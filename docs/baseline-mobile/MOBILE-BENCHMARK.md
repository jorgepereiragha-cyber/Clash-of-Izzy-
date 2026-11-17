# Benchmark mobile e visual — Clash of Izzy

> **Finalidade:** transformar referências de estratégia medieval em princípios de UX, arquitetura de informação e leitura visual para o Clash of Izzy.
>
> **Limite de aceite:** este documento é uma referência de design. Ele não aprova a PR #112, não substitui testes automatizados, nem substitui a inspeção no Android físico. A baseline só pode ser aprovada com capturas reais, sanitizadas e revisadas.

## 1. Princípios de uso das referências

Usar os jogos abaixo para estudar problemas resolvidos e padrões de interação, não para copiar telas, ícones, personagens, mapas, modelos, sons, textos, marcas ou assets. O Clash of Izzy deve manter identidade visual e implementação próprias.

As referências têm focos diferentes; não devem ser tratadas como uma única régua:

- **Clash of Kings:** estratégia MMO medieval — muralhas, produção de recursos, exércitos, heróis, dragões e alianças.
- **Clash of Clans:** organização da interface, clareza de progressão e redução de atrito nos menus.
- **Rise of Kingdoms:** leitura e navegação do mapa mundial, exploração e ações em tempo real.
- **Lords Mobile:** ligação entre heróis, especializações e bônus para exército/economia.
- **King of Avalon:** fantasia medieval, dragão ligado ao desenvolvimento do reino e cooperação entre alianças.
- **Stronghold: Definitive Edition:** composição de castelo, muralhas, economia local, tropas e leitura da cena medieval.

## 2. O que observar e aplicar

| Referência | Padrão a estudar | Aplicação própria no Clash of Izzy | Evidência/teste esperado |
|---|---|---|---|
| Clash of Kings | Muitos sistemas coexistem: recursos, construção, muralhas, tropas, heróis, dragões e alianças | Agrupar ações por intenção: Reino, Exército, Heróis, Aliança e Eventos. Priorizar a ação contextual em vez de exibir todos os sistemas ao mesmo tempo | Capturas de 360 CSS px e viewport nativo; verificar hierarquia, legibilidade, sobreposição e número de toques para tarefas frequentes |
| Clash of Clans | Reorganização da UI para reduzir dispersão de upgrades, manter a vila visível e dar endereço próprio a eventos | Centralizar melhorias por categoria sem esconder a cena 3D; manter acesso previsível aos eventos e evitar notificações sem ação útil | Executar tarefas de melhorar edifício, localizar evento e abrir tropas; registrar toques, tempo e qualquer menu que cubra controles essenciais |
| Rise of Kingdoms | Mapa mundial contínuo, zoom entre escalas, exploração e batalhas no próprio mapa | Tornar a transição Reino ↔ Mapa compreensível; preservar contexto/seleção durante zoom e impedir que painéis ocultem pontos de interesse | Gravar navegação entre cidade, mapa, território e retorno; verificar seleção, orientação, toque e desempenho no aparelho |
| Lords Mobile | Heróis com especializações e bônus distribuídos por funções | Mostrar claramente o que cada herói/mascote melhora: combate, construção, pesquisa, treinamento ou produção; distinguir bônus ativos de atributos decorativos | Captura da ficha de herói/mascote e teste de aplicação do bônus; comparar estado antes/depois com dados controlados |
| King of Avalon | Dragão como parte da fantasia e da progressão do reino, junto de alianças e diplomacia | Integrar dragão e mascotes à identidade e progressão sem misturar seus bônus ou criar painéis redundantes | Verificar descrição, origem, duração e efeito do bônus; confirmar que a UI explica o impacto antes da confirmação |
| Stronghold: Definitive Edition | Silhueta arquitetônica, muralhas, torres, economia local e relação espacial entre construções e tropas | Dar escala e leitura ao castelo: edifícios distintos, entradas visíveis, muralhas contínuas, caminhos e vegetação sem duplicação ou interseção | Capturas do reino 3D em zoom padrão e aproximado; inspecionar textura, iluminação, sombras, z-fighting, objetos repetidos e sobreposições |

## 3. Critérios de inspeção mobile

Marcar cada item como **APROVADO**, **REPROVADO** ou **NÃO TESTADO**. Um item não observado no aparelho não pode ser marcado como aprovado.

### 3.1 Interface e interação

- [ ] Em 360 CSS px não existe rolagem horizontal inesperada.
- [ ] No viewport nativo, HUD, recursos, navegação, CTA e painéis respeitam safe areas.
- [ ] Botões primários têm alvo de toque confortável (meta interna: 44 × 44 CSS px ou maior, sempre que o layout permitir).
- [ ] Alvos próximos não provocam toques acidentais.
- [ ] Nenhum modal, HUD, gravador ou notificação cobre a ação principal do cenário.
- [ ] Menus mantêm a cena do reino visível quando isso ajuda o contexto; fechar um menu é simples e previsível.
- [ ] Ações frequentes — abrir Reino/Mapa, consultar recursos, melhorar edifício e treinar tropa — têm caminho curto e rótulos inequívocos.
- [ ] Estado de carregamento, sucesso, erro e ação indisponível têm feedback distinto.

