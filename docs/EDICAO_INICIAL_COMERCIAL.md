# Edição comercial inicial do Clash of Izzy

## Objetivo

Publicar uma versão pequena e controlada, adequada ao plano Cloudflare Workers Gratuito, sem apagar a evolução já armazenada no projeto.

## Um único reino compartilhado: Eldoria

- Existe somente um mundo/reino público nesta edição: **Eldoria**. Todos os jogadores entram no mesmo servidor e interagem no mesmo mapa estratégico.
- A tabela legada `kingdoms` guarda a cidade/castelo controlado por cada jogador; ela não representa um servidor privado nem um mundo separado.
- Cada jogador recebe uma cidade/castelo no reino comum. A restrição `UNIQUE(player_id)` impede a criação de assentamentos duplicados pela mesma identidade, mas não divide jogadores em mundos diferentes.
- A coluna antiga `map_region` é mantida por compatibilidade, mas todos os castelos passam a usar `map_region = 1`. Não haverá criação automática de outro mundo após 400 jogadores.
- O mapa usa coordenadas persistentes em uma grade compartilhada de 20 colunas que cresce por novas linhas. Cada jogador vê os castelos próximos à sua posição; isso limita consultas e dados enviados ao celular sem criar outro reino.
- A migração `0026_single_shared_realm.sql` reposiciona os marcadores dos castelos antigos para reunir regiões anteriores. Preserva IDs, contas, recursos, construções, tropas, pesquisas, alianças, marchas, batalhas e inventários.
- Uma chamada autenticada a `POST /api/game/start` com uma identidade que já possui cidade retoma o estado existente, sem criar outra.
- O limite atual de criação por IP (20 por hora) continua sendo proteção contra abuso, não um limite global de população. Não bloquear clientes legítimos apenas por compartilharem a mesma rede.

## Loja de skins pagas

- A edição inicial libera as seis primeiras skins já cadastradas, em ordem estável de ID.
- Essas seis skins continuam sendo produtos pagos no fluxo existente de pedido, checkout/link Mercado Pago e revisão manual pelo painel Master.
- A loja pública, a busca global, a criação de pedido e a liberação manual Master aceitam somente as seis skins liberadas.
- As demais skins não são excluídas nem renomeadas: permanecem no D1 para uma futura edição.
- Skins já pertencentes a jogadores continuam no inventário.
- Pedidos antigos já registrados continuam podendo ser revisados e concluídos; a restrição aplica-se a novos pedidos e novas liberações manuais de skins bloqueadas.

## Reabertura após upgrade

O limite único da edição está em `INITIAL_PAID_SKIN_LIMIT` no `worker.js`. Aumentá-lo exige uma revisão da capacidade, orçamento, preço e disponibilidade do catálogo. A contratação do plano Pago da Cloudflare não altera automaticamente este valor e não publica mudanças por conta própria.

## Proteções de carga para o plano gratuito

- O Cron continua a cada minuto, mas cada execução fica limitada: até 3 filas globais de construção/treino/pesquisa, 1 reino consultado pelo processador global de marchas (até 2 marchas nesse lote), 1 rally concluído, 1 evento antigo encerrado e 1 e-mail enviado.
- Quando o jogador abre o estado do próprio castelo, o Worker continua reconciliando as marchas e filas daquele jogador. O Cron é a rede de segurança para contas inativas, não o único mecanismo de progresso.
- As recompensas diárias de Valhalla são distribuídas em páginas de 10 reinos por execução; o evento continua desligado por padrão. O encerramento do evento de fim de semana também paga no máximo 10 participantes por execução, mantendo a classificação original e retomando a próxima página no minuto seguinte.
- Limpeza de limites de API e expiração de replays também é feita em lotes, evitando varreduras/escritas sem limite.
- Esses limites reduzem picos de processamento, mas não comprovam uma capacidade concorrente fixa. A conta Gratuita possui 100.000 requisições/dia, 10 ms de CPU por requisição HTTP e por Cron; o D1 gratuito limita cada invocação a 50 subrequisições, 5 milhões de linhas lidas/dia e 100 mil escritas/dia. A capacidade real precisa ser medida em Preview/staging antes de divulgar um número máximo de jogadores.
- O mapa envia somente castelos próximos à posição do jogador. Isso mantém todos no mesmo reino sem carregar toda a população em cada resposta.
- O chat da aliança usa `GET /api/game/alliance/chat`, uma consulta compacta autenticada; a arena deixou de baixar `/api/game/state` inteiro a cada atualização do chat. A atualização passa a ocorrer a cada 15 segundos apenas enquanto o painel está aberto.
- O painel do reino atualiza filas no servidor a cada 60 segundos; os cronômetros visuais continuam avançando localmente a cada segundo.
- A resolução de marchas e rallies usa o Cron de um minuto como processamento de retaguarda; não é combate em tempo real com precisão de milissegundos.


## Condições comerciais e de publicação que continuam abertas

- **Skins:** a branch inclui equipagem persistente e visualização de skins adquiridas. A ação verifica a propriedade em `player_skins`, grava `kingdoms.equipped_skin_id`, mostra a seleção na cidade/loja e propaga a aparência para castelos no mapa compartilhado. A migration 0027 e os testes precisam passar antes da liberação comercial.
- **Mercado Pago:** o código tem rota de checkout individual e webhook, mas dependem de `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` configurados no Worker. Quando não configurado, a interface usa o link compartilhado e a revisão manual Master. A presença real dos secrets e uma compra/webhook de teste ainda não foram confirmadas.
- **Segurança:** a PR #116 foi integrada à `main` no commit `d94849fa38617dc8668cf8ab2dfed88984c094ab` após CI #941. A produção só receberá a proteção após deploy manual protegido.
- **Preview:** `wrangler.jsonc` tem `previews: {}` e não declara um D1 separado. É necessário criar/confirmar um banco descartável e configurar `preview_database_id` antes de executar migrations remotamente.
- **Dispositivos:** o CI automatizado Chromium em viewport móvel não substitui uma verificação em Android físico, incluindo toque, instalação PWA, reabertura, cache e memória.
- **Capacidade:** nenhum número máximo de jogadores é prometido sem benchmark. O plano Gratuito limita CPU e D1 por invocação e por dia; os limites de lote reduzem picos, mas não comprovam capacidade simultânea.

## Dados e implantação

- A migration 0026 consolida coordenadas e marcadores do mapa compartilhado; a migration 0027 adiciona a skin equipada ao castelo. Nenhuma apaga registros de jogadores ou progresso.
- Nenhuma migration antiga é reescrita.
- Nenhuma mudança no identificador de jogadores, tokens, economia, combate, alianças, marchas ou rallies.
- As alterações permanecem na branch de release para CI e revisão.
- Não executar deploy nem migrações remotas como parte desta alteração. A publicação de produção continua no fluxo manual protegido.
