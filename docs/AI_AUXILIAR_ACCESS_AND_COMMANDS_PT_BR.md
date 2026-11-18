# Acesso seguro para IAs auxiliares — Clash of Izzy

## Repositório e escopo

- Repositório: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-
- Branch de trabalho desta entrega: `feat/merchant-hero-market`
- Base da branch: PR #128, edição compartilhada Eldoria.
- PR da base visual/Android: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/128
- Todas as entregas de auxiliares devem entrar por branch própria e Pull Request Draft; não enviar commits diretamente para `main` ou `release/one-shared-realm-early-access`.

O repositório é público para leitura. Para escrever, a pessoa ou agente precisa receber permissão explícita no GitHub ou trabalhar por fork. Preferir permissões mínimas: leitura para auditoria; escrita apenas para colaboradores confiáveis que realmente precisem enviar commits. Não compartilhar senha, Personal Access Token, cookie, chave SSH privada, Cloudflare API Token, segredo do Worker, credenciais D1 ou dados bancários em prompt, chat ou arquivo.

## Comandos para começar

```bash
git clone https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-.git
cd Clash-of-Izzy-
git fetch origin
git switch --track origin/feat/merchant-hero-market
git status --short --branch
```

Se o agente precisar de uma branch própria, sem dividir o mesmo working tree:

```bash
git switch -c ai/nome-da-tarefa origin/feat/merchant-hero-market
git status --short --branch
```

Instalação e validações locais:

```bash
node --version
npm --version
npm install
npm run db:migrate:preview:local
npm test
npm run test:e2e
npm run check
git diff --check
```

A validação `db:migrate:preview:local` usa armazenamento local do Wrangler. Não acrescentar `--remote`. O projeto não versiona `package-lock.json`; portanto, não usar `npm ci` sem primeiro validar e aprovar a política de lockfile.

## Regras obrigatórias de segurança

1. Trabalhar somente em branch própria baseada em `feat/merchant-hero-market`; abrir PR Draft apontando para `feat/merchant-hero-market` enquanto esta frente não for integrada.
2. Não executar `npm run deploy`, `wrangler deploy`, `npm run db:migrate:remote`, `npm run db:migrate:preview:remote`, `wrangler d1 execute --remote`, `wrangler secret put`, remoção de D1, limpeza de dados ou alterações de produção.
3. Não editar `wrangler.jsonc`, IDs/bindings D1, variáveis, secrets, rotas de produção, autenticação ou contratos de sessão sem revisão humana separada.
4. Não copiar dados reais de usuários, tokens, emails, saldos, pedidos ou identificadores privados para relatórios e prompts.
5. Não criar uma segunda tabela de inventário, heróis, loja ou filas sem provar que o modelo existente não atende. Reutilizar `shop_inventory`, `inventory_items`, `hero_inventory`, `merchant_stock`, `kingdom_events` e `kingdom_queues`.
6. Não conceder itens, gemas, fragmentos ou recursos diretamente no banco para testar. Usar testes locais isolados e endpoints autenticados de teste.
7. Preservar `coi_game_token`, `gameIdentity()`, as rotas atuais, o Worker + D1 e o reino compartilhado Eldoria.
8. Cada alteração de regra de jogo precisa de teste negativo e positivo: propriedade, quantidade, limite, concorrência, saldo insuficiente e repetição.
9. Não remover arquivos por nome, tamanho ou impressão de que estão sem uso. Confirmar referências e testes antes de propor limpeza.
10. Não fazer force-push, rebase que altere histórico compartilhado, merge ou fechamento de PR sem autorização explícita.

## Comandos úteis de diagnóstico (somente leitura/local)

```bash
git status --short --branch
git log -8 --oneline --decorate
git diff --stat
git diff --check
npx wrangler --config wrangler.preview-migrations.jsonc d1 migrations list PREVIEW_DB --local
npx wrangler --config wrangler.jsonc d1 migrations list clash-of-izzy-db --local
```

Nunca colar no chat a saída de comandos que revele valores de secrets. Para auditar secrets, listar apenas nomes no ambiente autorizado; nunca ler, imprimir ou exportar os valores.

## Prompt operacional para cada IA auxiliar

> Você é um revisor/engenheiro auxiliar do Clash of Izzy. Leia primeiro este guia e a documentação relevante. Trabalhe em branch isolada baseada em `feat/merchant-hero-market`. Faça apenas alterações necessárias para a tarefa indicada. Preserve Worker + D1, Eldoria compartilhado, autenticação existente, inventários e filas canônicos. Não faça deploy, migração remota, mudança de secrets, escrita em produção, merge, force-push ou exclusão de arquivos. Antes de alterar código, localize os contratos e testes existentes. Implemente validações no servidor, proteção contra repetição/concorrência e testes positivos e negativos. Execute `npm test`, `npm run test:e2e`, `npm run check` e `git diff --check`. Entregue um resumo com arquivos alterados, riscos, comandos executados, resultados reais e pendências; nunca invente resultados. Abra uma PR Draft e aguarde revisão humana.

## Limites de validação

Passar CI não substitui inspeção em Android físico nem confirmação do D1 Preview remoto. Não declarar o jogo pronto para produção, publicação Play Store, PvP ou monetização integral com base apenas em testes locais.
