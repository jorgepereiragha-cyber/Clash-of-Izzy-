# Benchmark funcional — Clash of Kings aplicado ao Clash of Izzy

**Data da revisão:** 14/11/2026  
**Referência:** funcionalidades descritas publicamente pela Elex e listagem Google Play.  
**Escopo:** reconstrução original de sistemas observáveis; não reproduzir código, arte, nomes exclusivos, fórmulas privadas ou conteúdo protegido.

## 1. O que o Clash of Kings oferece publicamente

A página pública do jogo descreve:
- desenvolvimento de cidade, muralhas, edifícios e produção de recursos;
- treino e composição de infantaria, cavalaria, arqueiros e cerco;
- heróis, dragões e tecnologias;
- alianças, expansão territorial, ataques coordenados e batalhas competitivas;
- eventos de grande escala, incluindo Guerra pelo Trono, Conquista do Reino, Campanha do Dragão, Dominação do Império e Batalha do Firmamento;
- cinco identidades de civilização citadas na listagem: Huaxia, Viking, Yamato, Dragon-born e Crescent, com arquitetura e unidades de elite próprias;
- atualizações de qualidade de vida, como relatórios de batalha mais legíveis, comparação visual de atributos e seções recolhíveis.

A listagem não revela fórmulas internas, taxas de drop, balanceamento privado nem arquitetura do servidor. Não inferir esses detalhes.

## 2. Auditoria do Clash of Izzy nesta branch

| Sistema | O que já existe no código/documentação | Lacuna real |
|---|---|---|
| Reino e edifícios | Catálogo de edifícios, níveis, custos e interface do Centro de Comando | Evoluir apresentação para uma cidade 3D integrada, sem duplicar edifícios |
| Economia | Recursos persistidos, produção passiva, ledger e filas de construção/treino/pesquisa | Coleta externa, balanceamento e testes de carga |
| Tropas | Catálogo de unidades e filas persistentes por edifício militar | Formação avançada, feridos/cura completa e balanceamento por tier |
| Marchas | Envio de tropas para coleta, exploração e PvE em territórios neutros | Retorno, reforços, rally, defesa coordenada e PvP seguro |
| Combate | Simulação PvE no servidor e relatórios persistidos | Combate entre jogadores, replay verificável e resolução concorrente |
| Heróis | Inventário, raridade, experiência e progressão presentes no Worker | Formação ativa, equipamento integrado e validação uniforme dos bônus |
| Dragões | Modelo e progressão existentes | Habilidades e vínculo completo com formação, marcha e eventos |
| Pesquisa | Categorias gerais e fila persistente; árvore de sete camadas documentada | Nós, pré-requisitos e efeitos de jogo ainda precisam ser conectados ao catálogo real |
| Alianças | Estruturas e interface de aliança/chat presentes no projeto | Chefe cooperativo, cargos/permissões completos, rally e guerra entre alianças |
| Mundo | Territórios e ações de marcha; Centro de Comando lista o mundo | Mapa mundial 3D contínuo e interativo ainda não implementado |
| Eventos | Missões diárias LiveOps, resgate idempotente e calendário/catalogação documentada | Eventos competitivos completos, ranking, inscrição, fases e matchmaking |
| Loja | Catálogo de skins/pacotes e fluxo de consulta de compra | Pagamento e entrega automáticos ainda não devem ser considerados concluídos |
| Experiência | PWA instalável, shell offline, filas que avançam com o jogador desconectado | Conta recuperável, push e sincronização robusta em dispositivos diferentes |

**Importante:** esta tabela descreve a branch de trabalho feature/offline-kingdom-progression, não uma versão de produção publicada. A PR #9 permanece aberta; migrações novas ainda precisam de validação no ambiente remoto e não houve deploy por esta revisão.

## 3. O que aplicar — ordem de prioridade

### P0 — confiabilidade antes de adicionar conteúdo
1. Resolver e validar a falha do check externo Cloudflare Workers Builds.
2. Conferir a sequência completa de migrações no D1 de teste e remoto antes de qualquer publicação.
3. Testar concorrência de filas, marchas, batalhas e recompensas; impedir crédito duplicado.
4. Atualizar o estado do README, que não deve afirmar uma sequência de migrações antiga quando a branch já inclui novas migrações.

