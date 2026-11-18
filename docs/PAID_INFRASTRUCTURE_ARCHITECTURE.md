# Arquitetura de infraestrutura paga — Clash of Izzy / Eldoria

Data de referência: 18/11/2026  
Objetivo: preparar a edição compartilhada Eldoria para evoluir do Workers Free ao Workers Paid, sem duplicar a fonte de verdade, dividir a comunidade em mundos privados ou introduzir servidor Node/Discloud paralelo.

## 1. Decisão de arquitetura

A hospedagem principal continuará na Cloudflare:

- **Workers Paid:** camada de execução HTTP/API e conteúdo dinâmico.
- **D1:** banco autoritativo de jogadores, castelos, economia, tropas, alianças, filas, inventário, compras e relatórios.
- **Durable Objects (SQLite):** salas WebSocket regionais, presença e coordenação temporária de eventos em tempo real.
- **Queues:** trabalhos assíncronos com retries e dead-letter queue, quando a implementação dos consumidores estiver pronta.
- **R2:** assets grandes/versionados (skins, modelos 3D, texturas, replays e pacotes de mídia) quando o volume justificar.
- **Workers Logs/Observability:** erros, latência, CPU, invocações, consumo de D1/DO/Queues e alertas.
- **D1 Time Travel + exportações:** recuperação e cópias de segurança.

Não adicionar VPS Node, Discloud, segundo banco de economia ou cópia paralela de identidades. A mudança para Workers Paid é feita no plano da conta; não existe um servidor físico que precise ser configurado dentro do repositório.

## 2. O reino continua único

Eldoria continua sendo o único reino público. Salas/partições de Durable Objects são unidades internas de capacidade e não mundos separados visíveis ao jogador.

A regra deve ser:
- D1 persiste e valida a posição real do castelo e a região calculada no servidor.
- O Worker resolve qual sala interna corresponde à região/célula.
- O identificador de sala nunca é aceito como autoridade vindo do navegador.
- Ao atravessar uma região, o cliente faz handoff controlado entre salas.
- Eventos econômicos e de combate são sempre validados e persistidos pelo Worker/D1; WebSocket transporta notificações/estado transitório, não concede recompensas.
- Não usar um único Durable Object chamado `eldoria` para coordenar todos os jogadores em escala global.
- Não aumentar o limite provisório de 200 conexões como se fosse uma meta de capacidade. O teto precisa ser substituído por benchmark, sharding e observabilidade.

O Durable Object atual em `feature/eldoria-realtime-free` é apenas um piloto de presença/heartbeat; não é um sistema multiplayer completo.

## 3. Plano Workers Paid e orçamento

Referência oficial atual:
- Workers Paid: assinatura base de US$ 5/mês, incluindo 10 milhões de requisições dinâmicas e 30 milhões de milissegundos de CPU por mês; excedentes de requisição e CPU são cobrados por milhão.
- Limite de CPU por invocação: até 5 minutos no Paid, sujeito a configuração e limites específicos.
- D1 Paid: 25 bilhões de linhas lidas/mês e 50 milhões escritas/mês incluídas; acima disso há cobrança por milhão. Os primeiros 5 GB de armazenamento estão incluídos.
- D1 SQLite: máximo de 10 GB por banco individual; Time Travel de até 30 dias no Paid.
- Durable Objects Paid: 1 milhão de requests/mês e 400.000 GB-s incluídos, com cobrança acima da franquia. Mensagens WebSocket contam com proporção de 1 request faturável por 20 mensagens.
- Queues Paid: 1 milhão de operações/mês incluídas; operação adicional é cobrada. Em geral, consumir mensagem gera write + read + delete.
- R2 Standard: franquia de 10 GB-mês, 1 milhão de operações A e 10 milhões B; egress para Internet sem custo. Fora da franquia, storage/operations são cobrados.

Valores de referência devem ser reconferidos no Dashboard antes da contratação. Conversão de USD para BRL, impostos e tarifas do cartão variam.

