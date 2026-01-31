# Skill: Legacy Agent & Skill Backup (OpenClaw Community)

## Purpose
Help the user export and restore agent/skill configuration for migration and backup.

## Safety Rules (must follow)
- Do **not** request or store secrets (API keys, tokens, private keys, seed phrases, passwords).
- If the user’s configuration includes secrets in env files, instruct them to **remove/redact** before sharing.
- Back up *configuration* and *skill content* only.

## Backup workflow (high level)
1) Identify OpenClaw config and workspace directories.
2) Create a zip backup containing:
   - agent definitions (json/yaml)
   - skills (markdown)
   - plugin manifests (json)
   - optional UI metadata (if present)
3) Exclude:
   - `.env`, token files, keychains, credential stores
   - large caches, model weights

### Suggested commands (user runs locally)
> Adjust paths to match their installation.

```bash
mkdir -p ~/openclaw-backups
ts=$(date +%Y%m%d-%H%M%S)
zip -r ~/openclaw-backups/openclaw-backup-$ts.zip ~/.openclaw  \
  -x "*.env*" -x "*token*" -x "*key*" -x "*keys*" -x "*credentials*"
```

## Restore workflow
1) Unzip backup into a temporary folder.
2) Review contents and confirm no secrets are present.
3) Copy agent/skills back into the expected OpenClaw directories.

```bash
unzip openclaw-backup-YYYYMMDD-HHMMSS.zip -d /tmp/openclaw-restore
# Review /tmp/openclaw-restore before copying
```

## RavenOS compatibility note
If restoring into RavenOS, you can import the backup as a legacy pack and RavenOS will convert it to a RavenOS AgentPack format for installation.
