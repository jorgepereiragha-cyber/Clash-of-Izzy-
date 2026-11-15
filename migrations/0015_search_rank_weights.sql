-- Improve relevance without changing indexed content or search contracts.
-- FTS5 BM25 assigns six times more weight to the primary title than to
-- the secondary description for both prefix and substring retrieval.
INSERT INTO game_search_fts(game_search_fts, rank) VALUES('rank', 'bm25(6.0, 1.0)');
INSERT INTO game_search_substring_fts(game_search_substring_fts, rank) VALUES('rank', 'bm25(6.0, 1.0)');
