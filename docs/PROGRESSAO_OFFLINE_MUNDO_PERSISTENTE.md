# Progressão persistente e mundo ativo — Clash of Izzy

Status: primeira implementação de runtime concluída; CI aprovado (GitHub Actions run 68). PR #9 pronta para revisão. Não publicada em produção.
Branch: feature/offline-kingdom-progression

## Objetivo de produto

O reino deve continuar evoluindo quando o jogador fecha o app, troca de aplicativo, perde conexão ou desliga o telefone. O dispositivo nunca é o relógio oficial. O servidor e o banco persistem os prazos; ao retornar, o cliente recebe o estado atualizado e um resumo do que terminou.

Isto não significa manter um processo rodando por jogador. A abordagem recomendada é baseada em timestamps absolutos, processamento idempotente sob demanda e um scheduler global para tarefas que precisam ser resolvidas mesmo sem login.

## Auditoria do código existente

- applyProduction() em worker.js calcula produção pelo tempo decorrido desde kingdoms.last_production_at, preserva frações em production_remainders e usa compare-and-set. O cálculo limita o intervalo a sete dias.
- gameState() chama produção e processMarches() antes de montar o estado.
- processMarches() busca marchas vencidas e credita retorno/conclusão quando o reino é consultado. Portanto, o horário de chegada é persistido, mas a resolução não é executada autonomamente no instante de chegada.
- gameAction() executa upgrade, train e research imediatamente: debita recursos e aplica nível/tropas na mesma ação. Não existem filas de construção, treinamento ou pesquisa.
- O PWA mantém apenas o shell visual em cache. Não deve simular nem conceder progresso offline no cliente.
- Missões diárias já têm resgate idempotente e ledger, mas o catálogo de eventos sazonais ainda não é um calendário global automatizado.
- A documentação existente confirma que chat em tempo real, notificações push, rally e PvP global ainda não estão ativos.

## Modelo de tempo

1. Persistir cada tarefa com started_at, completes_at, status, kind, slot_key, payload_json e chave idempotente.
2. Usar UTC no servidor e no banco; retornar também server_time na API para o cliente desenhar contagens regressivas sem confiar no relógio local.
3. Não fazer polling contínuo por jogador. Calcular o tempo restante como max(0, completes_at - server_time).
4. Ao carregar o reino ou executar uma ação, reconciliar tarefas vencidas antes de ler/alterar saldos.
5. Usar Cron Trigger global para varrer tarefas que precisam de efeitos mundiais (marchas, batalhas, expiração de escudos e eventos), em lotes limitados e com cursores/índices.
6. A conclusão deve ser idempotente: transição condicional queued/running -> completed, chave única por tarefa e recompensa no mesmo lote transacional. Repetir o scheduler não pode duplicar tropas, níveis, recursos ou recompensas.
7. O servidor valida duração, custos, slots, requisitos, aceleradores e limites. O cliente apenas exibe o progresso.

## Filas propostas

| Fila | Slots | Resultado ao concluir |
|---|---:|---|
| Construção | 1 inicial; expansões via progressão/benefícios | Atualiza nível do edifício |
| Treinamento | 1 por edifício militar (quartel, estábulo, arqueiros, cerco) | Credita tropas treinadas |
| Pesquisa | 1 no Centro de Pesquisa | Atualiza tecnologia e bônus |
| Cura | 1 no hospital | Retorna tropas curadas ao exército |
| Marchas | Limite de marchas simultâneas por reino, ampliável por pesquisa/itens | Coleta, reconhecimento, ataque e retorno resolvidos pelo servidor |
| Dragão/herói | Atividades específicas somente se houver mecânica de espera clara | Evolução/expedição com recompensa validada |

Os slots e durações finais devem ser balanceados por nível do Castelo, edifícios, pesquisas, VIP e eventos. Não introduzir pay-to-win obrigatório: acelerar é conveniência, e o jogador gratuito mantém progressão normal.

## Ciclo de vida de tarefas

- Iniciar: verificar slot livre, requisitos e saldo; debitar e inserir tarefa atomicamente.
- Em andamento: o prazo persiste mesmo com o app fechado.
- Concluir: o servidor verifica completes_at <= now, reivindica a tarefa com atualização condicional e aplica efeito/recompensa uma única vez.
- Acelerar: validar item e escopo, reduzir prazo de forma atômica, registrar consumo no ledger.
- Cancelar: política explícita de reembolso antes de permitir; não devolver automaticamente custos sem regra de produto.
- Reconectar: enviar tarefas ativas, tarefas concluídas desde o último sync, hora do servidor e notificações pendentes.

## Marchas e mundo compartilhado

A marcha deve ter etapas persistidas (preparação, ida, no alvo, retorno, concluída) e prazos absolutos. A resolução de ataques/capturas precisa usar trava/claim atômico e verificar novamente a propriedade do alvo no instante da resolução. Para coleta, o recurso deve ser calculado pelo tempo efetivo no nó, respeitando capacidade de carga. Perdas, sobreviventes, relatórios e retorno devem ser persistidos.

