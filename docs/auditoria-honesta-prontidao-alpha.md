# Auditoria honesta de prontidão — Clash of Izzy

Data da revisão: 16 de novembro de 2026. Esta auditoria descreve evidências do repositório e do CI, não estimativas comerciais.

## O que melhorou de forma comprovável

1. O projeto possui um Worker central em `worker.js`, banco D1 com migrações sequenciais e autenticação por token assinado. Não precisa ser migrado para a estrutura alternativa `src/modules/*` proposta em mensagens anteriores.
2. A busca global está implementada na branch principal com FTS5, trigramas, normalização de acentos, ranking, descoberta de nicknames, fallback e limites por jogador/rede.
3. Existem testes locais de integração Worker+D1. `tests/worker-runtime-integration.test.js` executa fluxos reais contra D1 local e verifica 34 ações, incluindo estado, loja, cosméticos, equipamento, combate, filas, alianças e guerra. Portanto, dizer que existem "zero testes de integração" não corresponde ao repositório atual.
4. O manifesto 3D contém cinco assets CC0 Kenney habilitados: torre, muralha, trebuchet, árvore e arqueiro. A validação de GLB local, dependências e limites de tamanho é executada no CI. Portanto, dizer que há literalmente zero modelos reais também é incorreto.
5. O CI executa validação das migrações D1 locais, análise do Service Worker, validação dos assets, testes Node e bundle do Worker.
6. A Etapa I de e-mail foi acrescentada nesta branch por migração 0017, com confirmação de endereço, consentimento separado, histórico, fila idempotente e integração com o Cron já existente.

## O que ainda não foi validado em mundo real

- Não há evidência auditável de jogadores externos usando o jogo, instalações PWA em celulares físicos, sessões de playtest, retenção D1/D7 ou feedback de usuários.
- A suíte D1 local não substitui testes em produção, testes de carga ou validação em Android de entrada.
- Há apenas cinco assets GLB CC0 de base no manifesto, não um catálogo completo de edifícios, tropas, heróis, animações e cosméticos finais.
- A loja está configurada para link fixo do Mercado Pago e aprovação manual pelo painel Master. A documentação atual informa que ainda não existe confirmação automática por webhook. Não afirmar que pagamentos reais foram processados ou que houve receita.
- A interface de chat da aliança persiste o texto da mensagem no servidor em `alliance_chat`; a implementação presente não comprova E2EE. Não anunciar criptografia ponta a ponta sem um protocolo cliente-cliente e testes independentes.
- Passe de batalha e tutorial de 12 etapas não aparecem como sistemas integrados na branch `main` verificada. Não marcar essas features como lançadas sem código, rotas e testes correspondentes.
- A feature de e-mail só envia após configurar secrets/vars reais: `RESEND_API_KEY`, `EMAIL_FROM` de domínio verificado no Resend e `FRONTEND_URL` correto. E-mails de digest, comeback, ataque e boss não estão ativos até serem conectados a eventos e rotinas de gameplay reais.

## CI da integração de e-mail

A primeira execução da PR encontrou dois testes de busca que exigiam que a string `player_email` não aparecesse em `worker.js`. A asserção deixou de ser válida quando a integração de e-mail foi adicionada, pois o novo nome de tabela aparece no health check, mas isso não expõe endereços em resultados de busca. Os testes foram ajustados para verificar que a busca não retorna campos de endereço. Os seis novos testes contratuais de e-mail passaram nessa primeira execução; uma nova execução do CI é necessária para aprovar o conjunto completo após as correções posteriores de consentimento e validação do destinatário.

## Próximo marco correto: alpha fechado

1. Completar o CI verde para a branch e revisar/mesclar a PR 81.
2. Configurar os secrets/vars e aplicar a migração 0017 em ambiente remoto controlado.
3. Executar smoke test público de leitura e confirmar a fila Resend com um endereço de teste verificado.
4. Fazer teste manual em pelo menos um Android físico: instalação PWA, mapa, toque, retorno do app, cache/offline e consumo de memória.
5. Convidar 10 jogadores reais, acompanhar o fluxo básico e recolher feedback sem cobrar dinheiro de participantes de teste.
6. Só após os resultados publicar métricas de retenção, estabilidade ou monetização. Não fabricar números nem inferir receita a partir de código.

## Conclusão

O Clash of Izzy já tem mais do que código estático: há runtime, persistência, busca, regras de jogo e testes automatizados locais. Mas ainda não é correto descrevê-lo como negócio validado ou como lançamento final. O próximo ganho mais importante não é adicionar outra feature: é concluir a revisão, implantar em ambiente controlado e medir comportamento de jogadores reais.
