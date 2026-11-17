# Benchmark de Clash of Kings aplicado ao Clash of Izzy

Data da análise: 17/11/2026  
Branch analisada: `feat/visual-quality-mobile-3d`  
Base observada: PR #112, commit `6479d634eaf40a62453b21ba3893f0481ac2f2dd`

## Objetivo e limite

Usar Clash of Kings como referência de gênero e benchmark de profundidade sistêmica, não como fonte para copiar código, nomes, personagens, mapas, interface, modelos, texturas, animações ou identidade visual. Clash of Izzy deve manter universo, nomenclatura, arte, economia, balanceamento e progressão próprios.

Este documento registra uma análise de produto e arquitetura e um plano de integração. Não afirma que funcionalidades futuras já foram implementadas ou testadas em produção.

## 1. O que o benchmark ensina

A descrição atual da loja oficial e guias públicos convergem em um ciclo de estratégia 4X:
- Cidade/castelo: edifícios econômicos, militares e defensivos com pré-requisitos e níveis.
- Economia: produção, coleta, armazenamento, custos de manutenção e proteção de recursos.
- Pesquisa: tecnologias que alteram economia, construção, logística, defesa e tropas.
- Exército: infantaria, cavalaria, unidades de distância e cerco, com funções e contrajogo.
- Heróis e equipamento: progressão de personagens e bônus especializados que se combinam com tropas e pesquisa.
- Criaturas/dragões: progressão complementar e habilidades com impacto estratégico.
- Mapa persistente: territórios, recursos, exploração, marcha, ocupação e conflito.
- Alianças: ajuda, contribuições, diplomacia, reforços, rallies e guerras coordenadas.
- Eventos competitivos: objetivos temporários e sazonais que dão propósito ao crescimento.

A principal lição de design: poder exibido não é sinônimo de eficiência militar. A força real emerge da sinergia entre composição, atributos, pesquisa, herói, equipamento, criatura, logística, informação e contexto do alvo.

## 2. Auditoria do que já existe no Izzy

### Sistemas já identificados no repositório

| Domínio | Evidência encontrada | Leitura |
|---|---|---|
| Economia e cidade | `game-config.js`, filas persistentes, migrações de reino | Fundação existente; validar custos, pré-requisitos, produção e proteção de recursos |
| Tropas | `game-adapter.js`, catálogo de unidades e `kingdom-queue-rules.js` | Há várias classes; falta validar contrajogo e balanceamento por simulação |
| Combate | simulador server-authoritative, relatórios e replay | Base funcional; requer auditoria matemática, testes de cenários e transparência dos resultados |
| Pesquisa | `tech_catalog`, `kingdom_tech`, migração 0021 | Tecnologias militares, defensivas e econômicas já modeladas |
| Heróis/equipamento | tabelas de heróis existentes, `equipment-system.js`, migração 0008 | Sistema de equipamento e bônus existe; garantir herói como entidade jogável completa e não apenas multiplicador |
| Criaturas | dragões em 0003 e mascotes em 0022 | Diferencial próprio promissor; separar papéis e evitar bônus redundantes |
| Alianças | migração 0004: níveis, membros, ajuda, convites, chat e guerras | Base social persistente; conferir fluxo real de guerra, rally, reforço e território |
| Mapa | `world-map.js`, `world-map-3d.js`, nós de recursos e rallies em 0021 | Mapa e pontos de interesse existem; evoluir leitura estratégica, visibilidade e ocupação |
| Busca | FTS5 e `game_search_documents` em 0012 | Busca global indexa reinos, alianças, territórios e skins; não é ainda um recomendador estratégico |
| Visual 3D | Three.js, perfis low/balanced/high, texturas procedurais, manifesto GLB | Infraestrutura preparada, mas cobertura artística ainda é parcial |

### Lacunas visuais explicitamente documentadas

O próprio `assets/3d/README.md` informa que:
- O castelo de arte final ainda não foi incorporado; a cena usa geometria procedural.
- O manifesto tem poucas peças reais habilitadas: torre, muralha, trebuchet, árvore e arqueiro.
- Não existe cobertura artística final de todos os edifícios, tropas, heróis, animações e cosméticos.
- A cena 3D atual é renderizada sob demanda; não é ainda uma simulação contínua de batalha.
- Inspeção visual em Android físico continua obrigatória.

Portanto, a prioridade de qualidade não é simplesmente aumentar resolução ou sombras. É aumentar a qualidade e a variedade dos assets, preservar legibilidade e provar estabilidade em dispositivos reais.

## 3. Direção própria: identidade Clash of Izzy

### Pilares de identidade

