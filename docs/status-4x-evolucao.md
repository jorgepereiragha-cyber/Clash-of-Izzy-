# Auditoria funcional — Clash of Izzy

Atualizado em 15 nov 2026. Este documento separa o que existe no repositório, o que foi validado automaticamente e o que ainda não corresponde ao jogo 4X planejado. Código presente não é sinônimo de funcionalidade validada em produção.

## Escopo do produto

O objetivo continua sendo um jogo de estratégia medieval 4X, persistente e prioritariamente móvel: desenvolver um reino, produzir recursos, construir, pesquisar, treinar exércitos, explorar e disputar o mapa, cooperar em alianças, participar de eventos mundiais e progredir com heróis e cosméticos.

## Estado por sistema

| Sistema | Estado no código | Diferença para o resultado desejado |
|---|---|---|
| Reino e economia | Estado persistente em Cloudflare D1; produção aplicada no servidor | Falta telemetria de economia e balanceamento com partidas reais |
| Construção | Melhorias passam a usar fila persistente e conclusão agendada nesta versão | Ainda há uma única fila de construção por reino; não há cancelamento ou aceleração visível |
| Treinamento | Fila persistente e entrega de unidades na conclusão; quantidade limitada a 100 por ordem | Não há múltiplas filas, promoção de tier ou treinamento em lote encadeado |
| Pesquisa | Fila persistente, níveis confirmados no servidor | Árvore ainda é curta; pré-requisitos e efeitos precisam ser expandidos e balanceados |
| Exército | Catálogo de unidades e quantidades persistentes; schema agora aceita magos | Não há formação de marcha completa, reforços entre reinos ou counters de PvP completos |
| Marchas | Persistentes e resolvidas pelo cron | Ações ofensivas são PvE contra territórios neutros; ataques PvP estão explicitamente bloqueados |
| Mapa mundial | Territórios com coordenadas, terreno, recursos e proprietários são exibidos como pins | Ainda não é um mapa 4X extenso com tiles, zoom, exploração, névoa de guerra e fronteiras dinâmicas |
| Combate | Simulador no Worker com relatórios e regras server-authoritative | PvP, defesa de cidade, rally, reforços, cerco e balanceamento competitivo ainda não estão completos |
| Alianças | Criação/entrada, membros, convites, chat, doações, guerras e estados persistentes | Fluxos de rally, ajuda temporizada, diplomacia e guerra de território precisam de validação ponta a ponta |
| Heróis e equipamentos | Inventário, heróis, equipamentos e bônus validados no servidor | Faltam mais personagens, habilidades/efeitos ligados a batalhas e validação visual integrada |
| Evento Anjo da Morte | Evento PvE mundial com vida, pontuação, ataques e recompensas persistentes | Precisa de playtest, telemetria e ajuste de dificuldade/recompensas com população real |
| Loja | Pedidos auditáveis e aprovação Master idempotente | Ainda não há gateway PIX/cartão e confirmação automática por webhook |
| Busca mundial | FTS5, trigramas, tolerância controlada a erros, português e busca CJK por substring | Não é crawler da Internet; falta segmentação por dicionário CJK, romanização e telemetria de relevância |
| Cidade 3D | Renderizador Three.js isométrico progressivo, materiais procedurais e fallback | A arte final de castelo/heróis/monstros ainda precisa de GLBs aprovados e testados em Android físico |
| PWA/offline | Shell, navegação e tela offline em cache | Batalhas e sincronização exigem Internet; offline não é modo de jogo completo |

## Correções nesta etapa

1. Foi criada a migração 0016_strategy_queues_and_mage.sql, sem alterar migrações históricas.
2. A tabela de tropas é reconstruída preservando os registros e incluindo mage, já existente no catálogo de unidades do Worker.
3. Foi criada a tabela kingdom_queues com três faixas independentes por reino: construção, treinamento e pesquisa. Cada faixa permite uma ordem ativa por vez.
4. Os custos são debitados ao iniciar uma ordem; edifícios, unidades e níveis de pesquisa só são entregues na conclusão.
5. O Worker resolve ordens vencidas pelo cron e também ao consultar o estado do reino. A conclusão usa token único e guarda de estado para impedir pagamento/recompensa duplicados sob concorrência.
6. A central do reino agora apresenta filas e cronômetros, e permite iniciar treinamento e pesquisa. A PWA recebe novo identificador de cache para buscar a interface atualizada.
7. O endpoint de saúde passa a verificar a presença da tabela de filas.

## Validação obrigatória antes da produção

- Executar a suíte npm test.
- Aplicar todas as migrações num D1 local descartável e validar a migração 0016 em banco com dados de tropas existentes.
- Validar npm run check e o bundle do Worker.
- Testar duas ordens simultâneas da mesma faixa, três ordens em faixas diferentes, recursos insuficientes, falha/retry, conclusão concorrente e recompensa única.
- Testar em Android real a interface, o service worker, a renderização 3D, o consumo de memória e o comportamento sob perda de conexão.
- Confirmar migração remota e publicação Cloudflare separadamente; CI verde não comprova deploy remoto nem experiência testada em aparelho.

## Próximas prioridades reais

1. Mapa e PvP: resolver ataques entre reinos com proteção, muralhas, reforços, retorno de tropas, idempotência e relatórios; depois construir mapa navegável em escala, zoom, névoa de guerra e coordenadas.
2. Economia e progressão: auditoria transacional completa, ledger para todas as fontes/sumidouros, limites de produção/armazenamento, filas configuráveis e balanceamento.
3. Alianças: rally e reforços, ajuda mútua temporizada, objetivos coletivos, guerra e moderação; testar em D1 com múltiplos reinos.
4. Arte 3D: substituir progressivamente formas procedurais por GLBs autorais/licenciados com PBR, LOD, atlas e texturas comprimidas; cada asset deve ter origem/licença, tamanho e validação Android.
5. Busca multilíngue: benchmark anotado em português, inglês, chinês, japonês e coreano; só então avaliar segmentadores ICU/dicionários e possíveis serviços externos.
6. LiveOps e monetização: ferramentas administrativas de eventos, métricas agregadas com privacidade, gateway de pagamento e webhook assinado antes de vender itens como pagamento automático.

## Regras para não regredir

- Não duplicar tabelas ou sistemas de inventário que já existem.
- Não editar migrações aplicadas; criar sempre o próximo número.
- Não tornar o cliente autoridade de economia, batalha, progressão ou recompensa.
- Não ativar PvP nem pagamentos reais sem testes de integração, proteção contra repetição e regras operacionais.
- Não declarar assets finais ou performance Android antes de inspeção e teste em dispositivos reais.
- Manter referências de jogos estrangeiros como inspiração de engenharia e UX, sem copiar IP, personagens, mapas, assets ou interfaces protegidos.
