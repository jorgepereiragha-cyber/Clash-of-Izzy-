# Progressão persistente e mundo ativo — Clash of Izzy

Status: especificação técnica auditada; implementação de filas e scheduler ainda pendente.
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
