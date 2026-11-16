-- Phase 9: allow two independent training lanes while preserving one
-- construction and one research lane per kingdom.
ALTER TABLE kingdom_queues
  ADD COLUMN lane_number INTEGER NOT NULL DEFAULT 1
  CHECK (lane_number BETWEEN 1 AND 2);

DROP INDEX IF EXISTS idx_kingdom_queues_one_active_lane;

CREATE UNIQUE INDEX idx_kingdom_queues_one_active_construction
  ON kingdom_queues(kingdom_id)
  WHERE queue_type='construction' AND status='running';

CREATE UNIQUE INDEX idx_kingdom_queues_one_active_research
  ON kingdom_queues(kingdom_id)
  WHERE queue_type='research' AND status='running';

CREATE UNIQUE INDEX idx_kingdom_queues_training_lanes
  ON kingdom_queues(kingdom_id,lane_number)
  WHERE queue_type='training' AND status='running';
