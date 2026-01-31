# Pre-deploy QA checklist (RavenOS)

## Repo
- `.env.example` exists at repo root
- `compose.yml` references correct service names/ports

## Docker
- `docker compose up -d --build` succeeds
- UI available at `http://localhost:8080`
- API reachable through UI proxy:
  - `http://localhost:8080/api/health`

## Setup flow
- Wizard loads
- Engine test handles:
  - reachable + auth OK
  - reachable + auth required
  - unreachable

## AgentPack pipeline
- Analyze pack returns:
  - `analysis.security`
  - `analysis.reportId`
  - legacy conversion if `manifest.json` missing
- Install:
  - blocked for high/critical unless override checked
  - stages extraction with ZipSlip protections
  - persists report to reports dir

## Image Studio
- With HF token set, generates and previews an image
- Without HF token, shows clean error message

## Security
- Verify no secrets stored in the browser for HF token
- Review scan findings output for pack uploads
