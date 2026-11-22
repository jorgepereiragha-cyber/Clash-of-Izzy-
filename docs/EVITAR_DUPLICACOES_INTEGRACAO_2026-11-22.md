# Clash of Izzy — compatibilidade e prevenção de duplicações (22/11/2026)

Este inventário reconcilia o resumo externo com o repositório **real**. Código apresentado no chat não equivale a código implantado e nomes sugeridos pelo resumo não devem substituir automaticamente os contratos existentes.

| Item mencionado no resumo | Fonte de verdade encontrada no repositório |
|---|---|
| Novo `src/index.js` e rotas paralelas | `worker.js` com API e módulos existentes; `wrangler.jsonc` aponta para `worker.js` |
| Novo `wrangler.toml` | `wrangler.jsonc` usado nos comandos de npm e CI |
| Novo `package.json` | `package.json` já existe, Node 22, Wrangler 4, Three.js e Playwright |
| Novo banco, tabela `city_buildings` | D1 existente e `kingdom_buildings`; `city-layout-rules.js` e ação `city_layout_move` |
| Novo PWA em `public/sw.js` | `sw.js` e `manifest.json` na raiz |
| Novo catálogo de doações com recompensas | `vip_packages` e `purchase_requests` existentes; `support_orders` apenas para contribuições voluntárias sem benefícios |
| Novo motor de floresta | `world-map-3d.js` já otimizado com instâncias 3D |
| Executar schema novo em produção | **Não fazer**: auditar `d1_migrations`, testar local/Preview e aplicar migrações incrementais via fluxo protegido |

## Correção específica na PR #223

Havia dois arquivos com prefixo `0039_`. A migração de contribuições voluntárias permanece `0039_support_orders.sql`; o catálogo de pacotes passa a `0040_support_packages.sql`. Nenhuma tabela, produto ou dado foi apagado. Os testes de regressão em `tests/no-parallel-architecture.test.js` bloqueiam novos prefixes repetidos a partir da versão 0037 e as estruturas paralelas propostas pelo resumo.

**Atenção:** o histórico anterior a 0037 já contém migrações com números iguais; preservar os nomes de arquivos possivelmente aplicados. O controle de D1 registra os nomes completos no banco e a migração remota exige comparação com o estado real antes da publicação.

## Portas para entrega

1. Executar `npm test`, `npm run check` e as migrações no D1 **local**, mais Playwright.
2. Corrigir o conflito de integração da PR #223 com `main`; não assumir que código de PR está em produção.
3. Homologar recompensas, desbloqueio único, idempotência de pedidos e webhooks em Preview isolado.
4. Testar visualização/touch e instalação em dispositivo Android físico; depois validar o APK assinado.
5. Somente então considerar merge, migração remota e publicação pelos workflows protegidos.

Nenhum comando de criação de banco, publicação em produção, cobrança ou modificação remota do D1 é parte desta correção.
