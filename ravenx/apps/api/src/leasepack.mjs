import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * LeasePack format:
 * - lease.json
 * - payload.enc (AES-256-GCM)
 * - signature.sig (optional Ed25519 signature over canonical lease + payload hash)
 *
 * MVP KDF: scrypt. (Argon2id can replace later.)
 */

export function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function canonicalJson(obj) {
  // Minimal canonicalization for signing: stable key ordering.
  // (Enough for MVP; can adopt JCS later.)
  const stable = (x) => {
    if (Array.isArray(x)) return x.map(stable);
    if (x && typeof x === "object") {
      return Object.keys(x).sort().reduce((acc, k) => (acc[k] = stable(x[k]), acc), {});
    }
    return x;
  };
  return JSON.stringify(stable(obj));
}

export function deriveKey(passphrase, saltB64) {
  const salt = Buffer.from(saltB64, "base64");
  return crypto.scryptSync(passphrase, salt, 32); // 32 bytes => AES-256
}

export function decryptPayload({ encBytes, passphrase, kdf, aead }) {
  // enc format: { saltB64, ivB64, tagB64, ciphertextB64 } JSON
  const meta = JSON.parse(encBytes.toString("utf-8"));
  const key = deriveKey(passphrase, meta.saltB64);
  const iv = Buffer.from(meta.ivB64, "base64");
  const tag = Buffer.from(meta.tagB64, "base64");
  const ciphertext = Buffer.from(meta.ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain; // raw AgentPack zip bytes
}

export function verifyEd25519Signature({ publicKeyPem, message, signatureB64 }) {
  if (!publicKeyPem) return { ok: false, reason: "NO_PUBKEY" };
  try {
    const sig = Buffer.from(signatureB64, "base64");
    const ok = crypto.verify(null, Buffer.from(message, "utf-8"), publicKeyPem, sig);
    return { ok };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

export async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

export async function writeFileSafe(rootDir, rel, buf) {
  const dest = path.resolve(rootDir, rel);
  if (!dest.startsWith(path.resolve(rootDir) + path.sep)) {
    throw new Error(`Path escape blocked: ${rel}`);
  }
  await ensureDir(path.dirname(dest));
  await fs.writeFile(dest, buf);
  return dest;
}
