-- Migra o progresso do modelo legado "heroes" para o inventário canônico.
-- Mantém a tabela antiga intacta para compatibilidade com equipamentos e clientes antigos.
INSERT INTO hero_inventory (
  kingdom_id, hero_key, rarity, level, experience, stars, skill_level, fragments
)
SELECT
  h.kingdom_id,
  h.hero_key,
  CASE
    WHEN h.rarity IN ('common','white') THEN 'white'
    WHEN h.rarity IN ('rare','blue') THEN 'blue'
    ELSE 'purple'
  END,
  h.level,
  h.experience,
  1,
  1,
  0
FROM heroes h
WHERE 1
ON CONFLICT(kingdom_id, hero_key) DO UPDATE SET
  level = MAX(hero_inventory.level, excluded.level),
  experience = MAX(hero_inventory.experience, excluded.experience);

-- Índice para as consultas de herói ativo e progresso de batalha.
CREATE INDEX IF NOT EXISTS idx_hero_inventory_progress
  ON hero_inventory(kingdom_id, level DESC, stars DESC);
