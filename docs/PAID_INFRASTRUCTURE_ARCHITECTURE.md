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
- Workers Paid: assinatura base de US$ 5/mês, incluindo 10 milhões de requisições dinâmicas e 30 milhões de milissegundos de CPU por mês; excedentes: US$ 0,30 por milhão de requisições e US$ 0,02 por milhão de milissegundos de CPU. CPU máxima por invocação é 5 minutos (o padrão é 30 segundos); isso não aumenta a franquia mensal.
- Limite de CPU por invocação: até 5 minutos no Paid, sujeito a configuração e limites específicos.
- D1 Paid: 25 bilhões de linhas lidas/mês e 50 milhões escritas/mês incluídas; acima disso há cobrança por milhão. Os primeiros 5 GB de armazenamento estão incluídos.
- D1 SQLite: máximo de 10 GB por banco individual; Time Travel de até 30 dias no Paid.
- Durable Objects Paid: 1 milhão de requests/mês e 400.000 GB-s de duração incluídos. Excedentes de requests: US$ 0,15 por milhão; duração: US$ 12,50 por milhão de GB-s. Para fins de faturamento, mensagens WebSocket recebidas são agrupadas na proporção de 20 mensagens para 1 request; mensagens enviadas e pings de protocolo não são cobrados como requests. WebSocket Hibernation reduz a duração faturável enquanto o objeto está ocioso, mantendo clientes conectados.
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
2. Spending limits separados para Workers e Durable Objects, com alertas de orçamento da conta e notificação antes de atingir o limite.
3. Métricas de Worker, D1 e Durable Objects com alertas.
4. Segredos de produção e Preview isolados; nenhum valor sensível em `vars`, GitHub, HTML ou logs.
5. D1 Time Travel confirmado (é automático no backend novo; até 30 dias no Paid) e procedimento de recuperação revisado. Exportação externa é opcional para retenção maior ou cópia independente.
6. Workflow de produção manual, com confirmação explícita, backup/check de migrations, deploy e smoke test somente de leitura.

**Atenção aos controles de gastos:** Workers e Durable Objects possuem limites de gasto separados, cada um compartilhado entre os recursos daquele produto na conta. Ao atingir o limite de Workers, novas invocações podem ser rejeitadas, incluindo HTTP, Cron e consumers de Queue; ao atingir o limite de Durable Objects, as operações suportadas desse produto podem ser pausadas. Assets estáticos sem execução do Worker podem continuar disponíveis. Nenhum desses limites é um teto de fatura: não cobre a assinatura base nem todos os demais produtos/armazenamento; medição atrasada e operações em curso podem ultrapassá-los. O Budget Alert da conta envia aviso sem pausar produtos. Defina limites e alertas conscientemente, pois um limite baixo pode interromper o jogo.

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

## 7. Recuperação e limites financeiros revisados

- D1 Time Travel não exige habilitação ou tarefa de backup Cron: é sempre ativo em bancos no novo storage backend, com até 30 dias no Workers Paid e 7 dias no Free. Conferir `wrangler d1 info`: bancos no backend novo são identificados como `version: beta`; bancos antigos `alpha` usam o mecanismo legado e não suportam a mesma API.
- Restaurar um bookmark sobrescreve o banco no local e cancela queries/transações em andamento. A restauração é operação destrutiva e deve ter aprovação, bookmark anterior anotado e plano de reversão.
- Exportações para R2/armazenamento externo são complementares para retenção maior que 30 dias ou cópia fora da conta; não são requisito para o D1 ter Time Travel.
- Workers e Durable Objects têm controles de spending limit separados, ambos compartilhados entre os recursos do respectivo produto na conta. O limite de Workers pode interromper novas invocações de todos os Workers; o limite de Durable Objects pode pausar operações suportadas de todos os DOs. Nenhum cobre assinatura base, D1 storage, R2, Queues ou outros produtos. Budget Alerts da conta notificam sem bloquear; atrasos de medição podem permitir ultrapassar limites.
- Durable Objects têm billing próprio: requests, duração e SQLite rows/storage. Mensagens WebSocket recebidas aplicam proporção 20:1 para requests; envios/pings não contam como requests. Ativar Hibernation API para conexões ociosas reduz duration; o código atual ainda precisa de revisão para confirmar que usa a API de Hibernation, não apenas `acceptWebSocket()` padrão.

