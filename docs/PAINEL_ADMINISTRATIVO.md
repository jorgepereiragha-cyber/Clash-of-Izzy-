# Painel administrativo — Clash of Izzy

## Endereço
- Painel: `/admin.html`
- API administrativa: `/api/admin/*`
- O painel é separado do Centro de Comando dos jogadores.

## Acesso
Configure como segredos do Cloudflare Worker:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

O login emite um token assinado com validade de oito horas. O navegador mantém o token apenas em `sessionStorage`; a senha não é gravada no código nem no armazenamento local. Sem os três segredos, o login retorna configuração ausente.

## Recursos implementados
- Visão geral: total de jogadores, reinos, alianças, marchas em andamento e eventos das últimas 24 horas.
- Busca por trecho do nick, nome do reino ou ID, sem diferenciar maiúsculas/minúsculas.
- Jogadores podem definir um nick único (3–20 caracteres) no Centro de Comando; o servidor valida duplicidade antes de salvar.
- Ficha do jogador com estado atual do servidor: recursos, edifícios, tropas, heróis, dragão, pesquisas, marchas, batalhas, inventário, eventos, tarefas e aliança.
- Gestão de recursos e gemas, com validação de saldo não negativo e registro no ledger de recursos.
- Renomear reino e liberar skin já cadastrada.
- Cadastro de skins e pacotes VIP.
- Auditoria das alterações administrativas, com ator, ação, jogador-alvo, detalhes e horário.

## Limites
- A busca identifica o jogador por `player_id` estável e encontra nomes/nicks por substring em `players.name` e `kingdoms.kingdom_name`. O schema atual usa `players.name` como nick público e `kingdoms.kingdom_name` como nome do reino; a busca consulta ambos.
- O painel mostra dados reais retornados pelo Worker; não simula contas, jogadores online ou funcionalidades ainda não implementadas.
- A tela de ficha chama a rotina de estado existente, que pode reconciliar filas e marchas vencidas daquele reino, como ocorre quando o próprio jogador retorna.
- Não há botão de excluir conta, transferir propriedade, alterar senha de jogador ou ler credenciais privadas.
- A migração `0011_admin_audit_log.sql` precisa ser aplicada antes das rotas administrativas com auditoria funcionarem. O workflow de deploy existente aplica migrações antes de publicar, mas isso só ocorrerá quando o fluxo for executado com segredos válidos.

## Testes e publicação
- O CI deve validar o bundle do Worker, o cache PWA e as migrações D1 locais.
- A criação do código e da migração na branch não significa que o painel já esteja publicado em produção.
