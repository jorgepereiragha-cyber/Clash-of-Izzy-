# Clash of Izzy — Blueprint v53: revisão segura de pré-lançamento

Este patch é **somente código em branch de revisão** sobre a PR #233 (Draft).
Não efetua merge na main, migrações remotas, checkout real ou deploy.

## Integrado neste patch
- Service Worker v53: shell 2D mínimo (index, kingdom, offline) obrigatório; pré-cache 3D e demais assets opcionais com falha isolada, sem gravar respostas privadas. Página offline retorna mensagem 503 se cache for removido.
- Acessórios 3D do castelo: trono cosmético (20+), asas (25+), coroa dourada (30+ ou VIP8), sem mutar materiais compartilhados e com descarte de geometrias após atualizações. VIP do Castelo atual é limitado a 7; o gatilho VIP8 é reservado para evolução futura. A Guerra do Trono mundial é um sistema distinto.
- Testes estáticos e de lifecycle do Service Worker.

## Não aplicado deliberadamente
- **NÃO** copiar o `assign_hero` genérico: `hero-assignments-4x.js` já usa `kingdom_id`, especialidade e trava de posto. O exemplo original usa `player_id` e não protege a alocação do reino.
- **NÃO** criar `0043_fix_vip_catalog.sql` com `INSERT OR REPLACE`: preços P4–P8 propostos divergem de `level-packs.js`; a tabela real não tem as colunas de recursos e `required_level` pressupostas no documento. `0042` já define `level_pack_claims`.
- **NÃO** trocar o webhook por três UPDATEs incondicionais: a implementação atual verifica status/valor do Mercado Pago e faz D1.batch com ledger de entrega única. Preservar prevenção de replay e testes.
- **NÃO** adicionar `touchmove.preventDefault()` global: os grids já usam pointer capture e `touch-action:none`, evitando bloquear interação e acessibilidade.
- **NÃO** assumir que `wrangler.toml` existe: este repositório usa `wrangler.jsonc`; flags ficam desligadas por padrão.

## Bloqueios para produção
1. PRs #223, #229 e #233 precisam revisão e integração em ordem, respeitando os estados Draft e a CI de cada novo SHA.
2. Backup e teste de restauração D1; conferir migrações aplicadas. Nenhum `d1 migrations apply --remote` neste patch.
3. Homologar checkout sandbox real, HMAC de notificação, valor pago, replay e conciliação. Aprovar comercialmente os preços P4–P8 (e eventual pacote de R$3,99) antes de ativar flags.
4. Validar APK assinado no Android físico e retorno do WebGL após suspensão; monitorar taxa de erro e desempenho.
5. Implantação gradual e reversível por contas permitidas, sem liberar novas compras ao público até validação.
