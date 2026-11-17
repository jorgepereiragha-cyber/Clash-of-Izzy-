# Inspeção visual física Android — Clash of Izzy

**Data do registro:** 16/11/2026  
**Pull Request:** [#112 — feat(visual): improve kingdom art and mobile rendering quality](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/112)  
**Branch:** `feat/visual-quality-mobile-3d`  
**Estado geral:** baseline visual parcial; PR permanece em Draft e merge bloqueado.

> Este registro consolida o relatório de inspeção física fornecido pelo responsável pelo teste. As capturas originais ainda precisam ser anexadas ao repositório em formato sanitizado. Não tratar este registro textual como substituto dos arquivos de evidência.

## Captura 1 — Modal “Instalar no Android”

**Resultado:** APROVADO FUNCIONALMENTE COM AJUSTE COSMÉTICO PENDENTE DE RETESTE.  
**Severidade:** BAIXA.

| Critério | Resultado observado |
|---|---|
| Renderização, borda e fundo | Aprovado |
| Legibilidade e etapas | Aprovado |
| Botão “Entendi” | Aprovado |
| Fechamento pelo × | Funciona; indicador de foco dourado persistente observado |
| Instruções Android/Chrome | Aprovado |

**Diagnóstico:** o script focava programaticamente o botão de fechar ao abrir o diálogo. Como o tema já usa `:focus-visible`, simplesmente trocar seletores CSS não resolveria a origem do anel. A implementação foi ajustada para focar o contêiner acessível do diálogo (`#install-modal`) com `tabindex="-1"`, mantendo o foco visível nos controles quando houver navegação por teclado.

**Reteste obrigatório:** abrir pelo toque e verificar que o × não recebe o anel persistente; navegar com teclado e confirmar que o × continua exibindo foco visível; testar × e “Entendi” e confirmar que o scroll da página continua disponível após o fechamento.

**Evidência original:** recebida e revisada conforme relatório; anexar PNG sanitizado em `evidence/android-install-modal.png`.

## Captura 2 — Landing / Hero

**Resultado:** APROVADA.  
**Severidade:** NENHUMA.

| Critério | Resultado observado |
|---|---|
| Brasão nítido e sem duplicação | Aprovado |
| Título, tagline e badge | Aprovado |
| CTA principal com alvo adequado | Aprovado |
| Botão de instalação abre o modal | Aprovado |
| Checklist inferior e comportamento de dobra | Aprovado; conteúdo abaixo da dobra é alcançado por scroll |
| Overflow horizontal | Nenhum observado |

**Diagnóstico:** sem defeitos visuais reportados no dispositivo testado. Os emojis nos botões ficam registrados apenas como ponto de consistência entre renderizadores/fabricantes, sem bloquear a aprovação.

**Evidência original:** recebida e revisada conforme relatório; anexar PNG sanitizado em `evidence/android-landing-hero.png`.

## Itens de instalação e cache

| Item | Estado | Limite da evidência |
|---|---|---|
| Instruções e modal de instalação | FLUXO VALIDADO | Não prova que o PWA foi efetivamente instalado |
| Código do Preview `sw.js` | VALIDADO — `clash-of-izzy-shell-v31` | A presença do nome no arquivo não prova ativação/controlador no aparelho |
| Service Worker ativo/controlando a página | PENDENTE | Confirmar após atualização/instalação no Android |
| PWA standalone | PENDENTE | Requer ícone na tela inicial e abertura sem a barra do navegador |
| Reabertura offline | PENDENTE | Requer fechar completamente, reabrir sem rede e verificar shell/cache |

## Quatro capturas restantes

| # | Captura necessária | Critério principal | Estado |
|---|---|---|---|
| 3 | Cidade 3D — vista geral | Ausência de árvores/construções duplicadas; composição e enquadramento | PENDENTE |
| 4 | Close-up das texturas | Nitidez e detalhe dos tiers 128/256/512 px no dispositivo | PENDENTE |
| 5 | Sombras e iluminação | Estabilidade de sombras e iluminação durante rotação/zoom | PENDENTE |
| 6 | PWA instalado | Ícone na tela inicial, modo standalone, worker ativo/controlador e reabertura offline | PENDENTE |

## Decisão

**MERGE BLOQUEADO — PR #112 permanece Draft.**

A Captura 2 está aprovada. A Captura 1 está aprovada quanto ao fluxo, mas o ajuste cosmético precisa de reteste físico após a alteração de foco. Ainda são necessários os quatro cenários restantes, a confirmação do Service Worker ativo/controlador e a anexação das seis capturas sanitizadas.

Não promover a PR para Ready for Review nem mesclar até que todas as evidências sejam revisadas. CI e Preview automatizados não substituem a inspeção física Android.