## 8. O que NÃO ativar agora

- Não contratar ou provisionar Containers só para executar o jogo; a arquitetura atual não precisa de um processo Node persistente.
- Não configurar Redis externo nem PostgreSQL paralelo antes de provar limitação do D1.
- Não ativar R2 até haver volume que justifique.
- Não criar Queue vazia ou consumidor sem idempotência.
- Não aumentar o limite de conexões WebSocket com base apenas em testes unitários.
- Não mover combate/economia para o cliente.
- Não executar carga, migration remota, secret update ou deploy sem Preview validado, backup e aprovação.

## 9. Critérios de liberação da infraestrutura paga

- [ ] Workers Paid ativado pelo proprietário da conta e orçamento máximo registrado.
- [ ] Workers e Durable Objects spending limits e alertas configurados; Budget Alert da conta avaliado; consequência de limite atingido aceita conscientemente.
- [ ] D1 Preview remoto validado por UUID, com migrations aplicadas exclusivamente na base isolada.
- [ ] Credenciais Master e sessão de QA exclusivas de Preview.
- [ ] Fluxo de compra manual WhatsApp + liberação Master validado com conta descartável.
- [ ] Realtime usa ticket single-use e teste de cliente real antes de produção.
- [ ] Sharding regional aprovado por benchmark e custo.
- [ ] Teste Android físico (PWA, toque, memória, rede, retomada) anexado.
- [ ] Time Travel conferido (backend production/30 dias) e procedimento de recuperação ensaiado; exportação externa se retenção/cópia independente for necessária.
- [ ] Workflow manual protegido e smoke test read-only aprovados.

**Estado em 18/11/2026:** plano e arquitetura preparados; não foi ativado plano pago, criado Queue/R2, aplicado migration remota, alterado segredo, executada carga ou feito deploy de produção.


## 10. Revisão de capacidade e preços — 19/11/2026

Esta seção substitui qualquer estimativa antiga de capacidade que não esteja acompanhada de benchmark. Os limites abaixo foram conferidos na documentação oficial da Cloudflare em 19/11/2026; preços em USD, antes de câmbio/impostos.

### 10.1 Plano recomendado para a edição atual

**Recomendação: Workers Paid / Standard, começando pelo nível de entrada de US$ 5 por mês por conta.** Não é necessário contratar Cloudflare Enterprise, Containers, VPS/Discloud, Redis externo ou uma segunda base apenas para executar o jogo atual.

| Serviço | Configuração recomendada agora | Inclusão/preço de referência no Paid |
|---|---|---|
| Workers | Manter o Worker `clash-of-izzy` e o mesmo deploy | US$ 5/mês por conta; 10 milhões de requests dinâmicas/mês e 30 milhões de CPU-ms/mês incluídos; excedentes US$ 0,30/milhão de requests e US$ 0,02/milhão de CPU-ms |
| Static Assets | Continuar servindo HTML/CSS/JS/SVG/GLB same-origin pelo binding `ASSETS` | Requests diretas a static assets são gratuitas e ilimitadas no modelo Standard |
| D1 | Manter `clash-of-izzy-db` como fonte autoritativa única | 25 bilhões de linhas lidas/mês, 50 milhões escritas/mês e 5 GB de armazenamento incluídos; excedentes de leitura US$ 0,001/milhão de linhas, escrita US$ 1/milhão e armazenamento US$ 0,75/GB-mês |
| Durable Objects (SQLite) | Não ativar para gameplay público ainda; concluir ticket, cliente e sharding antes | 1 milhão de requests/mês e 400 mil GB-s/mês incluídos; excedentes US$ 0,15/milhão de requests e US$ 12,50/milhão de GB-s |
| Queues | Não criar fila vazia; criar somente junto de producer/consumer idempotentes | 1 milhão de operações/mês incluídas; excedente US$ 0,40/milhão |
| R2 Standard | Não criar bucket nesta fase | 10 GB-mês, 1 milhão de operações A e 10 milhões B incluídos; sem cobrança de egress |
| DNS/zone | Manter a zona/domínio existente; não contratar plano superior apenas para Worker | Plano DNS Free é suficiente para a arquitetura atual, salvo necessidade independente de WAF/recursos de zona pagos |

