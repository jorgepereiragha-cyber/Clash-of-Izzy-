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
- Essas seis skins continuam sendo produtos pagos no fluxo de pedido manual: o jogo registra a solicitação, abre o WhatsApp comercial com os dados do pedido e aguarda a conferência humana.
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
- Esses limites reduzem picos de processamento, mas não comprovam uma capacidade concorrente fixa. Na consulta oficial de 17/11/2026, Workers Free tem 100.000 requisições/dia, 10 ms de CPU por invocação HTTP e Cron, e 50 subrequisições por requisição. D1 Free tem 5 milhões de linhas lidas/dia, 100 mil escritas/dia, 500 MB por banco, 5 GB de armazenamento total e 50 subconsultas por invocação. Ao exceder o teto diário de linhas lidas/escritas, consultas D1 passam a falhar até a reposição diária; os dados armazenados não são apagados. A capacidade real precisa ser medida em Preview/staging antes de divulgar um número máximo de jogadores.
- O mapa envia somente castelos próximos à posição do jogador. Isso mantém todos no mesmo reino sem carregar toda a população em cada resposta.
- O chat da aliança usa `GET /api/game/alliance/chat`, uma consulta compacta autenticada; a arena deixou de baixar `/api/game/state` inteiro a cada atualização do chat. A atualização passa a ocorrer a cada 15 segundos apenas enquanto o painel está aberto.
- O painel do reino atualiza filas no servidor a cada 60 segundos; os cronômetros visuais continuam avançando localmente a cada segundo.
- A resolução de marchas e rallies usa o Cron de um minuto como processamento de retaguarda; não é combate em tempo real com precisão de milissegundos.


## Condições comerciais e de publicação que continuam abertas

- **Skins:** a equipagem/retirada persistente passou na CI #991. A ação verifica a propriedade em `player_skins`, grava `kingdoms.equipped_skin_id`, mostra a seleção na cidade/loja e propaga a aparência para castelos no mapa compartilhado. As seis opções usam paletas de materiais/cores na geometria de castelo existente; não são seis modelos 3D com malhas distintas. A PR #120 ainda não foi mesclada nem publicada.
- **Pagamentos manuais por WhatsApp:** a edição inicial não inicia checkout pagamento automático Mercado Pago nem usa webhook. O pedido fica pendente no D1; o jogador é encaminhado ao WhatsApp comercial `5547996531437` com número do pedido, ID do jogador, reino, produto e valor. O Master confere o recebimento e usa o botão `✓ Liberar pacote` no painel. A aprovação é autenticada, altera o status uma única vez e concede as gemas ou a skin correspondente. O WhatsApp é apenas o canal de contato; não confirma pagamento automaticamente.
- **Segurança:** a PR #116 foi integrada à `main` no commit `d94849fa38617dc8668cf8ab2dfed88984c094ab`; o smoke read-only da CI #991 reportou `adminHealthAuthBoundary: true` no Worker público.
- **Preview:** `wrangler.jsonc` tem `previews: {}` e não declara `previews.d1_databases`. Criar/confirmar um D1 descartável distinto do D1 de produção, configurar `previews.d1_databases` com a binding `DB` e criar `wrangler.preview-migrations.jsonc` com binding `PREVIEW_DB` apontando para o mesmo `database_id`. Aplicar migrations com `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc`. Não usar uma Version URL como teste isolado: Version URLs usam os recursos de produção. Previews que compartilham o mesmo `database_id` compartilham os mesmos dados.
- **Dispositivos:** o CI automatizado Chromium em viewport móvel não substitui uma verificação em Android físico, incluindo toque, instalação PWA, reabertura, cache e memória.
- **Capacidade:** nenhum número máximo de jogadores é prometido sem benchmark. O plano Gratuito limita CPU e D1 por invocação e por dia; os limites de lote reduzem picos, mas não comprovam capacidade simultânea.

## Dados e implantação

- A migration 0026 consolida coordenadas e marcadores do mapa compartilhado; a migration 0027 adiciona a skin equipada ao castelo. Nenhuma apaga registros de jogadores ou progresso.
- Nenhuma migration antiga é reescrita.
- Nenhuma mudança no identificador de jogadores, tokens, economia, combate, alianças, marchas ou rallies.
- As alterações permanecem na branch de release para CI e revisão.
- Não executar deploy nem migrações remotas como parte desta alteração. A publicação de produção continua no fluxo manual protegido.

## Referências técnicas oficiais consultadas em 17/11/2026

- [Limites Workers](https://developers.cloudflare.com/workers/platform/limits/): 100.000 requisições/dia no Free, 10 ms CPU por invocação e 50 subrequisições por requisição.
- [Preço D1](https://developers.cloudflare.com/d1/platform/pricing/): 5 milhões de linhas lidas/dia e 100 mil escritas/dia no Free; os contadores medem linhas examinadas/escritas, não apenas linhas retornadas.
- [Limites D1](https://developers.cloudflare.com/d1/platform/limits/): 500 MB por banco Free, 5 GB de armazenamento total, 50 subconsultas por invocação e Time Travel de 7 dias no Free.
- [Isolamento de recursos em Previews](https://developers.cloudflare.com/workers/previews/resources/): D1 Preview precisa de um database_id de staging separado; dois Previews com o mesmo ID compartilham os dados.
- **Cron em Preview:** Cloudflare direciona Cron Triggers à produção; Previews não recebem invocações agendadas. O fluxo agendado deve ser validado com testes locais/Worker-D1 e, se necessário, uma rotina de teste isolada e protegida, nunca acionando dados de produção.

A quota de linhas D1 é aplicada: ao exceder leituras ou escritas diárias no Free, as queries falham até o reset em 00:00 UTC. Não existe garantia de disponibilidade após esgotar a quota.
## Validação final do código — CI #991

- 271/271 testes Node aprovados, incluindo Worker+D1 e criação/leitura de aliança.
- 3/3 cenários Playwright móveis aprovados.
- Diagnóstico e smoke de produção somente de leitura aprovados.
- Wrangler `deploy --dry-run`: 359,95 KiB (78,13 KiB gzip).
- A execução não aplicou migrations remotas, não publicou Worker/assets e não realizou compra. A PR #120 permanece aberta aguardando D1 Preview isolado, pagamento real e validação em Android físico.
- [Execução da CI #991](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44134854021).

## Batch D1 para reduzir subconsultas

- Estado principal: 15 leituras independentes agrupadas num batch; consultas de convite/aliança e detalhes da aliança também agrupadas.
- Capacidade/defesa, poder, loja, cosméticos, heróis e mascotes usam batches de leitura.
- O número de linhas lidas/escritas continua sujeito às quotas diárias; ainda é necessário medir `/api/game/state` no staging descartável para provar CPU, subconsultas e consumo real.