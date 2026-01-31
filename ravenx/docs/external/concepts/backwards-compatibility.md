# Backwards compatibility (OpenClaw legacy)

RavenOS accepts:

1. RavenOS AgentPack (`manifest.json` at root)
2. Legacy OpenClaw-style exports (no manifest)

## Legacy detection (MVP)

If `manifest.json` is missing, RavenOS checks for:
- `agent.json` anywhere
- `skills/*.md`
- `openclaw.plugin.json`

If detected, RavenOS:
- converts into an in-memory RavenOS manifest for preview
- marks the import as `compatibility.isLegacy=true`

## Conversion rules

- `contents.agents` includes any `agent.json` paths
- `contents.skills` includes `skills/*.md`
- `contents.tools` includes `openclaw.plugin.json` paths (if present)
- permissions default conservative: network=true, filesystem=false, exec=false

This lets users migrate older agents forward without hand-editing.