### 3.2 Cena 3D e identidade visual

- [ ] Castelo, muralhas, construções, árvores e tropas têm silhuetas distinguíveis no tamanho de tela móvel.
- [ ] Texturas low/balanced/high são nítidas no tamanho de renderização esperado e não exibem grão grosseiro, borrão ou repetição evidente.
- [ ] Objetos procedurais e modelos GLB não ocupam o mesmo ponto nem se atravessam indevidamente.
- [ ] Sombras não escondem caminhos, edifícios ou unidades.
- [ ] Não há clipping, z-fighting, materiais rosa/magenta de fallback ou superfícies sem textura.
- [ ] O tier gráfico considera capacidades reportadas e limites de pixels; largura CSS, isoladamente, não deve rebaixar um aparelho capaz.
- [ ] Gestos de câmera e navegação não bloqueiam controles nem deixam a cena em estado inconsistente.

### 3.3 Progressão e economia

- [ ] Quantidades de recursos são legíveis e não mostram NaN, undefined ou valores truncados.
- [ ] Uma melhoria informa custo, requisito, duração e resultado antes da confirmação.
- [ ] Filas distinguem tipo, alvo, progresso e tempo restante.
- [ ] Bônus de heróis/mascotes indicam claramente qual sistema afetam.
- [ ] Eventos têm entrada identificável, prazo e ação principal; notificações não são ruído permanente.

### 3.4 PWA e estabilidade

- [ ] A URL aberta no Android corresponde ao deployment identificado no registro de evidência.
- [ ] O Service Worker `clash-of-izzy-shell-v31` está ativo e controlando a página.
- [ ] A instalação/abertura standalone não corta conteúdo nem oculta controles.
- [ ] Fechar e reabrir preserva a navegação/sessão esperada no perfil descartável.
- [ ] Uma falha de rede/status não classifica indevidamente um jogador vinculado como convidado.
- [ ] Não há travamento, congelamento ou queda visual grave durante 60 segundos de navegação e gestos; registrar dispositivo, orientação e condições do teste.
- [ ] Capturas, logs e gravações estão sanitizados e não incluem tokens, cookies, e-mails completos ou IDs privados.

## 4. Roteiro comparativo de tarefas

Usar a mesma lista de tarefas para o Clash of Izzy e, quando disponível, para os jogos de referência. Não comparar FPS ou fidelidade gráfica entre aplicações nativas diferentes e um PWA como se fossem o mesmo ambiente de execução.

| Tarefa | Pergunta de avaliação | Registro |
|---|---|---|
| Encontrar uma melhoria | O jogador entende onde estão os upgrades e os requisitos? | Número de toques, tempo, captura |
| Conferir recursos | O saldo e o custo ficam claros antes da ação? | Captura e resultado |
| Treinar tropas | Quantidade, capacidade e fila são compreensíveis? | Número de toques, feedback |
| Ir ao mapa e voltar | A transição mantém contexto e posição? | Gravação curta |
| Consultar herói/mascote | O bônus e sua origem são explicados? | Captura da ficha |
| Abrir evento | A entrada é fácil de encontrar sem poluir a tela? | Número de toques, captura |
| Inspecionar cidade | O jogador distingue construções, tropas e caminhos? | Capturas em zoom padrão/aproximado |

Não atribuir nota global por gosto pessoal. Registrar fricção observável, severidade (bloqueador, alto, médio, baixo) e cenário reproduzível.

## 5. Relação com a PR #112 e Bloco B

A PR #112 trabalha qualidade da Landing e do renderizador mobile 3D. O benchmarking serve como checklist de inspeção; não amplia o escopo da PR para copiar funcionalidades de outros jogos.

Para o Bloco B, manter as seis evidências exigidas no `BASELINE-TEMPLATE.md`:

1. Landing em 360 CSS px.
2. Landing no viewport nativo.
3. Reino 3D/texturas.
4. Conta vinculada com e-mail mascarado.
5. Fallback HTTP 500.
6. PWA standalone.

As evidências devem pertencer ao Preview exato registrado na baseline. Testes Playwright com mocks/fixtures validam comportamento automatizado, mas não provam aparência, GPU, toque, Service Worker controlador ou modo standalone no aparelho físico.

## 6. Fontes de referência

- Clash of Kings — Google Play, descrição oficial do jogo: https://play.google.com/store/apps/details?id=com.hcg.cok.gp
- Clash of Clans — atualização oficial da interface, 8 de outubro de 2026: https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/
- Clash of Clans — página oficial do jogo: https://supercell.com/en/games/clashofclans/
- Rise of Kingdoms — ficha oficial da App Store: https://apps.apple.com/us/app/rise-of-kingdoms/id1354260888
- Lords Mobile — portal oficial de heróis: https://lordsmobile.igg.com/project/game_tool/index.php?action=play_content&cate=1
- King of Avalon — ficha da App Store: https://apps.apple.com/us/app/frost-flame-king-of-avalon/id1084930849
- Stronghold: Definitive Edition — página oficial da Firefly Studios: https://www.fireflyworlds.com/press/sheet.php?p=Stronghold+Definitive+Edition

---
**Status:** referência de design criada; inspeção Android e aprovação visual continuam pendentes.
