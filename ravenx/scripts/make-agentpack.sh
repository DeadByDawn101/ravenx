#!/usr/bin/env bash
set -euo pipefail

# Creates a .ravenos-agentpack (zip) from a folder that contains manifest.json.
# Usage: scripts/make-agentpack.sh packs/examples/raven-starter out/raven-starter.ravenos-agentpack

SRC="${1:-}"
OUT="${2:-}"

if [[ -z "$SRC" || -z "$OUT" ]]; then
  echo "Usage: $0 <pack-folder> <output-file>"
  exit 1
fi

if [[ ! -f "$SRC/manifest.json" ]]; then
  echo "manifest.json not found in $SRC"
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
(cd "$SRC" && zip -r "$(realpath "$OUT")" .)
echo "Wrote: $OUT"
