# Bíblia visual — Clash of Izzy

Documento mestre para impedir que cidade, mapa, heróis, dragões, batalhas e interfaces pareçam pertencer a jogos diferentes.

## Identidade central

**Fantasia medieval estratégica, majestosa e legível em telas móveis.** A cidade do jogador é o centro visual e emocional. A interface deve parecer um reino vivo, não um painel genérico de administração.

## Paleta de referência

| Token | Cor | Uso |
|---|---|---|
| Azul-noite | #101A2B | Fundo profundo e molduras |
| Azul-real | #24476B | Painéis, uniformes e superfícies |
| Azul-aço | #52677D | Bordas secundárias e estados neutros |
| Ouro | #E7BD68 | Títulos, destaques e ações principais |
| Ouro escuro | #9A682D | Contornos e detalhes |
| Pergaminho | #F5EDDA | Texto principal |
| Verde reino | #456B4E | Terreno, produção e estados positivos |
| Vermelho guerra | #A9433B | Perigo, ataque e alertas |

Os tokens devem ser centralizados em CSS variables e reutilizados. Não criar uma paleta nova por tela.

## Linguagem de formas e materiais

- Castelo e edifícios: pedra clara/cinza quente, madeira escura, telhados azul-real e detalhes dourados.
- Fortificações: pedra, bandeiras e metal; leitura de silhueta clara em escala pequena.
- Heróis: armaduras medievais estilizadas, tecidos e metais coerentes com a facção.
- Dragões: anatomia fantástica consistente, materiais e iluminação compatíveis com o cenário.
- Interface: painéis azul-noite, molduras discretas douradas, tipografia de alta legibilidade.
- Ícones: uma única família visual, mesmo peso de traço, perspectiva e nível de detalhe.

## Câmera e composição

- Cidade: câmera isométrica/ortográfica como padrão, com rotação e zoom limitados e previsíveis.
- Mapa mundial: visão superior inclinada, escala e símbolos consistentes com a cidade.
- Combate: manter materiais, proporções, iluminação e design de personagens do mesmo universo.
- Edifícios devem manter escala relativa, orientação e pontos de ancoragem coerentes entre cenas.

## Materiais PBR e desempenho por perfil

A cidade utiliza materiais PBR do Three.js. Os mapas procedurais devem manter a mesma semente e o mesmo padrão de repetição em todas as instâncias equivalentes.

- **Albedo:** mapa de cor em espaço sRGB.
- **Normal:** mapa linear em espaço tangente, derivado da altura/luminância do padrão procedural e com amostragem em borda circular para evitar costura.
- **Roughness:** mapa linear de rugosidade, com faixa específica para pedra, madeira, telhado, grama e estrada.
- **Metalness:** reservado a metais reais (armaduras, ferragens e ornamentos); pedra, madeira e telha não devem receber brilho metálico artificial.
- **Low:** albedo 128 px e rugosidade escalar, sem mapas PBR adicionais para reduzir memória e trabalho de GPU.
- **Balanced:** albedo, normal e roughness em 256 px.
- **High:** albedo, normal e roughness em 512 px, respeitando o limite máximo de textura reportado pela GPU.

Os mapas devem usar repetição e anisotropia coerentes, ser compartilhados por cache por material e ser descartados explicitamente junto com os demais recursos WebGL. Mapas de normal e rugosidade não devem receber transformação sRGB. O sistema procedural é uma aproximação de materiais PBR; não deve ser apresentado como textura escaneada ou material PBR artístico final. Para a qualidade premium final, adicionar materiais autorais com albedo, normal, roughness, AO e, quando necessário, metalness, além de registrar licença, resolução e origem dos arquivos.

## Regras de consistência

1. Um único logo oficial, sem redesenhos improvisados.
2. Mesma paleta, tipografia, molduras, botões, ícones e estados.
3. Não misturar render realista, cartoon e low-poly sem decisão artística explícita.
4. Não usar imagens de referência como se fossem assets finais do jogo.
5. Todo asset deve ter nome, categoria, versão, licença/origem e especificação de uso.
6. Personagens e edifícios devem funcionar em fundo claro e escuro e em escala mobile.
7. A interface deve priorizar informação importante: recursos, poder, tarefas, construção e alertas.
8. Acessibilidade: contraste, alvos de toque e texto legível em Android.

## Componentes de interface a padronizar

- Barra superior: logo, jogador/reino, recursos e notificações.
- Navegação principal: Reino, Mundo, Exército, Heróis, Aliança e Loja.
- Cartão de edifício: ilustração, nível, produção/função, requisito e ação.
- Modal de melhoria: custo, duração, pré-requisitos e confirmação.
- Cartão de herói/dragão: retrato, raridade, nível, atributos e habilidade.
- Relatório de batalha: participantes, formação, perdas, resultado e recompensas.
- Chat: autor, horário, canal, moderação e estado de envio.

## Direção para a primeira cidade 3D

A cena inicial deve conter apenas os elementos necessários para validar a linguagem visual:
- terreno gramado com caminhos de pedra;
- castelo central com telhado azul e detalhes dourados;
- fazenda, serraria, pedreira e quartel no mesmo estilo arquitetônico;
- muralha e portão;
- bandeiras com o emblema de Clash of Izzy;
- iluminação diurna suave, sombras legíveis e vegetação moderada.

A cena precisa ser produzida com assets reutilizáveis e carregados a partir do estado do reino. Não é uma imagem de fundo estática.

## Revisão visual

Antes de aprovar qualquer tela, comparar lado a lado:
- cidade;
- mapa mundial;
- tela de aliança;
- inventário/equipamentos;
- heróis e dragões;
- combate.

Reprovar se houver divergência de paleta, escala, câmera, materiais, tipografia, ícones ou linguagem de ilustração.


## Camada ambiente Android — partículas da cidade

- `scripts/ambient-particles.js` é carregado somente na tela do Reino e usa Canvas 2D transparente, sem criar outro contexto WebGL.
- O número de partículas e o DPR são menores em telas móveis e em aparelhos com memória limitada; o loop decorativo é limitado a aproximadamente 30 fps.
- O efeito não inicia quando `prefers-reduced-motion`, Economia de dados ou memória reportada até 2 GB estão ativos.
- `IntersectionObserver` e `visibilitychange` suspendem a animação fora da área visível ou em segundo plano; o ciclo BFCache pausa/retoma e a saída real da página libera recursos.
- Temporizadores de construção, consultas da Loja de Valhalla e polling do evento global também ficam suspensos enquanto o documento está oculto; o estado oficial volta a ser buscado ao retornar.
- A camada é decorativa, `aria-hidden` e não intercepta toques; edifícios e controles continuam sendo elementos HTML interativos.
- O pós-processamento `scripts/post-processing.js` foi removido por não ter consumidor no runtime. Bloom/FXAA/Nordic Grade não devem ser descritos como ativos na cidade atual.
