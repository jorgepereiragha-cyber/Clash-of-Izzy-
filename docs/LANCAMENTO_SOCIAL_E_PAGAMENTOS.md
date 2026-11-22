# Clash of Izzy — pré-lançamento nas redes sociais e ativação responsável das vendas

Atualizado em 22/11/2026. **Status: pré-lançamento; não divulgar um APK comercial antes de existir uma GitHub Release oficial com APK assinado e SHA-256.** Não declarar compras habilitadas ou resultados financeiros sem evidências.

## Canal oficial e privacidade
- Portal para divulgação: https://clash-of-izzy-portal.jorgepereiragha.workers.dev/portal.html
- GitHub Releases para conferência: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases
- O navegador **apenas apresenta o jogo e seu download**; a jogabilidade pertence ao aplicativo Android.
- **Não divulgar** chave Pix, conta bancária, token Mercado Pago, senha de assinatura, número de cartão ou informações privadas.
- O link de divulgação inclui campanhas UTM somente para atribuição de origem, sem incluir IDs de jogador ou qualquer dado financeiro.
- Artes, heróis, dragões e slogans devem ser próprios de Clash of Izzy, sem usar materiais de Clash of Kings.

## Conteúdo de pré-lançamento, pronto para aprovação

### Instagram — feed/reels (descrição)
```text
Seu reino. Seu legado. ⚔️🏰
Clash of Izzy é um jogo de estratégia medieval para Android em desenvolvimento.
Construa seu castelo, organize tropas, convoque heróis e forme alianças no mundo de Eldoria.

Acompanhe as novidades e a futura liberação do APK oficial:
https://clash-of-izzy-portal.jorgepereiragha.workers.dev/portal.html

#ClashOfIzzy #Eldoria #EstrategiaMedieval #JogosAndroid #GamesBR
```

### TikTok — roteiro curto (20–25 s)
```text
[0–4 s] Seu reino começa com uma escolha.
[4–9 s] Construa um castelo e prepare seu exército.
[9–15 s] Reúna heróis, dragões e aliados.
[15–20 s] Um novo mundo de estratégia medieval está sendo preparado.
[20–25 s] Clash of Izzy. Acompanhe o lançamento do Android no link do perfil.
```
Use somente capturas reais do jogo, identificando cenas em desenvolvimento se o acabamento visual não estiver finalizado.

### Facebook — postagem
```text
Conheça Clash of Izzy, um projeto independente de estratégia medieval para Android.
Em Eldoria, o objetivo é desenvolver seu reino, administrar recursos, formar alianças e disputar territórios.

O aplicativo está em fase de finalização e testes. O download será disponibilizado apenas no portal oficial quando a versão assinada estiver aprovada.

Saiba mais: https://clash-of-izzy-portal.jorgepereiragha.workers.dev/portal.html
```

### WhatsApp — divulgação
```text
Conheça Clash of Izzy, novo jogo de estratégia medieval para Android em preparação.
Acompanhe o lançamento e confira a página oficial:
https://clash-of-izzy-portal.jorgepereiragha.workers.dev/portal.html
```

## Após a aprovação do APK
Antes de mudar qualquer anúncio para "disponível para baixar":
1. A release deve conter `clash-of-izzy-android.apk` e `clash-of-izzy-android.apk.sha256`, ambos públicos e verificáveis.
2. Instalar em Android físico, abrir a página do reino, criar/acessar conta, percorrer mapa, tropas, aliança e reconexão.
3. Realizar teste de pagamento autorizado de baixo valor e conciliação no provedor ou extrato; **não usar prints como prova**.
4. Verificar política de privacidade, suporte, reembolso e conteúdo dos pacotes.
5. Conferir no portal se o link foi habilitado pela release verdadeira e se o SHA-256 corresponde.

## Integração de recebimento em cada pacote
A loja obtém produtos, preços e gemas do D1; não deve calcular valores a partir de texto divulgado.
- **Mercado Pago**: vendas do catálogo vinculadas a pedido autenticado e checkout individual, apenas se `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` da **mesma conta recebedora verificada** existirem como Secrets do Worker. O saldo fica na conta Mercado Pago da aplicação, e eventual transferência para Nubank é configurada na própria conta Mercado Pago autorizada. Webhook validado e valor/moeda conferidos antes de entregar itens.
- **Nubank Pix**: alternativa assistida para o pedido autenticado, com `NUBANK_PIX_KEY` somente em **secret** do Worker; depende de `NUBANK_PIX_RECEIVER_VERIFIED=true` e `NUBANK_PIX_ENABLED=true`. O operador autorizado confere o crédito e o EndToEndId no **extrato real Nubank**, antes de aprovar manualmente. O mesmo EndToEndId não pode ser usado para aprovar dois pedidos. Não existe integração direta automática com o extrato Nubank nesta versão.
- **Pacote Master**: continua desativado por `MASTER_PACK_ENABLED` até preço, conteúdo, reconciliação e política comercial serem aprovados.
- Valores reais e titularidade **não são identificados por um número de conta colocado no repositório, portal ou comentário**.

**Pendências externas:** usuário responsável deve autenticar na Cloudflare e no provedor financeiro; configuração dos Secrets privados, verificação do recebedor e testes de liquidação **não são ações executáveis via edição do GitHub**. Não publicar contas bancárias em campanhas.

## Publicação nas redes
O portal oferece botões de compartilhamento nativo, WhatsApp, Facebook e cópia de URL para Instagram/TikTok. A publicação direta nas redes exige conexão e autorização das respectivas contas; os textos acima são rascunhos para aprovação editorial, não posts já publicados.
