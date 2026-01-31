import React, { useMemo, useReducer, useState } from "react";
import { initialContext, initialState, wizardReducer, type WizardEvent, type WizardPath } from "./wizardMachine";

export function Wizard(props: { onConnected: () => void; onFinish: () => void }) {
  const [{ state, ctx }, dispatch] = useReducer(wizardReducer, { state: initialState, ctx: initialContext() });

  // Local busy flags for async actions (kept out of reducer on purpose)
  const [busy, setBusy] = useState(false);
  const [allowHighRisk, setAllowHighRisk] = useState(false);


  const canContinue = useMemo(() => {
    if (state.name === "CONNECT_ENGINE") return Boolean(ctx.engine.gatewayUrl);
    if (state.name === "PATH_SELECT") return Boolean(ctx.chosenPath);
    if (state.name === "CREATE_AGENT") return Boolean(ctx.create.agentName);
    if (state.name === "IMPORT_AGENTPACK") return Boolean(ctx.import.fileName);
    if (state.name === "IMPORT_PREVIEW") return true;
    if (state.name === "SKIN_AGENT") return true;
    if (state.name === "WELCOME") return true;
    if (state.name === "FINISH") return true;
    return true;
  }, [state.name, ctx]);

  async function testConnection() {
    setBusy(true);
    dispatch({ type: "ENGINE_TEST_REQUEST" });

    const res = await fetch("/api/health", {
      headers: ctx.engine.gatewayToken ? { Authorization: `Bearer ${ctx.engine.gatewayToken}` } : {},
    }).catch(() => null);

    if (!res) {
      dispatch({ type: "ENGINE_TEST_FAIL", error: { code: "NO_RESPONSE", message: "Could not reach RavenOS API" } });
      setBusy(false);
      return;
    }

    const json = await res.json().catch(() => null);
    if (!json || json.ok !== true) {
      dispatch({ type: "ENGINE_TEST_FAIL", error: { code: "ENGINE_UNREACHABLE", message: "Engine not reachable. Check Gateway URL and Docker status.", details: json } });
      setBusy(false);
      return;
    }

    // Treat auth as OK if API says reachable. (API health already classifies auth enforced vs ok)
    const authOk = Boolean(json.authOk ?? true);
    dispatch({ type: "ENGINE_TEST_SUCCESS", reachable: true, authOk });
    props.onConnected();
    setBusy(false);
    alert(authOk ? "Connected to engine ✅" : "Gateway reachable, but auth may be required ⚠️");
  }

  async function analyzePack(file: File) {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/agentpacks/analyze", {
      method: "POST",
      headers: ctx.engine.gatewayToken ? { Authorization: `Bearer ${ctx.engine.gatewayToken}` } : {},
      body: form,
    }).catch(() => null);

    if (!res) {
      dispatch({ type: "IMPORT_ANALYZE_FAIL", error: { code: "NO_RESPONSE", message: "Could not reach API" } });
      setBusy(false);
      return;
    }
    const json = await res.json().catch(() => null);
    if (!json?.ok) {
      dispatch({ type: "IMPORT_ANALYZE_FAIL", error: { code: json?.error?.code || "ANALYZE_FAILED", message: json?.error?.message || "Analyze failed", details: json } });
      setBusy(false);
      return;
    }

    dispatch({ type: "IMPORT_ANALYZE_SUCCESS", analysis: json.analysis });
    setBusy(false);
  }

  async function installPack() {
    setBusy(true);
    const res = await fetch("/api/agentpacks/install", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ctx.engine.gatewayToken ? { Authorization: `Bearer ${ctx.engine.gatewayToken}` } : {}) },
      body: JSON.stringify({ installMode: "safe-defaults", allowHighRisk }),
    }).catch(() => null);

    if (!res) {
      dispatch({ type: "IMPORT_INSTALL_FAIL", error: { code: "NO_RESPONSE", message: "Could not reach API" } });
      setBusy(false);
      return;
    }
    const json = await res.json().catch(() => null);
    if (!json?.ok) {
      dispatch({ type: "IMPORT_INSTALL_FAIL", error: { code: json?.error?.code || "INSTALL_FAILED", message: json?.error?.message || "Install failed", details: json } });
      setBusy(false);
      return;
    }

    dispatch({ type: "IMPORT_INSTALL_SUCCESS", agentIds: json.agentIds || [] });
    setBusy(false);
  }

  function choosePath(path: WizardPath) {
    dispatch({ type: "SELECT_PATH", path });
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, margin: "12px 0" }}>RavenOS Setup</h1>
      <p style={{ opacity: 0.85 }}>Create a new agent, import an existing one, or skip and add later.</p>

      <div style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #222", borderRadius: 12, background: "#0f0f16" }}>
        {state.name !== "WELCOME" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>Step: {state.name}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => dispatch({ type: "BACK" })} style={btnStyle}>Back</button>
              {state.name !== "FINISH" && state.name !== "ERROR" && (
                <button onClick={() => dispatch({ type: "CONTINUE" })} disabled={!canContinue || busy} style={btnStyle}>
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        {state.name === "WELCOME" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Choose setup path</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ChoiceButton onClick={() => choosePath("create")} label="Create RavenOS agent" />
              <ChoiceButton onClick={() => choosePath("import")} label="Import agent pack" />
              <ChoiceButton onClick={() => choosePath("skip")} label="Skip for now" />
            </div>
          </div>
        )}

        {state.name === "CONNECT_ENGINE" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Connect Engine (OpenClaw Gateway)</div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ opacity: 0.8 }}>Gateway URL</span>
                <input
                  value={ctx.engine.gatewayUrl}
                  onChange={(e) => dispatch({ type: "ENGINE_CONFIG_UPDATE", gatewayUrl: e.target.value })}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ opacity: 0.8 }}>Gateway Token (stored locally)</span>
                <input
                  value={ctx.engine.gatewayToken}
                  onChange={(e) => dispatch({ type: "ENGINE_CONFIG_UPDATE", gatewayToken: e.target.value })}
                  style={inputStyle}
                />
              </label>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={testConnection} disabled={busy} style={btnStyle}>
                  {busy ? "Testing…" : "Test connection"}
                </button>
                <div style={{ opacity: 0.8 }}>
                  {ctx.engine.reachable === undefined ? "Not tested" : ctx.engine.reachable ? (ctx.engine.authOk ? "Connected ✅" : "Reachable ⚠️") : "Unreachable ❌"}
                </div>
              </div>
            </div>
          </div>
        )}

        {state.name === "PATH_SELECT" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Choose what to do next</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ChoiceButton active={ctx.chosenPath === "create"} onClick={() => dispatch({ type: "SELECT_PATH", path: "create" })} label="Create agent" />
              <ChoiceButton active={ctx.chosenPath === "import"} onClick={() => dispatch({ type: "SELECT_PATH", path: "import" })} label="Import pack" />
              <ChoiceButton active={ctx.chosenPath === "skip"} onClick={() => dispatch({ type: "SELECT_PATH", path: "skip" })} label="Skip" />
            </div>
            <p style={{ opacity: 0.8, marginTop: 10 }}>Click Continue to proceed.</p>
          </div>
        )}

        {state.name === "CREATE_AGENT" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Create agent (stub)</div>
            <p style={{ opacity: 0.8 }}>This starter does not yet write agents into the engine. Next step is to implement AgentPack install or a gateway agent-create endpoint.</p>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ opacity: 0.8 }}>Agent name</span>
                <input value={ctx.create.agentName} onChange={(e) => dispatch({ type: "CREATE_CONFIG_UPDATE", patch: { agentName: e.target.value } })} style={inputStyle} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ opacity: 0.8 }}>Policy preset</span>
                <select value={ctx.create.policyPreset} onChange={(e) => dispatch({ type: "CREATE_CONFIG_UPDATE", patch: { policyPreset: e.target.value as any } })} style={inputStyle}>
                  <option value="safe">safe</option>
                  <option value="standard">standard</option>
                  <option value="power">power</option>
                </select>
              </label>
              <button
                onClick={() => dispatch({ type: "CREATE_AGENT_SUCCESS", agentId: "raven" })}
                style={btnStyle}
              >
                Create (mock)
              </button>
            </div>
          </div>
        )}

        {state.name === "IMPORT_AGENTPACK" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Import agent pack</div>
            <input
              type="file"
              accept=".ravenos-agentpack,.zip,application/zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                dispatch({ type: "IMPORT_FILE_SELECTED", fileName: f.name, sizeBytes: f.size });
                analyzePack(f);
              }}
            />
            <div style={{ opacity: 0.8, marginTop: 8 }}>Selected: {ctx.import.fileName || "none"}</div>
            <p style={{ opacity: 0.8 }}>Once analyzed, you’ll see a preview before installing.</p>
          </div>
        )}

        {state.name === "IMPORT_PREVIEW" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Preview</div>
            <pre style={preStyle}>{JSON.stringify(ctx.import.analysis, null, 2)}</pre>
            <button onClick={installPack} disabled={busy} style={btnStyle}>
              {busy ? "Installing…" : "Install"}
            </button>
          </div>
        )}

        {state.name === "SKIN_AGENT" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Skin agent</div>
            <p style={{ opacity: 0.8 }}>You can upload an image to extract a palette and avatar suggestions (requires <code>photo.scan</code> tool in OpenClaw).</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => dispatch({ type: "SKIP_SKIN" })} style={btnStyle}>Skip</button>
              <button onClick={() => dispatch({ type: "SKIN_APPLY_SUCCESS", agentId: ctx.skin.agentId || "raven" })} style={btnStyle}>Apply (mock)</button>
            </div>
          </div>
        )}

        {state.name === "FINISH" && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Finish</div>
            <p style={{ opacity: 0.8 }}>RavenOS is ready. Continue to Marketplace.</p>
            <button onClick={props.onFinish} style={btnStyle}>Go to Marketplace</button>
          </div>
        )}

        {state.name === "ERROR" && (
          <div style={{ border: "1px solid #422", background: "#160b0b", padding: 12, borderRadius: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
            <div style={{ opacity: 0.9 }}>{state.error.code}: {state.error.message}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button onClick={() => dispatch({ type: "DISMISS_ERROR" })} style={btnStyle}>Dismiss</button>
              <button onClick={() => dispatch({ type: "BACK_TO_CONNECT" })} style={btnStyle}>Back to Engine</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceButton(props: { active?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        ...btnStyle,
        borderColor: props.active ? "#6b5cff" : "#333",
        background: props.active ? "#14122a" : "#111",
      }}
    >
      {props.label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "#0b0b10",
  color: "#eee",
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
  maxHeight: 240,
  overflow: "auto",
};
