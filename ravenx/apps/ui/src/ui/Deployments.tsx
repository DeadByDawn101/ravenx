import React, { useEffect, useMemo, useState } from "react";

const API = (import.meta as any).env?.VITE_RAVENOS_API_URL || (window as any).__RAVENOS_API_URL__ || "/api";

type Deployment = {
  deploymentId: string;
  packId?: string | null;
  agentId?: string | null;
  createdAt: number;
  expiresAt: number;
  wipeAt: number;
  status: string;
};

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function fmt(t: number) {
  const d = new Date(t * 1000);
  return d.toLocaleString();
}

export default function Deployments() {
  const [deployments, setDeployments] = useState<Record<string, Deployment>>({});
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [ttl, setTtl] = useState<number>(3600);
  const [password, setPassword] = useState<string>("");
  const [packId, setPackId] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [wipeDelay, setWipeDelay] = useState<number>(600);

  // extend form
  const [extendDep, setExtendDep] = useState<string>("");
  const [extendPassword, setExtendPassword] = useState<string>("");
  const [extendSeconds, setExtendSeconds] = useState<number>(3600);

  async function refresh() {
    setErr(null);
    try {
      const data = await api("GET", "/api/factory/list");
      setDeployments(data.deployments || {});
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);

  const list = useMemo(() => Object.values(deployments).sort((a,b) => (b.createdAt - a.createdAt)), [deployments]);

  async function onCreate() {
    setErr(null);
    try {
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      await api("POST", "/api/factory/deploy", {
        packId: packId || null,
        agentId: agentId || null,
        ttlSeconds: ttl,
        password,
        wipeDelaySeconds: wipeDelay,
      });
      setPassword("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onExtend() {
    setErr(null);
    try {
      if (!extendDep) throw new Error("Pick a deployment.");
      const r = await api("POST", "/api/lease/extend/password", {
        deploymentId: extendDep,
        password: extendPassword,
        extendSeconds,
      });
      // apply immediately (lease-guard can also do this, but UI can apply too)
      await api("POST", "/api/lease/apply", { token: r.token });
      setExtendPassword("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onStop(depId: string, wipe: boolean) {
    setErr(null);
    try {
      await api("POST", "/api/factory/stop", { deploymentId: depId, wipe });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Agent Factory Deployments</h2>
        <p style={{ opacity: 0.85, marginTop: 4 }}>
          Phase 1: password unlock. Deployments lock at expiry, then auto-wipe after the delay.
        </p>

        {err ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(255,0,0,0.35)" }}>
            <b>Error:</b> {err}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)" }}>
            <h3 style={{ marginTop: 0 }}>Create deployment</h3>
            <label>Pack ID (optional)</label>
            <input value={packId} onChange={(e) => setPackId(e.target.value)} style={{ width: "100%" }} />
            <label style={{ marginTop: 8, display: "block" }}>Agent ID (optional)</label>
            <input value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ width: "100%" }} />

            <label style={{ marginTop: 8, display: "block" }}>TTL seconds</label>
            <input type="number" value={ttl} onChange={(e) => setTtl(Number(e.target.value))} style={{ width: "100%" }} />

            <label style={{ marginTop: 8, display: "block" }}>Wipe delay seconds (default 600)</label>
            <input type="number" value={wipeDelay} onChange={(e) => setWipeDelay(Number(e.target.value))} style={{ width: "100%" }} />

            <label style={{ marginTop: 8, display: "block" }}>Admin password (min 6 chars)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} />

            <button onClick={onCreate} style={{ marginTop: 12 }}>Deploy</button>
          </div>

          <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)" }}>
            <h3 style={{ marginTop: 0 }}>Extend deployment</h3>
            <label>Deployment</label>
            <select value={extendDep} onChange={(e) => setExtendDep(e.target.value)} style={{ width: "100%" }}>
              <option value="">Select…</option>
              {list.map((d) => (
                <option key={d.deploymentId} value={d.deploymentId}>
                  {d.deploymentId} ({d.status})
                </option>
              ))}
            </select>

            <label style={{ marginTop: 8, display: "block" }}>Extend seconds</label>
            <input type="number" value={extendSeconds} onChange={(e) => setExtendSeconds(Number(e.target.value))} style={{ width: "100%" }} />

            <label style={{ marginTop: 8, display: "block" }}>Password</label>
            <input type="password" value={extendPassword} onChange={(e) => setExtendPassword(e.target.value)} style={{ width: "100%" }} />

            <button onClick={onExtend} style={{ marginTop: 12 }}>Extend</button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={refresh}>Refresh</button>
        </div>
      </div>

      <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
        <h3 style={{ marginTop: 0 }}>Deployments</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {list.length === 0 ? <div style={{ opacity: 0.7 }}>No deployments yet.</div> : null}
          {list.map((d) => (
            <div key={d.deploymentId} style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <b>{d.deploymentId}</b> <span style={{ opacity: 0.7 }}>({d.status})</span>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>
                    expires: {fmt(d.expiresAt)} | wipe: {fmt(d.wipeAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onStop(d.deploymentId, false)}>Stop</button>
                  <button onClick={() => onStop(d.deploymentId, true)}>Stop + Wipe</button>
                </div>
              </div>
              <div style={{ opacity: 0.75, marginTop: 6 }}>
                packId: {d.packId || "—"} | agentId: {d.agentId || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
