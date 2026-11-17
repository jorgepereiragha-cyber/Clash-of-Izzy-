# Atualizações pesquisadas e adaptadas — 17/11/2026

Branch: `release/one-shared-realm-early-access`  
PR: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/120

## O que foi adaptado nesta rodada

### 1. Privacidade das contas

- As respostas de `/api/account/login`, `/api/account/status` e `/api/account/register` deixam de enviar o endereço de e-mail completo.
- O servidor retorna somente `emailMasked`, por exemplo `c***@example.com`.
- Testes cobrem formatos inválidos e garantem que o valor original não apareça na resposta.
- A interface de conta exibe somente o e-mail mascarado.
- O contrato `coi_game_token` foi preservado: leitura/escrita em `localStorage` e `sessionStorage`; nenhum identificador de jogador ou senha foi alterado.

### 2. Three.js no mesmo domínio

- Three.js permanece fixado em `0.187.0` (r187), sem atualizar para versão de desenvolvimento.
- `scripts/vendor-three.mjs` gera `vendor/three/` a partir do pacote npm fixado. O gerador copia somente módulos usados, dependências relativas, licença e os recursos de runtime Draco/Basis.
- `wrangler.jsonc` executa o gerador pelo `build.command`; `npm test` e `npm run test:e2e` também preparam o manifesto antes dos testes.
- Cidade, mapa mundial, arena, pós-processamento e carregador GLTF resolvem os módulos pelo import map `/vendor/three/`, sem depender do jsDelivr para o runtime 3D.
- GLTFLoader recebe os decodificadores Draco, KTX2/Basis e Meshopt com caminhos locais.
- O cache PWA foi elevado para `clash-of-izzy-shell-v28`. No evento de instalação, o Service Worker valida o manifesto (formato, versão e prefixo dos caminhos) e adiciona os módulos/decodificadores locais ao cache junto com o shell.
- O manifesto/ficheiros gerados ficam fora do Git por `.gitignore`, mas continuam disponíveis como assets públicos do Worker. O script Node que gera o vendor é excluído dos assets públicos por `.assetsignore`.
- Foi acrescentado teste de integração Playwright para ativação do Service Worker e primeira resolução dos módulos/decodificadores com a rede desligada. Isso prova o cache do shell, GLB e runtime 3D; não promete gameplay autenticado ou sincronização D1 offline.

### 3. Verificação de implantação

- O smoke read-only agora valida o manifesto Three.js, os decodificadores, os import maps e a ausência de dependência direta do CDN nas telas e módulos principais.
- Os testes de sintaxe verificam os entry points 3D.
- O teste de deploy continua somente de leitura: não cria jogador, não registra pedido e não altera dados.

## Decisões de arquitetura com base na pesquisa

### Permanecer no Workers/D1 Gratuito, mas sem prometer população fixa

Os limites oficiais do Workers Free incluem 100.000 requests por dia, 10 ms de CPU por invocação e 50 subrequests por invocação. O D1 Free possui 5 milhões de linhas lidas/dia, 100 mil linhas escritas/dia, limite de 500 MB por banco e 50 subconsultas por invocação. Os batches já existentes diminuem chamadas/subrequests, mas as linhas lidas e escritas continuam consumindo quota.

**Decisão:** manter os batches e lotes de Cron atuais; medir CPU, latência, linhas lidas/escritas e backlog no Preview antes de definir qualquer máximo público de jogadores. Não inventar um número de capacidade com base apenas em testes unitários.

### Preview precisa de D1 separado

- O D1 candidato de Preview configurado é `izzy-preview-17112026` (`6674c0ac-3636-4e57-bff8-23cf60ab9637`).
- O D1 de produção continua sendo `clash-of-izzy-db` (`7e63af59-d9ff-4159-a9cf-b02e35b92605`).
- A CI valida as migrations localmente nos dois perfis. Isso não confirma que o recurso Preview remoto exista ou esteja acessível na conta Cloudflare.
- Previews que usam o mesmo database ID compartilham dados. Cron Triggers não executam em Preview.

**Decisão:** não executar `npm run db:migrate:preview:remote` até confirmar no painel Cloudflare que o D1 candidato existe e é descartável. Nunca apontar as migrations de Preview para o banco de produção.

### Não adicionar infraestrutura sem necessidade medida

- **Durable Objects:** não adicionados. Um objeto central pode criar um gargalo para o mundo único se for usado como autoridade de todas as ações; D1 continua a fonte de verdade.
- **Queues:** não adicionadas ao loop principal. O limite gratuito de operações/dia e a retenção limitada exigem um benefício medido; os lotes D1/Cron existentes são mais simples para a edição inicial.
- **Turnstile:** é uma opção gratuita para proteger formulários públicos contra bots, mas não foi ativado porque exige criar o widget no painel e configurar Site Key/Secret Key. Nenhuma chave foi inventada ou gravada.
- **Cache HTTP imutável:** não aplicado globalmente a nomes estáveis como `kingdom.html` ou `world-map-3d.js`. A recomendação oficial de cache imutável serve melhor a arquivos com nome/hash versionado; a PWA usa cache versionado do Service Worker.
- **Observabilidade:** mantém-se ativa. Monitorar requests, duração, erros e CPU no Workers Metrics, além de `rows_read`/`rows_written` do D1. Rever amostragem/retention de logs antes da mudança de preços de Observability prevista para 01/12/2026.

## Portões ainda obrigatórios antes da publicação

1. Confirmar no painel Cloudflare que o D1 Preview candidato existe, é descartável e continua diferente do D1 de produção.
2. Aplicar migrations somente no D1 Preview confirmado e validar autenticação, estado do reino, construções, chat, alianças, marchas, mapa e equipagem das seis skins.
3. Testar um pedido de demonstração pelo WhatsApp e a liberação Master em staging; o WhatsApp não confirma pagamentos automaticamente.
4. Verificar a PWA no Android físico: primeiro carregamento, instalação, toque, memória, retorno após suspensão e cache offline. Playwright/Chromium não substitui aparelho real.
5. Medir /api/game/state e o Cron em staging com carga gradual; não executar benchmark contra produção.
6. Antes de produção, capturar backup/Time Travel bookmark e executar o workflow manual protegido; validar com smoke read-only depois.

## Referências oficiais consultadas

- [Workers — limites e quotas](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 — preço e quotas por plano](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 — limites de banco e consultas](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 — batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Workers — recursos isolados em Previews](https://developers.cloudflare.com/workers/configuration/previews/)
- [Workers — comparação de Version URLs e Previews](https://developers.cloudflare.com/workers/configuration/previews/)
- [Wrangler — configuração de build](https://developers.cloudflare.com/workers/wrangler/configuration/#build)
- [Workers Builds — build command](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Three.js — release r187](https://github.com/mrdoob/three.js/releases/tag/r187)
- [Cloudflare Turnstile — planos e limites](https://developers.cloudflare.com/turnstile/plans/)

## Preservação

Nesta rodada não foram aplicadas migrations remotas, não houve deploy de produção, não foram alterados secrets, tokens de jogadores, compras, inventários ou progresso. O mundo compartilhado, as skins e a economia permanecem na PR #120 para validação e revisão antes do merge.
