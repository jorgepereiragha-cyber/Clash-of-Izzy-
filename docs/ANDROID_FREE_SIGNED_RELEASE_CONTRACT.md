# APK Android — modalidades comercial e gratuita, seguras por padrão

O workflow oficial agora aceita `modo=comercial|gratuito`, com padrão `comercial`.

- **Comercial**: mantém intactas as duas checagens `check-commercial-store.mjs`, além de assinatura, certificado SHA-256 fixado, `apksigner`, versionCode crescente, backend pronto e revalidação final.
- **Gratuito**: exige **duas vezes** `check-android-free-release-gate.mjs`. A consulta só retorna sucesso quando o Worker remoto declara o contrato `coi-android-free-v1`, o modo gratuito está explicitamente ligado, as duas configurações de pagamento estão ausentes/desligadas, não existem pedidos pendentes, contribuições pendentes ou ordens MP sem entrega, e as rotas de criação financeira listadas são bloqueadas antes do roteamento.

`ANDROID_FREE_RELEASE_MODE_ENABLED` inicia como **false**. Não deve ser ativado automaticamente no deploy. Uma resposta pública com somente `mercadoPago:false` e `nubankPix:false` continua sendo diagnóstico insuficiente.

## Restrições

- No modo gratuito, `POST /api/store/purchase-request`, `/api/store/checkout`, `/api/store/pix-instructions`, `/api/support/checkout`, `/api/admin/purchase-requests/review` e `/api/admin/gems` devolvem indisponibilidade. Webhooks anteriores **não** são desligados, para permitir reconciliação legítima.
- A loja deve ser revisada visualmente para explicar que compras estão indisponíveis. O endpoint de saúde do Worker e a flag precisam estar publicados antes de qualquer release gratuita.
- Antes de ligar o modo gratuito, conferir os pedidos e a exclusão de caminhos financeiros alternativos em código e Preview; os testes Node e o contrato da rota **não** substituem teste no servidor real.
- Não publicar em caso de existência de pedidos, estado financeiro desconhecido ou risco de cobrança/entrega pendente.
- Não alterar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, Pix, bancos ou flags na produção sem homologação.
- A assinatura permanente, a verificação da integridade do APK e o teste de instalação/atualização em Android físico são exigidos para ambas as modalidades.

Este patch é código em Draft, **não publica APK, não aplica migrações remotas e não habilita recebimentos**.
