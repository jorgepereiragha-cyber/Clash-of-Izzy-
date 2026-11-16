#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${CLASH_OF_IZZY_BASE_URL:-https://clash-of-izzy.jorgepereiragha.workers.dev}"
BASE_URL="${BASE_URL%/}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-20}"
GAME_TOKEN="${GAME_TOKEN:-}"
PLAYER_IDENTIFIER="${PLAYER_IDENTIFIER:-}"
PLAYER_PASSWORD="${PLAYER_PASSWORD:-}"
TRAINING_UNIT="${TRAINING_UNIT:-militia}"
TRAINING_QUANTITY="${TRAINING_QUANTITY:-10}"
MUTATE_TRAINING=0

usage() {
  cat <<'USAGE'
Uso:
  bash scripts/validate-core-loop.sh
  bash scripts/validate-core-loop.sh --mutate-training

Variáveis opcionais:
  CLASH_OF_IZZY_BASE_URL  URL do Worker (padrão: produção)
  GAME_TOKEN             Token Bearer de um reino existente
  PLAYER_IDENTIFIER      Usuário/e-mail da conta vinculada
  PLAYER_PASSWORD        Senha da conta vinculada
  TRAINING_UNIT          Tropa a treinar (padrão: militia)
  TRAINING_QUANTITY      Quantidade de tropas (padrão: 10)
  ALLOW_GAME_MUTATIONS=YES  Segunda confirmação exigida para treinar

O modo padrão não altera o reino nem seus recursos. Se você informar usuário/senha,
o endpoint de login poderá atualizar contadores antiautomação; use GAME_TOKEN
para evitar essa chamada. --mutate-training cria uma fila real e pode consumir
recursos do reino. Não use em um reino importante.
USAGE
}

