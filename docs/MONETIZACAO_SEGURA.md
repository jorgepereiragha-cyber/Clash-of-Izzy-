# Monetização controlada — Clash of Izzy

## Objetivo

Gerar a primeira receita **depois** de validar uma compra ponta a ponta, a entrega e a possibilidade de reembolso. Esta etapa não comprova receita obtida, clientes pagantes, ativação de gateways ou titularidade das contas.

## Canais

1. **Mercado Pago (checkout oficial)**. A Orders API e o webhook já estão implementados, mas só funcionam em produção com `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` corretos, ambos na mesma conta autorizada. Link de pagamento legado não comprova quem recebe.
2. **Nubank Pix (cobrança assistida)**. O administrador gera um link ou código Pix *para o valor exato* no aplicativo Nubank/Conta Nu Empresas, depois de receber um pedido identificado. A opção do cliente fica bloqueada até `NUBANK_PIX_ENABLED=true` no Worker e validação do canal de atendimento. **Não há API de liquidação Nubank nem entrega automática.** O Master deve conferir o crédito no extrato da conta autorizada, valor, identificador único e eventuais estornos antes de aprovar o pedido.
3. **Sem transferência automática**. A conta bancária de destino não pode ser configurada com dados colados em HTML, GitHub ou mensagens; apenas as credenciais e o titular corretos devem operar o recebimento.

## Operação recomendada

- Começar com um catálogo curto de produtos cosméticos e conveniência, sem prometer ganhos competitivos irreversíveis, recompensas fictícias ou vantagens já inexistentes no jogo.
- Realizar primeiro um ciclo completo em ambiente controlado: pedido → pagamento real autorizado de valor baixo → conciliação → entrega única → suporte e reembolso.
- Identificar claramente preços em BRL, conteúdo e política de atendimento. Guardar trilha de auditoria por pedido; não aceitar prints como prova única do pagamento.
- Definir atendimento e prazo de entrega para Pix assistido antes de habilitar `NUBANK_PIX_ENABLED`; tratar pagamentos pendentes e duplicados.
- Verificar compatibilidade com políticas das lojas de aplicativo antes de distribuir por Google Play. Distribuição direta/PWA segue requisitos distintos; não apresentar isso como isenção geral de leis, impostos ou regras de proteção ao consumidor.
- Medir conversão do catálogo, transações aprovadas, receita líquida de tarifas/estornos e satisfação. Não publicar projeções como faturamento real.
- Antes de publicizar o APK, assinar a release com keystore persistente e oferecer download por fonte oficial, com checksum. O portal consulta somente uma release pública oficial do GitHub com APK e arquivo SHA-256. Enquanto ela não existir ou não puder ser verificada, o botão de download permanece desabilitado; o portal não processa pagamentos.

## Restrições de segurança

- Nunca liberar itens apenas pela criação de pedido, por mensagem WhatsApp ou comprovante enviado. O pagamento Nubank só pode ser conferido no extrato do recebedor por pessoa autorizada.
- Não configurar a conta Nubank com dados sem confirmação de titularidade.
- Não aplicar migrações remotas ou fazer deploy apenas para habilitar pagamentos antes de confirmar as integrações e testes.
- Não executar pagamentos/transferências em nome dos usuários com este recurso.

Referências oficiais: https://nubank.com.br/empresas/solucoes-para-cobranca e https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications

## Chave Pix Nubank via secret (sem gravar dados pessoais no GitHub)
A chave do recebedor é um identificador financeiro pessoal e **não deve entrar no código-fonte, no portal público ou em logs**. O backend suporta chave Pix do tipo CPF validada por dígitos verificadores. Configure `NUBANK_PIX_KEY` como **secret no Cloudflare Worker** e mantenha a variável `NUBANK_PIX_ENABLED` desligada até concluir a verificação do titular e o teste de pagamento. Depois de verificar pessoalmente a conta recebedora, configure `NUBANK_PIX_RECEIVER_VERIFIED=true` e habilite `NUBANK_PIX_ENABLED=true` somente na conta/ambiente autorizado. Nenhuma chave foi enviada para o GitHub por esta atualização.

Com o servidor corretamente configurado, **somente a sessão autenticada dona de um pedido Pix pendente** recebe a chave para copiar em `POST /api/store/pix-instructions`; a rota tem limite de requisições, exige pedido pendente e responde com cabeçalho `Cache-Control: no-store`. Na interface, o comprador vê o valor e deve conferir o destinatário no banco antes de transferir. Isso é **Pix por chave CPF com conciliação manual**, não Pix Cobrança com QR dinâmico ou liquidação automatizada. O administrador só pode liberar os itens após conferir o crédito no extrato da conta autorizada; comprovante enviado pelo jogador não basta.

A configuração do secret, do plano Cloudflare, da conta Nubank e do acesso ao extrato **não é executada por commits no GitHub**. O passo de ativação exige sessão autorizada no Cloudflare e operação bancária do titular, sem publicar ou solicitar senhas.
