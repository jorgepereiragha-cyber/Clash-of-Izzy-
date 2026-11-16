# 🏰 Clash of Izzy — Release Oficial: Visual Premium & Gravador Cinematográfico

**Status:** produção publicada; CI e smoke test final aprovados  
**Data do deploy final:** 16 de novembro de 2026  
**Service Worker:** cache `clash-of-izzy-shell-v23`  
**Cloudflare Worker Version ID:** `15a15648-4b90-450c-a1b1-34747919ced7`  
**Commit de produção:** `93f48ac1a5c754440435673d8ea09b8c5295ae18`

---

## 🔗 Links oficiais

- 🎮 **Jogar:** [Clash of Izzy — Produção](https://clash-of-izzy.jorgepereiragha.workers.dev)
- 📦 **PR #95:** [Visual Premium e Gravador Cinematográfico](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/95)
- 🔧 **PR #97:** [Correção da validação de versão do cache](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/97)
- ⚙️ **Deploy final:** [GitHub Actions — run #43872671573](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671573)
- ✅ **CI final:** [GitHub Actions — run #43872671700](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671700)
- 💾 **Ponto de restauração D1:** [Artifact do Time Travel](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671573/artifacts/14228103669)

## 🚀 Entregas desta versão

### 1. Gravador cinematográfico

- Integrado à página do reino e ao renderizador Three.js existente.
- Presets de câmera, roteiro de 60 segundos, textos animados e barra de progresso.
- Prévia do vídeo e download local por `Blob` e `ObjectURL`.
- Captura sem enviar o vídeo para o servidor; o arquivo é mantido temporariamente na memória do dispositivo.

### 2. Compatibilidade e resiliência mobile

- Negociação de codecs com preferência dinâmica e fallback entre VP9, VP8 e H.264/MP4 conforme o suporte do navegador.
- Integração com Screen Wake Lock durante a gravação, com tentativa de reaquisição quando a página volta a ficar visível.
- Pré-checagem do orçamento de memória para evitar iniciar gravações estimadas acima do limite seguro.
- Atualização do Service Worker para o cache v23 e inclusão dos módulos do gravador no conjunto de assets da PWA.

**Limite da validação:** o smoke test de produção confirmou a publicação do Service Worker, dos módulos JavaScript e dos estilos do gravador. Ele não simula perda de rede nem substitui uma gravação física de 10 segundos no Android usando a versão de produção. O download é local e não faz upload do vídeo; o comportamento offline deve ser confirmado no dispositivo, após o cache dos assets.

### 3. Infraestrutura e publicação

- Inclusão de `"previews": {}` em `wrangler.jsonc` para compatibilidade com os Worker Previews da Cloudflare.
- Captura de um bookmark D1 Time Travel imediatamente antes da etapa de migração remota e arquivamento do arquivo de recuperação no GitHub Actions.
- Aplicação/validação do estado das migrations D1 remotas; no deploy final, o Wrangler informou **“No migrations to apply”**.
- Publicação do Worker e dos assets estáticos na Cloudflare.

O bookmark é um ponto de recuperação, não uma restauração automática. Uma restauração Time Travel requer ação explícita e sobrescreve o estado atual do banco; avalie cuidadosamente os dados gravados após o bookmark antes de executá-la.

## 🛡️ Validação do deploy final

Execução de produção: [run #43872671573](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671573)

- [x] 224 testes automatizados aprovados; 0 falhas.
- [x] Bundle do Worker validado.
- [x] Migrations verificadas localmente.
- [x] Credenciais de deploy Cloudflare verificadas pelo workflow.
- [x] Ponto de restauração D1 capturado.
- [x] Artifact do ponto de restauração arquivado.
- [x] Etapa de migrations remotas concluída.
- [x] Worker e assets estáticos publicados.
- [x] Smoke test de produção aprovado.

O smoke test de somente leitura confirmou:

- API de saúde, conexão D1, schema e configuração de sessão.
- Configuração administrativa e limites de autenticação.
- Catálogo da loja e rota de checkout Mercado Pago.
- Oito páginas HTML principais.
- Manifest e Service Worker da PWA.
- Assets da landing page, feedback e analytics.
- Navegação do mapa, renderização 3D e presença do gravador cinematográfico.

A execução final também informou que o provedor de e-mail transacional não está configurado. Isso não bloqueou o smoke test nem a publicação; configure o provedor antes de depender de envio de e-mails transacionais em produção.

## 📱 Conferência manual recomendada após o deploy

1. Abra a [URL de produção](https://clash-of-izzy.jorgepereiragha.workers.dev) no Android.
2. Feche completamente o PWA e abra-o novamente para atualizar o Service Worker.
3. Faça uma gravação de aproximadamente 10 segundos.
4. Confirme a prévia, o download e a reprodução do arquivo.
5. Feche o modal e confira se a câmera, as animações e o FPS continuam normais.
6. Para validar o modo sem rede, repita o teste depois de carregar/cachear os assets e coloque o dispositivo em modo avião antes de gravar.

Os testes físicos informados anteriormente pelo usuário foram feitos antes do deploy final; esta verificação pós-publicação é recomendada para fechar a validação no ambiente de produção.

---

*Clash of Izzy © 2026 — Visual Premium & Gravador Cinematográfico.*
