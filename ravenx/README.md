# RavenOS (starter)

RavenOS is a Docker-first UI shell + marketplace concept that connects to an OpenClaw Gateway.
This repo is a starter scaffold to get you to a working "vertical slice" quickly:

- Web UI (wizard, agent manager, scan + skin page)
- API proxy (optional) for safer gateway access
- Docker Compose profiles: `studio` (persistent) vs `baas` (ephemeral-style)
- AgentPack spec draft (`.ravenos-agentpack`)
- Placeholder OpenClaw plugin/tool contract for `photo.scan`

## 0) What you get in this starter
- `apps/ui` — React/Vite UI (Wizard + Marketplace shell)
- `apps/api` — Node API (proxy to OpenClaw Gateway, optional but recommended)
- `contracts/` — request/response schemas for tools + AgentPack manifest
- `compose.yml` — Docker Compose for UI + API + (external) gateway
- `packs/examples/` — example AgentPack structure

> Note: this scaffold does **not** vendor OpenClaw itself. You can run OpenClaw in a separate container/service, and point RavenOS to it.

## 1) Quick start (local dev)
Requirements: Node 18+ and pnpm.

```bash
pnpm install
pnpm dev
```

- UI: http://localhost:8080
- API: http://localhost:8787

Configure gateway URL + token in `.env` (see `.env.example`).

## 2) Docker start
Copy `.env.example` to `.env` and set values, then:

```bash
docker compose up -d
```

UI will be on port 8080.

## 3) Next steps (what to implement next)
1) Implement the OpenClaw tool/plugin side for `photo.scan` to match `contracts/photo.scan.schema.json`
2) Add a real marketplace catalog (static JSON, then registry later)
3) Add AgentPack import → install into OpenClaw (via plugin/agent directory or gateway endpoint/shim)
4) Add "sealed pack" verification (signature + allowlist)

## 4) Repo layout
```
apps/
  ui/        # RavenOS UI
  api/       # RavenOS API proxy (optional)
contracts/
packs/
scripts/
```

## Backwards compatibility + security scanning
- AgentPack analyzer supports legacy OpenClaw-style exports (no manifest.json). RavenOS converts them into a RavenOS manifest for preview.
- Uploaded packs are scanned with a static vulnerability scanner before install. High/critical risk packs require explicit override.

## Install pipeline (staging + optional OpenClaw direct install)
RavenOS analyzes an AgentPack, runs a static security scan, and then installs using a staged extraction with ZipSlip protection.
- Packs are staged to `${RAVENOS_PACKS_DIR}` and scan reports persisted to `${RAVENOS_REPORTS_DIR}`.
- If you set `RAVENOS_OPENCLAW_AGENTS_DIR`, `RAVENOS_OPENCLAW_SKILLS_DIR`, and/or `RAVENOS_OPENCLAW_PLUGINS_DIR`, RavenOS will copy the selected files into those targets.
- High/critical risk packs require an explicit override in the UI.

### Reports
After analyze, RavenOS returns a `reportId`. You can fetch it via `GET /api/agentpacks/report/:id`.
