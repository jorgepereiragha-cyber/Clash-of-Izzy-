#!/usr/bin/env bash
# LEGADO DESATIVADO: export nao e backup recuperavel padrao para D1 com FTS5.
# Antes de qualquer migracao de producao, usar o workflow oficial protegido,
# que captura e arquiva bookmark de Time Travel ANTES de aplicar migrations.
# Nunca restaurar Time Travel sem avaliacao das escritas posteriores ao bookmark.
set -euo pipefail

echo "BLOQUEADO: backup por exportacao manual D1 foi desativado." >&2
echo "Fluxo de leitura: GitHub Actions > Cloudflare Paid Readiness (read-only)." >&2
echo "Fluxo de producao: Deploy Clash of Izzy to Cloudflare, somente apos GO comercial e dois inputs booleanos." >&2
echo "FTS5: exportacao em formato sqlite3_cli_only nao e restauravel via importacao D1." >&2
exit 2
