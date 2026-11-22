# Portal de apoio voluntário — Clash of Izzy
Atualizado em 22/11/2026.

## Objetivo
Permitir divulgação de financiamento voluntário do Clash of Izzy no portal separado de distribuição do Android, sem interferir no jogo, no D1 ou na autenticação.

A página /support apresenta R$ 10, R$ 50 e R$ 200 como contribuições sugeridas. Não há recompensas digitais ou créditos associados. A meta R$ 5.000 é apenas uma meta de planejamento: valores reais arrecadados não podem ser divulgados sem conciliação financeira.

## Como habilitar pagamentos depois de revisar a PR
1. Criar na conta de recebimento do próprio projeto um Link de Pagamento oficial Mercado Pago. Preferir valor aberto se essa opção estiver disponível para essa conta e modalidade. Verificar tarifas, titularidade, termos, reembolsos e canal de atendimento.
2. Validar manualmente que o link HTTPS aponta para seu destinatário, não para ambiente de teste ou conta de terceiros.
3. Configurar o vínculo no Worker promocional via segredo Cloudflare, a partir da raiz do repositório:

    npx wrangler --config wrangler.portal.jsonc secret put SUPPORT_PAYMENT_URL

4. Fazer deploy pelo workflow próprio do portal, que não usa D1. Abrir https://clash-of-izzy-portal.jorgepereiragha.workers.dev/support e verificar /support-link.json. Sem link autorizado o botão permanece bloqueado.
5. Realizar teste de baixo valor e confirmar entrada diretamente na conta do Mercado Pago. Conferir também pagamento recusado, cancelamento e suporte ao contribuinte.
6. Publicar resultados financeiros apenas após conciliação de recebimentos, taxas, estornos e reembolsos.

O endpoint GET /support-link.json publica somente a URL externa configurada, sem tokens, bancos ou informações de jogadores, e só aceita HTTPS de domínio Mercado Pago. Link não configurado ou não permitido retorna enabled:false.

## Limite de segurança
- O portal não aceita POST, não tem contas e não executa cobranças ou operações de D1.
- Nunca permitir que amount, tier, playerId ou items_granted fornecidos pelo navegador determinem crédito de recursos.
- Não publicar Pix, senha, JWT, token MP ou dados bancários no HTML.
- As recompensas com gemas, skins e heróis descritas na proposta são vendas de bens digitais, não apoio voluntário sem contrapartida. Antes de oferecer, usar o catálogo e fluxo atual: vip_packages, purchase_requests, mercadopago_orders, validação de webhook e concessão idempotente. Criar os ativos e testes antes de cobrar.
- Não apresentar meta alcançada fictícia.

## Testes e publicação
    node --test tests/portal-isolation.test.js tests/portal-support.test.js
    npm test
    npm run test:e2e
    npm run check

Validar também os testes de isolamento do portal, o host real e o bloqueio de /api/game/state, métodos POST e páginas internas de jogo. Esta alteração não cria transações financeiras, nem altera D1 remoto, Worker principal ou secrets.

## Referências
- https://www.mercadopago.com.br/blog/como-fazer-campanhas-de-crowdfunding
- https://www.mercadopago.com.br/blog/link-pagamento-valor-aberto-doacoes
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications
