-- VOLUM Sales Ops V2
-- Ledger idempotente para medir auditorias, scores, planos e evolução por cliente.

CREATE TABLE IF NOT EXISTS audit_runs (
  audit_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  deal_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  audit_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  score_max REAL NOT NULL DEFAULT 10,
  score_percent REAL,
  plan_id TEXT,
  plan_status TEXT,
  criteria_total INTEGER NOT NULL DEFAULT 0,
  criteria_applicable INTEGER NOT NULL DEFAULT 0,
  criteria_unresolved INTEGER NOT NULL DEFAULT 0,
  evidence_coverage REAL,
  source_snapshot_id TEXT,
  generated_at TEXT NOT NULL,
  period TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_tenant_period
  ON audit_runs (tenant_id, period, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_runs_tenant_agent
  ON audit_runs (tenant_id, agent, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_runs_deal
  ON audit_runs (tenant_id, deal_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS optimization_plans (
  plan_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  deal_id TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  score_percent REAL,
  owner TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_optimization_plans_tenant
  ON optimization_plans (tenant_id, target, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS audit_client_rollups (
  tenant_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL DEFAULT '',
  total_audits INTEGER NOT NULL DEFAULT 0,
  average_score_percent REAL,
  latest_score_percent REAL,
  total_plans INTEGER NOT NULL DEFAULT 0,
  open_plans INTEGER NOT NULL DEFAULT 0,
  distinct_deals INTEGER NOT NULL DEFAULT 0,
  audit_to_plan_rate REAL NOT NULL DEFAULT 0,
  by_agent_json TEXT NOT NULL DEFAULT '{}',
  by_status_json TEXT NOT NULL DEFAULT '{}',
  by_period_json TEXT NOT NULL DEFAULT '{}',
  plan_summary_json TEXT NOT NULL DEFAULT '{}',
  refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_client_rollups_name
  ON audit_client_rollups (client_name);
