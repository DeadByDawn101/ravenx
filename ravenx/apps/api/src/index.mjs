import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import AdmZip from "adm-zip";
import { scanPack } from "./vulnscan.mjs";
import { detectLegacyLayout, convertLegacyToManifest } from "./legacy.mjs";
import { extractZipFiltered, safeIdFromManifest, sha256Hex, getOpenClawTargetsFromEnv, applyInstallToTargets } from "./installer.mjs";
import fs from "fs/promises";
import path from "path";
import { createDeployment, listDeployments, stopDeployment, markLockedIfExpired } from "./factory.mjs";
import { hashPassword, extendWithPassword, applyExtensionToken } from "./lease.mjs";

const app = express();

// JSON for non-upload endpoints
app.use(express.json({ limit: "6mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const PORT = Number(process.env.PORT || 8787);
const GATEWAY_URL = process.env.RAVENOS_GATEWAY_URL || "http://localhost:18789";
const GATEWAY_TOKEN = process.env.RAVENOS_GATEWAY_TOKEN || "";
const MODE = process.env.RAVENOS_MODE || "studio";

// Simple in-memory cache for the most recently analyzed pack (MVP).
const reports = new Map();
const zipBuffers = new Map(); // reportId -> Buffer


let lastPack = {
  analyzedAt: 0,
  manifest: null,
  agentIds: [],
};

function getAuth(req) {
  // Prefer env token (server-managed). If not set, allow pass-through from UI header.
  const header = req.headers["authorization"];
  if (GATEWAY_TOKEN) return `Bearer ${GATEWAY_TOKEN}`;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) return header;
  return "";
}

async function probeGateway(authHeader) {
  const base = GATEWAY_URL.replace(/\/$/, "");
  const candidates = [`${base}/health`, `${base}/status`, `${base}/`];

  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: authHeader ? { Authorization: authHeader } : {} });
      // If auth enforced, we still consider it "reachable"
      if (r.status === 401 || r.status === 403) return { reachable: true, authOk: false, status: r.status, url };
      if (r.ok) return { reachable: true, authOk: true, status: r.status, url };
    } catch {
      // try next
    }
  }
  return { reachable: false, authOk: false, status: 0, url: candidates[candidates.length - 1] };
}

app.get("/health", async (req, res) => {
  try {
    const auth = getAuth(req);
    const probe = await probeGateway(auth);
    res.json({
      ok: probe.reachable,
      reachable: probe.reachable,
      authOk: probe.authOk,
      status: probe.status,
      mode: MODE,
      gateway: GATEWAY_URL,
      probed: probe.url,
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: { code: "GATEWAY_UNREACHABLE", message: String(e?.message || e) } });
  }
});

app.post("/tools/invoke", async (req, res) => {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ ok: false, error: { code: "NO_AUTH", message: "Missing gateway token" } });

  const url = `${GATEWAY_URL.replace(/\/$/, "")}/tools/invoke`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(req.body),
    });

    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (e) {
    res.status(502).json({ ok: false, error: { code: "INVOKE_FAILED", message: String(e?.message || e) } });
  }
});

/**
 * AgentPack endpoints (MVP)
 * - analyze: parses manifest.json inside the zip and returns permissions + contents summary
 * - install: stub that returns agentIds derived from manifest; later this will install into OpenClaw.
 */
