import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = Number(process.env.PORT || 8080);
const API_URL = (process.env.RAVENOS_API_URL || 'http://api:8787').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

async function proxy(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const target = `${API_URL}${url.pathname.replace(/^\/api/, '')}${url.search}`;

  const headers = { ...req.headers };
  delete headers.host;

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  try {
    const r = await fetch(target, {
      method: req.method,
      headers,
      body: body,
    });

    const out = Buffer.from(await r.arrayBuffer());
    const outHeaders = {};
    r.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'transfer-encoding') return;
      outHeaders[k] = v;
    });
    // Allow the browser UI to call same-origin, we proxy so CORS isn't required.
    send(res, r.status, outHeaders, out);
  } catch (e) {
    send(res, 502, { 'content-type': 'application/json; charset=utf-8' },
      JSON.stringify({ ok: false, error: { code: 'API_UNREACHABLE', message: String(e?.message || e) } }));
  }
}

function safePath(p) {
  const rel = p.replace(/^\/+/, '');
  const resolved = path.resolve(DIST_DIR, rel);
  if (!resolved.startsWith(DIST_DIR)) return null;
  return resolved;
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;
  if (pathname === '/') pathname = '/index.html';

  // SPA fallback: if file doesn't exist, return index.html
  const candidate = safePath(pathname);
  const filePath = (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    ? candidate
    : path.resolve(DIST_DIR, 'index.html');

  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    send(res, 200, { 'content-type': mime }, data);
  } catch {
    send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
  }
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return proxy(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`RavenOS UI listening on :${PORT}`);
  console.log(`Proxying /api/* -> ${API_URL}`);
});
