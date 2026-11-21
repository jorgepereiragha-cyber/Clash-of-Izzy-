# Cloudflare Paid — correções de preparo e critérios de ativação

Atualização de infraestrutura: 21/11/2026.

## Aplicado ao código

- Dois workflows manuais agora usam `npm install --ignore-scripts --no-audit --no-fund`, compatível com a situação atual do repositório **sem package-lock.json**, e o setup do Node não tenta utilizar o cache npm que depende de lockfile.
- Antes de qualquer checkout com acesso aos secrets da Cloudflare, a branch selecionada é restrita a `main` ou `release/one-shared-realm-early-access`. Um nome arbitrário não é executado.
- A auditoria de leitura continua disponível mesmo quando o proprietário ainda não confirmou o plano Workers Paid: nesse caso o relatório diz **PENDENTE** e não conclui que o pagamento está ativo.
- `wrangler.preview-migrations.jsonc` está presente na `main`, usa o binding `PREVIEW_DB` e um UUID diferente do banco de produção. O arquivo fica excluído dos assets web.
- O fluxo de Preview continua exigindo duas confirmações, validando a identidade do banco antes de alterar seu schema. **Não é disparado automaticamente**.
- Testes estáticos cobrindo dependências, disparo manual, isolamento, gates e exclusão de arquivos.

## Não aplicado remotamente

O repositório não permite atestar por si só:
- assinatura Workers Paid ativa ou orçamento/limites configurados;
- acesso efetivo aos secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`;
- existência remota do D1 Preview no UUID declarado;
- migrações do D1 Preview, release compartilhada da PR #120 ou nova versão web em produção;
- carga simultânea real (meta de 1.000 usuários).

**Não marcar como concluído sem registros de execução.**

## Execução segura pelo GitHub

1. No painel Cloudflare, conferir em *Billing > Subscriptions* se Workers Paid está ativo. Confirmar os limites em *Spend Management* e alertas.
2. Em GitHub Actions, executar **Cloudflare Paid Readiness (read-only)**, com `target_branch=release/one-shared-realm-early-access`. A confirmação do proprietário só deve ser marcada se for verdadeira; de outro modo, a auditoria continua em modo informativo.
3. Guardar o log e conferir Worker, D1 produção, Preview, lista de migrations e Time Travel. Falha significa **não avançar**.
4. Somente quando estiver confirmado que o Preview existe, está isolado e é descartável, executar **Prepare Clash of Izzy Preview D1 (isolated)** com as duas confirmações verdadeiras e o UUID correto; essa etapa **muda** o D1 Preview remoto.
5. Executar testes de carga e smoke autenticado em staging antes de avaliar deploy de produção. A PR #120 permanece separada. O deploy de produção exige aprovação do ambiente `production` e confirmação explícita.

As correções deste documento **não executam nenhuma chamada remota de escrita no D1 nem compram o plano**.