1. **Reinos de Eldoria e mitologia nórdica original**: arquitetura de pedra antiga, madeira escura, metais forjados, runas discretas, estandartes próprios e paisagens regionais.
2. **Heróis com personalidade e função**: cada herói deve ter história, classe, habilidade ativa/passiva, sinergias e escolhas de evolução; evitar apenas trocar retratos e somar porcentagens.
3. **Dragões e companheiros como sistemas distintos**: dragões ligados a especializações e habilidades de grande impacto; mascotes com suporte, exploração ou utilidade, sem duplicar o mesmo bônus.
4. **Guerra legível e tática**: jogador entende por que venceu/perdeu, quais unidades foram eficazes e quais decisões pode mudar.
5. **Progressão justa e sustentável**: evitar que poder agregado, compras ou tempo de espera substituam escolhas estratégicas; cosméticos não concedem atributos quando declarados cosméticos.

### Vocabulário visual sugerido

- Castelo: fortaleza de Eldoria, silhueta reconhecível e evolução visível por nível.
- Edifícios: academia rúnica, salão dos juramentos, quartel, estábulo, campo de arqueiros, oficina de cerco, enfermaria, mercado, muralha e torre de vigia.
- Materiais PBR: pedra talhada e envelhecida, madeira com veios, ferro escurecido, cobre, tecidos bordados, telhas e vegetação regional.
- Heróis: silhuetas e paletas distintas por função; equipamento com leitura visual clara.
- Terrenos: floresta, planície, montanha, pântano e neve, com recursos e vantagens táticas coerentes.
- Interface: painel medieval próprio, hierarquia mobile-first, ícones legíveis e feedback de ação sem imitar a composição visual do benchmark.

## 4. Mapeamento de sistemas: benchmark → Izzy

| Referência de gênero | Implementação recomendada no Izzy | Critério de aceitação |
|---|---|---|
| Ciclo de castelo | Cadeia de pré-requisitos e edifícios com função única | Nenhum upgrade sem validar nível, custo, fila e benefício |
| Economia | Produção offline calculada no servidor, armazenamento, custos de exército e recursos protegidos claramente separados | Sem duplicação de coleta, overflow silencioso ou corrida de saldo |
| Pesquisa | Árvore em três ramos: economia, guerra e fortificação/logística | Pré-requisitos acíclicos; efeito aplicado uma única vez |
| Tropas | Infantaria, lança, arqueiros, cavalaria, magia e cerco com vantagens/desvantagens | Matriz de counters documentada e testes automatizados de confrontos |
| Heróis | Catálogo original, inventário, formação, nível, estrelas/habilidades e equipamento | Herói selecionado afeta somente a marcha/formação autorizada |
| Dragões | Especializações de ataque, defesa, economia ou exploração | Um conjunto de efeitos ativo, auditável e sem empilhamento acidental |
| Alianças | Ajuda, doações com limites, reforço, rally, território e guerra | Permissões por cargo, idempotência e histórico auditável |
| Mapa | Nós regeneráveis, castelos, ruínas, pontos de interesse e rotas | Coordenadas únicas, ocupação transacional e estado consistente |
| Eventos | Temporadas e objetivos de reino/aliança com calendário e recompensas | Regras versionadas, limites por jogador e encerramento idempotente |
| Relatórios | Replay determinístico e explicação de perdas/eficácia | Mesmo input e seed geram o mesmo resultado; relatório confere com inventário |

## 5. Prioridades de engenharia

### P0 — Integridade antes de expansão

- Manter Worker como autoridade para recursos, filas, marcha, formação, combate e recompensas.
- Aplicar transações D1 e chaves de idempotência em toda ação que gasta, concede ou movimenta itens/tropas.
- Validar que bônus de castelo, pesquisa, herói, equipamento, dragão e mascote são compostos exatamente uma vez.
- Corrigir e testar o simulador de combate antes de introduzir mais atributos: posições iniciais, alcance, seleção de alvo, ordem de turnos, baixas, feridos, cerco e condição de vitória devem ter regras explícitas.
- Não confiar no poder total enviado pelo cliente; recalcular atributos a partir do estado persistido.
- Garantir que replays sejam reproduzíveis e que relatórios não revelem dados de terceiros indevidamente.

### P1 — Profundidade estratégica

- Definir uma matriz de counters e papéis por unidade.
- Introduzir formações e slots de herói como escolhas estratégicas, não apenas multiplicadores.
- Conectar pesquisa e equipamento a unidades compatíveis, com limites e diminishing returns quando necessário.
- Tornar rallies, reforços e guerras de aliança um fluxo completo, com estados e prazos consistentes.
- Criar objetivos de mapa com escolhas: ocupar, coletar, explorar, defender ou disputar.
- Criar um painel de recomendação explicável: “melhor próximo passo” baseado em gargalos reais (economia, pesquisa, tropas ou defesa), sem automação opaca.

