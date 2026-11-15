# Busca global — arquitetura, relevância e limites

## Caminho de consulta

1. A rota autenticada `GET /api/game/search` valida sessão, categoria, tamanho da consulta e limites por jogador/rede.
2. FTS5 com tokenizer Unicode cobre correspondências exatas e prefixos; índices trigram FTS5 cobrem fragmentos e selecionam candidatos para tolerância a erros.
3. Consultas curtas em chinês, japonês e coreano usam fallback por substring; consultas maiores também consultam o índice trigram.
4. Os resultados são deduplicados e ordenados por correspondência exata, prefixo, frase, cobertura de tokens, BM25 e, por último, distância de edição.
5. Consultas sem candidatos recuperáveis mantêm os fallbacks SQL parametrizados existentes por categoria.
6. O payload público contém somente dados de jogo apresentados na interface; não inclui e-mail, hash de senha nem identificadores privados de conta.

## Relevância e ranking

A migração `0015_search_rank_weights.sql` configura o ranking BM25 nativo do FTS5 nos índices principal e de substring:

- Título/nome: peso `6.0`.
- Subtítulo/descrição: peso `1.0`.

Assim, quando dois resultados têm sinais de correspondência semelhantes, o nome principal tem precedência sobre texto secundário. A pontuação continua baseada em termos e estatísticas do corpus; não é um ranking treinado com cliques ou comportamento dos jogadores. O FTS5 permite ponderar colunas no BM25 e recomenda ordenar pelo campo `rank` para aproveitar sua otimização.

## Tolerância a erros

A implementação própria usa distância Damerau–Levenshtein apenas depois da seleção de candidatos pelo índice trigram. O conjunto é limitado a `min(160, limit * 8)` por categoria pesquisada.

- 1–4 caracteres: sem correção aproximada.
- 5–8 caracteres: até 1 edição.
- 9 ou mais caracteres: até 2 edições.
- Troca do primeiro caractere recebe custo adicional, reduzindo falsos positivos.
- Termos numéricos e tokens CJK não entram no fuzzy matcher.
- Consultas em chinês, japonês e coreano mantêm busca exata/prefixo/fragmento e fallback já existente; isso não equivale a segmentação linguística por dicionário.
- Correspondências exatas e prefixos sempre vencem resultados aproximados.

## Limites conhecidos e evolução segura

- A busca é do mundo público do jogo (jogadores, reinos, alianças, territórios e skins), não um crawler ou buscador de toda a Internet.
- Ainda não existe segmentação CJK por dicionário, conversão entre chinês simplificado/tradicional, romanização japonesa/coreana ou expansão de sinônimos multilíngues. Não fazemos substituições aproximadas nesses scripts para evitar resultados incorretos.
- Não existem métricas agregadas de relevância/cliques nem consultas reais anotadas; por isso, os pesos e thresholds são conservadores e ainda não foram calibrados com telemetria.
- Um serviço como Meilisearch, Elasticsearch ou OpenSearch só deve ser avaliado depois de medir volume, latência, custo e manutenção da solução FTS5 atual. A arquitetura atual não exige um serviço de busca adicional.

## Testes e segurança

A suíte cobre transposição de letras, limites por tamanho, primeiro caractere, múltiplos tokens, tokens numéricos/CJK, limite do conjunto de candidatos e a configuração de pesos BM25. As queries SQL permanecem parametrizadas. A lógica fuzzy nunca faz `SELECT *` nem percorre as tabelas de origem sem índice.

## Referências técnicas

- SQLite FTS5: tokenizadores Unicode/trigram, BM25 por coluna e configuração do campo `rank`: https://www.sqlite.org/fts5.html
- Cloudflare D1: compatibilidade SQLite e extensão FTS5: https://developers.cloudflare.com/d1/sql-api/sql-statements/
- Unicode UAX #29: segmentação de texto e necessidade de mecanismos especializados/dicionários para limites de palavras em chinês e japonês: https://unicode.org/reports/tr29/
