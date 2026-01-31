import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { readJson, writeJson } from "./registry.mjs";

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function deploymentsPath() {
  // Keep RavenOS naming for backwards compatibility
  return process.env.RAVENOS_DEPLOYMENTS_PATH || "/var/lib/ravenos/deployments.json";
}

export function workspacesDir() {
  return process.env.RAVENOS_WORKSPACES_DIR || "/var/lib/ravenos/workspaces";
}

export function makeId(prefix = "dep") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export async function listDeployments() {
  const db = await readJson(deploymentsPath(), { deployments: {} });
  return db.deployments || {};
}

export async function getDeployment(deploymentId) {
  const db = await readJson(deploymentsPath(), { deployments: {} });
  return db.deployments[deploymentId] || null;
}

export async function upsertDeployment(deploymentId, patch) {
  const db = await readJson(deploymentsPath(), { deployments: {} });
  const cur = db.deployments[deploymentId] || null;
  if (!cur) throw new Error("deployment_not_found");
  db.deployments[deploymentId] = { ...cur, ...patch, updatedAt: Date.now() };
  await writeJson(deploymentsPath(), db);
  return db.deployments[deploymentId];
}

export async function createDeployment({ packId, agentId, ttlSeconds, unlockPolicy }) {
  const db = await readJson(deploymentsPath(), { deployments: {} });

  const deploymentId = makeId("dep");
  const createdAt = nowSec();
  const expiresAt = createdAt + Math.max(60, Number(ttlSeconds || 3600)); // min 60s
  const wipeDelaySeconds = Number(unlockPolicy?.wipeDelaySeconds ?? 600); // default 10 min
  const wipeAt = expiresAt + Math.max(0, wipeDelaySeconds);

  const rec = {
    deploymentId,
    packId: packId || null,
    agentId: agentId || null,
    createdAt,
    expiresAt,
    lockedAt: null,
    wipeAt,
    status: "ACTIVE", // ACTIVE | LOCKED | WIPING | STOPPED
    unlockPolicy: {
      mode: "password",
      passwordHash: unlockPolicy.passwordHash,
      wipeDelaySeconds,
      maxExtendSeconds: Number(unlockPolicy?.maxExtendSeconds ?? 86400),
      wipeOnExpire: unlockPolicy?.wipeOnExpire !== false,
    },
    updatedAt: Date.now(),
  };

  db.deployments[deploymentId] = rec;
  await writeJson(deploymentsPath(), db);

  // Ensure a workspace folder exists for this deployment (used for artifacts / wipe)
  const wsDir = path.join(workspacesDir(), deploymentId);
  await fs.mkdir(wsDir, { recursive: true });

  return rec;
}

export async function markLockedIfExpired(deploymentId) {
  const rec = await getDeployment(deploymentId);
  if (!rec) return null;
  const t = nowSec();
  if (rec.status === "ACTIVE" && t >= rec.expiresAt) {
    return await upsertDeployment(deploymentId, { status: "LOCKED", lockedAt: t });
  }
  return rec;
}

export async function wipeDeploymentWorkspace(deploymentId) {
  const wsDir = path.join(workspacesDir(), deploymentId);
  // Delete contents but keep parent dir (safer with volume)
  try {
    const items = await fs.readdir(wsDir);
    await Promise.all(items.map(async (name) => {
      const p = path.join(wsDir, name);
      await fs.rm(p, { recursive: true, force: true });
    }));
  } catch {
    // ignore missing
  }
}

export async function stopDeployment({ deploymentId, wipe }) {
  const rec = await getDeployment(deploymentId);
  if (!rec) throw new Error("deployment_not_found");

  if (wipe) {
    await upsertDeployment(deploymentId, { status: "WIPING" });
    await wipeDeploymentWorkspace(deploymentId);
  }

  const out = await upsertDeployment(deploymentId, { status: "STOPPED" });
  return out;
}
