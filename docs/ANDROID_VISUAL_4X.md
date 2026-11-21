# Clash of Izzy — Interface medieval 4X (cidade)

## Objetivo
Evoluir a experiência de cidade do Clash of Izzy usando referências **de gênero**
de jogos de estratégia 4X: cidade isométrica em destaque, painel de recursos,
nível do castelo, poder, ordens de construção e navegação direta entre cidade,
tropas, mundo e aliança. Esta entrega usa **identidade visual própria**, sem
copiar as texturas, artes, código, logotipos ou marcas de outros jogos.

## Integrado de forma funcional
- O WebGL 3D existente e a arte 2D de fallback continuam conectados aos
  edifícios reais recebidos do Worker. Nenhum modelo ou combate falso é exibido.
- A barra de recursos mantém os dados da API e permite rolagem horizontal
  em Android sem espremer os seis indicadores.
- O painel de comando lê nível do castelo, poder e exército do estado existente.
- A faixa de ordens mostra apenas filas com \`status = running\`, com um atalho
  direto para a fila mais próxima ou para o catálogo de construções.
- O dock inferior navega para âncoras reais e páginas já existentes;
  não cria botões cenográficos que não funcionam.
- Alvos de toque, safe-area, foco por teclado e redução de movimento.
- Módulo puro de projeção de dados com testes, sem alterar Worker, D1,
  pagamentos ou inventário.

## Lançamento, compatibilidade e APK
Esta branch estende a PR #131 (\`feat/android-apk-sideload\`) e **não
desencadeia publicação na Cloudflare**. O APK de teste é um WebView que
carrega a URL HTTPS de produção; portanto, **recompilar o APK, por si só,
não coloca estes novos visuais na tela**. É necessário revisar/mesclar a PR
e executar o fluxo manual e protegido de deploy do Worker/assets.
O APK do PR deve ser usado somente para validação, não é release assinada.

## Para aproximar a qualidade de um grande jogo 4X
1. Substituir gradualmente placeholders/procedurais por assets 3D
   originais ou licenciados, com GLB e texturas compactadas KTX2.
2. Integrar heróis, unidades e marchas com animações 3D e combate
   que corresponda exatamente às regras verificadas no servidor.
3. Tornar o mapa compartilhado e as alianças testáveis com centenas de
   sessões simultâneas e observabilidade sob carga.
4. Fazer testes reais de memória, temperatura, FPS e contexto WebGL
   em Android de entrada, intermediário e avançado.
5. Concluir testes de login/recuperação de conta, loja, privacidade,
   política de pagamentos e assinatura antes de distribuição pública.

## Não afirmar
- Que agora temos arte, escala ou animações do jogo original.
- Que foi validado 60 FPS, PvP massivo, 1000 pessoas simultâneas, ou
  estabilidade Android físico.
- Que foi feita alteração em dados reais ou deploy de produção.
