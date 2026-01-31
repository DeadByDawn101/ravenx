import fs from "fs/promises";
import path from "path";

export async function readJson(filePath, fallback) {
  try {
    const t = await fs.readFile(filePath, "utf-8");
    return JSON.parse(t);
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, obj) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

export async function upsertRegistry({ registryPath, agentId, record }) {
  const reg = await readJson(registryPath, { agents: {} });
  reg.agents[agentId] = { ...(reg.agents[agentId] || {}), ...record, updatedAt: Date.now() };
  await writeJson(registryPath, reg);
  return reg.agents[agentId];
}

export async function setLease({ leasesPath, agentId, lease }) {
  const db = await readJson(leasesPath, { leases: {} });
  db.leases[agentId] = { ...lease, updatedAt: Date.now() };
  await writeJson(leasesPath, db);
  return db.leases[agentId];
}

export async function getLease({ leasesPath, agentId }) {
  const db = await readJson(leasesPath, { leases: {} });
  return db.leases[agentId] || null;
}

export async function listLeases({ leasesPath }) {
  const db = await readJson(leasesPath, { leases: {} });
  return db.leases || {};
}

export async function clearLease({ leasesPath, agentId }) {
  const db = await readJson(leasesPath, { leases: {} });
  delete db.leases[agentId];
  await writeJson(leasesPath, db);
}
