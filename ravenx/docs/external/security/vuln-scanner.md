# Static vulnerability scanner (AgentPacks)

Every user-submitted pack (private or public) is scanned on upload.

## What is scanned
- Text-like files: md/json/js/ts/yaml/txt up to 512KB each.

## What is flagged (MVP)
- private keys / key blocks
- token-like hardcoded strings
- dangerous shell patterns (curl|sh, rm -rf /, sudo)
- prompts requesting passwords / seed phrases / private keys

## Risk gating
- `risk=high|critical` blocks install unless user explicitly confirms override.
- Scan results get a `reportId`, can be fetched later and are persisted to disk on install.

## Limits
This is a static scanner. It reduces risk and helps moderation, but cannot prove safety.
