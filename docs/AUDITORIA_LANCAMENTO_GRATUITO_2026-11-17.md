# Auditoria de prontidão — edição inicial no plano Cloudflare Gratuito

Data: 17 de novembro de 2026  
Branch de trabalho: `release/early-access-one-kingdom-six-skins`  
PR: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/118

## Decisão de arquitetura do mundo

Eldoria é um único reino/servidor compartilhado por todos os jogadores. A tabela legada `kingdoms` descreve a cidade/castelo de cada jogador, não um mundo privado. A main auditada anteriormente dividia os castelos em `map_region` diferentes após 400 posições. A edição inicial remove essa divisão, mantém `map_region = 1`, amplia a grade global em 20 colunas e reposiciona os marcadores antigos na migration 0026. A consulta do mapa carrega somente os castelos próximos, sem dividir o servidor.

## Alterações aplicadas nesta branch

1. **Reino compartilhado:** novo módulo de coordenadas, migration `0026_single_shared_realm.sql`, consulta do mapa sem filtro por região e testes que cobrem até 10.000 posições, incluindo o 401º castelo.
2. **Edição de skins:** catálogo pago inicial limitado a seis entradas, sem apagar catálogo, inventários ou pedidos antigos.
3. **Carga do plano Gratuito:** Cron continua a cada minuto, mas processa lotes controlados: 3 filas globais, 1 grupo de reino/2 marchas no fallback global, 1 rally, 10 recompensas de evento por execução, 10 recompensas diárias de Valhalla por execução, 1 e-mail e limpeza em lotes.
4. **Chat eficiente:** nova rota autenticada `GET /api/game/alliance/chat` retorna somente a conversa da aliança; a arena não baixa mais o estado inteiro do reino a cada atualização. A frequência do chat passou a 15 segundos e a atualização das filas do reino a 60 segundos.
5. **Sessão do chat:** o token é lido primeiro de `localStorage` e depois de `sessionStorage`, sem ignorar o segundo quando o primeiro está vazio.
6. **Testes adicionados:** coordenadas do mundo único, lotes do Cron, feed do chat e teste integrado Worker+D1 para ler mensagens de aliança.

## Limites reais a observar no plano Gratuito

A documentação oficial consultada em 17/11/2026 indica 100.000 requisições Workers por dia, 10 ms de CPU por chamada HTTP e por Cron, e 50 subrequisições por invocação. No D1 Gratuito há 5 milhões de linhas lidas/dia, 100 mil linhas escritas/dia, 500 MB por banco e 5 GB de armazenamento total da conta. Uma chamada `db.batch()` conta como uma subrequisição D1, mas todas as linhas lidas/escritas continuam sujeitas às quotas.

A redução de lotes e chamadas de chat ajuda a respeitar esses limites, mas ainda não existe medição de CPU e subrequisições D1 do endpoint completo `/api/game/state` no runtime remoto. Portanto, não há um número tecnicamente comprovado de jogadores simultâneos. O benchmark deve ser executado apenas em Preview/staging descartável.

## Pendências obrigatórias antes de cobrar/publicar

- CI completa e verde no HEAD atual da PR #118. A CI #940 aprovou uma versão anterior. Na CI #947, o teste integrado falhou porque `POST /api/game/start` respondeu HTTP 503 ao fundar o primeiro reino. Ao investigar a consulta do mapa, encontrei dois bindings de coordenada que haviam sido removidos junto com o filtro por região e os restaurei. A causa exata ainda precisa ser confirmada por uma nova CI; os ajustes mais recentes do scheduler e do feed compacto também aguardam validação automatizada.
- PR #116: CI #941 passou por migrations locais, Worker+D1, Playwright móvel, smoke read-only e bundle. A PR permanece Draft e ainda não foi integrada; a correção só protege produção depois de merge e deploy.
- D1 de Preview: confirmar que o banco separado declarado no Wrangler existe e é acessível; aplicar migrations apenas nele e validar start/state, mapa, construção, marchas, rallies, alianças e inventário.
- Mercado Pago: confirmar no Worker os secrets `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`; executar compra de teste e receber webhook assinado. Sem essas credenciais, a loja usa link compartilhado e revisão manual Master.
- Skins: a interface atual informa que as compras entram na coleção, mas ainda não há equipagem e visualização da aparência no castelo. Não anunciar as seis skins como aparência utilizável até implementar isso ou descrever explicitamente o produto como item de coleção.
- Android físico: testar cidade/mapa 3D, toque, PWA standalone, retomada de sessão, cache e consumo de memória.
- Capacidade: medir CPU real, consultas D1 por `/api/game/state`, linhas lidas/escritas e backlog do Cron em staging antes de fixar limite público de jogadores.

## Preservação

Nenhuma mudança foi publicada na `main`; nenhum deploy ou workflow de produção foi iniciado; nenhuma migration remota foi aplicada; nenhum banco, token, secret, conta, progresso, tropas, compras ou inventário foi apagado. A branch e a PR permanecem como proposta revisável até os gates acima passarem.

## Sequência de lançamento

1. CI verde e revisão da PR #116.
2. Integrar a proteção de diagnóstico administrativo.
3. Rebase/atualização da PR #118 sobre a nova main e CI verde.
4. Validar Preview com D1 separado.
5. Fechar a pendência comercial das skins e validar checkout/webhook ou manter a venda explicitamente em modo manual.
6. Testar no Android físico e obter backup/bookmark de produção.
7. Executar workflow de deploy manual protegido.
8. Fazer smoke test público read-only e uma compra real de baixo valor, autorizada pelo dono do projeto.

**Conclusão:** a arquitetura de reino compartilhado e o perfil inicial de cargas gratuitas estão implementados na branch. O jogo ainda não está liberado para produção por esta alteração; a maior parte dos próximos bloqueios é validação remota, segurança e garantia de que os itens vendidos são utilizáveis.
