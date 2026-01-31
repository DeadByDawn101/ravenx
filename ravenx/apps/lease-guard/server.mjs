/**
 * lease-guard: watches deployments and enforces:
 * - lock on expiry
 * - wipe after delay
 * - stop after wipe
 *
 * It does NOT need passwords; it consumes server-minted decisions via RavenX API.
 */
const API = process.env.RAVENX_API_URL || process.env.RAVENOS_API_URL || "http://api:8787";
const POLL = Math.max(5, Number(process.env.POLL_INTERVAL_SECONDS || 20));

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function j(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function tick() {
  const list = await j("GET", "/api/factory/list");
  const deployments = Object.values(list.deployments || {});
  const now = Math.floor(Date.now()/1000);

  for (const d of deployments) {
    if (!d || !d.deploymentId) continue;

    // Ask API to mark locked if expired (idempotent)
    if (d.status === "ACTIVE" && now >= d.expiresAt) {
      try { await j("POST", "/api/factory/lock", { deploymentId: d.deploymentId }); } catch {}
    }

    // Wipe & stop if wipeAt reached and policy allows wipe
    const wipeOnExpire = d.unlockPolicy?.wipeOnExpire !== false;
    if (wipeOnExpire && ["LOCKED","ACTIVE"].includes(d.status) && now >= d.wipeAt) {
      try {
        await j("POST", "/api/factory/stop", { deploymentId: d.deploymentId, wipe: true });
      } catch {}
    }
  }
}

async function main() {
  console.log(`lease-guard starting. API=${API} poll=${POLL}s`);
  while (true) {
    try {
      await tick();
    } catch (e) {
      console.error("tick error:", e?.message || e);
    }
    await sleep(POLL * 1000);
  }
}

main();
