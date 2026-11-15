# O Arquivo Velado — Clash of Izzy

## Direção criativa

Introduzir o tema do “olho que tudo vê” como mistério medieval discreto, sem usar um grande olho triangular ou uma iconografia contemporânea ostensiva. A referência visual é um pequeno motivo de arcos concêntricos interrompidos, uma pupila sugerida por uma estrela/lente e marcas cartográficas. O sinal deve parecer parte da arquitetura e da heráldica do mundo.

## A Vigília do Véu

Ordem fictícia, anterior aos reinos atuais. Não governa, não recruta abertamente e não aparece como facção jogável. Seu juramento: “Não governamos os reinos. Guardamos aquilo que os reis esquecem.”

A Vigília preserva mapas, registros de guerras, rotas desaparecidas e observações astronômicas. Sua ambiguidade é intencional: pode proteger o equilíbrio ou esconder verdades perigosas.

## Primeiros fragmentos narrativos

1. **A lente sob o castelo** — uma lente azulada na cripta revela riscos que formam um mapa de túneis.
2. **A estrela deslocada** — sete estrelas de prata no observatório; uma aponta para uma torre apagada dos registros.
3. **O livro sem autor** — um livro na sala dos mapas registra guerras antes de acontecerem, mas deixa as páginas finais em branco.

## Implementação atual

- Nova aba “Arquivo Velado” no Centro de Comando.
- Três fragmentos podem ser examinados e revelados pelo jogador.
- Um emblema original e discreto usa arcos e uma lente/estrela, sem reproduzir diretamente o triângulo do Olho da Providência.
- Descobertas são salvas no armazenamento local do navegador/dispositivo.
- Esta primeira versão é narrativa e cosmética: não concede recursos, bônus, poder, vigilância de jogadores ou vantagem competitiva.
- O progresso não sincroniza entre dispositivos nem com o servidor; isso está claramente informado na interface.
- Cache PWA atualizado para a nova interface.

## Próxima evolução, antes de virar sistema de jogo

- Migrar descobertas para uma tabela do servidor por reino, com resgate idempotente e validação de pré-requisitos.
- Colocar pistas visuais no mapa 3D e em edifícios específicos, em vez de depender apenas de um menu.
- Criar uma cadeia de investigação opcional com escolhas, fragmentos e recompensas cosméticas equilibradas.
- Dar à Vigília personagens próprios: uma astrônoma, um cartógrafo e um guardião dos arquivos.
- Não usar a Vigília para observar mensagens privadas, localização real ou comportamento fora do jogo. “Tudo vê” é apenas fantasia e conhecimento do mundo ficcional.

## Referências de design

- Getty Art & Architecture Thesaurus: contextualiza o Olho da Providência como motivo histórico de iconografia, evitando atribuições simplistas. https://www.getty.edu/vow/AATFullDisplay?find=300389738&logic=AND&note=&subjectid=300265839
- Game Developer: environmental storytelling pode comunicar história por objetos, arquitetura e pistas ambientais, sem exigir exposição constante. https://www.gamedeveloper.com/design/what-you-give-is-what-you-get-environmental-storytelling-in-games
- SAGE: itens colecionáveis, descrições e diários podem construir lore opcional. https://journals.sagepub.com/doi/10.1177/2042753019834957

## Protótipo de campanha associado
O Centro de Comando inclui agora a campanha local **A Primeira Fenda**, desbloqueada visualmente no Castelo nível 3. Ela apresenta três capítulos inspirados com respeito em Gênesis 4, um registro de Basilisco no bestiário e a descoberta narrativa Cartografia das Fundações. O progresso usa `coi_origin_campaign_v1` no armazenamento local do navegador. Não sincroniza com a conta, não concede recursos, não executa combate e não cria uma tecnologia funcional. Para produção, precisa de validação e persistência no servidor.


## Atualização técnica — progresso sincronizado

As pistas do Arquivo Velado agora usam a migração `0010_kingdom_story_progress`. A API valida as três etapas em sequência e devolve `storyProgress` para o Centro de Comando. As descobertas passam a acompanhar o reino no servidor; os valores antigos do navegador são apenas importados como pedidos e revalidados. A migração ainda aguarda CI e publicação autorizada. Não há ainda posições físicas ou interação 3D no mapa mundial; consulte `docs/EXPLORACAO_3D_PISTAS.md`.