while (($#)); do
  case "$1" in
    --mutate-training) MUTATE_TRAINING=1 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if ! command -v curl >/dev/null 2>&1; then
  echo "ERRO: curl é necessário." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: Node.js é necessário para validar as respostas JSON." >&2
  exit 1
fi
if [[ "$BASE_URL" != https://* ]]; then
  echo "ERRO: a URL precisa usar HTTPS." >&2
  exit 1
fi
if [[ ! "$REQUEST_TIMEOUT" =~ ^[0-9]+$ ]] || ((REQUEST_TIMEOUT < 1 || REQUEST_TIMEOUT > 120)); then
  echo "ERRO: REQUEST_TIMEOUT deve ser um número entre 1 e 120." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
BODY_FILE="$TMP_DIR/response.json"
CURL_ERROR_FILE="$TMP_DIR/curl-error.txt"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

HTTP_STATUS=""
RESPONSE_BODY=""

request() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local payload="${4:-}"
  local -a args
  args=(--silent --show-error --max-time "$REQUEST_TIMEOUT"
        --request "$method" --output "$BODY_FILE" --write-out "%{http_code}"
        --header "Accept: application/json")
  if [[ -n "$token" ]]; then
    args+=(--header "Authorization: Bearer $token")
  fi
  if [[ -n "$payload" ]]; then
    args+=(--header "Content-Type: application/json" --data "$payload")
  fi
  if ! HTTP_STATUS="$(curl "${args[@]}" "$BASE_URL$path" 2>"$CURL_ERROR_FILE")"; then
    echo "ERRO de comunicação ao consultar $path:" >&2
    cat "$CURL_ERROR_FILE" >&2
    exit 1
  fi
  RESPONSE_BODY="$(cat "$BODY_FILE")"
}

json_value() {
  node -e '
    const fs = require("node:fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = process.argv[2].split(".").filter(Boolean)
      .reduce((current, key) => current == null ? undefined : current[key], data);
    if (value === undefined) process.exit(3);
    process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
  ' "$BODY_FILE" "$1"
}

json_type() {
  node -e '
    const fs = require("node:fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = process.argv[2].split(".").filter(Boolean)
      .reduce((current, key) => current == null ? undefined : current[key], data);
    if (value === undefined) process.exit(3);
    process.stdout.write(Array.isArray(value) ? "array" : value === null ? "null" : typeof value);
  ' "$BODY_FILE" "$1"
}

api_error() {
  node -e '
    const fs = require("node:fs");
    try {
      const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      process.stdout.write(String(data.error || data.message || "resposta sem campo de erro"));
    } catch {
      process.stdout.write("resposta não JSON");
    }
  ' "$BODY_FILE"
}

echo "Clash of Izzy — validação do Core Loop"
echo "Destino: $BASE_URL"
echo "Modo: $([[ "$MUTATE_TRAINING" -eq 1 ]] && echo "treinamento solicitado" || echo "somente leitura")"
echo "============================================================"

echo "1/4 — Saúde do Worker e do D1 (somente leitura)"
request GET "/api/health"
if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "FALHA: /api/health retornou HTTP $HTTP_STATUS — $(api_error)" >&2
  exit 1
fi
if ! HEALTH_OK="$(json_value "ok")" || [[ "$HEALTH_OK" != "true" ]]; then
  echo "FALHA: Worker/D1 não está pronto: $(api_error)" >&2
  exit 1
fi
echo "OK: Worker, D1, SESSION_SECRET e schema obrigatórios estão prontos."

echo "2/4 — Bloqueio de sessão anônima (somente leitura)"
request GET "/api/account/status"
if [[ "$HTTP_STATUS" != "401" ]]; then
  echo "FALHA: status sem token deveria retornar 401, recebeu HTTP $HTTP_STATUS — $(api_error)" >&2
  exit 1
fi
if ! ANON_ERROR="$(json_value "error")" || [[ "$ANON_ERROR" != *"Sessão do jogador inválida"* ]]; then
  echo "FALHA: a resposta 401 não contém a mensagem de sessão esperada." >&2
  exit 1
fi
echo "OK: sessão anônima corretamente rejeitada com HTTP 401."

echo "3/4 — Autenticação e leitura do reino"
if [[ -z "$GAME_TOKEN" ]]; then
  if [[ -n "$PLAYER_IDENTIFIER" && -n "$PLAYER_PASSWORD" ]]; then
    LOGIN_PAYLOAD="$(PLAYER_IDENTIFIER="$PLAYER_IDENTIFIER" PLAYER_PASSWORD="$PLAYER_PASSWORD" node -e '
      process.stdout.write(JSON.stringify({
        identifier: process.env.PLAYER_IDENTIFIER,
        password: process.env.PLAYER_PASSWORD
      }));
    ')"
    request POST "/api/account/login" "" "$LOGIN_PAYLOAD"
    if [[ "$HTTP_STATUS" != "200" ]]; then
      echo "FALHA: login retornou HTTP $HTTP_STATUS — $(api_error)" >&2
      exit 1
    fi
    if ! GAME_TOKEN="$(json_value "token")" || [[ -z "$GAME_TOKEN" ]]; then
      echo "FALHA: o login não retornou um token." >&2
      exit 1
    fi
    echo "OK: login de conta concluído; token não será exibido."
  else
    echo "PENDENTE: forneça GAME_TOKEN ou PLAYER_IDENTIFIER e PLAYER_PASSWORD."
    echo "As verificações autenticadas e o treinamento não foram executados."
    exit 2
  fi
else
  echo "OK: token de reino fornecido pelo ambiente; não será exibido."
fi

request GET "/api/account/status" "$GAME_TOKEN"
if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "FALHA: status autenticado retornou HTTP $HTTP_STATUS — $(api_error)" >&2
  exit 1
fi
echo "OK: token aceito por /api/account/status (HTTP 200)."

request GET "/api/game/state" "$GAME_TOKEN"
if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "FALHA: leitura do reino retornou HTTP $HTTP_STATUS — $(api_error)" >&2
  exit 1
fi
if ! STATE_QUEUES_TYPE="$(json_type "state.queues")" || [[ "$STATE_QUEUES_TYPE" != "array" ]]; then
  echo "FALHA: resposta do reino não contém a lista de filas esperada." >&2
  exit 1
fi
if ! STATE_TROOPS_TYPE="$(json_type "state.troops")" || [[ "$STATE_TROOPS_TYPE" != "array" ]]; then
  echo "FALHA: resposta do reino não contém a lista de tropas esperada." >&2
  exit 1
fi
if ! STATE_RESOURCES="$(node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const kingdom = data.state && data.state.kingdom;
  if (!kingdom || typeof kingdom !== "object") process.exit(2);
  const keys = ["food", "wood", "stone", "iron", "gold"];
  const found = keys.filter(key => Number.isFinite(Number(kingdom[key])));
  if (found.length < 3) process.exit(3);
  process.stdout.write(found.join(", "));
' "$BODY_FILE")"; then
  echo "FALHA: não foi possível confirmar os recursos do reino." >&2
  exit 1
fi
echo "OK: reino autenticado, tropas e filas disponíveis; recursos encontrados: $STATE_RESOURCES."

if [[ "$MUTATE_TRAINING" -eq 0 ]]; then
  echo "============================================================"
  echo "VALIDAÇÃO READ-ONLY CONCLUÍDA."
  echo "Login, status autenticado, estado do reino e economia foram verificados."
  echo "Treinamento real NÃO foi enviado e nenhum recurso foi gasto."
  echo "Para criar uma fila real, use --mutate-training e confirme ALLOW_GAME_MUTATIONS=YES."
  exit 0
fi

echo "4/4 — Treinamento real (altera o reino e pode consumir recursos)"
if [[ "${ALLOW_GAME_MUTATIONS:-}" != "YES" ]]; then
  echo "BLOQUEADO: defina ALLOW_GAME_MUTATIONS=YES para autorizar a mutação." >&2
  exit 2
fi
if [[ ! -t 0 ]]; then
  echo "BLOQUEADO: a confirmação final precisa ser digitada em um terminal interativo." >&2
  exit 2
fi
if [[ ! "$TRAINING_QUANTITY" =~ ^[0-9]+$ ]] || ((TRAINING_QUANTITY < 1 || TRAINING_QUANTITY > 100)); then
  echo "ERRO: TRAINING_QUANTITY deve estar entre 1 e 100." >&2
  exit 2
fi
if [[ ! "$TRAINING_UNIT" =~ ^(militia|swordsman|spearman|archer|crossbowman|cavalry|knight|mage|catapult|ram|trebuchet)$ ]]; then
  echo "ERRO: TRAINING_UNIT não é um tipo de tropa suportado." >&2
  exit 2
fi

echo "Será enviada uma ordem real: $TRAINING_QUANTITY x $TRAINING_UNIT."
read -r -p 'Digite TREINAR para confirmar (qualquer outra resposta cancela): ' confirmation
if [[ "$confirmation" != "TREINAR" ]]; then
  echo "Cancelado. Nenhuma ordem de treinamento foi enviada."
  exit 0
fi

TRAIN_PAYLOAD="$(TRAINING_UNIT="$TRAINING_UNIT" TRAINING_QUANTITY="$TRAINING_QUANTITY" node -e '
  process.stdout.write(JSON.stringify({
    type: "train",
    unit: process.env.TRAINING_UNIT,
    quantity: Number(process.env.TRAINING_QUANTITY)
  }));
')"
request POST "/api/game/action" "$GAME_TOKEN" "$TRAIN_PAYLOAD"
if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "FALHA: treinamento retornou HTTP $HTTP_STATUS — $(api_error)" >&2
  exit 1
fi
if ! TRAIN_SUCCESS="$(json_value "success")" || [[ "$TRAIN_SUCCESS" != "true" ]]; then
  echo "FALHA: servidor não confirmou a ordem — $(api_error)" >&2
  exit 1
fi
if ! QUEUE_CREATED="$(TRAINING_UNIT="$TRAINING_UNIT" TRAINING_QUANTITY="$TRAINING_QUANTITY" node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const queues = data.state && Array.isArray(data.state.queues) ? data.state.queues : [];
  const found = queues.some(queue =>
    queue.queue_type === "training" &&
    queue.target_key === process.env.TRAINING_UNIT &&
    queue.status === "running" &&
    Number(queue.quantity) === Number(process.env.TRAINING_QUANTITY)
  );
  process.stdout.write(found ? "true" : "false");
' "$BODY_FILE")"; then
  QUEUE_CREATED="false"
fi
if [[ "$QUEUE_CREATED" != "true" ]]; then
  echo "FALHA: servidor respondeu sucesso, mas a fila de treinamento esperada não foi encontrada no estado retornado." >&2
  exit 1
fi

echo "OK: fila real criada: $TRAINING_QUANTITY x $TRAINING_UNIT."
echo "============================================================"
echo "VALIDAÇÃO DO CORE LOOP CONCLUÍDA COM TREINAMENTO REAL."
echo "A ordem foi registrada no reino; consulte a fila na tela do jogo."
