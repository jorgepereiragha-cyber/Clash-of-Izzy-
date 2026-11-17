# Baseline visual mobile — Clash of Izzy

> **Estado: TEMPLATE — NÃO APROVADO.** Este documento não representa uma aprovação visual. Marque um critério como aprovado somente depois de executar o teste no dispositivo indicado e anexar a evidência correspondente.

## 1. Identificação da captura

| Campo | Valor |
|---|---|
| Projeto | Clash of Izzy (PWA) |
| Pull Request | [#112](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/112) |
| Commit de referência | `76af1483252b85e8772cdd05539759ba25644087` |
| Abreviação do commit | `76af148` |
| Service Worker cache | `clash-of-izzy-shell-v30` |
| CI de referência | [#831 — sucesso](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43983540858) |
| Build Cloudflare (build aprovado; URL pública de Preview não confirmada) | [Build Cloudflare](https://dash.cloudflare.com/ed443802b956d175409db190a0fe8d0e/workers/services/view/clash-of-izzy/production/previews/feat-visual-quality-mobile-3d/builds/1ad210ca-78dc-4128-b545-597b4f1fd87c) |
| URL/ID do deployment efetivamente testado | **PREENCHER** |
| Data e hora da inspeção (UTC) | **PREENCHER** |
| Responsável pela inspeção | **PREENCHER** |

### Dispositivo e ambiente

| Campo | Valor |
|---|---|
| Modelo do dispositivo | **PREENCHER** |
| Versão do Android | **PREENCHER** |
| Navegador e versão | **PREENCHER** |
| Modo | `Chrome tab` / `PWA standalone` |
| Resolução física | **PREENCHER** |
| Viewport CSS | **PREENCHER** |
| Escala/DPR | **PREENCHER** |
| Orientação | **PREENCHER** |
| Rede utilizada | **PREENCHER** |

## 2. Pré-condições e proveniência

- [ ] Confirmar no painel Cloudflare que o build/Preview efetivamente usado corresponde ao commit `76af148`.
- [ ] Registrar a URL exata do deployment, não apenas a URL estável da branch.
- [ ] Abrir `/sw.js` no Preview e confirmar `clash-of-izzy-shell-v30`.
- [ ] Confirmar em DevTools → Application → Service Workers qual worker está ativo e controlando a página.
- [ ] Fazer hard reload/atualização do worker no perfil descartável antes das capturas.
- [ ] Confirmar que a requisição autenticada `GET /api/account/status` retorna `emailMasked` e **não** contém a propriedade `email`.
- [ ] Guardar o status HTTP e a resposta JSON sanitizada, sem token ou dados pessoais reais.

**Prova de versão (preencher):**

- Commit/build visto no painel: **PREENCHER**
- URL do deployment: **PREENCHER**
- Cache name visto em `sw.js`: **PREENCHER**
- Worker ativo/controlador: **PREENCHER**
- Resposta de status validada sem PII bruta: **PREENCHER**
- Evidência (arquivo/link): **PREENCHER**

> A versão do cache, sozinha, não prova a identidade do commit. Use em conjunto o deployment do painel, a URL exata e a resposta do Worker.

## 3. Matriz de inspeção visual

Use uma conta descartável, criada especificamente para este teste. Não use conta real ou dados pessoais reais.

| Cenário | Viewport/modo | Critérios de aceite | Estado | Evidência |
|---|---|---|---|---|
| Convidado | 360 CSS px, Chrome | Banner aparece; CTA visível; sem sobreposição do HUD; sem scroll horizontal | PENDENTE | `screenshots/guest-360.png` |
| Convidado | viewport nativo, Chrome | Banner e CTA respeitam safe areas e largura disponível | PENDENTE | `screenshots/guest-native.png` |
| Conta vinculada | viewport nativo, Chrome | Mostra e-mail mascarado; formulário de cadastro ausente do layout; ação de sair visível | PENDENTE | `screenshots/linked-masked-email.png` |
| Conta vinculada | viewport nativo, Chrome | Não há salto de layout após resposta de status | PENDENTE | `screenshots/linked-settled.png` |
| Fallback HTTP 500 | viewport nativo, Chrome | Banner permanece oculto; reino continua utilizável; sem erro técnico exposto na interface | PENDENTE | `screenshots/status-500.png` |
| PWA standalone | resolução nativa | Abre em standalone; sessão persiste; worker ativo usa cache v30 | PENDENTE | `screenshots/pwa-standalone.png` |

### 3.1 Estado de convidado

- [ ] `GET /api/account/status` retorna `hasAccount: false`.
- [ ] Banner “Modo Convidado” aparece após a resposta de status.
- [ ] CTA navega para `/account.html`.
- [ ] Banner não cobre HUD, recursos, botões ou conteúdo principal.
- [ ] CTA respeita a largura disponível e não provoca rolagem horizontal.
- [ ] Reino permanece utilizável durante a navegação.

### 3.2 Estado vinculado

- [ ] `GET /api/account/status` retorna `hasAccount: true`.
- [ ] Resposta contém `account.emailMasked` quando há e-mail.
- [ ] Resposta não possui `account.email` nem contém o endereço original em qualquer campo.
- [ ] Interface mostra somente o valor mascarado (ex.: `j***@example.com`).
- [ ] Formulário `#registerForm` permanece oculto e não reserva espaço.
- [ ] Botão “Sair deste dispositivo” aparece e, usando conta descartável, encerra a sessão conforme esperado.

### 3.3 Falha de status / HTTP 500

- [ ] Simular falha apenas no perfil de teste (mock/route interception ou ambiente isolado).
- [ ] Banner de convidado permanece oculto em estado ambíguo.
- [ ] Reino continua renderizado e utilizável.
- [ ] Nenhuma mensagem técnica, stack trace ou dado sensível é mostrado ao jogador.
- [ ] Registrar console/network apenas com dados sanitizados.

### 3.4 Ciclo de vida PWA

- [ ] Instalar/adicionar o Preview à tela inicial no perfil descartável.
- [ ] Abrir no modo standalone e confirmar ausência da UI do navegador.
- [ ] Fechar completamente o app e reabri-lo.
- [ ] Confirmar sessão e navegação persistentes.
- [ ] Confirmar worker ativo/controlador com shell cache v30.
- [ ] Repetir a abertura online e, quando aplicável, o cenário offline sem fazer ações que alterem dados reais.

## 4. Não regressão para PRs futuras

- [ ] O banner de convidado só aparece após resposta confirmada `hasAccount: false`.
- [ ] Estado vinculado nunca exibe CTA de convidado.
- [ ] Falha de rede/status não classifica o jogador como convidado.
- [ ] O endpoint de status nunca devolve e-mail em texto puro.
- [ ] Login e cadastro também devolvem `emailMasked`, nunca `email` em texto puro.
- [ ] Formulários com atributo HTML `hidden` permanecem efetivamente ocultos apesar do CSS de layout.
- [ ] Nenhum overflow horizontal em 360 CSS px ou no viewport nativo testado.
- [ ] Navegação e controles principais permanecem acessíveis por toque.
- [ ] Alterações em assets shell incrementam o cache do Service Worker e atualizam as expectativas de teste.
- [ ] Capturas e logs não contêm tokens, e-mails completos, IDs de sessão ou outras PII.

## 5. Evidências

Guardar somente capturas sanitizadas. Não incluir cookies, cabeçalhos Authorization, tokens, e-mail real, senha, IDs de jogador ou conteúdo de contas reais.

Estrutura sugerida:

```text
docs/baseline-mobile/
├── BASELINE-TEMPLATE.md
└── evidence/
    ├── guest-360.png
    ├── guest-native.png
    ├── linked-masked-email.png
    ├── linked-settled.png
    ├── status-500.png
    └── pwa-standalone.png
```

| Evidência | Arquivo/link | Sanitizada? | Revisada? |
|---|---|---|---|
| Convidado 360 px | **PREENCHER** | PENDENTE | PENDENTE |
| Convidado viewport nativo | **PREENCHER** | PENDENTE | PENDENTE |
| Vinculado / e-mail mascarado | **PREENCHER** | PENDENTE | PENDENTE |
| Formulário oculto | **PREENCHER** | PENDENTE | PENDENTE |
| Fallback HTTP 500 | **PREENCHER** | PENDENTE | PENDENTE |
| PWA standalone | **PREENCHER** | PENDENTE | PENDENTE |

## 6. Resultado e aprovação

| Área | Resultado |
|---|---|
| CI automatizada | APROVADA — CI #831 |
| Contrato da API sem e-mail bruto | APROVADO — teste automatizado |
| Build Cloudflare do commit de referência | APROVADO |
| Runtime do Preview no deployment exato | PENDENTE |
| Inspeção física Android | PENDENTE |
| Ciclo de vida PWA standalone | PENDENTE |
| Baseline visual | NÃO APROVADO |

**Bloqueios conhecidos:** confirmar que o Preview efetivamente servido no aparelho corresponde ao deployment do commit de referência; executar e registrar a inspeção visual Android.

**Aprovador técnico:** **PREENCHER**  
**Data da aprovação:** **PREENCHER**  
**Commit aprovado para baseline:** **PREENCHER**

> Não marcar este documento como baseline aprovado nem marcar a PR como Ready for Review enquanto os itens de runtime/Android acima estiverem pendentes.
