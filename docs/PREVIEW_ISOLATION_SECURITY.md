# Isolamento seguro de Previews — Clash of Izzy

Este procedimento vale para a branch de lançamento e para qualquer Preview do Worker `clash-of-izzy`.

## Regra principal

O Preview não herda a configuração de produção. A configuração deve ser declarada no bloco `previews` do Wrangler. Secrets não são gravados no repositório nem em `wrangler.jsonc`; precisam ser definidos separadamente na configuração base de Previews ou no Preview específico.

Documentação oficial:
- [Worker Previews — Configuration](https://developers.cloudflare.com/workers/previews/configuration/)
- [Worker Previews — Resources and isolation](https://developers.cloudflare.com/workers/previews/resources/)
- [D1 — Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)

## Recursos desta edição

| Recurso | Produção | Preview |
|---|---|---|
| Worker | `clash-of-izzy` | Preview da branch |
| D1 binding | `DB` | `DB` |
| D1 name | `clash-of-izzy-db` | `izzy-preview-17112026` |
| D1 ID | `7e63af59-d9ff-4159-a9cf-b02e35b92605` | `6674c0ac-3636-4e57-bff8-23cf60ab9637` |
| Environment | `production` | `preview` |

Os IDs são valores declarados no repositório. A existência, acessibilidade e estado atual do D1 de Preview ainda devem ser confirmados na conta Cloudflare antes de qualquer migração remota. Nunca substitua o ID de produção pelo ID de Preview, nem o contrário.

Dois Previews que usam o mesmo `database_id` compartilham as mesmas linhas. A base acima é compartilhada entre os Previews que apontarem para ela; não use-a para testes destrutivos ou com jogadores reais. Para testes concorrentes que precisem de dados independentes, crie outro D1 descartável e atualize simultaneamente o binding do Worker e o arquivo de migrations dessa branch.

## Secrets de Preview

Os Previews não recebem automaticamente os secrets de produção. Para testar autenticação e o painel Master, configure credenciais exclusivas de staging:

- `SESSION_SECRET`: segredo aleatório exclusivo para Preview, diferente do segredo de produção.
- `ADMIN_EMAIL` e `ADMIN_PASSWORD`: conta Master descartável de QA, com senha exclusiva.
- Não configure `MP_ACCESS_TOKEN` nem `MP_WEBHOOK_SECRET` nesta edição manual por WhatsApp.
- Não configure chaves reais de e-mail, serviços externos ou credenciais pessoais apenas para fazer o Preview compilar.

Os secrets só podem ser configurados no Cloudflare Dashboard ou pelos comandos Wrangler de Previews. Exemplos de comandos para valores de staging (o Wrangler solicita o valor; não o coloque no comando, no terminal compartilhado, em issue ou no Git):

```sh
npx wrangler preview base-config secret put SESSION_SECRET
npx wrangler preview base-config secret put ADMIN_EMAIL
npx wrangler preview base-config secret put ADMIN_PASSWORD
```

A configuração Base se aplica a novos Previews. Para um Preview já criado, configure o secret no próprio Preview:

```sh
npx wrangler preview secret put SESSION_SECRET --name <nome-do-preview>
npx wrangler preview secret put ADMIN_EMAIL --name <nome-do-preview>
npx wrangler preview secret put ADMIN_PASSWORD --name <nome-do-preview>
```

Não reutilize secrets de produção. Não copie variáveis globais de outro provedor/Discloud. Se não for testar o painel Master, não é necessário habilitar uma conta administrativa no Preview.

## Sequência de validação — sem tocar na produção

1. No terminal autenticado na conta Cloudflare correta, liste os bancos:

   ```sh
   npx wrangler d1 list --json
   ```

2. Consulte o D1 candidato e confira o UUID retornado:

   ```sh
   npx wrangler d1 info izzy-preview-17112026 --json
   ```

3. Confirme que o UUID é exatamente `6674c0ac-3636-4e57-bff8-23cf60ab9637`, distinto do D1 de produção `7e63af59-d9ff-4159-a9cf-b02e35b92605`. Se o recurso não existir, o ID não coincidir ou houver dúvida sobre o conteúdo, pare. Não crie outro banco nem edite o binding por tentativa.

4. Confira as migrations pendentes com o arquivo de configuração dedicado:

   ```sh
   npx wrangler --config wrangler.preview-migrations.jsonc d1 migrations list PREVIEW_DB --remote
   ```

5. Somente depois de confirmar identidade, isolamento, permissão e backup do banco descartável, aplique as migrations usando o script de Preview:

   ```sh
   npm run db:migrate:preview:remote
   ```

6. Configure os secrets exclusivos de Preview, crie/abra o Preview da branch e valide login de QA, estado do reino, construção, treinamento, alianças, loja manual e skin equipada apenas com contas descartáveis.

7. Guarde capturas e logs sanitizados. Não publique tokens, cookies, secrets, IDs de sessão, dados pessoais ou números de telefone.

## Limitações do Preview

- Cron Triggers não executam em Previews. O processamento agendado deve ser validado por testes Worker/D1 locais ou em ambiente descartável especificamente preparado; não tente acionar o Cron de produção para validar Preview.
- Previews provisionam namespaces próprios de Durable Objects, mas uma classe lida por `env` também precisa de binding no bloco `previews`. O binding `ELDORIA_ROOM` deve estar presente quando a sala realtime for incluída nessa branch.
- Uma Version URL usa recursos de produção e não substitui um Preview com D1 de staging.
- CI local, Wrangler dry-run e Workers Build aprovados não provam a existência do D1 remoto, secrets configurados, rotas autenticadas funcionando ou testes em Android físico.

## Proibição operacional

Este documento não autoriza:
- aplicar migrations no D1 de produção;
- executar seed ou carga de teste na produção;
- copiar secrets ou tokens de produção para Preview;
- publicar/deployar produção;
- alterar contas, reinos, inventários, compras ou progresso de jogadores.

A publicação continua dependente de validação remota do Preview, teste físico em Android, backup/Time Travel e workflow manual protegido.
