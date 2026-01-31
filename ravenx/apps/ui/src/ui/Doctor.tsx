import React, { useEffect, useState } from "react";

type DoctorResult = {
  id: string;
  ok: boolean;
  details?: any;
  fix?: string | null;
};

export function Doctor() {
  const [busy, setBusy] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState("http://localhost:18789");
  const [results, setResults] = useState<DoctorResult[]>([]);
  const [err, setErr] = useState<string>("");

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/doctor/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayUrl }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setErr(json?.error?.message || "Doctor failed");
        setBusy(false);
        return;
      }
      setResults(json.report?.results || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { run(); }, []);

  return (
    <div>
      <h2 style={{ fontSize: 22, margin: "8px 0" }}>RavenOS Doctor</h2>
      <p style={{ opacity: 0.8 }}>
        Diagnostics + fix suggestions. This checks RavenOS storage, ports, and OpenClaw gateway reachability.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ opacity: 0.8 }}>Gateway URL</span>
          <input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} style={inputStyle} />
        </label>
        <button onClick={run} disabled={busy} style={btnStyle}>{busy ? "Running…" : "Run Doctor"}</button>
      </div>

      {err && (
        <div style={{ border: "1px solid #331a1a", background: "#140b0b", padding: 10, borderRadius: 12, marginBottom: 12 }}>
          <b style={{ color: "#ffb3b3" }}>Error:</b> <span style={{ opacity: 0.9 }}>{err}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {results.map((r) => (
          <div key={r.id} style={{ border: "1px solid #222", borderRadius: 12, padding: 12, background: "#0b0b10" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 800 }}>{r.id}</div>
              <div style={{ marginLeft: "auto", opacity: 0.9 }}>
                {r.ok ? <span style={{ color: "#9cffb3" }}>OK</span> : <span style={{ color: "#ffb3b3" }}>FAIL</span>}
              </div>
            </div>

            {r.fix && !r.ok && (
              <div style={{ marginTop: 8, opacity: 0.9 }}>
                <b>Fix:</b> {r.fix}
              </div>
            )}

            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", opacity: 0.85 }}>Details</summary>
              <pre style={preStyle}>{JSON.stringify(r.details || {}, null, 2)}</pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#0b0b10",
  color: "#eee",
  minWidth: 340,
};

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#111",
  color: "#eee",
  cursor: "pointer",
};

const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  background: "#0b0b10",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #222",
  overflowX: "auto",
};
