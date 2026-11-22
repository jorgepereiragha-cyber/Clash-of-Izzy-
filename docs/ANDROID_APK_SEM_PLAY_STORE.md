# Clash of Izzy — APK Android fora da Play Store

## Decisao tecnica

O jogo ja existe como site HTTPS/PWA e depende do Worker + D1 da Cloudflare.
O APK desta pasta e um **cliente Android com WebView nativo** apontado para
`https://clash-of-izzy.jorgepereiragha.workers.dev/kingdom.html`.
Nao transforma o jogo em um motor 3D nativo: WebGL, FPS e texturas continuam
limitados pelo Android System WebView, pela GPU e pelos assets realmente publicados.
O APK **nao** embute o backend, nao copia o D1 e nao remove a necessidade de internet
para a maioria das operacoes multiplayer.

Alternativas avaliadas:
- **PWA:** ja existe, instalavel de navegador compativel, sem gerar APK; opcao mais simples.
- **TWA / Bubblewrap / PWABuilder:** usa o navegador como motor e exige Digital Asset Links
  com dominio controlado e impressao SHA-256 da assinatura para experiencia verificada
  sem interface de guia. Boa escolha depois de definir dominio e assinatura.
- **Capacitor:** mais util se o jogo precisar de plugins nativos e pacote web local.
  `server.url` para site remoto nao e a rota recomendada para producao.
- **WebView Android (escolhido agora):** APK independente para distribuicao direta,
  com custo de manutencao baixo e **sem** exigir verificacao de dominio TWA.

## Gerar sem PC, usando o navegador do celular e o GitHub

1. Mescle a PR desta feature na `main` depois que os testes ficarem verdes.
   O workflow novo compila **APK de teste** nos PRs, sem alterar Cloudflare ou D1.
2. Abra **GitHub > repositorio > Actions > Android APK - instalacao direta**.
3. Selecione **Run workflow**, branch `main`, tipo **teste**, e execute.
4. Abra a execucao concluida; no fim da pagina baixe o artifact
   `clash-of-izzy-android-apk-teste`. Ele vem como ZIP: extraia o `.apk`.
5. No Android permita *instalar apps desconhecidos* somente para o aplicativo
   pelo qual abrira esse APK; verifique origem e instale. Desative essa
   permissao depois do teste, se preferir.

O APK de teste e assinado pela chave de debug do runner e usa package ID
`com.clashofizzy.android.debug`. Ele nao serve como pacote estavel para
atualizacoes: o certificado temporario muda entre builds e a instalacao anterior
pode precisar ser removida antes de instalar outro APK debug.

O ZIP do GitHub Actions inclui o APK e o respectivo arquivo `.sha256`.
Para conferir o arquivo extraido em um terminal com `sha256sum`,
execute o comando na pasta que contem os dois arquivos:

```sh
sha256sum -c app-debug.apk.sha256
```

O workflow tambem verifica a assinatura do APK de teste e informa o hash
SHA-256 no resumo da execucao. Este hash comprova integridade em relacao
ao build consultado, mas **nao** substitui a verificacao da origem
do arquivo nem torna a assinatura temporaria de debug adequada a producao.

## APK de release com atualizacao permanente

Para gerar um APK estavel, crie **uma** keystore privada, faca backup offline
seguro da keystore e senhas e adicione os quatro **GitHub Actions Secrets**
exatamente com estes nomes:

- `ANDROID_RELEASE_KEYSTORE_BASE64`: conteudo base64 da keystore `.jks`
- `ANDROID_RELEASE_STORE_PASSWORD`: senha do arquivo JKS
- `ANDROID_RELEASE_KEY_ALIAS`: alias da chave
- `ANDROID_RELEASE_KEY_PASSWORD`: senha da chave

Para criar uma chave em ambiente privado com JDK:
```sh
keytool -genkeypair -v -keystore clash-izzy-release.jks -alias clashizzy \
  -keyalg RSA -keysize 3072 -validity 10000
base64 -w0 clash-izzy-release.jks
```
**Nao** cole a keystore/base64, chaves ou senhas em issue, PR, chat,
commit ou arquivo publico. Use a tela de Secrets no GitHub. Guarde
copia offline; sem a mesma chave nao sera possivel atualizar por cima da
release anterior assinada.

Em **Actions > Android APK - instalacao direta > Run workflow**, escolha
`assinado`. O build **falhara** caso falte algum secret. Quando aprovado,
o artifact `clash-of-izzy-android-apk-assinado` tera o APK assinado
para instalacao direta, acompanhado de `app-release.apk.sha256`. Use
`sha256sum -c app-release.apk.sha256` para validar a copia extraida. O application ID de release e
`com.clashofizzy.android`. Incremente `versionCode` a cada
nova release para permitir atualizacao no Android. Para instalar sobre
uma versao anterior, mantenha **applicationId e certificado iguais**.

## Protecoes e limites

- Dominios externos sao abertos fora do app; HTTP sem TLS nao carrega no WebView.
- JavaScript e DOM Storage sao habilitados apenas porque o jogo precisa deles.
  File access, mixed content e pontes JavaScript nativas ficam desativados.
- HTTPS/TLS invalido nao e ignorado.
- A sessao do WebView nao e compartilhada automaticamente com o Chrome.
  Pode ser necessario entrar/criar sessao no APK; nao apague o estado do
  navegador sem verificar que a conta esta protegida e recuperavel.
- O WebView abre janelas solicitadas por gesto do usuario por meio de uma WebView
  tecnica invisivel. Enderecos HTTPS externos (incluindo checkout Mercado Pago)
  sao entregues ao navegador do Android, sem substituir o jogo. Popups automaticos
  nao sao autorizados. A interface de pagamento permanece fora do aplicativo.
- O fluxo de pagamento completo (retorno do navegador, webhook, entrega), seletores
  de arquivo, notificacoes, jogos offline, audio e captura cinematografica ainda
  exigem validacao manual em aparelhos Android reais; nao ha promessa de suporte
  nativo aos demais recursos.
- O APK **nao altera o backend** e nao valida se a versao recente de uma
  PR de melhorias 3D ja esta implantada no Worker de producao.
- Teste aparelho de entrada e intermediario (WebGL, memoria, FPS,
  renderizacao, login, reconexao, batalha e rotacao) antes de distribuir.

## Compilacao local opcional

Com JDK 17, Android SDK 35 e Gradle 8.11.1:
```sh
cd android-sideload
gradle assembleDebug
```
O APK gerado fica em `app/build/outputs/apk/debug/`.

**Seguranca operacional:** este workflow nao executa `wrangler deploy`,
migracao D1, alteracao de secretos Cloudflare, pagamentos ou publicacao
no Google Play. Ele so compila o aplicativo-cliente Android.
