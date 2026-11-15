-- Persisted long-running kingdom actions.
CREATE TABLE IF NOT EXISTS kingdom_tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kingdom_id INTEGER NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 task_type TEXT NOT NULL CHECK(task_type IN ('construction','training','research')),
 slot_key TEXT NOT NULL,
 payload_json TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','cancelled')),
 started_at TEXT NOT NULL,
 completes_at TEXT NOT NULL,
 completed_at TEXT,
 completion_token TEXT,
 idempotency_key TEXT NOT NULL UNIQUE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kingdom_tasks_active_slot ON kingdom_tasks(kingdom_id,task_type,slot_key) WHERE status='running';
CREATE INDEX IF NOT EXISTS idx_kingdom_tasks_due ON kingdom_tasks(status,completes_at,id);
CREATE INDEX IF NOT EXISTS idx_kingdom_tasks_kingdom ON kingdom_tasks(kingdom_id,status,completes_at);
