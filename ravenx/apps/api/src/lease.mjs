import crypto from "crypto";
import { getDeployment, upsertDeployment, nowSec, markLockedIfExpired } from "./factory.mjs";

function secret() {
  return (
    process.env.RAVENX_EXTENSION_SECRET ||
    process.env.RAVENOS_EXTENSION_SECRET ||
    ""
  );
}

export function requireSecret() {
  const s = secret();
  if (!s || s.length < 16) {
    throw new Error("missing_extension_secret");
  }
  return s;
}

export function hashPassword(password) {
  // scrypt params: N=16384, r=8, p=1 (reasonable baseline)
  const salt = crypto.randomBytes(16);
  const keylen = 64;
  const N = 16384, r = 8, p = 1;
  const dk = crypto.scryptSync(password, salt, keylen, { N, r, p });
  return `scrypt:${salt.toString("base64")}:${dk.toString("base64")}:${N}:${r}:${p}:${keylen}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltB64, hashB64, N, r, p, keylen] = stored.split(":");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const key = crypto.scryptSync(password, salt, Number(keylen), { N: Number(N), r: Number(r), p: Number(p) });
    const expected = Buffer.from(hashB64, "base64");
    return crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function mintExtensionToken({ deploymentId, extendSeconds }) {
  const s = requireSecret();
  const issuedAt = nowSec();
  const tokenTtl = 120; // token valid for 2 minutes
  const payload = {
    deploymentId,
    extendSeconds: Number(extendSeconds),
    issuedAt,
    exp: issuedAt + tokenTtl,
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf-8");
  const sig = crypto.createHmac("sha256", s).update(payloadBytes).digest();
  return `${b64url(payloadBytes)}.${b64url(sig)}`;
}

export function verifyExtensionToken(token) {
  const s = requireSecret();
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, reason: "bad_format" };
  const payloadBytes = fromB64url(parts[0]);
  const sigBytes = fromB64url(parts[1]);

  const expected = crypto.createHmac("sha256", s).update(payloadBytes).digest();
  if (expected.length !== sigBytes.length || !crypto.timingSafeEqual(expected, sigBytes)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString("utf-8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  const t = nowSec();
  if (t > payload.exp) return { ok: false, reason: "expired_token" };
  if (!payload.deploymentId || !Number.isFinite(payload.extendSeconds)) {
    return { ok: false, reason: "invalid_fields" };
  }
  return { ok: true, payload };
}

export async function extendWithPassword({ deploymentId, password, extendSeconds }) {
  const rec0 = await markLockedIfExpired(deploymentId);
  if (!rec0) throw new Error("deployment_not_found");

  const rec = await getDeployment(deploymentId);
  const policy = rec?.unlockPolicy;
  if (!policy || policy.mode !== "password" || !policy.passwordHash) {
    throw new Error("unlock_policy_not_configured");
  }

  const ok = verifyPassword(password, policy.passwordHash);
  if (!ok) throw new Error("invalid_password");

  const req = Math.max(60, Number(extendSeconds || 0));
  const cap = Math.max(60, Number(policy.maxExtendSeconds || 86400));
  const approvedSeconds = Math.min(req, cap);

  const token = mintExtensionToken({ deploymentId, extendSeconds: approvedSeconds });
  return { token, approvedSeconds };
}

export async function applyExtensionToken({ token }) {
  const v = verifyExtensionToken(token);
  if (!v.ok) throw new Error(v.reason);

  const { deploymentId, extendSeconds } = v.payload;
  const rec = await getDeployment(deploymentId);
  if (!rec) throw new Error("deployment_not_found");

  // if already wiped/stopped, refuse
  if (["STOPPED"].includes(rec.status)) throw new Error("deployment_stopped");

  const t = nowSec();
  const newExpiresAt = Math.max(rec.expiresAt, t) + Number(extendSeconds);
  const wipeDelaySeconds = Number(rec.unlockPolicy?.wipeDelaySeconds ?? 600);
  const newWipeAt = newExpiresAt + Math.max(0, wipeDelaySeconds);

  const out = await upsertDeployment(deploymentId, {
    expiresAt: newExpiresAt,
    wipeAt: newWipeAt,
    status: "ACTIVE",
    lockedAt: null,
  });

  return out;
}