Fontes oficiais:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/queues/platform/pricing/
- https://developers.cloudflare.com/queues/platform/limits/
- https://developers.cloudflare.com/r2/pricing/

## 4. Componentes e ordem de ativação

### P0 — necessários para operar com segurança
1. Workers Paid no account onde `clash-of-izzy` já está publicado.
2. Spending limit para uso variável de Workers, separado da assinatura.
3. Métricas de Worker, D1 e Durable Objects com alertas.
4. Segredos de produção e Preview isolados; nenhum valor sensível em `vars`, GitHub, HTML ou logs.
5. D1 Time Travel habilitado no plano e exportação periódica testada.
6. Workflow de produção manual, com confirmação explícita, backup/check de migrations, deploy e smoke test somente de leitura.

**Atenção ao spending limit:** quando alcançado, novas invocações de Workers podem ser rejeitadas, incluindo HTTP, Cron e consumers de Queue. Assets estáticos que não passam pelo Worker podem continuar disponíveis; rotas dinâmicas podem falhar. Definir limite que proteja a conta sem interromper o jogo inadvertidamente.

### P1 — processamento assíncrono
Criar Queue somente quando houver producer e consumer reais, idempotentes e testados. Primeiros candidatos:
- envio de e-mail e notificações;
- eventos de analytics não críticos;
- processamento de notificações de combate;
- tarefas de limpeza e distribuição de recompensas em lotes.

Não enviar para Queue uma mutação econômica sem chave de idempotência, registro persistente e regra de retry. Configurar retry, backoff, limite e dead-letter queue; monitorar backlog/idade. Queue tem entrega at-least-once, portanto duplicatas são possíveis e precisam ser inofensivas.

Não mover a fonte de verdade de D1 para Queue, KV ou memória.

### P1 — multiplayer distribuído
1. Corrigir autenticação do handshake de navegador com ticket curto, assinado/aleatório, single-use e expiração, emitido após Bearer auth no Worker. Nunca colocar o token principal em query string.
2. Hibernar WebSockets quando o Durable Object estiver ocioso, evitando manter duração faturável sem trabalho.
3. Criar salas por região/célula calculada no Worker/D1; testar isolamento, handoff e limite por sala.
4. Entregar somente mensagens validadas; cliente não envia saldos, tropas, resultados, recompensas nem IDs privados.
5. Testar dois clientes autenticados, reconexão, aba oculta, perda de rede, flood, ticket expirado/reutilizado e saturação de uma região.
6. Só depois do benchmark decidir capacidade por sala e quantidade de salas. Um Durable Object individual é single-threaded; a documentação informa limite soft de cerca de 1.000 requests/s por objeto, não uma garantia de FPS, latência ou capacidade de jogadores.

### P2 — armazenamento de assets e conteúdo
- Manter os GLBs atuais no fluxo same-origin enquanto a biblioteca for pequena.
- Migrar assets volumosos para R2 quando tamanho/uso justificarem, mantendo manifesto/versionamento e cache CDN.
- Não armazenar estado econômico, sessões ou inventário em R2.
- Usar URLs públicas versionadas para arquivos públicos; upload administrativo deve ser autenticado e limitado.

### P2 — expansão do banco
- Manter D1 atual como fonte oficial e medir rows read/written, latência, tamanho, índices e consultas lentas.
- O limite de 10 GB é por banco, mesmo no Paid. Aproximando-se dele, desenhar partição por domínio/entidade com plano de migração e reconciliação; não dividir Eldoria em mundos por jogador.
- Não implementar múltiplos bancos antes de demonstrar a necessidade com métricas e definir transações/consistência entre eles.

## 5. Plano de testes de capacidade

Executar somente em um D1 descartável e um Worker de carga separados:
- 50 contas/reinos QA iniciando construções;
- 20 marchas simultâneas;
- 5 rallies com até 10 participantes cada;
- 120 e 200 rallies sintéticos vencidos para testar drenagem do backlog;
- picos graduais de conexões WebSocket por região.

