# Clash of Izzy — Pacote Único Consolidado

> **Status: proposta recebida; ainda não validada nem integrada ao jogo.**
>
> Este documento registra o pacote consolidado fornecido na conversa. Não execute os comandos de deploy nem aplique a migration em produção antes da auditoria técnica. O repositório atual já possui uma aplicação Three.js e Cloudflare Worker com arquitetura própria; os caminhos `client/`, `worker/` e a classe `GameRenderer` deste pacote não devem ser introduzidos automaticamente, pois podem criar um segundo cliente/renderizador e duplicar sistemas existentes.

## Índice

1. Análise do gênero e regras de não duplicação
2. Estrutura de pastas proposta
3. Configuração compartilhada
4. Banco de dados — migration proposta
5. Backend — Worker e Durable Object
6. Cliente — renderer, texturas e UI
7. Pipeline de assets
8. PWA e Android
9. Passos de deploy propostos
10. Auditoria e critérios de pronto
11. Roadmap

---

## 1. Análise do gênero e regras de não duplicação

Sistemas essenciais: cidade-base; economia com quatro recursos; tropas em tiers; marcha no mapa; batalha com relatório; alianças; progressão.

Eixos de diferenciação: PvP/PvE; profundidade de herói; timers longos/curtos.

Regras propostas:
- Uma única configuração compartilhada entre cliente e Worker, versionada.
- Cálculo de batalha somente no servidor; cliente apenas apresenta o relatório.
- Um dono por tipo de dado: D1 persistente, Durable Objects efêmero/coordenação, R2 assets e KV cache.
- Um endpoint de fila com ações parametrizadas.
- Componentes de UI parametrizados em vez de telas duplicadas.
- Uma migration por fase, após reconciliar schemas divergentes.
- Nomes canônicos e versionados para assets, por exemplo `/assets/v1/castle.glb`.

## 2. Estrutura de pastas proposta

```text
clash-of-izzy/
├── shared/
│   ├── game-config.json
│   └── schema.ts
├── db/migrations/0001_core.sql
├── worker/
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts
│       ├── queue.ts
│       ├── march.ts
│       ├── battle.ts
│       ├── march-do.ts
│       └── util.ts
├── client/
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── src/
│       ├── api.ts
│       ├── main.ts
│       ├── engine/
│       │   ├── renderer.ts
│       │   ├── texture-manager.ts
│       │   └── asset-loader.ts
│       └── ui/
│           ├── queue-ui.ts
│           └── report-ui.ts
├── tools/
│   ├── generate_models.py
│   ├── compress_assets.sh
│   ├── compress_assets.ps1
│   └── audit.sh
└── public/
    ├── assets/models/
    ├── assets/textures/{buildings,units}/
    ├── draco/draco_decoder.js
    └── basis/basis_transcoder.js
```

**Compatibilidade pendente:** esta árvore é uma proposta lógica, não uma instrução para mover os arquivos atuais. A aplicação existente usa `arena.html`, seu próprio loop Three.js e o pipeline integrado na branch `feat/visual-assets-loader`. Antes de qualquer adoção, mapear cada responsabilidade para o arquivo existente e evitar segundo renderer, cena, canvas, loop, service worker ou API paralela.

## 3. Configuração compartilhada

Arquivo proposto: `shared/game-config.json`.

```json
{
  "version": 1,
  "resources": ["wood", "stone", "gold", "food"],
  "buildings": {
    "town_hall": {"cost":{"wood":0,"stone":0},"time":0,"hp":1000,"requires":[]},
    "farm": {"cost":{"wood":50,"stone":0},"time":30,"hp":300,"requires":["town_hall:1"]},
    "lumber": {"cost":{"wood":30,"stone":20},"time":30,"hp":300,"requires":["town_hall:1"]},
    "quarry": {"cost":{"wood":40,"stone":0},"time":45,"hp":300,"requires":["town_hall:1"]},
    "warehouse": {"cost":{"wood":60,"stone":40},"time":60,"hp":500,"requires":["town_hall:2"]},
    "barracks": {"cost":{"wood":80,"stone":60},"time":90,"hp":600,"requires":["town_hall:2"]}
  },
  "units": {
    "infantry_t1":{"cost":{"food":20,"wood":10},"time":10,"hp":100,"atk":20,"def":25,"speed":2,"tier":1,"barracks":1},
    "archer_t1":{"cost":{"food":15,"wood":25},"time":12,"hp":80,"atk":30,"def":15,"speed":2,"tier":1,"barracks":1},
    "cavalry_t1":{"cost":{"food":40,"gold":20},"time":20,"hp":150,"atk":35,"def":20,"speed":4,"tier":1,"barracks":2},
    "siege_t1":{"cost":{"wood":80,"stone":60},"time":40,"hp":200,"atk":50,"def":10,"speed":1,"tier":1,"barracks":2}
  },
  "march":{"baseSpeedTilesPerMin":6,"maxDurationSec":3600},
  "battle":{"rounds":5,"damageVariance":0.1}
}
```

