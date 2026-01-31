import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

/**
 * Secure extraction with ZipSlip protection.
 */
export async function extractZipFiltered(zip, destRoot, filter = () => true) {
  await fs.mkdir(destRoot, { recursive: true });

  const extracted = [];
  for (const entry of zip.getEntries()) {
    const name = entry.entryName;
    if (entry.isDirectory) continue;
    if (!filter(name)) continue;

    const normalized = name.replace(/\\/g, "/");
    const targetPath = path.resolve(destRoot, normalized);
    if (!targetPath.startsWith(path.resolve(destRoot) + path.sep)) {
      throw new Error(`ZipSlip blocked: ${name}`);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, entry.getData());
    extracted.push(normalized);
  }
  return extracted;
}

export function safeIdFromManifest(manifest) {
  const base = `${manifest?.name || "pack"}@${manifest?.version || "0.0.0"}`;
  return base.toLowerCase().replace(/[^a-z0-9._@-]+/g, "-").slice(0, 64);
}

export function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function getOpenClawTargetsFromEnv() {
  return {
    agentsDir: process.env.RAVENOS_OPENCLAW_AGENTS_DIR || "",
    skillsDir: process.env.RAVENOS_OPENCLAW_SKILLS_DIR || "",
    pluginsDir: process.env.RAVENOS_OPENCLAW_PLUGINS_DIR || "",
    packsDir: process.env.RAVENOS_PACKS_DIR || "/var/lib/ravenos/packs",
    reportsDir: process.env.RAVENOS_REPORTS_DIR || "/var/lib/ravenos/reports",
  };
}

/**
 * Copy selected files from staging into OpenClaw targets based on manifest contents.
 * If targets are not configured (env empty), we still stage the pack.
 */
export async function applyInstallToTargets({ stagingRoot, manifest, extractedPaths, allowOverwrite=false }) {
  const { agentsDir, skillsDir, pluginsDir } = getOpenClawTargetsFromEnv();
  const copied = { agents: [], skills: [], tools: [] };

  const contents = manifest.contents || { agents: [], skills: [], tools: [], ui: [] };
  const present = new Set(extractedPaths);

  async function copyRel(relPath, destBase, bucket) {
    if (!destBase) return;
    const src = path.resolve(stagingRoot, relPath);
    const dest = path.resolve(destBase, relPath);

    if (!dest.startsWith(path.resolve(destBase) + path.sep)) {
      throw new Error(`Target path escape blocked: ${relPath}`);
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });

    if (!allowOverwrite) {
      try { await fs.access(dest); return; } catch {}
    }

    const data = await fs.readFile(src);
    await fs.writeFile(dest, data);
    copied[bucket].push(relPath);
  }

  const select = (arr) => (Array.isArray(arr) ? arr.filter((p) => present.has(p)) : []);

  for (const p of select(contents.agents)) await copyRel(p, agentsDir, "agents");
  for (const p of select(contents.skills)) await copyRel(p, skillsDir, "skills");
  for (const p of select(contents.tools)) await copyRel(p, pluginsDir, "tools");

  return { copied, targets: { agentsDir, skillsDir, pluginsDir } };
}
