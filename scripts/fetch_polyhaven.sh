#!/usr/bin/env bash
set -euo pipefail
# Download staging, never into the public asset directory.
cd "$(dirname "$0")/.."
node scripts/fetch-polyhaven.mjs "${1:-raw_textures}"