O scheduler não deve simular cada segundo. Processar apenas tarefas vencidas em lotes. Para operações globais concorrentes, usar claim com lease/estado e chave idempotente; não confiar em setTimeout dentro de uma instância Worker.

## Produção offline e limites

- Preservar a produção atual baseada em timestamps e compare-and-set.
- O limite atual de sete dias precisa virar regra de balanceamento explícita e configurável, exibida ao jogador; não aumentar nem remover sem simular economia e inflação.
- Considerar capacidade de armazenamento: recursos acima do limite de armazém podem ser perdidos ou bloqueados segundo regra clara, nunca silenciosamente.
- Aplicar bônus de pesquisa, dragão, skins e eventos por intervalos de tempo, evitando aplicar bônus atual retroativamente a todo o período offline.

## Notificações e retorno ao jogo

Fase posterior: notificações push para construção concluída, treino, pesquisa, marcha chegando, ataque recebido, escudo prestes a expirar, evento começando e recompensa disponível. Push é lembrete, não fonte de verdade; ao tocar, o app sincroniza com o servidor. Preferir agrupamento e preferências por jogador para não incomodar.

## Segurança, consistência e testes obrigatórios

- Nunca aceitar timestamps, duração ou recompensa enviados pelo cliente como autoridade.
- Proteger contra dupla conclusão, corrida entre duas sessões, retries HTTP e scheduler duplicado.
- Testar: fechar/reabrir app; telefone desligado; perda de rede; relógio local alterado; dois dispositivos; duas requisições simultâneas; tarefa vencida durante manutenção; scheduler repetido; período offline maior que sete dias; slot ocupado; acelerador concorrente; saldo insuficiente.
- Verificar invariantes do ledger: todo débito/crédito é único, auditável e transacional.
- Adicionar métricas de tarefas atrasadas, falhas/retries, tamanho da fila, duração de processamento e idade da última execução do scheduler.

## Ordem de implementação

1. Migração aditiva para tarefas/filas, índices de vencimento e chaves idempotentes; sem renomear/apagar tabelas existentes.
2. Serviço de tempo e processador de tarefas testável isoladamente.
3. Migrar construção, treino e pesquisa para filas, mantendo compatibilidade da API e adaptando a interface para mostrar cronômetros.
4. Migrar marchas para scheduler global e resolução atômica; cobrir retorno e disputas de território.
5. Cura, aceleradores, limites de armazém e balanceamento.
6. Push notifications, preferências e centro de notificações.
7. Testes de carga, economia e falhas antes de ativar no ambiente de produção.

## Infraestrutura e publicação

Antes de ativar Cron Trigger, confirmar a configuração Cloudflare e o comportamento de deploy. O workflow de produção atual pode aplicar migrações remotas; portanto, nenhuma migração deve ser executada no banco de produção sem revisão, testes locais/D1 de desenvolvimento e confirmação explícita do plano de deploy. O shell PWA offline não substitui a execução autoritativa no servidor.


## Pesquisa externa e decisões de arquitetura (14/11/2026)

Fontes consultadas:
- Rise of Kingdoms: filas de treinamento independentes por edifício militar e gestão de construção/pesquisa: https://rokhub.app/vi/faq/troops e https://paamu.com/en/games/rise-of-kingdoms/guides/gathering-research/
- Arquitetura de jogos idle cooperativos: calcular ganhos por tempo decorrido, com relógio do servidor, em vez de simular cada segundo: https://teemo.dev/game-design/coop-idle/systems/systems-and-architecture-how-to-actually/
- Cloudflare Durable Objects: coordenação stateful, consistência forte, multiplayer, conexões persistentes e trabalho agendado por entidade: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Cloudflare Alarms: execução pelo menos uma vez e possibilidade de retries; os efeitos precisam ser idempotentes: https://developers.cloudflare.com/durable-objects/api/alarms/
- Ciclo de vida e escolha entre alarms por entidade e Cron Triggers globais: https://architectingoncloudflare.com/chapter-07/

### Decisão para a infraestrutura atual

1. Manter D1 como persistência canônica inicial; não adicionar banco ou serviço pago sem necessidade comprovada.
2. Usar timestamps UTC absolutos (started_at, completes_at, completed_at) e incluir server_time na API. O cliente só desenha a contagem regressiva.
3. Reconciliar tarefas vencidas antes de qualquer leitura/ação que dependa de saldo, nível, tropas ou território.
4. Usar Cron Trigger global para marchas, batalhas, expiração de escudos e eventos que precisam produzir efeitos sem login.
5. Reservar Durable Objects para coordenação por reino/sessão, WebSockets, chat ou combate multiplayer em tempo real. Não criar um objeto por jogador apenas para contar cronômetros.
6. Tratar Cron/Alarm como entrega pelo menos uma vez: claim condicional, lease recuperável, chave idempotente única e efeito/recompensa no mesmo lote transacional D1.
7. Processar lotes limitados com índices por status/prazo, cursor e métricas. Atraso do scheduler não pode alterar duração nem duplicar recompensas.
8. A consulta de estado também reconcilia vencimentos, para recuperar o estado correto mesmo após atraso/falha do agendamento.

