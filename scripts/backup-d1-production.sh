#!/usr/bin/env bash
# Backup D1 PRODUCAO: exporta dados + schema, sem executar migracoes.
set -euo pipefail
umask 077

DB_NAME="clash-of-izzy-db"
if [[ "${CONFIRM_D1_PRODUCTION_BACKUP:-}" != "$DB_NAME" ]]; then
  echo "BLOQUEADO: defina CONFIRM_D1_PRODUCTION_BACKUP=$DB_NAME" >&2
  exit 2
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "BLOQUEADO: credenciais Cloudflare precisam estar no ambiente, nunca no script." >&2
  exit 2
fi
if ! command -v npx >/dev/null 2>&1 || ! command -v sha256sum >/dev/null 2>&1; then
  echo "BLOQUEADO: Node/npx e sha256sum sao obrigatorios." >&2
  exit 2
fi

DEST="${BACKUP_DIR:-$HOME/clash-of-izzy-private-backups}"
mkdir -p "$DEST"
DEST="$(cd "$DEST" && pwd -P)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)"
case "$DEST/" in
  "$REPO_ROOT/"*) echo "BLOQUEADO: backup deve ficar FORA do repositorio Git." >&2; exit 2;;
esac
chmod 700 "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$DEST/clash-of-izzy-d1-prod-$STAMP-$$.sql"
trap 'rm -f "$DUMP" "$DUMP.sha256"' ERR
echo "Exportando exclusivamente D1 remoto de producao ($DB_NAME)..."
npx --no-install wrangler d1 export "$DB_NAME" --remote --output="$DUMP"
if [[ ! -s "$DUMP" ]]; then echo "ERRO: export vazio." >&2; exit 1; fi
sha256sum "$DUMP" > "$DUMP.sha256"
trap - ERR
echo "Backup privado concluido: $DUMP"
echo "Integridade: $DUMP.sha256"
echo "NENHUMA migracao aplicada. Confira o arquivo e guarde copia fora do dispositivo."
