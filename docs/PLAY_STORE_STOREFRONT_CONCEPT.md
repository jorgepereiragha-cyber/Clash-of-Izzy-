# Google Play — conceito da página oficial do Clash of Izzy

Status: conceito de produto e conteúdo. Não representa publicação, aprovação da Play Console ou screenshots capturados do jogo final.

## Posicionamento

**Nome:** Clash of Izzy  
**Frase curta:** Construa seu reino. Reúna heróis. Lute por Eldoria.  
**Categoria sugerida:** Estratégia  
**Orientação:** retratar um jogo de estratégia medieval original, com foco em construção de reino, heróis, equipamentos, alianças, mapa e eventos. Não usar nomes, marcas, personagens ou artes de outros jogos.

## Direção visual da ficha

- Paleta: azul-real e azul-noite, dourado envelhecido, pedra e aço.
- Símbolo: brasão original de Clash of Izzy; não substituir o ícone por uma imagem genérica.
- Arte principal: castelo original de Eldoria, muralhas, montanhas, floresta e rio; composição legível em telas pequenas.
- Tipografia: serifada de fantasia apenas em títulos; sans-serif legível para informações e botões.
- Capturas: interface real da versão Android, sem números de jogador inventados, sem telas conceituais apresentadas como gameplay.
- Todas as imagens devem ser produzidas na proporção e dimensões exigidas pela Play Console no momento do envio.

## Sequência planejada de screenshots

1. **Seu reino começa aqui** — visão da cidade/castelo 3D, construções e HUD de recursos reais.
2. **Heróis com identidade própria** — catálogo de heróis, raridade, nível, habilidades e atributos obtidos da API.
3. **Forje seu equipamento** — inventário, cinco espaços de equipamento, raridades e requisitos de progressão.
4. **Explore o mapa de Eldoria** — mapa mundial, territórios, pontos de recursos e marchas reais.
5. **Una-se a uma aliança** — tela de aliança, membros, chat e atividades que estejam efetivamente implementadas.
6. **Participe dos eventos** — apresentar apenas eventos ativos ou claramente identificados como próximos; temporizadores e recompensas devem vir do servidor.
7. **Evolua sua estratégia** — árvore de pesquisas, bônus e filas reais.
8. **Prepare suas tropas** — treinamento, composição e relatório de batalha, somente após validar os fluxos no Android.

## Texto-base da ficha

**Descrição curta:** Construa seu reino medieval, evolua heróis e equipamentos e dispute Eldoria ao lado da sua aliança.

**Descrição longa (rascunho):**

Eldoria espera por um novo comandante.

Construa e fortaleça seu reino, desenvolva tecnologias, treine tropas e prepare seus heróis para desafios cada vez maiores. Explore o mapa, reúna recursos e forme alianças para defender seu território e conquistar novas fronteiras.

- Desenvolva sua cidade e aprimore construções.
- Recrute e evolua heróis com habilidades próprias.
- Forje equipamentos e planeje combinações de atributos.
- Treine tropas e organize marchas pelo mapa.
- Colabore com sua aliança em atividades e eventos.
- Acompanhe sua evolução com sistemas persistentes de jogo.

Clash of Izzy é um projeto em evolução. Recursos, eventos e disponibilidade podem variar conforme a versão.

## Requisitos de publicação — bloqueios

- Definir domínio HTTPS definitivo, Application ID Android e certificado Play App Signing.
- Gerar e testar o Android App Bundle (AAB) assinado; o pacote TWA deve abrir o domínio verificado em tela cheia.
- Publicar `/.well-known/assetlinks.json` com package name e fingerprint SHA-256 reais do certificado de produção.
- Preparar política de privacidade pública, formulário Data safety, classificação indicativa e declarações de anúncios/coleta de dados.
- Confirmar regras atuais de Google Play Billing para itens digitais vendidos na versão Play; não presumir que checkout externo da versão web possa ser reutilizado.
- Completar teste interno/fechado, relatório de pré-lançamento e checklist de compatibilidade.
- Capturar screenshots reais da build Android aprovada para divulgação. Não usar a arte conceitual como prova de gameplay.
- Verificar nome, ícone, feature graphic, screenshots, descrição e países/idiomas antes do envio.

## Portões de qualidade antes de abrir o lançamento

1. CI da branch de integração verde.
2. D1 Preview remoto isolado, com autenticação, reino, inventário, heróis e eventos validados em staging.
3. Teste em Android físico de entrada, intermediário e alto; medir toque, memória, temperatura, estabilidade e frame time.
4. Conferir se cada screenshot representa uma função realmente disponível.
5. Revisão de privacidade, segurança, pagamentos e conformidade Play Console.
6. Aprovação humana final antes de enviar para revisão do Google.

## Não fazer

- Não prometer multiplayer, eventos, chat, PvP ou recompensas que não estejam ativos e testados.
- Não mostrar moedas, níveis, rankings, bônus ou contagens fictícias como dados reais.
- Não publicar AAB, criar assinatura, alterar domínio, secrets, D1 remoto ou produção sem confirmação e validação próprias.
- Não remover ou substituir o checkout web existente sem implementar e validar o fluxo de faturamento exigido para a edição Play.
