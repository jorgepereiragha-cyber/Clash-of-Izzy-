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
   Identifique o SHA-256 do certificado de assinatura da keystore em ambiente
   privado (por exemplo, `keytool -list -v -keystore arquivo.jks`). Configure
   **Actions > Variables** com `ANDROID_RELEASE_CERT_SHA256` (64 hexadecimais,
   sem os dois-pontos).
   Se voce ja configurou as quatro credenciais em **Actions > Secrets**, mas nao tem
   o SHA-256, execute [Diagnostico seguro dos requisitos de assinatura Android](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/diagnostico-assinatura-android.yml)
   pelo botao **Run workflow**. A rotina valida a keystore e as senhas; se o
   pin estiver ausente, mostra **somente o SHA-256 publico do certificado** no
   resumo da execucao e encerra com falha ate que voce o configure em Variables.
   Nao cole keystore, Base64, senhas ou tokens em conversas nem no repositorio. Nao use o SHA-256 do arquivo APK ou da keystore no lugar
   do fingerprint do **certificado**. O workflow cancela o release se a variavel
   estiver ausente ou nao corresponder a assinatura do APK. O fingerprint nao
   e uma senha, mas a keystore e suas credenciais devem continuar privadas.
4. Antes da compilação assinada, a rotina consulta `/api/health` do Worker de produção e exige `androidApiContract=eldoria-android-v1`, D1 saudável e `missingTables=[]`. Repete o teste imediatamente antes de publicar a release. **O host antigo de jogo não tem esse contrato e bloqueia o APK oficial até ocorrer o deploy integral.** Um build Android de teste não é uma release pública.
5. Em GitHub Actions, executar `Publicar APK Android oficial` na `main`,
   informando `versao` (ex.: 1.0.0), `codigo_versao` crescente e
   `PUBLICAR_APK_OFICIAL` como confirmacao.
6. A rotina exige testes, build assinado e apksigner; publica em GitHub
   Releases `clash-of-izzy-android.apk` junto com
   `clash-of-izzy-android.apk.sha256`. Nao faz deploy Cloudflare,
   nao migra D1 e nao inicia pagamentos.
7. O portal consulta somente a ultima GitHub Release publica e **nao
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


## Pesquisa de referencia
- Assinatura e atualizacoes de APK: https://developer.android.com/studio/publish/app-signing
- Ferramenta `apksigner verify --print-certs`: https://developer.android.com/tools/apksigner
- WebView seguro (conteudo controlado, HTTPS, JavaScript): https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges
- Play Integrity e instalacao fora da Play Store: https://developer.android.com/google/play/integrity/verdicts

## Quando o botao de download nao funciona

O site **nao fornece um APK ficticio** nem instala builds de teste como se fossem comerciais. O botao e liberado automaticamente somente depois de existir uma GitHub Release publica estavel com os dois arquivos `clash-of-izzy-android.apk` e `clash-of-izzy-android.apk.sha256`. O portal tambem oferece um link permanente para consultar as Releases oficiais.

Se ainda nao existe release, consulte [o workflow oficial](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/publicar-apk-android.yml). O preflight verifica **antes** de testes demorados a presenca dos quatro GitHub Actions Secrets de assinatura e da variable `ANDROID_RELEASE_CERT_SHA256`; o certificado sera comparado com o arquivo assinado no final da compilacao. Configure a keystore e as senhas somente no gerenciador privado de Secrets do GitHub, nunca no codigo-fonte, no portal ou em mensagens. Nao use certificado de debug para uma release comercial.

O workflow oficial continua exigindo autorizacao explicita, `main`, CI, APK assinado, verificacao de hash e contrato de backend antes de publicar. Se o workflow nao tiver sido executado ou falhar, **nenhum download comercial deve ser anunciado**. Builds de teste ficam apenas nos artefatos privados/temporarios de GitHub Actions.
