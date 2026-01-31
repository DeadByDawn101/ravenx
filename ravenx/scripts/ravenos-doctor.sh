#!/usr/bin/env bash
set -euo pipefail

echo "🩺 RavenOS Doctor (CLI)"
echo "pwd: $(pwd)"

if command -v docker >/dev/null 2>&1; then
  echo "✅ docker: $(docker --version)"
else
  echo "❌ docker not found (install Docker Desktop)"
fi

if [ -f compose.yml ]; then
  echo "✅ compose.yml found"
else
  echo "❌ compose.yml not found (run from repo root)"
fi

if [ -f .env.example ]; then
  echo "✅ .env.example found"
else
  echo "❌ .env.example missing"
fi

if [ -f .env ]; then
  echo "✅ .env present"
else
  echo "⚠️ .env missing (run: cp .env.example .env)"
fi

echo
echo "Server-side Doctor (if stack is running):"
echo "  curl -s http://localhost:8080/api/doctor/run -H 'Content-Type: application/json' -d '{"gatewayUrl":"http://localhost:18789"}' | head"
