# Clash of Izzy — homologação Android P0 (WebView)

Esta alteração está limitada ao shell Android; **não** muda pagamentos,
instalador oficial, API, D1 ou flags da produção.

## Comportamento proposto

- Normaliza `WebSettings.setTextZoom(100)` para reduzir diferenças de HUD
  entre aparelhos. **Revisão de acessibilidade obrigatória:** fontes grandes,
  contraste e TalkBack devem continuar utilizáveis; se houver regressão,
  reverter e adaptar CSS do HUD em vez de forçar tamanho fixo.
- Em Android 8+, prioriza o renderer enquanto visível, liberando prioridade
  ao sair do primeiro plano. Isso não impede o sistema de terminar o processo.
- Em `onSaveInstanceState`, salva histórico somente se a URL corrente pertencer
  ao host HTTPS autorizado do jogo. Em recriação da Activity, restaura o
  histórico apenas quando a URL salva e a URL restaurada coincidem. Caso contrário
  recarrega a página principal oficial.
- A sessão, inventário, economia e ações continuam autoritativos no Worker/D1.
  `WebView.saveState` não preserva necessariamente todo o estado JavaScript/DOM.

## Aceite obrigatório em aparelho físico (sem publicação)

1. Abrir reino, mapa, login e inventário; girar a tela e voltar.
2. Minimizar, receber chamada e voltar; repetir com aplicativo terminado pelo sistema.
3. Testar links externos de pagamento: não restaurar páginas de checkout dentro do WebView.
4. Testar internet lenta/indisponível, renderer morto e recuperação para o jogo.
5. Testar configurações de acessibilidade, fontes de 100%, 130%, 200%, TalkBack e telas menores.
6. Compilar APK debug e candidato interno assinado, confirmar package id e versionCode.
7. Não anunciar a release oficial nem ativar a loja por causa deste patch.

Nenhuma prova de teste físico ou instalação resulta automaticamente deste commit.
