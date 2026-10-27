-- VOLUM Sales Ops V2
-- Snapshot normalizado do CRM e eventos usados pelos agentes.

CREATE TABLE IF NOT EXISTS lead_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  schema_name TEXT NOT NULL DEFAULT 'VOLUM_SALES_OPS_V2',
  version TEXT NOT NULL DEFAULT 'V2.0.0',
  pipeline_id TEXT,
  stage_id TEXT,
  volum_phase TEXT,
  coverage_complete INTEGER NOT NULL DEFAULT 0,
  missing_sources_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_snapshots_latest_key
  ON lead_snapshots (tenant_id, deal_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_lead_snapshots_deal
  ON lead_snapshots (tenant_id, deal_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS lead_events (
  event_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  occurred_at TEXT,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  actor_user_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  volum_phase TEXT,
  evidence_status TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (snapshot_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_events_deal
  ON lead_events (tenant_id, deal_id, occurred_at);
