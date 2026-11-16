-- Verified, opt-in transactional email delivery.
-- Addresses are stored separately because players do not have an account email column.
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS player_email_contacts (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email_verified_at INTEGER,
  verification_token_hash TEXT,
  verification_expires_at INTEGER,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0,1)),
  event_alerts_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (event_alerts_opt_in IN (0,1)),
  attack_alerts_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (attack_alerts_opt_in IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  CHECK (
    (verification_token_hash IS NULL AND verification_expires_at IS NULL)
    OR
    (verification_token_hash IS NOT NULL AND verification_expires_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_player_email_verified
  ON player_email_contacts(email_verified_at, player_id);

CREATE TABLE IF NOT EXISTS email_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES email_templates(id),
  category TEXT NOT NULL CHECK (category IN ('transactional','events','attack_alerts','marketing')),
  variables_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  scheduled_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  locked_at INTEGER,
  sent_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_email_queue_due
  ON email_queue(status, scheduled_at, id);

CREATE TABLE IF NOT EXISTS email_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed')),
  provider_message_id TEXT,
  sent_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_email_history_player
  ON email_history(player_id, sent_at DESC);

INSERT OR IGNORE INTO email_templates
  (id,name,subject,html_template,text_template)
VALUES
  ('purchase_confirmation','Confirmação de compra','Compra confirmada — Clash of Izzy',
   '<h1>Compra confirmada</h1><p>Pedido #{{request_id}} aprovado.</p><p>Produto: <strong>{{product_name}}</strong></p><p>Gemas creditadas: <strong>{{gems_amount}}</strong></p><p>Obrigado por apoiar Clash of Izzy.</p>',
   'Compra confirmada. Pedido #{{request_id}} aprovado. Produto: {{product_name}}. Gemas creditadas: {{gems_amount}}.'),
  ('attack_alert','Alerta de ataque','Seu reino foi atacado — Clash of Izzy',
   '<h1>Seu reino está sob ataque</h1><p>{{attacker_name}} atacou seu reino.</p><p>Resultado: {{result}}</p>',
   '{{attacker_name}} atacou seu reino. Resultado: {{result}}.'),
  ('boss_event','Evento mundial','Um chefe apareceu — Clash of Izzy',
   '<h1>{{boss_name}} apareceu no mundo</h1><p>Reúna sua aliança e participe do evento. Tempo restante: {{time_left}}.</p>',
   '{{boss_name}} apareceu no mundo. Tempo restante: {{time_left}}.'),
  ('comeback','Retorno ao jogo','Seu reino sente sua falta — Clash of Izzy',
   '<h1>Sentimos sua falta</h1><p>Faz {{days_away}} dias que você não visita seu reino.</p>',
   'Faz {{days_away}} dias que você não visita seu reino.');
