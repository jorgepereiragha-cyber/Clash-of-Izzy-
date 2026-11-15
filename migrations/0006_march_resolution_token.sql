-- Token exclusivo para reivindicar uma marcha e impedir resolução duplicada concorrente.
ALTER TABLE marches ADD COLUMN resolution_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marches_resolution_token
  ON marches(resolution_token)
  WHERE resolution_token IS NOT NULL;