### P1 — mapa e estratégia visível
1. Criar a primeira área 3D do reino e conectar os territórios já existentes, sem criar um segundo sistema de mundo.
2. Exibir recursos, propriedade, perigo, distância e estado de marchas.
3. Permitir selecionar destino e formação; o servidor continua calculando tempo, custo, perdas e resultado.
4. Preservar alternativa HTML acessível e desempenho adaptativo em Android.

### P2 — vida de aliança
1. Chefe ancestral cooperativo com fases, tentativas limitadas e contribuição individual/comunitária.
2. Objetivos semanais da aliança e recompensas por marcos, não apenas pelo primeiro lugar.
3. Inscrição, lista de participantes, avisos fixados e horários UTC/local.
4. Usar o sistema LiveOps existente; não criar um calendário paralelo.

### P3 — guerra entre jogadores e reinos
1. Implementar primeiro reforço e rally PvE; depois PvP entre jogadores.
2. Matchmaking por idade do reino e faixa de poder.
3. Preparação, disputa e recuperação para guerra pelo trono.
4. Reivindicação territorial, defesa, retorno de tropas, escudos e cura com regras autoritativas.
5. Particionar coordenação de batalhas por reino/aliança; evitar um único objeto global e proteger todas as recompensas com idempotência.

### P4 — identidade de civilizações
Criar cinco culturas originais do Clash of Izzy, com arquitetura, paleta e unidades de identidade. Bônus devem ser pequenos, transparentes e compensáveis por estratégia; não criar civilização paga mais forte. Os nomes e a direção visual devem ser próprios, sem copiar os nomes/visuais da referência.

### P5 — qualidade de vida
- Relatórios com comparação visual de atributos, cores acompanhadas por rótulos/texto e seções recolhíveis.
- Histórico claro de marchas, batalhas, recompensas e contribuições.
- Tutoriais curtos e contextuais, com opção de pular.
- Notificações úteis e configuráveis; nunca punir o jogador por ficar ausente.

## 4. Regras que não podem ser quebradas

- O servidor é a autoridade sobre recursos, filas, tropas, combate, território, ranking e recompensas.
- Não confiar em relógio, coordenadas, pontuação ou resultado enviados pelo cliente.
- Toda operação econômica deve ser atômica, auditável e idempotente.
- Migrações são aditivas; nunca editar migrações já aplicadas ou apagar dados para simplificar.
- Antes de criar tabela, fila, catálogo ou interface, procurar e reutilizar o sistema existente.
- Jogadores gratuitos devem acessar a progressão principal e os eventos-base.
- Monetização cosmética/conveniência; sem poder exclusivo pago ou probabilidades ocultas.
- Não declarar como ativo o que ainda está documentado, prototipado ou sem deploy.

## 5. Próxima entrega técnica recomendada

A próxima fatia vertical é **Mapa do Reino — primeira região 3D**: uma área pequena, um território clicável, painel com informação real do servidor, seleção de marcha e atualização do estado. Reutilizar world_territories, marches, /api/game/state e as ações existentes após auditoria completa das rotas. Não implementar PvP ou uma segunda economia antes de testes de concorrência.

Critérios de aceite:
- estado igual em dois dispositivos após sincronização;
- nenhuma tropa ou recompensa duplicada em chamadas simultâneas;
- alvo e quantidade validados pelo servidor;
- fallback acessível sem WebGL;
- testes automatizados e CI aprovados;
- nenhum deploy ou migração remota sem validação explícita.

## Fontes públicas
- Google Play — Clash of Kings (descrição e atualizações): https://play.google.com/store/apps/details?id=com.hcg.cok.gp
- Apple App Store — Clash of Kings (histórico público de atualizações): https://apps.apple.com/us/app/clash-of-kings-cok/id945274928

Última revisão baseada na listagem pública disponível em novembro de 2026. As funcionalidades e atualizações podem variar por região, servidor e versão.