Medir em quadros separados:
1. API: RPS, p50/p95/p99, 2xx/4xx/429/5xx e timeout.
2. D1: linhas lidas/escritas, batches, subrequests, duração e tamanho.
3. Durable Objects: conexões, mensagens, requests faturáveis, GB-s e duração ativa.
4. Queues: mensagens aceitas, retries, DLQ, backlog e idade máxima.
5. Worker: CPU p50/p95/p99, memória, invocações e consumo mensal estimado.

Critério de partida sugerido para staging, não garantia de serviço:
- mutações válidas p95 abaixo de 1 s e p99 abaixo de 2 s;
- zero duplicação de débito, tropas, saque, prêmio ou batalha após retry;
- backlog retorna a zero após pico dentro do SLO;
- API do jogo funciona sem WebSocket e sem Queue;
- nenhum teste ou carga atinge D1/segredos de produção.

## 6. Preview e proteção de produção

- Worker Preview tem binding D1 separado de produção: Preview `6674c0ac-3636-4e57-bff8-23cf60ab9637`; produção `7e63af59-d9ff-4159-a9cf-b02e35b92605`.
- A existência e conteúdo do D1 de Preview ainda precisam ser confirmados na conta Cloudflare antes de aplicar migrations remotas.
- Previews usando mesmo `database_id` compartilham dados.
- Durable Objects declarados por binding `env` precisam de binding correspondente no bloco `previews`; a própria namespace/storage de uma classe declarada localmente pode ser isolada automaticamente por Preview conforme o padrão de acesso usado.
- Secrets são configurados separadamente na Previews Base ou no Preview individual. Não copiar segredos de produção.
- Não adicionar Cron triggers, Queue consumers ou rotas de produção no bloco Preview: a documentação de Previews indica limitações desses recursos.
- Cron Triggers não executam em Previews; validar agendamento por testes locais/Worker-D1 e staging específico sem tocar em produção.
- Nunca usar Version URL como prova de isolamento, pois ela utiliza recursos de produção.

Documentação:
- https://developers.cloudflare.com/workers/previews/configuration/
- https://developers.cloudflare.com/workers/previews/resources/

## 7. O que NÃO ativar agora

- Não contratar ou provisionar Containers só para executar o jogo; a arquitetura atual não precisa de um processo Node persistente.
- Não configurar Redis externo nem PostgreSQL paralelo antes de provar limitação do D1.
- Não ativar R2 até haver volume que justifique.
- Não criar Queue vazia ou consumidor sem idempotência.
- Não aumentar o limite de conexões WebSocket com base apenas em testes unitários.
- Não mover combate/economia para o cliente.
- Não executar carga, migration remota, secret update ou deploy sem Preview validado, backup e aprovação.

## 8. Critérios de liberação da infraestrutura paga

- [ ] Workers Paid ativado pelo proprietário da conta e orçamento máximo registrado.
- [ ] Spending limit e alertas configurados; consequência de limite atingido aceita conscientemente.
- [ ] D1 Preview remoto validado por UUID, com migrations aplicadas exclusivamente na base isolada.
- [ ] Credenciais Master e sessão de QA exclusivas de Preview.
- [ ] Fluxo de compra manual WhatsApp + liberação Master validado com conta descartável.
- [ ] Realtime usa ticket single-use e teste de cliente real antes de produção.
- [ ] Sharding regional aprovado por benchmark e custo.
- [ ] Teste Android físico (PWA, toque, memória, rede, retomada) anexado.
- [ ] Backup/Time Travel e recuperação testados.
- [ ] Workflow manual protegido e smoke test read-only aprovados.

**Estado em 18/11/2026:** plano e arquitetura preparados; não foi ativado plano pago, criado Queue/R2, aplicado migration remota, alterado segredo, executada carga ou feito deploy de produção.
