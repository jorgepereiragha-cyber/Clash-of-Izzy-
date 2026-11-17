# Auditoria de prontidão — edição inicial no plano Cloudflare Gratuito

Data: 17 de novembro de 2026  
Branch de trabalho: `release/one-shared-realm-early-access`  
PR de lançamento: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/120

## Decisão de arquitetura do mundo

Eldoria é um único reino/servidor compartilhado por todos os jogadores. A tabela legada `kingdoms` descreve a cidade/castelo de cada jogador, não um mundo privado. A main auditada anteriormente dividia os castelos em `map_region` diferentes após 400 posições. A edição inicial remove essa divisão, mantém `map_region = 1`, amplia a grade global em 20 colunas e reposiciona os marcadores antigos na migration 0026. A consulta do mapa carrega somente os castelos próximos, sem dividir o servidor.

## Alterações aplicadas nesta branch

1. **Reino compartilhado:** novo módulo de coordenadas, migration `0026_single_shared_realm.sql`, consulta do mapa sem filtro por região e testes que cobrem até 10.000 posições, incluindo o 401º castelo.
2. **Edição de skins:** catálogo pago inicial limitado a seis entradas, sem apagar catálogo, inventários ou pedidos antigos.
3. **Carga do plano Gratuito:** Cron continua a cada minuto, mas processa lotes controlados: 3 filas globais, 1 grupo de reino/2 marchas no fallback global, 1 rally, 10 recompensas de evento por execução, 10 recompensas diárias de Valhalla por execução, 1 e-mail e limpeza em lotes.
4. **Chat eficiente:** nova rota autenticada `GET /api/game/alliance/chat` retorna somente a conversa da aliança; a arena não baixa mais o estado inteiro do reino a cada atualização. A frequência do chat passou a 15 segundos e a atualização das filas do reino a 60 segundos.
5. **Sessão do chat:** o token é lido primeiro de `localStorage` e depois de `sessionStorage`, sem ignorar o segundo quando o primeiro está vazio.
6. **Skins equipáveis:** migration `0027_castle_skin_equipment.sql`, ação autenticada `castle_skin_equip`, validação de propriedade em `player_skins`, seleção na cidade e loja, e aparência propagada aos castelos do mapa compartilhado.
7. **Testes adicionados:** coordenadas do mundo único, lotes do Cron, feed do chat, proteção administrativa e equipagem autorizada de skins.

## Limites reais a observar no plano Gratuito

A documentação oficial consultada em 17/11/2026 indica 100.000 requisições Workers por dia, 10 ms de CPU por chamada HTTP e por Cron, e 50 subrequisições por invocação. No D1 Gratuito há 5 milhões de linhas lidas/dia, 100 mil linhas escritas/dia, 500 MB por banco e 5 GB de armazenamento total da conta. Uma chamada `db.batch()` conta como uma subrequisição D1, mas todas as linhas lidas/escritas continuam sujeitas às quotas.

A redução de lotes e chamadas de chat ajuda a respeitar esses limites, mas ainda não existe medição de CPU e subrequisições D1 do endpoint completo `/api/game/state` no runtime remoto. Portanto, não há um número tecnicamente comprovado de jogadores simultâneos. O benchmark deve ser executado apenas em Preview/staging descartável.

## Pendências obrigatórias antes de cobrar/publicar

- **CI #963 aprovada numa versão anterior, antes da equipagem de skins:** 259/259 testes Node, Worker+D1, 3/3 cenários Playwright móveis, diagnóstico e smoke de produção somente leitura, e `wrangler deploy --dry-run` (357,25 KiB / 77,53 KiB gzip). A nova CI #966 está validando a PR #120, incluindo migration 0027 e equipagem; ainda não considerar o HEAD atual aprovado.
- Segurança administrativa: PR #116 foi integrada à `main` no commit `d94849fa38617dc8668cf8ab2dfed88984c094ab` após CI #941 verde. A proteção ainda precisa chegar à produção pelo workflow manual protegido.
- **D1 de Preview ausente:** `wrangler.jsonc` tem `previews: {}` e não declara um banco D1 separado. Criar/confirmar um D1 descartável, adicionar `preview_database_id` sem tocar no binding de produção e validar somente nele. Não reutilizar o segundo ID antigo sem confirmar seu nome e finalidade.
- Mercado Pago: confirmar no Worker os secrets `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`; executar compra de teste e receber webhook assinado. Sem essas credenciais, a loja usa link compartilhado e revisão manual Master.
- Skins: equipagem e visualização foram implementadas nesta branch. A validação Worker+D1 e Playwright da migration 0027 e dos fluxos de propriedade está na CI #966; não vender como entregue em produção antes do merge/deploy.
- Android físico: testar cidade/mapa 3D, toque, PWA standalone, retomada de sessão, cache e consumo de memória.
- Capacidade: medir CPU real, consultas D1 por `/api/game/state`, linhas lidas/escritas e backlog do Cron em staging antes de fixar limite público de jogadores.

## Preservação

A correção de segurança da PR #116 foi publicada no código da `main`, mas ainda não foi implantada na produção; nenhum deploy de produção foi iniciado; nenhuma migration remota foi aplicada; nenhum banco, token, secret, conta, progresso, tropas, compras ou inventário foi apagado. A branch e a PR permanecem como proposta revisável até os gates acima passarem.

## Sequência de lançamento

1. Concluir CI/revisão da nova PR de lançamento, já baseada na main com a segurança administrativa integrada.
2. Criar/confirmar D1 de Preview separado e validar migrations 0026/0027, autenticação, mapa, marchas, rallies, chat e equipagem.
3. Confirmar credenciais Mercado Pago e executar compra + webhook de teste; se não houver configuração, manter revisão manual Master com informação transparente.
4. Testar no Android físico e obter backup/bookmark de produção.
5. Executar workflow de deploy manual protegido após aprovação explícita.
6. Fazer smoke test público read-only e uma compra real de baixo valor, autorizada pelo dono do projeto.

**Conclusão:** a arquitetura de reino compartilhado e o perfil inicial de cargas gratuitas estão implementados na branch. O jogo ainda não está liberado para produção por esta alteração; a maior parte dos próximos bloqueios é validação remota, segurança e garantia de que os itens vendidos são utilizáveis.
