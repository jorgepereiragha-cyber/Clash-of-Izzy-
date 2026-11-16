-- Clash of Izzy v3.0: progresso persistente da árvore de tecnologias por reino.
-- A tabela e o catálogo foram criados em 0021; esta migração apenas indexa e faz backfill.
CREATE INDEX IF NOT EXISTS idx_kingdom_tech_level
  ON kingdom_tech(kingdom_id,level);

INSERT OR IGNORE INTO kingdom_tech(kingdom_id,tech_id,level)
SELECT k.id,c.id,0
FROM kingdoms k
CROSS JOIN tech_catalog c;
