# RavenX

RavenX is an agent “control plane” and UI that’s designed for **containerized, disposable agent deployments**.

It’s built for two vibes at once:
- 🎭 **Fun**: bring agents to life with **skins** (theming, persona, presence)
- 🧰 **Serious**: ship agents like infrastructure (TTL, lock, wipe, audit)

## Current milestone (Phase 1)

### Fun + product
- **Skinnable AI desktop agent**: “agent skins” are first-class. Pick a look, swap a vibe, ship a persona.
- **Photo Scanner (prompt-to-photo)**: scan a reference photo and generate a consistent “skin prompt” for your agent.
- **Import-first**: import agents and skills so nobody loses work. Imported sources stay preserved and versioned (never overwritten).

### Dev + ops
- **Agent Factory**: create deployments with a TTL
- **BaaS Leases**: deployments **LOCK** at expiry, then **AUTO-WIPE** after a delay (default: 10 minutes)
- **Password unlock**: extend time using an admin password (stored as a hash, never plaintext)
- **Lease Guard**: background watcher that enforces lock + wipe
- **Deployments UI**: create / extend / stop + quick QA workflow
- **Wallet-based extension (WalletConnect)** is planned as an optional deployment policy in a later phase.

### Marketplace + BaaS (revenue path)
RavenX is designed to support an **Agent Marketplace** where agents can be:
- published with skins + skills,
- deployed as **Bot-as-a-Service (BaaS)** for timeboxed jobs,
- **locked and wiped** after the engagement,
- extended via admin policy (password now; optional wallet later).

The goal: make “shipping agents” feel like shipping apps, and make “renting agents” feel like renting compute.

---

## Repo layout (this folder)

- `apps/api`  
  RavenX API (factory + leases + registry)

- `apps/ui`  
  RavenX UI (Deployments panel + wizard surfaces)

- `apps/lease-guard`  
  Lease enforcement service (polls API, locks on expiry, wipes + stops after delay)

- `compose.yml`  
  Multi-service local runtime (api + ui + lease_guard)

---

## Quick start (macOS, no Docker)

RavenX runs great with **Podman Desktop** on a clean Mac.

### 1) Install Podman Desktop
Install (Homebrew):

```bash
brew install --cask podman-desktop

Open Podman Desktop once (Applications → Podman Desktop).

2) Start the Podman machine (macOS VM)

podman machine init
podman machine start
podman info >/dev/null && echo "Podman OK ✅"

3) Enable Compose

In Podman Desktop:
	•	Settings → Resources → Compose → Setup
Verify:

podman compose version

If podman compose isn’t available, install a provider:

python3 -m pip install --user podman-compose
podman-compose --version

4) Clone and configure

git clone https://github.com/DeadByDawn101/ravenx.git
cd ravenx/ravenx
cp -n .env.example .env

Generate a signing secret and paste it into .env:

openssl rand -hex 32

Set:
	•	RAVENX_EXTENSION_SECRET=<your hex secret>

5) Run RavenX

Using podman compose:

podman compose up -d --build

Or using podman-compose:

podman-compose up -d --build

Services:
	•	UI: http://localhost:8080
	•	API: http://localhost:8787

⸻

Quick start (Docker, optional)

cd ravenx/ravenx
cp -n .env.example .env
openssl rand -hex 32
# paste into .env -> RAVENX_EXTENSION_SECRET
docker compose up -d --build


⸻

Environment variables

Required:
	•	RAVENX_EXTENSION_SECRET
HMAC secret used to sign short-lived lease extension tokens.

Optional (advanced):
	•	RAVENOS_DEPLOYMENTS_PATH (default: /var/lib/ravenos/deployments.json)
	•	RAVENOS_WORKSPACES_DIR (default: /var/lib/ravenos/workspaces)

⸻

QA (fast, real)

QA-1: API responds

curl -s http://localhost:8787/api/factory/list | python3 -m json.tool

curl -s http://localhost:8787/api/factory/list | python3 -m json.tool

QA-2: Create a short lease (locks + wipes quickly)

This creates a deployment that expires in 30 seconds and wipes 30 seconds after expiry:

curl -s -X POST http://localhost:8787/api/factory/deploy \
  -H "content-type: application/json" \
  -d '{"ttlSeconds":30,"password":"test1234","wipeDelaySeconds":30}' \
  | python3 -m json.tool

List deployments and observe status transition:

curl -s http://localhost:8787/api/factory/list | python3 -m json.tool

Expected transitions:
	•	ACTIVE → LOCKED → STOPPED

QA-3: Password extend

Create a 60s deployment:

curl -s -X POST http://localhost:8787/api/lease/extend/password \
  -H "content-type: application/json" \
  -d '{"deploymentId":"DEPLOYMENT_ID","password":"test1234","extendSeconds":3600}' \
  | python3 -m json.tool

Request an extension token (extend by 3600 seconds):

curl -s -X POST http://localhost:8787/api/lease/extend/password \
  -H "content-type: application/json" \
  -d '{"deploymentId":"DEPLOYMENT_ID","password":"test1234","extendSeconds":3600}' \
  | python3 -m json.tool

Apply the token:

curl -s -X POST http://localhost:8787/api/lease/apply \
  -H "content-type: application/json" \
  -d '{"token":"PASTE_TOKEN_HERE"}' \
  | python3 -m json.tool

Expected:
	•	Deployment returns to ACTIVE
	•	expiresAt increases
	•	wipeAt updates accordingly
UI QA

Open the UI:
	•	http://localhost:8080

Go to Deployments:
	•	Create deployment (TTL + password)
	•	Extend it
	•	Stop / Stop+Wipe

⸻

Lease model (Phase 1)
	•	Deployments start ACTIVE
	•	At expiresAt they become LOCKED
	•	At wipeAt they are wiped and stopped (default wipe delay: 600 seconds)

Extension:
	•	Admin password → server verifies hash → mints short-lived token → token applied to extend time

⸻

Security notes
	•	No plaintext passwords are stored (hashed with scrypt).
	•	Lease extension uses short-lived signed tokens.
	•	Keep .env private and never commit it.
### After you paste it, commit + push
```bash
cd "$HOME/Downloads/ravenx-repo/ravenx"
git add README.md
git commit -m "docs: update README (skins + imports + marketplace/BaaS)"
git push