app.post("/agentpacks/analyze", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: { code: "NO_FILE", message: "Missing file upload" } });

    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries().map((e) => e.entryName);

    // 1) Load manifest.json if present; otherwise attempt legacy detection + conversion.
    const manifestEntry = zip.getEntry("manifest.json");
    let manifest = null;
    let compatibility = { isLegacy: false, converted: false, legacyKind: null };

    if (manifestEntry) {
      try {
        manifest = JSON.parse(manifestEntry.getData().toString("utf-8"));
      } catch {
        return res.status(400).json({ ok: false, error: { code: "BAD_MANIFEST", message: "manifest.json is not valid JSON" } });
      }
    } else {
      const legacy = detectLegacyLayout(entries);
      if (!legacy) {
        return res.status(400).json({
          ok: false,
          error: {
            code: "MISSING_MANIFEST",
            message: "manifest.json not found at pack root and no known legacy layout detected",
          },
        });
      }
      // Collect common legacy paths
      const agentPaths = entries.filter((p) => /(^|\/)agent\.json$/i.test(p));
      const skillPaths = entries.filter((p) => /^skills\/.+\.md$/i.test(p));
      const toolPaths = entries.filter((p) => /openclaw\.plugin\.json$/i.test(p));
      manifest = convertLegacyToManifest({ entries, agentPaths, skillPaths, toolPaths });
      compatibility = { isLegacy: true, converted: true, legacyKind: legacy.kind };
    }

    // 2) Normalize contents / permissions / trust
    const contents = manifest.contents || { agents: [], skills: [], tools: [], ui: [] };
    const permissions = manifest.permissions || {};
    const trust = manifest.signature ? "verified" : (compatibility.isLegacy ? "local" : "community");

    // 3) Derive agent ids best-effort from paths
    const agentIds = Array.isArray(contents.agents)
      ? contents.agents.map((p) => String(p).split("/").slice(-2, -1)[0]).filter(Boolean)
      : [];

    // 4) Prepare text files for vuln scan (lightweight; do not OCR, do not execute)
    const files = [];
    for (const e of zip.getEntries()) {
      const p = e.entryName;
      const lower = p.toLowerCase();
      if (!/(\.md|\.json|\.js|\.mjs|\.ts|\.yaml|\.yml|\.txt)$/.test(lower)) continue;
      // avoid huge files
      const data = e.getData();
      if (data.length > 512 * 1024) continue;
      try {
        files.push({ path: p, text: data.toString("utf-8") });
      } catch {
        // ignore decode errors
      }
    }

    const security = scanPack({ manifest, files });

    // Cache last analyzed pack (MVP)
    const packHash = sha256Hex(file.buffer);
    const reportId = packHash.slice(0, 16);
    const report = { id: reportId, packHash, analyzedAt: Date.now(), manifest, agentIds, security, trust, permissions, contents, compatibility };
    reports.set(reportId, report);
    zipBuffers.set(reportId, file.buffer);
    lastPack = report;

    return res.json({
      ok: true,
      analysis: {
        manifest,
        contents: {
          agents: Array.isArray(contents.agents) ? contents.agents : [],
          skills: Array.isArray(contents.skills) ? contents.skills : [],
          tools: Array.isArray(contents.tools) ? contents.tools : [],
          ui: Array.isArray(contents.ui) ? contents.ui : [],
        },
        permissions,
        trust,
        compatibility,
        security,
        reportId,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: "ANALYZE_FAILED", message: String(e?.message || e) } });
  }
});
app.post("/agentpacks/install", async (req, res) => {
  try {
    if (!lastPack?.manifest) {
      return res.status(400).json({ ok: false, error: { code: "NO_ANALYZED_PACK", message: "Analyze a pack first" } });
    }

    const allowHighRisk = Boolean(req.body?.allowHighRisk);
    const allowOverwrite = Boolean(req.body?.allowOverwrite);
    const risk = lastPack.security?.risk || "unknown";

    if ((risk === "high" || risk === "critical") && !allowHighRisk) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "RISK_BLOCKED",
          message: `Pack risk is ${risk}. Review findings and explicitly allow installation.`,
          details: { risk, security: lastPack.security, reportId: lastPack.id },
        },
      });
    }

    // Staging extraction: requires the original zip buffer. For MVP, we re-use the last uploaded buffer via analyze.
    // We store the original zip buffer in zipBuffers map (not included in reports).
    const zipBuffer = zipBuffers.get(lastPack.id);
    if (!zipBuffer) {
      return res.status(400).json({ ok: false, error: { code: "NO_ZIP_BUFFER", message: "Re-upload pack: buffer not available" } });
    }

    const targets = getOpenClawTargetsFromEnv();
    await fs.mkdir(targets.packsDir, { recursive: true });
    await fs.mkdir(targets.reportsDir, { recursive: true });

    const packId = safeIdFromManifest(lastPack.manifest);
    const stagingRoot = path.join(targets.packsDir, `${packId}-${lastPack.id}`);

    // Extract everything into staging (safe)
    const zip = new AdmZip(zipBuffer);
    const extracted = await extractZipFiltered(zip, stagingRoot, () => true);

    // Apply to OpenClaw targets if configured
    const applied = await applyInstallToTargets({
      stagingRoot,
      manifest: lastPack.manifest,
      extractedPaths: extracted,
      allowOverwrite,
    });

    // Persist report to disk for audit trails
    const reportPath = path.join(targets.reportsDir, `${lastPack.id}.json`);
    await fs.writeFile(reportPath, JSON.stringify(lastPack, null, 2), "utf-8");

    // Return install result
    const agentIds = lastPack.agentIds.length ? lastPack.agentIds : ["raven"];

    return res.json({
      ok: true,
      agentIds,
      risk,
      security: lastPack.security,
      reportId: lastPack.id,
      stagedAt: stagingRoot,
      applied,
      reportPath,
      notes: [
        "If OpenClaw target dirs were not configured, pack is staged only.",
        "Configure env vars RAVENOS_OPENCLAW_AGENTS_DIR / SKILLS_DIR / PLUGINS_DIR to enable direct install.",
      ],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: { code: "INSTALL_FAILED", message: String(e?.message || e) } });
  }
});
app.get("/agentpacks/report/:id", async (req, res) => {
  const r = reports.get(req.params.id);
  if (!r) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Report not found" } });
  return res.json({ ok: true, report: r });
});

