# Clash of Izzy — Marchas e configurações estratégicas (modelo 4X)

**Regras próprias**, inspiradas nas mecânicas gerais de Clash of Kings e outros jogos de estratégia. Não reutilizar arte, UI, personagens ou fórmulas proprietárias.

## Configuração de capacidade por marcha (implementada)
A quantidade que pode ser enviada em **uma única expedição** não é a mesma coisa que a capacidade total de tropa do quartel. O modelo atual do Clash of Izzy é:

- Base de marcha: **150 unidades**.
- Castelo: **100 unidades por nível** (1–30).
- Quartel: **80 unidades por nível** (1–30).
- Academia: **25 unidades por nível** (1–30).
- Pesquisa militar: **110 unidades por nível** (0–30).
- Herói comandante: **18 unidades por nível + 90 por estrela + raridade**. Branco +0; Azul +180; Roxo +420; Dourado +800.
- Teto de segurança do sistema: **16.000 unidades** por expedição, não um direito a enviar tropas acima do saldo.

**Exemplo base sem herói:** castelo 1, quartel 1, academia 1, pesquisa 0 resulta em 355 unidades por marcha. Com herói branco nível 1 e uma estrela, 463 unidades por marcha.

O servidor calcula a capacidade diretamente do D1 e rejeita formações acima do limite **antes de debitar tropas**. O usuário pode escolher um herói específico (de sua própria coleção); caso não escolha, o sistema usa o herói de maior liderança. Os bônus de vários heróis **não se somam** para aumentar artificialmente uma mesma marcha.

**Filas simultâneas:** 1 inicial; +1 no castelo 5; +1 no castelo 15; +1 na pesquisa militar 5; +1 na pesquisa militar 15, até cinco filas. O Worker também confere o número de filas no mesmo débito atômico das tropas, impedindo que uma marcha rejeitada por filas lotadas desconte soldados.

**Formações rápidas:** Coleta (formação econômica de até 50 tropas), Equilibrada (distribui entre tipos disponíveis), Preencher (usa até a capacidade) e Limpar, sempre sem exceder a quantidade disponível. O jogador pode editar a composição manualmente antes de enviar.

O jogo salva o comandante escolhido e a capacidade validada na marcha persistente. Ao chegar ao ponto de combate, utiliza o comandante salvo (com fallback seguro para personagens antigos ou excluídos). A interface mostra as tropas selecionadas / capacidade e a decomposição por castelo, quartel, academia, pesquisa e herói; impede enviar mais que o limite. O cerco da Guerra do Trono também respeita a capacidade de marcha.

## Sistemas atuais verificados no código
- **Treinamento e exército:** tipos de tropa, quartéis e filas de treinamento, limites globais.
- **Marchas:** coleta, exploração e conquista de territórios neutros com expiração persistente e processamento por cron.
- **Combate PvE:** resolução e relatório de batalhas, bônus de heróis, dragões, pesquisa, equipamentos e recompensas; marchas antigas seguem válidas.
- **Coletores e nós:** sistema de territórios e nós especiais de recursos; isolamento completo de rallys entre mapas precisa de testes próprios antes de ampla concorrência.
- **Alianças/rally:** comunicação e reforços de recursos já possuem módulos separados; não presumir que o PvP massivo esteja pronto apenas pela existência de um botão.
- **Guerra do Trono:** trono por mundo, 35 dias de escudo, preparação, disputa, recuperação, cerco por alianças e coroação condicionada.
- **3 mundos:** o segundo é desbloqueado após 700 reinos cadastrados; o terceiro após 1.000.

## Próximas melhorias para paridade de categoria (ainda não concluídas)
1. **Formações salvas (3–5 slots)** no servidor, com escolha de unidades, herói e reutilização mediante saldo e capacidade atual.
2. **Marchas simultâneas (já implementadas):** ampliar futuramente slots sazonais e condições especiais somente após testes de balanceamento.
3. **Carga de coleta real** proporcional ao número/tipo de tropas, tempo e capacidade do nó, em vez de recompensas fixas por expedição.
4. **Monstros de mundo**, níveis progressivos, energia, chance de drop documentada e rastreamento antiautomação.
5. **Rallies entre mapas isolados** e entre alianças, limites por grupo, reforço e retirada segura em transações D1.
6. **Tempos de viagem por distância**, modificadores por tipo de tropa e habilidade de heróis, com contagem de marcha e retorno.
7. **Balanço de perdas** de feridos/hospital por tipo e nível, com limites e relatórios de batalha verificáveis.
8. **Desempenho para 1.000 jogadores**, carga e monitoramento de D1, WebSockets e Workers antes do lançamento comercial em grande escala.

Esses itens exigem etapas de implementação e testes; a inclusão neste plano não significa que já estejam ativados.

## Implantação
A mudança adiciona migration `0036_march_commanders.sql`, sem excluir dados de marchas anteriores. Antes do deploy: testes, D1 Preview e backup Time Travel. Depois, validar HTTP 200/ready, criar marcha com herói, testar capacidade e duplicidade, retornar tropas; somente então publicar APK assinado.

**Status de produção:** código integrado ao GitHub não habilita a produção. O backend/recebimentos ainda precisam da implantação protegida, das configurações privadas e dos testes financeiros; não substituir estas etapas por valores bancários escritos na conversa.
