# Bot-as-a-Service Time-Locked Agents (Lease Packs)

RavenOS supports turning any imported/created agent into a **RavenOS agent** and optionally wrapping it as a **time-locked “BaaS” lease pack**.

## Goals

- Make “job bots” that can be rented (e.g., pentest bots) without permanently shipping the full agent contents.
- Expire automatically.
- Allow an admin to extend time without redistributing the whole pack.
- After expiry/unlock completion: wipe job workspace and secrets.

## Threat model (plain language)

This is designed to reduce accidental leakage and casual redistribution. It **cannot** guarantee zero exfiltration if an operator is malicious and can observe runtime outputs.

## Format overview

### AgentPack (normal)
- Plain RavenOS AgentPack zip (manifest + skills/agents/tools).

### LeasePack (time-locked)
- Encrypted AgentPack payload + lease metadata:
  - `lease.json` (expiry, allowed runtime, policy)
  - `payload.enc` (encrypted zip bytes)
  - `signature.sig` (admin signature over lease.json + payload hash)

## Encryption approach (recommended)

- Encrypt the payload with **AES-256-GCM**.
- Derive key from passphrase using **Argon2id** (strong KDF).
- Use envelope encryption:
  - `DEK` (data key) encrypts payload
  - `KEK` (key-encryption key) derived from passphrase encrypts DEK
  - Optional admin rewrap: admin can rotate/rewrap DEK without changing payload

## Time-lock / extension flow

1. User installs LeasePack.
2. RavenOS verifies signature (if present).
3. RavenOS stores:
   - expiry timestamp
   - pack hash
   - allowed policy
4. When expiry hits:
   - disable agent
   - wipe workspace
   - (optional) remove decrypted cache

### Extending time (admin)

Admin issues a **Lease Extension Token**:
- `extension.json` (pack hash, new expiry, nonce)
- signed by admin key

User uploads extension token; RavenOS verifies and applies.

## Wipe semantics

On expiry:
- delete agent workspace folder
- clear RavenOS memory entries for that agent (unless configured otherwise)
- delete staged pack extraction folder
- rotate any bot tokens used for channels (Discord/Slack/etc.)

## “Discord twist” (optional)

Use a Discord server channel as a controlled “lease desk”:
- the admin bot posts signed extension tokens (as file attachments)
- the renter uploads the attachment into RavenOS
- RavenOS verifies signature locally and extends the lease

No secrets are posted publicly, and the token is only valid for a specific pack hash.
