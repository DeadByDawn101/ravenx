# RavenOS Doctor

RavenOS Doctor is a built-in diagnostics flow inspired by OpenClaw’s `openclaw doctor`.

OpenClaw’s doctor is described as a repair + migration tool that checks health and offers actionable repair steps. (See OpenClaw docs for `openclaw doctor`.)

## What RavenOS Doctor checks

### Environment & runtime
- Node version (if using local dev)
- Docker installed / running (if in Docker mode)
- Required ports available (8080 UI, 8787 API)
- Disk space + write permissions for:
  - packs dir
  - reports dir
  - media dir (optional)

### Engine connectivity
- Gateway URL reachable
- Auth configured (token present if required)
- `/tools/invoke` reachable (auth gates OK)

### Security posture
- Warn if auth is disabled while gateway is publicly reachable
- Warn if risky tools are enabled without approvals
- Confirm vuln scanner is enabled (it is by default)

### Pack install system
- ZipSlip protection sanity (self-test)
- Report persistence writable

## Wrapping OpenClaw Doctor

If the `openclaw` CLI is present on the host:
- RavenOS Doctor can run `openclaw doctor` and surface the result
- it can also run:
  - `openclaw plugins doctor` to report plugin load errors

In Docker, this is optional; it requires either:
- openclaw CLI installed in the container, or
- a sidecar that runs the CLI and shares results via API.
