# RavenOS BaaS: LeasePack (time-locked agents)

LeasePack is a password-protected, time-locked packaging format for “job bots”.
It’s designed for:
- short-lived pentest/recon bots
- contractor workflows
- ephemeral training bots

## What it is
A LeasePack is a zip containing:
- `lease.json` — expiry + policy caps + pack hash
- `payload.enc` — encrypted AgentPack zip bytes
- `signature.sig` — optional admin signature over `lease.json` + `payloadSha256`

## Security properties
- payload is encrypted with AES-256-GCM
- key is derived from a passphrase via scrypt (MVP, swap to Argon2id later)
- signature verification uses Ed25519 (admin public key)

## Expiry behavior
When a lease expires RavenOS:
- disables the agent
- wipes the agent workspace directory
- removes staged decrypted payload

## Extending time
Admin issues an `extension.json` (signed):
- packHash
- new expiry
- nonce

User uploads extension token. RavenOS verifies signature and applies.

## Disclaimer
This reduces accidental leakage and casual redistribution. It cannot prevent exfiltration by a malicious operator.