Workers Paid também aumenta o limite de CPU por invocação HTTP para até 5 minutos (padrão 30 s); não aumenta a memória de 128 MB. O plano Free atual limita Worker a 100.000 requests/dia, 10 ms de CPU por invocação e 50 subrequests. No Paid, o limite de subrequests é 10.000 por invocação e as requests são faturadas conforme uso; não interpretar os 10 milhões incluídos como teto total.

**Orçamento inicial de plataforma:** a parcela base de Workers é US$ 5/mês. Com o tráfego e os armazenamentos dentro das inclusões, D1 e DO dentro das suas franquias e sem outros produtos pagos, esse é o custo mínimo de referência. Não é uma cotação final nem garantia de que o jogo ficará em US$ 5: D1, DO, Queues, R2, domínio, e-mail, pagamentos, impostos e excedentes devem ser acompanhados em suas linhas próprias.

Fórmulas de excedente a usar na planilha mensal:
- Workers = `max(0, requests - 10.000.000) / 1.000.000 × US$0,30` + `max(0, CPU_ms - 30.000.000) / 1.000.000 × US$0,02`.
- D1 = `max(0, rows_read - 25.000.000.000) / 1.000.000 × US$0,001` + `max(0, rows_written - 50.000.000) / 1.000.000 × US$1,00` + armazenamento acima de 5 GB × US$0,75/GB-mês.
- Durable Objects = `max(0, requests - 1.000.000) / 1.000.000 × US$0,15` + `max(0, GB-s - 400.000) / 1.000.000 × US$12,50`.
- Queues = operações acima de 1.000.000 × US$0,40/milhão. Um ciclo típico de entrega de uma mensagem exige write + read + delete (aproximadamente 3 operações); cada retry acrescenta leitura.
- R2 Standard, quando necessário: acima da franquia, US$0,015/GB-mês, US$4,50/milhão de operações A e US$0,36/milhão B; egress permanece sem cobrança.

### 10.2 Gargalo real: D1, não a quantidade de Workers

O Paid não transforma um banco D1 em banco multi-writer. Cada banco D1 individual é single-threaded e processa queries uma por vez. A documentação usa como aproximação teórica até 1.000 queries/s para query de 1 ms ou 10 queries/s para query de 100 ms, mas o overhead de plataforma reduz o throughput real. Esses exemplos não são capacidade de jogadores.

Limites atuais relevantes:
- Até 10 GB por banco D1 individual; esse teto não pode ser aumentado.
- Até 1 TB de armazenamento total da conta no Paid.
- Até 1.000 subqueries D1 por invocação do Worker no Paid.
- Time Travel de até 30 dias no Paid.
- 100.000 bancos D1 incluídos no Paid; o jogo não precisa criar bancos por jogador.

**Decisão de arquitetura:** manter a economia de Eldoria no D1 atual. Não dividir jogadores, castelos ou inventários em bancos por jogador. Primeiro medir tempo de query, rows read/written, índices, batches e concorrência. Uma eventual partição futura deverá ser por domínio/entidade com estratégia transacional e reconciliação explícita, não uma divisão de Eldoria em mundos.

### 10.3 Replicação global de leitura D1 — candidata a P2, não ativar cegamente

A Cloudflare disponibiliza read replicas globais para D1. Para utilizar as réplicas, o Worker precisa usar a D1 Sessions API (`env.DB.withSession(...)`); o código atual usa a interface D1 existente e não deve ser considerado já beneficiado pela replicação.

As réplicas recebem as escritas do primário de forma assíncrona. Todas as escritas continuam indo ao primário. A Sessions API usa bookmarks para fornecer consistência sequencial entre leituras da mesma sessão, incluindo leitura após a própria escrita.

