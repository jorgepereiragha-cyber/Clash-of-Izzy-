# Clash of Izzy — ativação segura dos recebimentos Mercado Pago

Este documento é um roteiro operacional. **O repositório não determina a conta bancária recebedora**. O saldo é creditado à conta Mercado Pago titular das **credenciais de produção** usadas pela integração. O link legado `https://link.mercadopago.com.br/pagamentosskin` deve ser conferido no painel da conta correspondente; sua presença no código não comprova titularidade.

## Situação técnica observada

- Loja: `arena.html` envia um `purchase-request` e tenta criar checkout individual em `POST /api/store/checkout`.
- Backend: `mercadopago-orders.js` usa a Orders API do Mercado Pago e recebe notificações em `POST /api/webhook/mp`.
- Persistência: D1 registra identificadores do pedido, confirmação e entrega de gemas ou skins.
- Fallback: sem credenciais completas, a interface usa o **link hospedado compartilhado** e exige conferência e aprovação manual pelo Master. Esse link não identifica automaticamente o jogador comprador.
- Uma compra com cartão, Pix ou outro método disponível depende das opções oferecidas pelo Mercado Pago na conta do vendedor, e não dos campos bancários no GitHub.

## Passos obrigatórios na conta Mercado Pago do vendedor

1. Entrar na conta Mercado Pago **que pertence ao responsável pelo jogo** e confirmar que o link `pagamentosskin` está sob controle dessa mesma conta.
2. Criar/selecionar a aplicação de integração Checkout Pro com Orders API, em **Suas integrações** do Mercado Pago Developers.
3. Ativar o ambiente de produção somente depois de verificar identidade, titularidade e habilitação comercial exigidas pelo Mercado Pago.
4. Copiar o **Access Token de produção** da aplicação e configurar exclusivamente como secret do Cloudflare Worker `MP_ACCESS_TOKEN`.
5. Em **Webhooks** da mesma aplicação, registrar a URL HTTPS `https://clash-of-izzy.jorgepereiragha.workers.dev/api/webhook/mp`, selecionar o evento **Order (Mercado Pago)** e obter a **assinatura secreta do webhook** para o secret `MP_WEBHOOK_SECRET`.
6. As credenciais têm de pertencer à **mesma aplicação/conta**. Não inserir tokens, senhas, chaves Pix ou dados de conta bancária no repositório público ou no arquivo `wrangler.jsonc`.

Com o CLI Wrangler devidamente autenticado para a conta Cloudflare correta, configurar os dois segredos (um por vez, inserindo cada valor no prompt seguro):

```bash
npx wrangler --config wrangler.jsonc secret put MP_ACCESS_TOKEN
npx wrangler --config wrangler.jsonc secret put MP_WEBHOOK_SECRET
```

Atenção: alterações de secrets podem causar nova versão/deploy do Worker. Verificar o ambiente e acompanhar os logs antes de operar em produção. **Não colar os valores nesta conversa nem num ticket de GitHub.**

## Verificações antes de aceitar compras reais

- Executar testes automatizados e `npm run check` na branch de código aprovada.
- Verificar migrações D1: especialmente `0024_player_accounts_mercadopago_orders.sql`. Não aplicar migração remota manualmente como teste.
- Efetuar compra controlada autorizada com valor pequeno, usando o ambiente/carteira correta; verificar no Mercado Pago o status da order, o ID, a moeda BRL e o valor.
- Verificar recebimento do webhook válido e crédito de gemas/skin **uma só vez**; repetir a notificação em ambiente isolado e confirmar idempotência.
- Testar pagamento recusado, pendente e estornado. Não liberar item com pedido apenas pendente; reembolsos, chargebacks e reconciliação precisam de procedimento operacional.
- Conferir que o painel Master não aprova manualmente transações sem prova independente de recebimento.
- Confirmar se a URL pública do Worker e o domínio final do jogo coincidem com a URL registrada no Mercado Pago.
- Conferir os lançamentos financeiros e as taxas no **saldo da conta Mercado Pago**; configurar eventual Pix/TED para Nubank **apenas no aplicativo da conta autorizada**.

## Separação de responsabilidades

**GitHub/Cloudflare**: código, Worker, secrets e registros de pedidos. **Mercado Pago**: identidade do recebedor, captura do pagamento, saldo, tarifas e transferências. O código do jogo **não faz transferências bancárias** e não deve afirmar que alterou a conta de recebimento.

Sem confirmação de titularidade e sem verificar secrets ativos na Cloudflare, o estado correto é **integração preparada, ativação financeira pendente**.

Referências oficiais:
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
