# RavenX

RavenX is an agent “control plane” and UI that’s designed for **containerized, disposable agent deployments**.

Current milestone (Phase 1):
- **Agent Factory**: create deployments with a TTL
- **BaaS Leases**: deployments **LOCK** at expiry, then **AUTO-WIPE** after a delay
- **Password unlock**: extend time using an admin password (stored as a hash, never plaintext)
- **Lease Guard**: background watcher that enforces lock + wipe
- **UI**: a Deployments panel for create/extend/stop + quick QA

> Wallet-based extension (WalletConnect) is planned as an optional deployment policy in a later phase.

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