Plano seguro:
1. Criar banco de experimento descartável e medir latência/rows antes.
2. Implementar um adaptador isolado de leitura com `withSession("first-primary")` ou bookmark válido, sem alterar operações econômicas.
3. Propagar bookmark entre chamadas somente onde o contrato da sessão esteja definido e testado.
4. Testar leitura imediatamente após escrita, duas sessões do mesmo jogador, troca de região, bookmark ausente/expirado e réplica atrasada.
5. Pilotar em rotas predominantemente de leitura (por exemplo, catálogo/configuração pública e consultas de mapa apropriadas) antes de considerar o estado completo do reino.
6. Manter compras, saldo, tropas, inventário, propriedade de skin, marcha e concessão de prêmios no caminho autoritativo do primário até prova de consistência e integridade.

Não ativar global read replication como uma opção isolada de painel esperando ganho automático: sem Sessions API, as queries continuam usando o primário.

### 10.4 Durable Objects e WebSocket: requisito de escala e controle de custo

Workers Paid inclui franquias de DO, mas o custo de duração pode superar o custo de requests quando a conexão fica ativa sem hibernação. A Hibernation WebSocket API mantém os clientes conectados sem cobrar duração durante períodos em que o DO está elegível para hibernar. WebSocket protocol ping/pong não deve ser simulado com timers permanentes; timers/alarmes e trabalho em memória impedem a hibernação enquanto ativos.

O protótipo da PR #122 usa `ctx.acceptWebSocket(server)` e `serializeAttachment()`, que correspondem ao modelo de Hibernation WebSocket. Isso é um bom ponto de partida, mas não o torna pronto para produção:
- o protótipo usa um único ID lógico `eldoria` e teto defensivo de 200 sockets;
- não conecta ainda as telas do jogo ao WebSocket;
- não sincroniza movimento, chat global, marcha, combate ou eventos de jogo;
- o número 200 é limite local do protótipo, não capacidade de Cloudflare nem capacidade comercial comprovada.

A documentação apresenta 1.000 requests/s por objeto como limite soft, não throughput garantido. Cada objeto continua single-threaded. O limite de conexões do runtime não é critério de capacidade de jogo: CPU, tamanho de payload, frequência de broadcast, armazenamento e eventos por socket determinam o throughput real.

**Sequência antes de liberar realtime:**
1. Concluir a issue #123 (cliente autenticado, reconexão com backoff/jitter, pausa em aba oculta, fallback HTTP).
2. Derivar sala/região no Worker a partir da posição validada em D1; ignorar qualquer sala arbitrária informada pelo navegador.
3. Criar salas por região/célula com IDs determinísticos e handoff controlado. Eldoria permanece um único reino para o jogador.
4. Enviar somente eventos tipados e autorizados. O Worker/D1 validam a ação e persistem qualquer efeito econômico; DO apenas coordena/presença/transporte.
5. Manter Hibernation API, attachment pequeno e sem timers em espera; medir requests, GB-s, duração acordada e mensagens por socket.
6. Testar 2, 10, 50, 100 e 200 sockets por sala, depois aumentar em passos controlados, verificando latência, erros, reconnect storm, broadcast e custo.
7. Não remover o teto piloto nem anunciar número de jogadores até medir headroom e falhas.

### 10.5 Queues: usar apenas para trabalho que pode ser assíncrono

Queues fornece entrega at-least-once, portanto a mesma mensagem pode ser processada novamente. O consumidor precisa validar novamente a operação e utilizar chave de idempotência persistida em D1. A cobrança é por operação de 64 KB escrita, lida ou excluída; batches não reduzem operações por mensagem.

Primeiros usos adequados quando houver código real:
- e-mails e notificações não críticas;
- analytics e telemetria que não podem atrasar uma ação do jogador;
- tarefas de limpeza e processamento de lotes recuperáveis.

Não usar Queue para confirmar saldo/compra, atribuir gemas ou decidir resultado de batalha sem ledger/idempotência e revalidação. Não mover a fonte de verdade para Queue. Configurar retry, backoff, Dead Letter Queue, alarmes de backlog/idade e replay administrativo com autorização.

### 10.6 R2 e recursos gráficos

