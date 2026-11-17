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

## Dados e implantação

- A migration 0026 é aditiva quanto ao schema e só atualiza coordenadas e marcadores dos castelos para unificar o mapa; não remove registros de jogadores ou progresso.
- Nenhuma migration antiga é reescrita.
- Nenhuma mudança no identificador de jogadores, tokens, economia, combate, alianças, marchas ou rallies.
- A alteração permanece nesta branch/PR para CI e revisão.
- Não executar deploy nem migrações remotas como parte desta alteração. A publicação de produção continua no fluxo manual protegido.
