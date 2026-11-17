# Edição comercial inicial do Clash of Izzy

## Objetivo

Publicar uma versão pequena e controlada, adequada ao plano Cloudflare Workers Gratuito, sem apagar a evolução já armazenada no projeto.

## Reinos e jogadores

- O jogo mantém um único mundo compartilhado.
- Cada identidade de jogador possui um único reino. A tabela `kingdoms` já impõe `UNIQUE(player_id)`.
- Uma chamada autenticada a `POST /api/game/start` com um token que já possui reino retoma esse reino e não cria outro.
- Jogadores diferentes continuam podendo entrar no mesmo mundo e criar seu próprio reino.
- Não existe nesta versão um sistema de múltiplos mundos/servidores independentes; novos mundos ficam fora da edição inicial.
- O limite atual de criação por IP (20 por hora) continua sendo proteção contra abuso, não um limite global de população. Não bloquear clientes legítimos por compartilharem a mesma rede.

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

- Nenhuma migration nova.
- Nenhuma exclusão, atualização ou limpeza de dados D1.
- Nenhuma mudança no identificador de jogadores, tokens, economia, combate, alianças, marchas ou rallies.
- A alteração permanece nesta branch/PR para CI e revisão.
- Não executar deploy nem migrações remotas como parte desta alteração. A publicação de produção continua no fluxo manual protegido.