O inventário de assets da edição atual é pequeno (a auditoria anterior estimou cerca de 443 KB para os assets examinados). Não criar R2 agora: o armazenamento same-origin e o cache atual são mais simples. Reavaliar R2 para coleções grandes de GLB/KTX2, vídeos, replays ou uploads, com versionamento, licenças e política de cache. R2 não deve guardar estado econômico, sessão, inventário ou progresso.

### 10.7 Segurança financeira e alertas de gasto

A Cloudflare agora oferece spending limits e email alerts separados para Workers e Durable Objects:
- um spending limit pode bloquear operações e interromper aplicações que usam aquele produto em toda a conta;
- o email alert e o Budget Alert notificam sem parar os serviços;
- limites Workers e DO são independentes, não incluem outros produtos, storage ou a assinatura base e não garantem teto absoluto da fatura devido a atraso de medição/operações em andamento.

**Recomendação de lançamento:** habilitar alertas por e-mail para Workers e DO e Budget Alert da conta; acompanhar D1, Queues e R2 nos próprios painéis. Não estabelecer limite rígido baixo sem aceitar que o jogo pode ficar indisponível quando o limite for atingido. Definir um teto rígido só depois de conhecer o consumo do staging e registrar formalmente a consequência de interrupção.

### 10.8 Plano operacional final recomendado

| Fase | Ação | Critério para avançar |
|---|---|---|
| P0 | Proprietário ativa Workers Paid na conta atual e registra orçamento em USD | Plano visível no Dashboard; alertas e responsável definidos |
| P0 | Validar D1 Preview por UUID, secrets QA separados, status das migrations e Time Travel | Readiness workflow verde com consulta remota; sem migration na produção |
| P0 | Testar login, conta convidada/vinculada, reino, construção, treino, aliança, loja e skin no Preview | Fluxos ponta a ponta em conta descartável; sem duplicação/PII |
| P0 | Inspeção Android física em aparelho de entrada e intermediário/alto | FPS/estabilidade/memória/temperatura/toque/rede e retomada medidos |
| P1 | Rodar benchmark da issue #117 em D1/Worker descartáveis | Quadros API/D1/Cron/backlog, p50/p95/p99, custo estimado e invariantes aprovados |
| P1 | Implementar Sessions API em rotas selecionadas, se o benchmark provar gargalo de leitura | Testes de bookmark, read-your-writes e replica lag aprovados |
| P1 | Integrar realtime e sharding regional da issue #123 | Cliente real, Hibernation, handoff, fallback e carga por sala aprovados |
| P1 | Adicionar Queues junto com o primeiro consumidor real | Idempotência, retry, DLQ, replay e backlog aprovados |
| P2 | Migrar assets para R2 somente quando o volume justificar | Medição de tamanho, tráfego e custo mostrar vantagem |
| P2 | Avaliar particionamento de D1 por domínio somente se o primário atingir gargalo/10 GB | Plano de consistência, transação, migração, reconciliação e rollback |

### 10.9 Limites de capacidade e o que o plano não resolve

O Workers Paid remove o limite diário do Free e melhora o envelope de CPU/subrequests, mas não transforma D1 em banco multi-writer, não faz as batalhas mais rápidas que o scheduler, não ativa automaticamente a sala WebSocket e não melhora o FPS do WebGL no celular. O FPS é principalmente renderizado pela GPU/CPU do dispositivo Android; o Worker apenas entrega a lógica/API e os assets.

Assim, não existe hoje evidência para declarar 200, 1.000, 5.000 ou qualquer outro número de jogadores simultâneos. A capacidade será definida após a issue #117, integração realtime da #123, staging remoto e teste físico. O primeiro marco comercial deve ser beta controlado, com capacidade conservadora, métricas e rollback.

### Referências oficiais conferidas em 19/11/2026

- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 global read replication / Sessions API: https://developers.cloudflare.com/d1/best-practices/read-replication/
- Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Durable Objects limits: https://developers.cloudflare.com/durable-objects/platform/limits/
- WebSocket Hibernation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Queues pricing: https://developers.cloudflare.com/queues/platform/pricing/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Spending limits and alerts: https://developers.cloudflare.com/billing/manage/spend-management/
