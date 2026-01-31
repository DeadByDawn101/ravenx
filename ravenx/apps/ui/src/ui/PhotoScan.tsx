import React, { useMemo, useState } from 'react';

type Mode = 'ocr'|'caption'|'classify'|'dedupe'|'skin';

export function PhotoScan() {
  const [mode, setMode] = useState<Mode>('skin');
  const [file, setFile] = useState<File|null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const token = useMemo(() => localStorage.getItem('ravenos.gatewayToken') || '', []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setResult(null);

    const dataUrl = await readAsDataURL(file);
    const { base64, mime } = splitDataURL(dataUrl);

    // Basic client-side size control: limit base64 size by downscaling if needed (TODO).
    const body = {
      tool: 'photo.scan',
      args: {
        mode,
        input: { image_base64: base64, mime },
        options: { max_side: 1600, return_blocks: mode === 'ocr', return_palette: mode === 'skin' }
      },
      sessionKey: 'sap:local',
      dryRun: false
    };

    const res = await fetch('/api/tools/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });

    const json = await res.json().catch(() => ({ ok:false, error:{ code:'BAD_JSON', message:'Invalid JSON response' }}));
    setResult(json);
    setBusy(false);
  }

  return (
    <div>
      <h2 style={{fontSize: 22, margin: '8px 0'}}>Photo Scanner</h2>
      <p style={{opacity:0.8}}>Uploads an image and calls <code>photo.scan</code> through the RavenOS API proxy. Implement the tool in OpenClaw to make this work end-to-end.</p>

      <div style={{display:'grid', gap: 10, border:'1px solid #222', borderRadius: 12, padding: 12, background:'#0f0f16'}}>
        <label style={{display:'grid', gap: 6}}>
          <span style={{opacity:0.8}}>Mode</span>
          <select value={mode} onChange={(e)=>setMode(e.target.value as Mode)} style={controlStyle}>
            <option value="skin">skin (palette + avatar hints)</option>
            <option value="ocr">ocr</option>
            <option value="caption">caption</option>
            <option value="classify">classify</option>
            <option value="dedupe">dedupe</option>
          </select>
        </label>

        <input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
        <div style={{display:'flex', gap: 8}}>
          <button onClick={run} disabled={!file || busy} style={btnStyle}>
            {busy ? 'Scanning…' : 'Run scan'}
          </button>
          <button onClick={()=>setResult(null)} style={btnStyle}>Clear</button>
        </div>

        <div>
          <div style={{opacity:0.8, marginBottom: 6}}>Result</div>
          <pre style={{whiteSpace:'pre-wrap', background:'#0b0b10', padding: 12, borderRadius: 12, border:'1px solid #222'}}>
{result ? JSON.stringify(result, null, 2) : 'No result yet.'}
          </pre>
        </div>
      </div>
    </div>
  );
}

const controlStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #333',
  background: '#0b0b10',
  color: '#eee'
};

const btnStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #333',
  background: '#111',
  color: '#eee',
  cursor: 'pointer'
};

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function splitDataURL(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!m) return { mime: 'application/octet-stream', base64: '' };
  return { mime: m[1], base64: m[2] };
}
