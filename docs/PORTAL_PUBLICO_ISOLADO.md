# Portal público separado do jogo — Clash of Izzy

## Objetivo
No endereço público de divulgação, o navegador **apenas anuncia o Clash of Izzy e
oferece download do APK oficial Android**. Não contém jogo, login, WebSocket,
loja, painel administrativo, PWA ou endpoints de pagamento.

## Implementação
- `portal-worker.js` aceita somente GET/HEAD e permite os cinco caminhos
  promocionais (HTML, CSS, favicon e emblema). Todas as outras URLs, inclusive
  `/kingdom.html`, `/api/*`, `/sw.js` e `/manifest.json`, são recusadas,\n  **exceto** `/api/android/latest` (apenas GET/HEAD, metadados públicos de release com APK e hash validados).
- `wrangler.portal.jsonc` cria **outro Worker**, `clash-of-izzy-portal`,
  com diretório estático **isolado** `public-portal/`. Não tem acesso
  ao D1, Durable Objects, secrets, autenticação, nem ao código do jogo.
- O conteúdo promocional é uma cópia da página oficial da candidata,
  incluindo consulta da última release GitHub com APK e checksum SHA-256.\n  O portal prefere o proxy somente leitura `/api/android/latest`, com cache curto de sucesso/404,\n  e conserva consulta direta à API do GitHub apenas como fallback quando o proxy não está disponível.\n  O proxy jamais consulta D1, recebe tokens, cria pedidos ou ativa downloads sem APK e checksum oficiais.
  O download permanece desabilitado na falta da release oficial.
- A raiz redireciona ao portal, preservando parâmetros UTM de campanhas.

## Publicação controlada
1. Executar os testes `node --test tests/portal-isolation.test.js`
   e o pipeline normal; revisar propaganda e links.
2. Em homologação, publicar **somente o portal**, separadamente:
   `npx wrangler --config wrangler.portal.jsonc deploy`.
   Verificar o endereço atribuído ao Worker e confirmar que
   `/kingdom.html` e `/api/game/state` retornam 404.
3. Apontar o domínio público de marketing ao novo Worker
   `clash-of-izzy-portal` em Cloudflare. Não mudar a rota do
   Worker de jogo até confirmar que o WebView Android continua
   consumindo o host de jogo correto.
4. Testar em Android real: cadastro, reino, multiplayer, pagamentos
   de teste e reinstalação/atualização por APK assinado.
5. Liberar o APK oficial somente após as verificações de assinatura,
   Cloudflare Paid, banco Preview e operação financeira.

**Limite importante:** o Worker antigo do jogo continua hospedando
`/kingdom.html` e APIs para o WebView. Separar o domínio de marketing
impede execução do jogo **na hospedagem promocional**, mas não bloqueia
usuários que descubram e visitem diretamente a URL do Worker antigo.
Um bloqueio confiável de uso apenas no APK exige atestação do aplicativo,
vinculada a uma sessão validada no backend; User-Agent ou cabeçalhos
customizados não são prova de autenticidade. Não ativar um bloqueio frágil
que possa impedir jogadores legítimos de entrar.

Nenhuma alteração de DNS, Cloudflare em produção, cobrança real,
nem publicação de APK foi feita por esta mudança.
