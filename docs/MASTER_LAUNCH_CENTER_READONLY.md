# Central de Lançamento Master — diagnóstico, não autorização

A nova rota `GET /api/admin/launch-center` exige token com `scope=admin` e `sub=admin` e usa apenas consultas SQL `SELECT`. O limitador de taxa já existente pode registrar seu estado no D1. A rota não modifica pacotes, saldo, preços, pedidos, flags nem configurações.

## Informações apresentadas
- Existência das tabelas essenciais, sem afirmar integridade geral a partir disso.
- Nome da última migração registrada, quando disponível; `pendingMigrations:null` significa **desconhecido**, nunca zero.
- Presença dos bindings de recebimento (sem valores, tokens ou chaves no JSON).
- Pedidos pendentes agrupados e valores nominais de pedidos já marcados aprovados. **Não são prova de dinheiro liquidado, extrato, receita líquida ou reembolso**.
- Estado do APK obtido exclusivamente pelo proxy público isolado. Se o proxy ainda não foi publicado ou a consulta falhar, o painel exibe `não verificado`.
- Falhas de webhook, plano Paid, Sandbox e Android físico ficam como `null` quando não há telemetria/evidência confiável.

A Central devolve **NO_GO** até confirmação externa explícita de D1 Preview, pagamento Sandbox, restauração e teste Android físico. A CI verde não altera essas conclusões. Não expor o painel sem autenticação ou transformá-lo em controle de deploy.

A defesa adicional de `handleValhallaAdmin` exige explicitamente um ator Master já verificado pelo Worker, mesmo que uma futura refatoração invoque o módulo por outra rota.

**Sem deploy, migração remota ou ativação financeira nesta PR.**
