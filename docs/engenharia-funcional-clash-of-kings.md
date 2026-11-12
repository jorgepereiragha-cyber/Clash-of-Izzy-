# Engenharia funcional — Clash of Izzy
## Objetivo
Reconstruir, com implementação original, os sistemas observáveis do gênero e as funcionalidades publicamente descritas de Clash of Kings. Este documento é uma especificação de produto e engenharia; não contém código, assets, protocolos privados ou dados internos da Elex.

## Base pública consultada
- Página oficial da Elex: desenvolvimento do reino, construção, exército e conquista.
- Listagem pública do jogo: muralhas, produção, tropas, dragões, heróis, pesquisas, alianças, territórios e batalhas coordenadas.
- Atualização pública de setembro de 2026: eventos de reino, fases da Batalha pelo Trono e pontuação por treinamento.
As descrições públicas orientam o escopo, não revelam fórmulas internas nem autorizam reproduzir conteúdo protegido.

## Matriz de sistemas a reconstruir

| Sistema | Comportamento observável a implementar | Estado no Clash of Izzy |
|---|---|---|
| Cidade | Castelo, edifícios, níveis, requisitos e filas de melhoria | Esquema D1 criado; APIs e interface pendentes |
| Economia | Produção por edifício, coleta, armazenamento e custos | Tabelas de recursos criadas; cálculo servidor pendente |
| Exército | Infantaria, arqueiros, cavalaria e cerco; quantidade, tier e feridos | Tabela army_units criada; treinamento servidor pendente |
| Marchas | Seleção de tropas, destino, duração, chegada e retorno | Tabela marches criada; resolução servidor pendente |
| Combate | Comparação de formações, bônus, perdas e relatório | battle_reports criada; motor de batalha pendente |
| Heróis | Nível, experiência, raridade, atribuição e equipamento | Tabelas criadas; regras pendentes |
| Dragões | Progressão, habilidades, vínculo com marcha/batalha | Ainda precisa de modelo de dados |
| Pesquisa | Árvore tecnológica, pré-requisitos, duração e bônus | Tabela research criada; regras pendentes |
| Alianças | Criar, entrar, cargos, membros e cooperação | Tabelas criadas; APIs pendentes |
| Mundo | Coordenadas, terrenos, recursos, ocupação e proteção | world_territories criada; mapa e regras pendentes |
| Eventos | Temporadas, etapas, pontuação e recompensas | kingdom_events criada; calendário e regras pendentes |
| Monetização | Catálogo, inventário, pedidos e confirmação de pagamento | VIP/skins existentes; fluxo de compra real pendente |

## Regras de engenharia
1. O servidor é a autoridade: cliente nunca decide saldo, custo, resultado de batalha ou propriedade de território.
2. Toda ação econômica é transacional: validar saldo, debitar, creditar e registrar resource_ledger na mesma operação.
3. Tempos são calculados e validados no servidor; o cliente apenas apresenta contagens.
4. Operações sensíveis exigem sessão autenticada e validação de propriedade do reino.
5. APIs devem ser idempotentes quando houver risco de repetição por rede.
6. Não migrar nem apagar dados existentes; aplicar migrações D1 versionadas.
7. Fórmulas de produção, velocidade, combate e progressão serão definidas como regras originais, calibradas por testes e observação legítima do jogo, não inventadas como se fossem fórmulas oficiais.

## Sequência de implementação
- Fase 1: fundação automática do reino, leitura do estado e persistência D1.
- Fase 2: melhorias de edifícios, produção por tempo, coleta e treinamento de tropas.
- Fase 3: marchas, mapa mundial, coleta externa e relatórios de batalha PvE.
- Fase 4: heróis, dragões, pesquisas e equipamentos.
- Fase 5: alianças, PvP, eventos e placares.
- Fase 6: catálogo, pagamentos e painel administrativo integrado.

## Critérios mínimos de aceite
- Dois dispositivos acessando o mesmo jogador recebem o mesmo estado do servidor.
- Recarregar ou trocar de dispositivo não apaga o reino.
- Não é possível gastar recursos abaixo de zero nem duplicar recompensas por repetir uma requisição.
- Melhorias e treinamento sobrevivem a reinicializações e falhas de conexão.
- Batalhas produzem relatório persistido e reproduzível a partir dos parâmetros registrados.

## Limites
Não serão extraídos APKs protegidos, chaves, tráfego autenticado, contas, dados pessoais, banco privado ou código-fonte proprietário. A referência é a funcionalidade pública e o comportamento acessível legitimamente; implementação, arte, nomes e balanceamento serão próprios do Clash of Izzy.
