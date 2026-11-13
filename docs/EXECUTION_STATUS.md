# Clash of Izzy — estado técnico da execução

Última revisão: 2026-11-13

Este documento registra o que foi confirmado no código do branch `main`. Não significa que o serviço esteja publicado ou que os testes de produção tenham passado.

## Arquitetura que deve ser preservada

- Cloudflare Worker em `worker.js`.
- Cloudflare D1 pelo binding `DB`.
- Arquivos estáticos servidos pelo binding `ASSETS`.
- Migrações SQL em `migrations/`.
- Não adicionar Express, Socket.IO ou PostgreSQL como um segundo backend.

## Confirmado no código

- O Worker implementa `POST /api/game/start`, `GET /api/game/state` e `POST /api/game/action`.
- O estado do reino, construções, tropas, territórios, marchas, relatórios de batalha e alianças é persistido em D1.
- A migração `0004_alliance_social.sql` cria chat de aliança persistente, convites e guerras de aliança.
- `gameAction` já contém operações de criação/entrada/saída de aliança, chat de aliança e declaração de guerra.
- O motor `game-adapter.js` é chamado pelo Worker para resolver batalhas do jogo.

## Pendências comprovadas ou não comprovadas

1. **Conta e recuperação de jogador:** `/api/game/start` gera um novo `player_id` aleatório a cada chamada. Não foi encontrado fluxo de cadastro/login de jogador. A interface usa `sessionStorage` para o token; isso não oferece recuperação de conta.
2. **PvP entre reinos:** o fluxo de batalha encontrado chama `simulateBattle` para combate do jogo, mas não foi encontrado endpoint/ação de ataque autenticado entre dois reinos de jogadores com validação de tropas, saque e relatório PvP.
3. **Tempo real:** não foi encontrado binding de Durable Objects nem servidor WebSocket. O chat de aliança é persistido em D1 e aparece no estado consultado; entrega em tempo real não está comprovada.
4. **Migrações remotas:** o workflow atual aplica migrações locais antes das remotas, mas a execução #12 falhou na validação do bundle; portanto, não há prova de que as etapas D1 tenham rodado nessa execução.
5. **Testes de ponta a ponta:** não há prova de teste com duas contas reais conectadas ao ambiente publicado.

## Correção de CI em andamento

O PR [#1](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/1) fixa Wrangler 4.0.0 nas quatro etapas do workflow. Isso endereça a falha observada com Wrangler 3.90.0 lendo `wrangler.jsonc`.

O PR está em rascunho e ainda não foi integrado. O workflow não foi executado neste branch; a correção só pode ser considerada validada depois de uma execução real no GitHub Actions.

## Próxima ordem segura

1. Validar a correção de Wrangler no Actions.
2. Projetar e implementar autenticação de jogador com identidade estável, hash de senha e recuperação de reino, sem expor credenciais nem apagar reinos existentes.
3. Implementar PvP no Worker, consumindo tropas do atacante e defensor dentro de operações consistentes no D1; nunca aceitar poder, dano ou resultado enviados pelo cliente.
4. Implementar chat/presença em tempo real com Durable Objects e binding/migração próprios, mantendo histórico em D1.
5. Adicionar testes automatizados para as rotas reais e cenários com dois jogadores. Um endpoint ausente (404) deve ser falha, nunca sucesso.
6. Fazer testes de produção e só então marcar o jogo como pronto.

## Proteções

- Não aplicar migrações PostgreSQL do exemplo Express/Socket.IO.
- Não renomear migrações já publicadas sem verificar o histórico do D1 remoto.
- Não executar migrações remotas, deploy ou alteração de secrets sem evidência de que o workflow e as credenciais do ambiente estão corretos.
- Não declarar deploy, login, multiplayer ou testes concluídos sem confirmação no ambiente real.
