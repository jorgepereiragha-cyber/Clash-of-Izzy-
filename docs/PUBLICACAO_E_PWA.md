# Publicação, instalação e disponibilidade — Clash of Izzy

## Resultado desejado
- Um endereço HTTPS único para compartilhar com jogadores.
- O jogo abre no Centro de Comando.
- Android pode instalar o PWA na tela inicial; o modo instalado abre sem a barra do navegador.
- O shell visual básico pode ser aberto offline, mas ações, conta e progresso exigem conexão com o servidor.
- Cada publicação aprovada atualiza o Worker e os arquivos estáticos.
- Um monitor verifica a prontidão do servidor a cada 15 minutos.

## Como publicar na Cloudflare
1. No Cloudflare Dashboard, abra **Workers & Pages** e selecione o Worker `clash-of-izzy`.
2. Em **Settings → Domains & Routes**, confirme se o endereço `workers.dev` está habilitado ou configure um domínio/subdomínio próprio. O endereço `workers.dev` depende do subdomínio da conta e não pode ser adivinhado pelo repositório.
3. Em **Settings → Variables and Secrets**, configure `SESSION_SECRET` como Secret forte e aleatório. Configure também `ADMIN_EMAIL` e `ADMIN_PASSWORD` como Secrets se o painel administrativo for usado.
4. No GitHub, abra **Settings → Secrets and variables → Actions** e crie:
   - Secrets: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
   - O token deve ter somente as permissões necessárias para editar Workers Scripts e D1 no escopo da conta.
5. Em **Settings → Secrets and variables → Actions → Variables**, crie `GAME_PUBLIC_URL` com o endereço HTTPS público completo, sem barra final.
6. Depois da revisão e merge da PR para `main`, o workflow `deploy-cloudflare.yml` valida o bundle, testa as migrations localmente, aplica migrations remotas, publica o Worker e consulta `/api/health`.
7. O workflow `uptime.yml` consulta a prontidão a cada 15 minutos. Se o endereço não estiver configurado, o agendamento fica inativo até a variável ser criada.

## Compartilhar e instalar
- Link para compartilhar: `https://SEU-DOMINIO/command-center.html`.
- No Android, abrir no Chrome e tocar em **Instalar jogo** quando o botão aparecer. Se o navegador não oferecer o prompt, usar o menu ⋮ → **Instalar app** ou **Adicionar à tela inicial**.
- No iPhone/iPad, abrir no Safari → Compartilhar → **Adicionar à Tela de Início**.
- A PWA usa `manifest.json`, ícones, service worker versionado e fallback offline. O cache não intercepta nem armazena respostas de `/api/*`; dados do jogador continuam vindo do servidor.

## Monitoramento
- `GET /api/health` responde 200 apenas quando D1 responde e `SESSION_SECRET` está configurado.
- A rota não revela tokens, nomes de usuário ou configuração administrativa.
- O monitor do GitHub Actions roda a cada 15 minutos quando `GAME_PUBLIC_URL` existe. Uma falha aparece como execução vermelha no separador Actions do GitHub.
- Ative notificações de falha de workflow nas configurações de notificações do GitHub para receber alertas.
- Cloudflare Workers Observability fornece métricas e logs para investigar erros e latência.

## Limites importantes
- Offline é somente a casca visual; login, criação de reino, batalha, chat e salvamento exigem Internet.
- O monitor não substitui redundância de banco, backups testados, alertas externos nem testes de carga.
- Não colocar tokens ou senhas em arquivos, commits, variáveis públicas ou mensagens.
- Não declarar o jogo publicado até o endereço HTTPS responder 200 em `/api/health` e o fluxo de criação/recuperação de sessão ser validado.