/**
 * Agent Factory + Leases (Phase 1: password-only unlock)
 */
app.post("/api/factory/deploy", async (req, res) => {
  try {
    const { packId, agentId, ttlSeconds, password, maxExtendSeconds, wipeDelaySeconds, wipeOnExpire } = req.body || {};
    if (!password || String(password).length < 6) return res.status(400).json({ error: "password_required_min6" });

    const passwordHash = hashPassword(String(password));
    const dep = await createDeployment({
      packId,
      agentId,
      ttlSeconds: Number(ttlSeconds || 3600),
      unlockPolicy: {
        passwordHash,
        maxExtendSeconds: Number(maxExtendSeconds || 86400),
        wipeDelaySeconds: Number(wipeDelaySeconds || 600),
        wipeOnExpire: wipeOnExpire !== false,
      },
    });
    res.json({ ok: true, deployment: dep });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/factory/list", async (_req, res) => {
  try {
    const deployments = await listDeployments();
    res.json({ ok: true, deployments });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/factory/lock", async (req, res) => {
  try {
    const { deploymentId } = req.body || {};
    if (!deploymentId) return res.status(400).json({ error: "deploymentId_required" });
    const dep = await markLockedIfExpired(deploymentId);
    res.json({ ok: true, deployment: dep });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/factory/stop", async (req, res) => {
  try {
    const { deploymentId, wipe } = req.body || {};
    if (!deploymentId) return res.status(400).json({ error: "deploymentId_required" });
    const dep = await stopDeployment({ deploymentId, wipe: Boolean(wipe) });
    res.json({ ok: true, deployment: dep });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/lease/extend/password", async (req, res) => {
  try {
    const { deploymentId, password, extendSeconds } = req.body || {};
    if (!deploymentId) return res.status(400).json({ error: "deploymentId_required" });
    if (!password) return res.status(400).json({ error: "password_required" });
    const { token, approvedSeconds } = await extendWithPassword({ deploymentId, password, extendSeconds: Number(extendSeconds || 0) });
    res.json({ ok: true, token, approvedSeconds });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/lease/apply", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: "token_required" });
    const dep = await applyExtensionToken({ token });
    res.json({ ok: true, deployment: dep });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`RavenOS API listening on :${PORT}`);
});