# Qualidade visual Android — ícone real e castelo GLB progressivo

## Ícone de launcher (Android 7–15+)
- Fonte única: `android-sideload/app/src/main/res/drawable-nodpi/royal_king.webp`.
- API 26+: `mipmap-anydpi-v26/ic_launcher.xml` e `ic_launcher_round.xml` separam fundo azul-escuro (`#081831`) e a imagem do rei em primeiro plano, centralizada dentro da área segura 72/108 dp. O launcher aplica máscara circular, quadrada ou personalizada.
- API 24–25: `mipmap-anydpi/` fornece composição equivalente sem depender de `<adaptive-icon>`.
- Android 12+: `values-v31/styles.xml` informa o mesmo herói ao splash do sistema. O painel de carregamento em `MainActivity.java` conserva o emblema e usa enquadramento central `FIT_CENTER` e borda dourada.
- Os XMLs escalam o mesmo WebP `drawable-nodpi`, **sem gerar cinco cópias redundantes**. Essa abordagem não aumenta a resolução real da imagem original.

### Quando houver arte original em alta resolução
O WebP atual é um recurso compacto de marca, não um master 1024×1024. Para lançamentos com inspeção rigorosa, exporte a mesma arte licenciada, sem alterar a identidade, de um master vetorial ou 1024×1024. Use **Android Studio → Image Asset → Launcher Icons (Adaptive and Legacy)**, com margem de segurança, para gerar opcionalmente os legados nos respectivos `mipmap-*`:

| Bucket | Ícone legado |
|---|---:|
| mdpi | 48 × 48 px |
| hdpi | 72 × 72 px |
| xhdpi | 96 × 96 px |
| xxhdpi | 144 × 144 px |
| xxxhdpi | 192 × 192 px |

Não ampliem o WebP pequeno alegando que ele se tornou arte original em alta definição. Inspecionar recorte do rei nos launchers redondo, quadrado e Samsung; validar o splash em Android 11 e Android 12+; compilar um APK de teste (não distribuir como assinado).

## Castelo e vegetação

1. A cidade Three.js já possui GLTFLoader, KTX2 e 5 GLBs Kenney CC0 com texturas locais. `engine/asset-loader.js` é uma API independente para `/assets/models/`, enquanto o renderer da cidade usa `/assets/3d/`. Para não criar outro carregador nem mudar o contrato, o castelo inicial usa **o loader já usado por `scripts/kingdom-3d.js`**.
2. O castelo padrão é composto por clones dos GLBs `tower-square.glb` e `wall.glb`, sem mutar materiais/geometry compartilhados. `balanced`: 2 torres + 2 muralhas; `high`: 4 + 4. Se GLB estiver ausente, parcial, desabilitado ou Data Saver for ativado, o castelo procedural continua disponível. Skins especiais preservam a renderização procedural com paletas próprias.
3. A floresta procedural permanece instanciada para poucas draw calls; apenas árvores decorativas próximas usam o GLB texturizado Kenney. No `balanced` até 3; no `high` até 6; no `low`, nenhum download GLB opcional.
4. No `high`, sombras `PCFSoftShadowMap` evitam serrilhados, sem aumentar resolução de sombras ou pixel ratio. Reavaliar os limites com `window.__coiKingdomDiagnostics?.()` e aparelhos físicos.

### Texturas mínimas

O pipeline já cria mapas PBR tileáveis para pedra, madeira, telhado, grama e estrada (128/256/512 conforme o aparelho). Os Kenney GLBs possuem cores/texturas locais. Ao substituir por materiais de arte final, preferir atlas WebP 512×512 (1024 só quando necessário) ou KTX2/Basis com fallback, usando normal/roughness quando o perfil permitir. Preservar mesma origem e orçamento do manifesto.

### Feedback visual (próxima rodada, quando os eventos forem homologados)

- Construção concluída: contorno dourado por 450 ms no prédio associado ao evento de conclusão **confirmado pelo servidor**; sem animação quando `prefers-reduced-motion`.
- Marcha: trilha curta no trajeto real do movimento, exibida somente se `march.startAt` / `endAt` indicarem marcha válida; nunca simular movimento sem estado do servidor.
- Recompensa diária: brilho leve e contador de gemas apenas após resposta de sucesso e idempotência confirmada; nunca animar antes da resposta.

Estas sugestões não alteram economia nem timers de produção. É obrigatório testar em Android físico, aparelho de entrada e intermediário, antes de promover qualidade visual a release comercial.
