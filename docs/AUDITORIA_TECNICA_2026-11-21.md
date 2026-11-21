# Auditoria técnica do Clash of Izzy — 21/11/2026

## Escopo da inspeção

Inspeção da branch `main`, configurações Cloudflare, módulos de renderização, mecanismo de assets, Service Worker, testes e backlog de pull requests/issues. Evidências são de leitura estática e documentação disponível no repositório. Não foram executados testes de carga, inspeção em celulares físicos, migrações remotas nem deploy.

## Resultado operacional

O jogo já possui Worker, D1 com migrações locais, autenticação e rate limiting HMAC, uma suíte significativa de testes, fallback 2D e carregamento progressivo de assets 3D. Isso não comprova prontidão comercial ou capacidade de 1.000 jogadores simultâneos.

| Prioridade | Área | Constatação / ação |
| --- | --- | --- |
| P0 — corrigido nesta PR | Cache PWA | `sw.js` da `main` interceptava quase todo GET fora de `/api/` e persistia respostas e URLs arbitrárias, inclusive variantes com parâmetros; a nova política restringe armazenamento ao shell conhecido e assets estáticos elegíveis, evita respostas privadas e autenticação, limita o cache dinâmico a 64 entradas e ignora falhas de quota |
| P0 — pendente | Capacidade real | Dimensionar D1/Worker com concorrência, testes de explosão de requests, latência p95/p99, erros e custo; ver issue #117 e issue #124 |
| P0 — pendente | Staging/produção | Confirmar D1 Preview, bindings e secrets isolados, migrações somente em ambiente de teste, smoke test e rollback; nunca aplicar `db:migrate:remote` como teste |
| P1 — pendente | Multiplayer | PR #122 implementa um piloto com limite temporário, não solução validada para 1.000 conexões. Integrar cliente, salas regionais, reconexão e medir comportamento — issue #123 |
| P1 — pendente | Android 3D | A `main` ainda usa perfil conservador e arte procedural. PR #128 propõe melhorias móveis, mas exige CI, Preview atualizado e testes físicos (FPS, memória, temperatura, toque) |
| P1 — pendente | Economia/PvP | Revisar atomicidade, contratos e idempotência antes de integrar PR #129; reconciliar a Fase 10 de PvP com migrations e ramo Eldoria — issue #125 |
| P1 — pendente | Venda na Play Store | Não disponibilizar venda de bens digitais pelo fluxo legado até implementar o faturamento exigido para a edição Google Play e validar créditos server-side |
| P2 — pendente | Qualidade dos assets | A documentação indica uma base de cinco GLBs CC0; ampliar catálogo de edifícios/unidades e medir custo GPU, LOD, KTX2 e fallback sem sacrificar dispositivos de entrada |

## Mudanças entregues na branch desta auditoria

1. Política de cache restrita a rotas do shell e assets locais conhecidos.
2. Sem interceptação de `/api/*`, requests autenticados ou mutações.
3. Sem armazenamento de URLs com parâmetros, respostas `private`, `no-store`, `no-cache`, com `Set-Cookie`, status diferente de 200 ou respostas opacas.
4. Cache runtime dedicado limitado a 64 entradas; limpeza de versões antigas durante a ativação.
5. Em caso de quota excedida, a entrega da resposta de rede prevalece.
6. Novos testes de regressão com Service Worker simulado e atualização dos testes de versão existentes.

## Critérios para autorizar integração e eventual lançamento

- CI integral verde no commit exato, incluindo Worker bundle, D1 local, validação 3D, Node e Playwright.
- Teste real de instalação/atualização PWA e navegação online/offline em Android e desktop.
- Validação controlada de contas, inventário, pagamentos, economia, eventos e PvP em staging.
- Benchmark reproduzível de concorrência com métricas e limites comprovados antes de declarar suporte a 1.000 jogadores.
- Revisão de proteção de dados, Play Store, recuperação do D1 e observabilidade.

**Limite desta auditoria:** não há afirmação de que a totalidade de funcionalidades foi auditada ou de que a produção foi modificada. Mudanças ficam em branch/PR para aprovação.
