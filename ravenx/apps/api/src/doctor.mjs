import fs from "fs/promises";
import net from "net";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function canWriteDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    const test = `${dir}/.__ravenos_write_test__`;
    await fs.writeFile(test, "ok", "utf-8");
    await fs.unlink(test);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function isTcpListening(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      try { socket.destroy(); } catch {}
      resolve({ ok });
    };
    socket.setTimeout(1000, () => done(false));
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
  });
}

async function checkBinary(bin) {
  try {
    const { stdout } = await execFileAsync("which", [bin], { timeout: 1500 });
    return { ok: Boolean(stdout.trim()), path: stdout.trim() };
  } catch {
    return { ok: false };
  }
}

export async function runDoctor({ packsDir, reportsDir, gatewayUrl }) {
  const results = [];

  results.push({
    id: "env.node",
    ok: true,
    details: { version: process.version, platform: process.platform, arch: process.arch },
    fix: null,
  });

  const docker = await checkBinary("docker");
  results.push({
    id: "deps.docker",
    ok: docker.ok,
    details: docker,
    fix: docker.ok ? null : "Install Docker Desktop and ensure it is running.",
  });

  // When RavenOS is running, these should be LISTENING.
  const apiListen = await isTcpListening("127.0.0.1", 8787);
  results.push({
    id: "ports.api_listening_8787",
    ok: apiListen.ok,
    details: apiListen,
    fix: apiListen.ok ? null : "API is not listening on 8787. Check container logs and compose ports.",
  });

  // UI container may not be reachable from API container via localhost; this is a best-effort check.
  const uiListen = await isTcpListening("127.0.0.1", 8080);
  results.push({
    id: "ports.ui_listening_8080",
    ok: uiListen.ok,
    details: uiListen,
    fix: uiListen.ok ? null : "UI is not listening on 8080 from this environment. If running Docker, check the UI service.",
  });

  const packs = await canWriteDir(packsDir);
  results.push({
    id: "fs.packs_writable",
    ok: packs.ok,
    details: { dir: packsDir, ...packs },
    fix: packs.ok ? null : "Ensure the packs directory is writable (check Docker volume mounts / permissions).",
  });

  const reports = await canWriteDir(reportsDir);
  results.push({
    id: "fs.reports_writable",
    ok: reports.ok,
    details: { dir: reportsDir, ...reports },
    fix: reports.ok ? null : "Ensure the reports directory is writable (check Docker volume mounts / permissions).",
  });

  if (gatewayUrl) {
    try {
      const r = await fetch(`${gatewayUrl.replace(/\/$/, "")}/health`).catch(() => null);
      const ok = Boolean(r && (r.status === 200 || r.status === 401 || r.status === 403));
      results.push({
        id: "engine.gateway_reachable",
        ok,
        details: { gatewayUrl, status: r?.status || null },
        fix: ok ? null : "Gateway not reachable. Verify OpenClaw is running and the URL is correct.",
      });
    } catch (e) {
      results.push({
        id: "engine.gateway_reachable",
        ok: false,
        details: { gatewayUrl, error: String(e?.message || e) },
        fix: "Gateway not reachable. Verify OpenClaw is running and the URL is correct.",
      });
    }
  } else {
    results.push({
      id: "engine.gateway_reachable",
      ok: false,
      details: { gatewayUrl: null },
      fix: "Set RAVENOS_GATEWAY_URL or configure gateway in the UI, then re-run Doctor.",
    });
  }

  const okAll = results.every((x) => x.ok);
  return { ok: okAll, results };
}