### Regras de implementação adicionais

- Antes de criar a próxima migração, enumerar e auditar todos os arquivos de migrations existentes e confirmar o último número realmente usado.
- A tabela de tarefas deve ter slots ativos únicos por reino/tipo/slot, prazo indexado, estado explícito, payload validado no servidor, chave idempotente única, tentativas e lease de processamento.
- Débito inicial, inserção da tarefa e registro no ledger devem ser atômicos.
- Conclusão deve mudar o estado condicionalmente e creditar o efeito no mesmo lote transacional; uma segunda execução deve ser inofensiva.
- Cron é para varredura global; não usar setTimeout dentro do Worker como mecanismo de persistência.
- Não tratar o instante de execução do scheduler como deadline exato. O prazo oficial é completes_at e tarefas atrasadas são reconciliadas pela mesma lógica.
- A produção offline atual e o limite de sete dias devem ser preservados até simulação econômica; qualquer mudança deve ser configurável e visível ao jogador.

### Sequência e limite desta etapa

1. Revalidar migrações, tabelas e modelos de edifícios/tropas/pesquisas.
2. Criar migração aditiva e testes de invariantes do motor de tarefas.
3. Integrar construção, treinamento e pesquisa com filas reais e contagens regressivas.
4. Integrar scheduler global e resolução atômica de marchas.
5. Implementar cura, aceleradores, capacidade de armazém e notificações.
6. Executar testes de concorrência, repetição, relógio manipulado, app fechado, telefone desligado e offline prolongado.

Esta atualização é pesquisa e especificação. Não declara filas, scheduler, push ou multiplayer como implementados; nenhuma migração ou publicação de produção foi executada.


## Implementação de runtime adicionada nesta branch

- Migração aditiva `0009_kingdom_tasks.sql`: tabela de tarefas, slots ativos únicos por reino/tipo/slot, chave idempotente e índices de vencimento.
- `upgrade`, `train` e `research` agora debitam recursos no início e criam tarefas persistidas; o nível/tropas só são aplicados ao concluir.
- Filas: uma fila global inicial de construção, uma de pesquisa e uma por edifício militar de treinamento (quartel, estábulo, arqueiros, academia e oficina de cerco).
- `processDueKingdomTasks` reivindica conclusão com token único e aplica efeitos/recompensas no mesmo lote D1 transacional.
- `scheduled()` e Cron Trigger de um minuto processam tarefas vencidas e marchas mesmo sem jogadores conectados. O estado do reino também reconcilia tarefas vencidas quando o jogador retorna.
- API do estado inclui `activeTasks` e `serverTime`; o Centro de Comando mostra filas e contagens regressivas. A contagem local é apenas visual.
- Custos de construção, treinamento e pesquisa são registrados no `resource_ledger`.
- `task-engine.js` contém regras de duração e testes unitários; CI aplica todas as migrações apenas em D1 local e testa os tempos.
- A produção passiva existente e o limite de sete dias foram preservados.

### Limitações que continuam pendentes

- O Cron roda em intervalo de um minuto; a conclusão pode aparecer com atraso de até um ciclo, mas o prazo real permanece no timestamp persistido.
- A fila de construção e pesquisa tem um slot cada; ainda não há aceleradores/cancelamento/segunda fila VIP.
- Marchas continuam usando a lógica atual de resolução, agora também chamada pelo scheduler global. PvP global, rally, combate entre reinos, coleta por tempo no nó e notificações push ainda não estão prontos.
- Cura hospitalar, escudos com expiração automatizada, calendário global de eventos, WebSockets/chat instantâneo e push notifications ficam em etapas posteriores.
- As novas filas dependem da migração 0009. Até o deploy e aplicação dessa migração, a versão em produção não recebe esse comportamento.
- Nenhuma migração remota, merge ou deploy foi executado nesta etapa.


## Persistência narrativa — migração 0010

A campanha A Primeira Fenda e o Arquivo Velado usam agora `kingdom_story_progress`, associada ao reino e com chave primária composta por reino, campanha e etapa. O Worker valida o catálogo permitido, o nível do Castelo e o pré-requisito anterior antes de gravar. A inserção usa `INSERT OR IGNORE` e o evento de conclusão é registrado no mesmo `DB.batch()` somente quando há uma nova descoberta. Repetições não duplicam o registro. O estado da API inclui `storyProgress`, e o Centro de Comando lê esse estado do servidor. O cliente também tenta migrar progresso antigo de `localStorage`; os dados locais não são mais fonte de autoridade.

Não há recompensas ou efeitos econômicos nessa primeira versão. A migração 0010 ainda precisa ser aplicada pelo pipeline em ambiente local/CI e, depois, em produção somente por deploy autorizado. Não foi executada migração remota manualmente.
