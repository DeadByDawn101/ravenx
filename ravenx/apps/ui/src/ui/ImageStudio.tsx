import React, { useMemo, useState } from "react";

export function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [neg, setNeg] = useState("");
  const [size, setSize] = useState<"512x512"|"768x768"|"1024x1024">("1024x1024");
  const [steps, setSteps] = useState<number>(8);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<{ mime: string; b64: string } | null>(null);
  const [err, setErr] = useState<string>("");

  // Server-side token only (RAVENOS_HF_TOKEN). UI never stores HF token.
  const model = useMemo(() => "Tongyi-MAI/Z-Image", []);

  async function generate() {
    setBusy(true);
    setErr("");
    setImg(null);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt: neg || undefined,
          model,
          size,
          steps
        })
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setErr(json?.error?.message || "Failed to generate image");
        setBusy(false);
        return;
      }
      const first = json.images?.[0];
      if (!first?.data_base64) {
        setErr("No image data returned");
        setBusy(false);
        return;
      }
      setImg({ mime: first.mime || "image/png", b64: first.data_base64 });
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const src = img ? `data:${img.mime};base64,${img.b64}` : "";

  return (
    <div>
      <h2 style={{ fontSize: 22, margin: "8px 0" }}>Image Studio</h2>
      <p style={{ opacity: 0.8 }}>
        Stable text-to-image generation via the Hugging Face Inference API (server-side token).
      </p>

      <div style={{ display: "grid", gap: 10, border: "1px solid #222", borderRadius: 12, padding: 12, background: "#0f0f16" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ opacity: 0.8 }}>Prompt</span>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={inputStyle} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ opacity: 0.8 }}>Negative prompt (optional)</span>
          <input value={neg} onChange={(e) => setNeg(e.target.value)} style={inputStyle} />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>Size</span>
            <select value={size} onChange={(e) => setSize(e.target.value as any)} style={inputStyle}>
              <option value="512x512">512x512</option>
              <option value="768x768">768x768</option>
              <option value="1024x1024">1024x1024</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>Steps</span>
            <input type="number" value={steps} min={1} max={80} onChange={(e) => setSteps(Number(e.target.value))} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>Model</span>
            <input value={model} readOnly style={{ ...inputStyle, opacity: 0.85 }} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={generate} disabled={busy || !prompt.trim()} style={btnStyle}>
            {busy ? "Generating…" : "Generate"}
          </button>
          <button onClick={() => { setImg(null); setErr(""); }} style={btnStyle}>Clear</button>
        </div>

        {err && (
          <div style={{ border: "1px solid #331a1a", background: "#140b0b", padding: 10, borderRadius: 12 }}>
            <b style={{ color: "#ffb3b3" }}>Error:</b> <span style={{ opacity: 0.9 }}>{err}</span>
          </div>
        )}

        {img && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.8 }}>Preview</div>
            <img src={src} alt="generated" style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #222" }} />
            <details>
              <summary style={{ cursor: "pointer", opacity: 0.85 }}>Base64 (for export)</summary>
              <pre style={preStyle}>{img.b64.slice(0, 1200)}{img.b64.length > 1200 ? "\n…(truncated)…" : ""}</pre>
            </details>
          </div>
        )}
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
