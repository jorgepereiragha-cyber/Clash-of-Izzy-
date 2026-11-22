# Clash of Izzy — vinculação com Google
Status: **implementação proposta para revisão e testes; não habilitada em produção**.

## Experiência
- No menu Conta do Comandante, jogadores com um reino existente selecionam **Vincular Google**. Isso mantém o mesmo ID do jogador, progresso, castelo, gemas e inventário.
- Em outro dispositivo, **Entrar com Google** recupera somente o jogador cujo identificador está previamente vinculado. Uma conta Google ainda não vinculada **não assume um reino por coincidência de e-mail**: o jogador deve primeiro entrar no reino antigo e confirmar a vinculação.
- A tabela `google_account_links` mantém o `sub` estável do Google em uma relação única com o ID interno do jogador. Senhas e e-mails de outros cadastros existentes não mudam; tokens Google não ficam armazenados.
- Desvincular não é ofertado automaticamente: será necessário um fluxo separado com reautenticação e método alternativo de recuperação testado.

## Segurança
- Validação RS256 pelo Worker com JWKS oficial do Google, `aud`, `iss`, `exp`, `iat`, `sub`, `nonce` e validação de assinatura.
- Desafio `nonce` criado no D1, consumido uma vez, válido por cinco minutos; o token jamais substitui o Bearer do jogo sem validação.
- O endpoint de vínculo exige a sessão autenticada atual, nunca um `player_id` livre fornecido pelo navegador. A coluna `google_sub` é `UNIQUE`.
- Se um reino foi vinculado enquanto tinha uma sessão anônima, as sessões anônimas anteriores deixam de funcionar. Contas com senha preservam a versão já existente.
- A configuração falha fechada quando faltar a credencial ou a migração. Execute testes antes do deploy. Limites de taxa do Worker são aplicados por IP e jogador.

## Configuração externa necessária
1. No **Google Cloud Console**, configurar um projeto e a tela de consentimento OAuth, com origem HTTPS autorizada: `https://clash-of-izzy.jorgepereiragha.workers.dev`.
2. Criar um **OAuth Client ID tipo Web**. Informar o ID, e não o Client Secret, ao Worker em `GOOGLE_WEB_CLIENT_ID` (variável de ambiente). É um identificador público.
3. Para o APK, criar também OAuth Client ID tipo **Android** no mesmo projeto Google, com package `com.clashofizzy.android` e SHA-1 do certificado permanente, inclusive versões de teste com certificado diferente.
4. No app, Credential Manager solicita ID token com **Web Client ID** (server client ID). O login Google **não roda dentro de WebView**; a seleção é executada nativamente no Android.
5. Testar migração local e preview D1, build Android, usuário existente, conta nova não vinculada, segunda instalação, expiração, repetição de nonce, dois jogadores tentando vincular o mesmo Google e desconexão. Aplicar migração remota só em janela de implantação autorizada e com backup.

## Referências
- https://developers.google.com/identity/siwg/best-practices
- https://developers.google.com/identity/sign-in/web/backend-auth
- https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

**Limite:** a criação das credenciais OAuth no Google Cloud Console, a aprovação da tela de consentimento, a implantação e os testes em aparelho físico dependem do titular do projeto e não são realizados por este commit.
