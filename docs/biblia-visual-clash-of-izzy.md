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
