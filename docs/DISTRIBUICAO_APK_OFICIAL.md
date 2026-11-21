# Distribuicao Android — site somente para divulgar e baixar

## Requisito do produto
O navegador **nao e o cliente de jogo**. `/index.html` encaminha para
`/portal.html`, que apresenta a marca, imagens e botao de APK. Ele nao oferece
links para jogar nem instalacao PWA. O Android abre o jogo como aplicativo
instalado no aparelho, com icone proprio e assinatura.

O APK atual ainda e um contêiner **Android WebView**, com jogo HTML/WebGL
carregado pelo aplicativo e Worker/D1 como backend. Isso nao representa
uma engine 3D nativa; o servidor permanece necessario para multiplayer.
As URLs historicas `/kingdom.html` etc. ainda existem para o aplicativo e
testes. **Retirar links publicos nao impede alguem de acessar a URL direta
num navegador.** Bloqueio efetivo sem quebrar o cliente requer uma
autenticacao/atestacao especifica do aplicativo no backend, a implementar
antes de declarar acesso exclusivamente via APK.

## Publicacao controlada e instalacao direta
1. Integrar esta branch a uma candidata revisada, depois a `main` quando
   todos os testes e verificacoes de infraestrutura forem aprovados.
2. Validar jogo e servidor em producao, login, WebView, interface em Android
   fisico, pagamentos de teste e atualizacao por cima de APK anterior.
3. Gerar uma keystore **permanente** em ambiente privado e configurar os
   secrets: `ANDROID_RELEASE_KEYSTORE_BASE64`,
   `ANDROID_RELEASE_STORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS` e
   `ANDROID_RELEASE_KEY_PASSWORD`. Nunca publicar secrets nem chave.
4. Em GitHub Actions, executar `Publicar APK Android oficial` na `main`,
   informando `versao` (ex.: 1.0.0), `codigo_versao` crescente e
   `PUBLICAR_APK_OFICIAL` como confirmacao.
5. A rotina exige testes, build assinado e apksigner; publica em GitHub
   Releases `clash-of-izzy-android.apk` junto com
   `clash-of-izzy-android.apk.sha256`. Nao faz deploy Cloudflare,
   nao migra D1 e nao inicia pagamentos.
6. O portal consulta somente a ultima GitHub Release publica e **nao
   libera o download** sem os dois assets oficiais com URLs dentro
   de `github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases/download/`.
   Versoes em draft, pre-release e APKs de debug ficam invisiveis.

## Limites e cuidados
- A rotina **nao foi disparada** nesta alteracao; nenhum APK assinado foi
  publicado por ela. Com secrets ausentes, o job deve falhar antes da release.
- Para atualizacoes sobre uma instalacao anterior, manter o mesmo
  `applicationId` e certificado, com `codigo_versao` maior.
- No Android, o jogador precisa autorizar instalacao de fonte externa
  para abrir o APK. Nao e a Play Store nem implica revisao do Google.
- O portal nao deve prometer iOS: um APK nao funciona no iPhone; isso
  requer um pacote iOS e fluxo proprio de distribuicao.
- Confirmar direitos autorais de artes/identidade. A pagina usa apenas
  a marca **Clash of Izzy**; nao exibe nem se apresenta como outro jogo.
- A loja, Mercado Pago e Nubank nao aparecem no portal, apenas dentro
  do jogo. Pix continua desabilitado no servidor por padrao e depende
  de reconciliacao verificavel. Nenhuma conta bancaria foi alterada.