### P2 — Arte, textura e apresentação

- Produzir primeiro um pacote coeso de edifícios essenciais: castelo, quartel, academia, fazenda, serraria, pedreira, mina, muralha, torre, estábulo, enfermaria e oficina de cerco.
- Produzir heróis originais com rig, idle, walk, attack, hit e victory; validar escala e leitura em câmera isométrica.
- Criar tropas por classe e variações visuais por tier, sem multiplicar draw calls por soldado.
- Criar atlas de textura e materiais compartilhados; KTX2/Basis somente após validar no pipeline e em Android.
- Adicionar LODs, impostors ou instancing para multidões e objetos repetidos.
- Manter Canvas/procedural como fallback e carregamento GLB local com procedência/licença registrada.
- Não ativar asset novo só porque o GLB abre: validar materiais, UVs, normais, pivô, escala, colisão, animação, memória e aparência em tela pequena.

### P3 — Experiência e retenção saudável

- Tutorial por objetivos que ensina economia, defesa, pesquisa, marcha e aliança.
- Missões diárias e sazonais com recompensas previsíveis e sem exigir presença constante.
- Histórico de batalha, scouting e comparação de composição.
- Notificações úteis e configuráveis; evitar spam.
- Cosméticos de reino e herói com identidade forte, sem vantagem competitiva escondida.

## 6. Regras de balanceamento

- Separar **Poder de Progressão** de **Poder de Combate Efetivo**.
- Exibir os fatores do cálculo: tropas disponíveis, tier, feridos, formação, herói, pesquisa, equipamento, dragão, terreno e defesa.
- Avaliar custo/benefício por recurso, tempo e risco; não premiar apenas quantidade de unidades.
- Simular milhares de confrontos com seeds fixas e cenários espelhados antes de alterar coeficientes.
- Medir taxa de vitória por composição, diferença de nível, custo perdido e tempo de recuperação.
- Evitar uma composição universalmente dominante; counters devem ser úteis, mas não absolutos.
- Recompensas de eventos devem ter limites, auditoria e regras anti-abuso.

## 7. Qualidade gráfica e metas de validação

Os perfis atuais low/balanced/high e os orçamentos de pixels existentes devem ser preservados até medição. Não declarar FPS ou melhoria percentual sem captura real.

Métricas obrigatórias por dispositivo:
- tempo até primeiro quadro útil e até cena completa;
- p50/p95 do intervalo de frames, com amostra e duração;
- memória JS/GPU quando disponível;
- bytes transferidos por cena;
- draw calls, triângulos e texturas residentes;
- temperatura/thermal throttling apenas se a plataforma fornecer medição confiável;
- comportamento após alternar abas, perder WebGL, reconectar e instalar como PWA.

Matriz mínima: Android de entrada, intermediário e topo; Chrome normal e PWA instalada; rede lenta e Data Saver; perfil low/balanced/high. O teste automatizado de Playwright não substitui a inspeção física.

## 8. Plano de execução recomendado

1. Fechar auditoria do combate atual e criar fixtures de batalha determinísticas.
2. Validar economia, filas, pesquisa e bônus em D1 de Preview.
3. Completar fluxo de herói/formação e provar efeito no replay.
4. Fechar rally, reforço e guerra de aliança ponta a ponta.
5. Criar pacote visual original de edifícios essenciais e validar no Android.
6. Criar primeiro herói completo e uma unidade animada por classe como vertical slice.
7. Rodar testes de regressão, abuso, concorrência e migração.
8. Inspecionar Preview no Android e só então propor merge/deploy.

## 9. Fontes consultadas

- Google Play, página atual de Clash of Kings: https://play.google.com/store/apps/details?id=com.hcg.cok.gp
- Apple App Store, histórico de versões e funcionalidades: https://apps.apple.com/us/app/clash-of-kings-cok/id945274928
- Guia de progressão e edifícios (fonte secundária): https://boostroom.com/blog/clash-of-kings-castle-upgrade-guide-buildings-power-and-progression-tips
- Guia de tropas e formações (fonte secundária): https://boostroom.com/blog/clash-of-kings-troops-guide-best-units-formations-and-combat-tips
- Guia de progressão inicial (fonte secundária): https://boostroom.com/blog/clash-of-kings-beginner-guide-best-tips-for-fast-progression
- Documentação Three.js: https://threejs.org/docs/
- Especificação glTF 2.0: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html

A descrição das lojas é evidência primária para os recursos anunciados pelo jogo; guias são referências secundárias e podem conter dados desatualizados. Valores exatos, coeficientes e disponibilidade devem ser conferidos na versão jogável antes de qualquer reprodução de balanceamento.
