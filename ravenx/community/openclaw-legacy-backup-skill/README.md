# OpenClaw Legacy Backup Skill (Community)

This folder contains a standalone skill you can drop into an OpenClaw skills directory to help
users back up and restore their agent + skill configuration in a safe way.

Design goals:
- No secret collection (never ask users for tokens, passwords, private keys, seed phrases)
- Prefer exporting configuration files only
- Encourage redaction of sensitive environment variables before sharing

Files:
- `skills/openclaw-legacy-backup-skill.md` — standalone skill markdown
- `ravenos-pack/` — the same skill packaged as a RavenOS skill pack (.ravenos-agentpack compatible)
