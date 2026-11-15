# Busca global — arquitetura e limites

## Caminho de consulta

1. A rota autenticada `GET /api/game/search` valida sessão, categoria, tamanho da consulta e limites por jogador/rede.
2. FTS5 com tokenizer Unicode cobre prefixos; índices trigram FTS5 cobrem fragmentos e formam um conjunto pequeno de candidatos.
3. Os resultados são deduplicados e ordenados por correspondência exata, prefixo, frase, cobertura de tokens e, por último, distância de edição.
4. Consultas sem candidatos recuperáveis mantêm os fallbacks SQL existentes por categoria.
5. O payload público contém somente dados de jogo apresentados na interface; não inclui e-mail, hash de senha nem identificadores privados de conta.

## Tolerância a erros

A implementação própria usa distância Damerau–Levenshtein apenas depois da seleção de candidatos pelo índice trigram. O conjunto é limitado a `min(160, limit * 8)` por categoria pesquisada.

- 1–4 caracteres: sem correção aproximada.
- 5–8 caracteres: até 1 edição.
- 9 ou mais caracteres: até 2 edições.
- Troca do primeiro caractere recebe custo adicional, reduzindo falsos positivos.
- Termos numéricos e tokens CJK não entram no fuzzy matcher.
- Consultas em chinês, japonês e coreano mantêm busca exata/prefixo/fragmento e fallback já existente; isso não equivale a segmentação linguística por dicionário.
- Correspondências exatas e prefixos sempre vencem resultados aproximados.

O desenho segue práticas públicas de motores de busca maduros, mas não afirma equivalência funcional com Meilisearch, Elasticsearch ou OpenSearch. Não há serviço externo de busca nem custo de hospedagem adicional.

## Testes e segurança

A suíte cobre transposição de letras, limites por tamanho, primeiro caractere, múltiplos tokens, tokens numéricos/CJK e limite do conjunto de candidatos. As queries SQL permanecem parametrizadas. A lógica fuzzy nunca faz `SELECT *` nem percorre as tabelas de origem sem índice.

## Limitações conhecidas

- O ranking não usa frequência global/IDF completa nem personalização por idioma.
- A segmentação CJK por dicionário ainda não está integrada.
- Não existem métricas de relevância com consultas reais de jogadores; thresholds precisam ser ajustados com telemetria agregada e privacidade preservada.
- Um serviço como Meilisearch/Elasticsearch só deve ser avaliado depois de medir tamanho, latência, custo e manutenção da solução FTS5 atual.
