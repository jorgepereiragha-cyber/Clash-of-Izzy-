# Relatório de andamento — Clash of Izzy
**Data da verificação:** 20/11/2026  
**Escopo:** evolução visual/mobile, heróis, equipamentos, eventos e preparação Google Play.

## Estado confirmado no GitHub

- PR #128 — `feat(android): aprimorar visual 3D móvel e preparar publicação na Play Store`.
- Estado: **aberta e Draft**, base `release/one-shared-realm-early-access`, branch `feat/mobile-visual-quality-playstore-prep`.
- Commit verificado: `7dcf4d8943329b28ab3173488d0d5139222b58fe`.
- A verificação `quality` deste commit terminou com **success**.
- A verificação de build Preview da Cloudflare terminou com **success**. Isso confirma a construção Preview associada ao commit, não publicação em produção nem funcionamento validado em aparelho.
- A PR contém alterações em 70+ arquivos, incluindo código, artes, testes, documentação e uma migração SQL. A migração 0028 está apenas no repositório; não foi aplicada remotamente nesta atividade.

## Trabalho já representado na PR

### Experiência visual e Android
- Perfis gráficos adaptativos por memória, núcleos, limite de textura e economia de dados.
- Texturas procedurais em 128, 256 e 512 px conforme o perfil.
- Limites de resolução do buffer, pixel ratio, draw calls/edifícios e anisotropia.
- Pausa de animações e shaders quando a página está oculta ou a cidade fora da área visível.
- Diagnóstico local de intervalos requestAnimationFrame p50/p95. Isso não é medição de GPU nem garantia de FPS.
- Arte SVG própria de fortaleza, muralhas, floresta, montanhas e rio.
- Melhorias de PWA/offline e shell do Service Worker.
- CSS e testes de experiência Android, inclusive cenários de viewport estreito.

### Heróis, equipamentos e eventos
- Catálogo e apresentação de heróis, retratos SVG e testes de apresentação.
- Hierarquia de equipamentos em cinco espaços, com progressão Comum, Raro, Épico e Lendário.
- Regras de pré-requisito e bônus aplicados no Worker, com limites de atributos.
- Catálogo de sete eventos e artes SVG próprias: Anjo da Morte, Ascensão de Valhalla, Caçada Selvagem, Shiva, Khali, Cerco de Eldoria e Torneio dos Campeões.
- Os estados dos eventos não são equivalentes: alguns usam sistemas existentes; outros ainda são preparação ou dependem de configuração/implementação posterior. Não anunciar todos como eventos jogáveis.
- Testes Node e Playwright foram adicionados para apresentação de heróis, equipamentos, eventos, mapa, cidade 3D e PWA.

### Preparação Google Play
- Documentação de TWA/Bubblewrap, assinatura, Digital Asset Links, requisitos da loja e descrição em português.
- A arquitetura planejada reaproveita a PWA e o Worker/D1 existentes; não cria um segundo servidor.
- Ainda não há evidência nesta verificação de AAB final assinado, Application ID definitivo, certificado de produção, Digital Asset Links publicados, ficha submetida ou aprovação da Play Console.
- Itens digitais vendidos dentro da edição Play exigem solução compatível com as regras aplicáveis de Google Play Billing; não presumir que o checkout web possa ser simplesmente reaproveitado.

## Identidade visual do ícone — pedido mais recente

O pedido do usuário é substituir o símbolo atual pelo retrato do herói escolhido, sem dragão nem coroa, mantendo a marca Clash of Izzy e a paleta azul-real/dourada.

**Estado técnico verificado:** `icon-192.svg`, `icon-512.svg` e `favicon.svg` ainda contêm um emblema geométrico de espadas/escudo. O arquivo `assets/art/heroes/portraits.svg` contém retratos, mas não foi confirmado qual retrato corresponde exatamente à imagem escolhida pelo usuário. Portanto, o ícone ainda não foi alterado para o herói. Não substituir automaticamente por um retrato aproximado.

**Próxima ação segura:** identificar o retrato exato aprovado, preparar versões quadradas de ícone adaptável e favicon sem coroa/dragão e validar legibilidade em tamanhos pequenos; depois atualizar manifesto, referências HTML e testes de assets em branch própria.

## Pendências que bloqueiam a saída de Draft

1. Confirmar D1 Preview remoto realmente isolado, binding e rotas autenticadas de staging; não executar migração remota até backup e isolamento estarem comprovados.
2. Fazer inspeção em Android físico: aparelho de entrada, intermediário e alto; viewport 360 px; toque; texturas; sombras; memória; temperatura; retomada; rotação; rede instável.
3. Confirmar testes atuais da PR após qualquer novo commit e analisar falhas/avisos, sem tratar apenas o build Cloudflare como teste funcional.
4. Validar os fluxos de herói, inventário/equipamento, atributos e eventos contra estado real do servidor.
5. Definir domínio final, Application ID, chave/certificado e Digital Asset Links reais.
6. Preparar AAB assinado e validar instalação/atualização no teste interno.
7. Fechar privacidade, Data safety, classificação indicativa, faturamento Play e ficha da loja.
8. Capturar imagens promocionais apenas da build Android real; marcar artes conceituais como mockups.

## Segurança e ações não executadas

Nesta atualização não houve deploy de produção, alteração de secrets, escrita no D1 de produção, aplicação de migração remota, alteração de contas/saldos/inventários, criação de chave de assinatura, envio de AAB ou submissão à Play Console. A PR #128 continua Draft. Não foram apagados arquivos por suposição de que estariam sem uso.

## Ordem recomendada para a próxima sessão

1. Resolver e validar o ícone do herói aprovado.
2. Inspecionar Preview D1 e segurança de secrets sem escrita.
3. Rodar/confirmar suíte completa e revisar artefatos E2E.
4. Inspecionar a versão Preview em Android físico.
5. Corrigir apenas problemas comprovados, preservar o que funciona e repetir os testes.
6. Só então avaliar retirar Draft e avançar para o pacote Android.

**Conclusão:** há trabalho concreto no código e documentação, e as duas verificações consultadas para o commit atual estão verdes. Ainda não há comprovação de experiência final em Android físico nem de publicação na Google Play. O projeto está em preparação avançada, mas não deve ser declarado pronto para lançamento até fechar os bloqueios acima.