Arquivo proposto: `shared/schema.ts`.

```typescript
export type Resource = "wood" | "stone" | "gold" | "food";
export interface QueueItem {
  id: string; kind: "build" | "upgrade" | "train" | "research" | "cancel";
  ref: string; qty: number; startedAt: number; endsAt: number;
}
export interface MarchOrder {
  id: string; fromPlayer: string; toX: number; toY: number;
  units: Record<string, number>; departAt: number; arriveAt: number;
  returnAt?: number; kind: "attack" | "gather" | "return"; resolved: boolean;
}
export interface BattleReport {
  id: string; attacker: string; defender: string;
  winner: "attacker" | "defender" | "draw";
  rounds: {round:number; aDmg:number; dDmg:number}[];
  attackerLosses: Record<string,number>; defenderLosses: Record<string,number>;
  loot: Partial<Record<Resource,number>>;
}
```

**Correção necessária:** `version` não é hash criptográfico. Para cumprir a regra de hash, gerar hash real do conteúdo canônico e verificar no servidor; não confiar em um valor enviado pelo cliente como mecanismo de segurança.

## 4. Banco de dados — migration proposta

Arquivo proposto: `db/migrations/0001_core.sql`.

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE kingdoms (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  x INTEGER NOT NULL, y INTEGER NOT NULL,
  wood INTEGER NOT NULL DEFAULT 0, stone INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 0, food INTEGER NOT NULL DEFAULT 0,
  wood_rate INTEGER NOT NULL DEFAULT 0, stone_rate INTEGER NOT NULL DEFAULT 0,
  gold_rate INTEGER NOT NULL DEFAULT 0, food_rate INTEGER NOT NULL DEFAULT 0,
  last_tick INTEGER NOT NULL, shield_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_kingdoms_xy ON kingdoms(x, y);

CREATE TABLE buildings (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
  kind TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, x INTEGER NOT NULL, y INTEGER NOT NULL
);
CREATE INDEX idx_buildings_player ON buildings(player_id);

CREATE TABLE armies (
  player_id TEXT NOT NULL REFERENCES players(id), unit_kind TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (player_id, unit_kind)
);

CREATE TABLE queues (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
  kind TEXT NOT NULL, ref TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1,
  started_at INTEGER NOT NULL, ends_at INTEGER NOT NULL
);
CREATE INDEX idx_queues_player ON queues(player_id, ends_at);

CREATE TABLE marches (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
  payload_json TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);

CREATE TABLE battle_reports (
  id TEXT PRIMARY KEY, attacker TEXT NOT NULL, defender TEXT NOT NULL,
  payload_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX idx_reports_defender ON battle_reports(defender, created_at DESC);
```

Comando proposto, **não executar antes de reconciliar o schema existente**:

```bash
wrangler d1 migrations apply izzy --remote
```

## 5. Backend — Worker e Durable Object

Arquivos propostos:
- `worker/wrangler.toml`
- `worker/src/util.ts`
- `worker/src/queue.ts`
- `worker/src/battle.ts`
- `worker/src/march.ts`
- `worker/src/march-do.ts`
- `worker/src/index.ts`

Configuração de referência:

```toml
name = "clash-of-izzy"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "izzy"
database_id = "SEU_DATABASE_ID_AQUI"

[[durable_objects.bindings]]
name = "MARCH_DO"
class_name = "MarchDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["MarchDO"]
```

Contrato proposto de API:
- `POST /api/queue` com ações `build`, `upgrade`, `train`, `cancel`.
- `POST /api/march` para enviar marchas.
- Batalhas calculadas no servidor e relatórios persistidos em D1.

**Bloqueadores de segurança/correção encontrados no código fornecido:**
1. `x-player-id` enviado pelo cliente não autentica ninguém; qualquer pessoa pode falsificar outro jogador. Usar sessão/token assinado e validar no Worker.
2. `trySpend` faz leitura e atualização separadas; há condição de corrida que pode duplicar gastos/recursos. Fazer operação transacional/condicional e validar todas as chaves de coluna por allowlist.
3. `doBuild` insere edifício imediatamente, embora exista timer; a construção deve ter estado pendente e só tornar-se concluída ao expirar.
4. `doUpgrade` aumenta o nível antes do fim da fila.
5. `settleExpired` só finaliza treino e apaga as demais filas; não conclui construção/upgrade nem libera resultados de pesquisa.
6. `cancel` apaga fila sem reembolso, sem validar o tipo e sem tratar o estado do edifício.
7. `sendMarch` não valida tipos/quantidades das unidades, propriedade e saldo do exército, destino, alcance nem limite de duração; não subtrai as tropas antes da marcha.
8. O Durable Object agenda alarme antes de persistir a marcha em D1; pode haver inconsistência se uma etapa falhar.
9. O defensor está hardcoded como 50 infantarias; precisa carregar exército e defesa reais de D1.
10. O código de batalha não distribui corretamente baixas por rodada/unidade, ignora defesa e pode dividir por zero com exércitos vazios.
11. Não há autenticação de mensagens internas do DO, idempotência, proteção contra replay, rate limit nem tratamento robusto de retries.
12. A migration não define estados de construção, propriedade/defesa de território, sessões, alianças, eventos de idempotência ou recursos necessários à resolução completa de marchas.

Este backend é um esqueleto de referência, não um backend pronto para produção.

## 6. Cliente — renderer, texturas e UI

O pacote original propõe:
- `client/src/engine/texture-manager.ts`
- `client/src/engine/asset-loader.ts`
- `client/src/engine/renderer.ts`
- `client/src/api.ts`
- `client/src/main.ts`
- `client/index.html`
- UI de fila e relatórios.

**Não copiar o renderer/main/index para a aplicação atual.** O jogo já possui renderer, cena, câmera, loop, controles e UI dentro da aplicação existente. O PR #14 adiciona `engine/asset-loader.js` e `engine/texture-manager.js` integrados ao renderer atual de `arena.html`. Reutilizar esses módulos e adaptar as APIs; não introduzir outro canvas, renderer, cena, import map, loop ou Service Worker.

O exemplo original de import map aponta para `/node_modules/`, o que não é automaticamente servido pelo deploy Cloudflare atual. A resolução de dependências deve respeitar o mecanismo já existente e a versão Three.js 0.160.0.

## 7. Pipeline de assets

Arquivos propostos:
- `tools/generate_models.py`
- `tools/compress_assets.sh`
- `tools/compress_assets.ps1`

Dependências do gerador:

```bash
pip install trimesh numpy
python tools/generate_models.py
```

O gerador descrito cria modelos geométricos simples (blocos, cones e cápsulas) exportados como GLB. São placeholders programáticos, não modelos artísticos detalhados. Não substituem assets finais de castelos, edifícios, tropas e animações.

Compressão proposta com glTF Transform:

```bash
npx --yes @gltf-transform/cli optimize public/assets/models/*.glb public/assets/models/ --compress draco --texture-compress webp --simplify false
```

Validar a sintaxe e os formatos suportados pela versão instalada do CLI antes de executar em lote. O pipeline existente usa DRACO/KTX2 com Three.js 0.160.0; garantir compatibilidade entre compressão, loaders e decoders. Não adicionar arquivos de decoder de versões incompatíveis.

## 8. PWA e Android

Manifest proposto:

```json
{
  "name": "Clash of Izzy",
  "short_name": "Izzy",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#1a1a24",
  "theme_color": "#1a1a24",
  "icons": [
    {"src":"/icons/192.png","sizes":"192x192","type":"image/png"},
    {"src":"/icons/512.png","sizes":"512x512","type":"image/png"}
  ]
}
```

O Service Worker proposto no pacote não deve substituir o SW atual sem comparar estratégias de cache e atualização. Os caminhos de assets e decoders precisam corresponder aos caminhos efetivamente servidos pelo Wrangler.

Empacotamento TWA proposto:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://SEU_DOMINIO/manifest.webmanifest
bubblewrap build
```

Antes de publicar: domínio HTTPS, Digital Asset Links, ícones reais, política de privacidade, assinatura segura, testes de instalação e validação da experiência em Android.

## 9. Passos de deploy propostos

Os comandos abaixo são apenas referência; não executar até adaptar a arquitetura e validar os arquivos:

```bash
mkdir -p shared db/migrations worker/src client/src/{engine,ui} tools public/{assets/{models,textures/{buildings,units}},draco,basis}
npm install three
npm install -D wrangler typescript @gltf-transform/cli
pip install trimesh numpy
python tools/generate_models.py
bash tools/compress_assets.sh
wrangler d1 create izzy
wrangler d1 migrations apply izzy --remote
cd worker && wrangler deploy
```

**Não criar um segundo banco D1 ou Worker com o mesmo papel.** Primeiro identificar o banco, binding, Worker, diretório de assets e pipeline de deploy já existentes. Nunca colocar tokens ou secrets no repositório ou no chat. Não aplicar migration remota nem fazer deploy sem autorização explícita.

## 10. Auditoria e critérios de pronto

Auditoria proposta: `tools/audit.sh`. O script precisa ser adaptado aos nomes reais de branches, banco e CLI do repositório. Não assumir que PRs #7, #9, #13 e #14 ainda estão abertos ou têm o mesmo estado; consultar GitHub no momento da auditoria.

Critérios de lançamento:
1. Dois jogadores em navegadores diferentes conseguem jogar e ver o estado sincronizado.
2. Cada jogador tem reino próprio persistente após reload.
3. Treinamento conclui e atualiza o exército uma única vez.
4. Marcha parte, chega, resolve combate e produz relatório.
5. PvP aplica perdas e saque limitados corretamente.
6. Reload durante marcha não perde nem duplica a resolução.
7. Recursos não duplicam após reconexão ou retry.
8. Modelos 3D carregam em celular de referência dentro do orçamento de desempenho.
9. APK/TWA instala e abre em dispositivos Android suportados.

Adicionar também testes de autenticação, autorização, concorrência, idempotência, migração/rollback, reconexão, falha de DO, exploração econômica, acessibilidade e desempenho. O pacote original lista nove testes de lançamento, mas eles não estão implementados por este documento.

## 11. Roadmap por fase

| Fase | Entrega | Estimativa indicativa |
|---|---|---:|
| 1 | Fechar loop principal e integrar sem duplicações | 2–3 semanas |
| 2 | Alianças, chat, ajuda e escudo | 2 semanas |
| 3 | Idempotência, rate limit e administração | 1 semana |
| 4 | PvP com saque limitado, ranking e evento | 2 semanas |
| 5 | PWA testada, TWA assinado e preparação de loja | 2 semanas |

Estimativa total indicativa: 9–11 semanas, sujeita à auditoria do código, testes e disponibilidade de assets. As fases 2–5 exigem implementação e validação próprias; não estão entregues pelo esqueleto de código acima.

---

## Referências oficiais

- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Three.js DRACOLoader: https://threejs.org/docs/pages/DRACOLoader.html
- Three.js KTX2Loader: https://threejs.org/docs/pages/KTX2Loader.html
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Android Trusted Web Activity: https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2
- Bubblewrap: https://github.com/GoogleChromeLabs/bubblewrap

## Histórico desta cópia

Este arquivo foi salvo como documentação consolidada de referência. Nenhum código de runtime, schema de produção, migration remota ou deploy foi alterado por esta operação. O conteúdo foi anotado com incompatibilidades e riscos identificados para impedir que os exemplos sejam confundidos com uma implementação validada.
