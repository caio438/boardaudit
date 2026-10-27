import {
  buildClientAuditAggregate,
  buildAuditLedgerRow,
  normalizeAuditRecord
} from "../../audit-tracking/src/auditTracking.mjs";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-volum-api-key",
  "access-control-allow-methods": "GET, POST, OPTIONS"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function safeText(value) {
  return String(value ?? "").trim();
}

function authorized(request, env) {
  const expected = safeText(env?.VOLUM_API_KEY);
  return !expected || request.headers.get("x-volum-api-key") === expected;
}

function rowToAudit(row) {
  return {
    auditId: row.audit_id,
    tenantId: row.tenant_id,
    clientName: row.client_name,
    dealId: row.deal_id,
    agent: row.agent,
    auditType: row.audit_type,
    status: row.status,
    score: row.score,
    scoreMax: row.score_max,
    planId: row.plan_id,
    planStatus: row.plan_status,
    criteriaTotal: row.criteria_total,
    criteriaApplicable: row.criteria_applicable,
    criteriaUnresolved: row.criteria_unresolved,
    evidenceCoverage: row.evidence_coverage,
    sourceSnapshotId: row.source_snapshot_id,
    generatedAt: row.generated_at,
    period: row.period,
    published: Boolean(row.published),
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {}
  };
}

function rowToPlan(row) {
  return {
    planId: row.plan_id,
    tenantId: row.tenant_id,
    clientName: row.client_name,
    dealId: row.deal_id,
    target: row.target,
    status: row.status,
    score: row.score,
    scorePercent: row.score_percent,
    owner: row.owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function listAudits(env, tenantId, dealId = "") {
  let query = "SELECT * FROM audit_runs WHERE tenant_id = ?";
  const binds = [tenantId];
  if (dealId) {
    query += " AND deal_id = ?";
    binds.push(dealId);
  }
  query += " ORDER BY generated_at DESC";
  const result = await env.DB.prepare(query).bind(...binds).all();
  return (result.results || []).map(rowToAudit);
}

async function listPlans(env, tenantId, dealId = "") {
  let query = "SELECT * FROM optimization_plans WHERE tenant_id = ?";
  const binds = [tenantId];
  if (dealId) {
    query += " AND deal_id = ?";
    binds.push(dealId);
  }
  query += " ORDER BY updated_at DESC";
  const result = await env.DB.prepare(query).bind(...binds).all();
  return (result.results || []).map(rowToPlan);
}

async function saveSnapshot(env, input) {
  const snapshot = input?.snapshot || input;
  const deal = snapshot?.deal || {};
  const tenantId = safeText(snapshot?.tenantId);
  const dealId = safeText(deal.id || snapshot?.dealId);
  if (!tenantId || !dealId) throw new Error("snapshot tenantId and deal.id are required");
  const capturedAt = safeText(snapshot.capturedAt || snapshot.generatedAt || new Date().toISOString());
  const snapshotId = safeText(snapshot.snapshotId) || [tenantId, dealId, capturedAt].join(":");
  const stage = deal.currentStage || {};
  const coverage = snapshot.coverage || {};
  await env.DB.prepare(`
    INSERT INTO lead_snapshots (
      snapshot_id, tenant_id, deal_id, schema_name, version, pipeline_id, stage_id,
      volum_phase, coverage_complete, missing_sources_json, payload_json, captured_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(snapshot_id) DO UPDATE SET
      version=excluded.version, pipeline_id=excluded.pipeline_id, stage_id=excluded.stage_id,
      volum_phase=excluded.volum_phase, coverage_complete=excluded.coverage_complete,
      missing_sources_json=excluded.missing_sources_json, payload_json=excluded.payload_json,
      captured_at=excluded.captured_at, updated_at=CURRENT_TIMESTAMP
  `).bind(
    snapshotId, tenantId, dealId, safeText(snapshot.schema || "VOLUM_SALES_OPS_V2"),
    safeText(snapshot.version || "V2.0.0"), safeText(deal.pipelineId),
    safeText(stage.stageId), safeText(stage.volumPhase),
    coverage.complete === true ? 1 : 0,
    JSON.stringify(coverage.missingSources || []), JSON.stringify(snapshot), capturedAt
  ).run();

  const events = Array.isArray(snapshot.events) ? snapshot.events : [];
  for (const event of events) {
    await env.DB.prepare(`
      INSERT INTO lead_events (
        event_id, snapshot_id, tenant_id, deal_id, occurred_at, event_type, source,
        actor_user_id, actor_name, actor_role, volum_phase, evidence_status, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_id, event_id) DO UPDATE SET
        occurred_at=excluded.occurred_at, event_type=excluded.event_type,
        source=excluded.source, actor_user_id=excluded.actor_user_id,
        actor_name=excluded.actor_name, actor_role=excluded.actor_role,
        volum_phase=excluded.volum_phase, evidence_status=excluded.evidence_status,
        payload_json=excluded.payload_json
    `).bind(
      safeText(event.id || event.eventId), snapshotId, tenantId, dealId,
      safeText(event.occurredAt), safeText(event.type || "UNKNOWN"),
      safeText(event.source || "CRM"), safeText(event.actorUserId),
      safeText(event.actorName), safeText(event.actorRole),
      safeText(event.volumPhase), safeText(event.evidence?.status),
      JSON.stringify(event.payload || event)
    ).run();
  }
  return { snapshotId, tenantId, dealId, events: events.length };
}

async function latestSnapshot(env, tenantId, dealId) {
  const result = await env.DB.prepare(`
    SELECT * FROM lead_snapshots
    WHERE tenant_id = ? AND deal_id = ?
    ORDER BY captured_at DESC LIMIT 1
  `).bind(tenantId, dealId).all();
  const row = (result.results || [])[0];
  if (!row) return null;
  return {
    snapshotId: row.snapshot_id,
    tenantId: row.tenant_id,
    dealId: row.deal_id,
    schema: row.schema_name,
    version: row.version,
    pipelineId: row.pipeline_id,
    stageId: row.stage_id,
    volumPhase: row.volum_phase,
    coverageComplete: Boolean(row.coverage_complete),
    missingSources: JSON.parse(row.missing_sources_json || "[]"),
    capturedAt: row.captured_at,
    payload: JSON.parse(row.payload_json || "{}")
  };
}

async function listRollups(env) {
  const result = await env.DB.prepare(
    "SELECT * FROM audit_client_rollups ORDER BY client_name, tenant_id"
  ).all();
  return (result.results || []).map((row) => ({
    tenantId: row.tenant_id,
    clientName: row.client_name,
    totalAudits: row.total_audits,
    averageScorePercent: row.average_score_percent,
    latestScorePercent: row.latest_score_percent,
    totalPlans: row.total_plans,
    openPlans: row.open_plans,
    distinctDeals: row.distinct_deals,
    auditToPlanRate: row.audit_to_plan_rate,
    byAgent: JSON.parse(row.by_agent_json || "{}"),
    byStatus: JSON.parse(row.by_status_json || "{}"),
    byPeriod: JSON.parse(row.by_period_json || "{}"),
    plans: JSON.parse(row.plan_summary_json || "{}"),
    refreshedAt: row.refreshed_at
  }));
}

async function saveAudit(env, audit) {
  const row = buildAuditLedgerRow(audit);
  await env.DB.prepare(`
    INSERT INTO audit_runs (
      audit_id, tenant_id, client_name, deal_id, agent, audit_type, status,
      score, score_max, score_percent, plan_id, plan_status, criteria_total,
      criteria_applicable, criteria_unresolved, evidence_coverage,
      source_snapshot_id, generated_at, period, published, metadata_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(audit_id) DO UPDATE SET
      client_name=excluded.client_name, status=excluded.status,
      score=excluded.score, score_max=excluded.score_max,
      score_percent=excluded.score_percent, plan_id=excluded.plan_id,
      plan_status=excluded.plan_status, criteria_total=excluded.criteria_total,
      criteria_applicable=excluded.criteria_applicable,
      criteria_unresolved=excluded.criteria_unresolved,
      evidence_coverage=excluded.evidence_coverage,
      source_snapshot_id=excluded.source_snapshot_id,
      generated_at=excluded.generated_at, period=excluded.period,
      published=excluded.published, metadata_json=excluded.metadata_json,
      updated_at=CURRENT_TIMESTAMP
  `).bind(
    row.audit_id, row.tenant_id, row.client_name, row.deal_id, row.agent,
    row.audit_type, row.status, row.score, row.score_max, row.score_percent,
    row.plan_id, row.plan_status, row.criteria_total, row.criteria_applicable,
    row.criteria_unresolved, row.evidence_coverage, row.source_snapshot_id,
    row.generated_at, row.period, row.published, row.metadata_json
  ).run();
  return row;
}

async function savePlan(env, input) {
  const planId = safeText(input.planId || input.id);
  const tenantId = safeText(input.tenantId || input.clientId || input.clienteId);
  const dealId = safeText(input.dealId || input.leadId);
  if (!planId || !tenantId || !dealId) throw new Error("planId, tenantId and dealId are required");
  const now = safeText(input.updatedAt || input.createdAt || new Date().toISOString());
  const values = [
    planId, tenantId, safeText(input.clientName || input.client || input.cliente),
    dealId, safeText(input.target || input.destino || "SDR").toUpperCase(),
    safeText(input.status || "NAO_VERIFICAVEL").toUpperCase(),
    input.score ?? null, input.scorePercent ?? input.percentual ?? null,
    safeText(input.owner || input.responsible || input.responsavel),
    safeText(input.createdAt || now), now, JSON.stringify(input.metadata || {})
  ];
  await env.DB.prepare(`
    INSERT INTO optimization_plans (
      plan_id, tenant_id, client_name, deal_id, target, status, score,
      score_percent, owner, created_at, updated_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(plan_id) DO UPDATE SET
      status=excluded.status, score=excluded.score,
      score_percent=excluded.score_percent, owner=excluded.owner,
      updated_at=excluded.updated_at, metadata_json=excluded.metadata_json
  `).bind(...values).run();
  return { planId, tenantId, dealId };
}

async function refreshRollup(env, tenantId) {
  const [audits, plans] = await Promise.all([
    listAudits(env, tenantId),
    listPlans(env, tenantId)
  ]);
  const aggregate = buildClientAuditAggregate(audits, plans)[0] || {
    tenantId, clientName: "", audits: { total: 0 }, plans: { total: 0 },
    coverage: { distinctDeals: 0, auditToPlanRate: 0 }
  };
  await env.DB.prepare(`
    INSERT INTO audit_client_rollups (
      tenant_id, client_name, total_audits, average_score_percent,
      latest_score_percent, total_plans, open_plans, distinct_deals,
      audit_to_plan_rate, by_agent_json, by_status_json, by_period_json,
      plan_summary_json, refreshed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id) DO UPDATE SET
      client_name=excluded.client_name, total_audits=excluded.total_audits,
      average_score_percent=excluded.average_score_percent,
      latest_score_percent=excluded.latest_score_percent,
      total_plans=excluded.total_plans, open_plans=excluded.open_plans,
      distinct_deals=excluded.distinct_deals,
      audit_to_plan_rate=excluded.audit_to_plan_rate,
      by_agent_json=excluded.by_agent_json, by_status_json=excluded.by_status_json,
      by_period_json=excluded.by_period_json, plan_summary_json=excluded.plan_summary_json,
      refreshed_at=CURRENT_TIMESTAMP
  `).bind(
    aggregate.tenantId, aggregate.clientName, aggregate.audits.total || 0,
    aggregate.audits.averageScorePercent, aggregate.audits.latestScorePercent,
    aggregate.plans.total || 0, aggregate.plans.open || 0,
    aggregate.coverage.distinctDeals || 0, aggregate.coverage.auditToPlanRate || 0,
    JSON.stringify(aggregate.audits.byAgent || {}),
    JSON.stringify(aggregate.audits.byStatus || {}),
    JSON.stringify(aggregate.audits.byPeriod || {}),
    JSON.stringify(aggregate.plans || {})
  ).run();
  return aggregate;
}

export async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
  if (url.pathname === "/health" && request.method === "GET") {
    return json({ ok: true, service: "volum-sales-ops-v2", schema: "V2" });
  }
  if (!env.DB) return json({ error: "database_not_configured" }, 503);

  const clientMatch = url.pathname.match(/^\/v2\/clients\/([^/]+)$/);
  const leadMatch = url.pathname.match(/^\/v2\/leads\/([^/]+)$/);

  if (request.method === "GET" && clientMatch) {
    const tenantId = decodeURIComponent(clientMatch[1]);
    const [audits, plans] = await Promise.all([listAudits(env, tenantId), listPlans(env, tenantId)]);
    const aggregate = buildClientAuditAggregate(audits, plans)[0] || null;
    return json({ tenantId, aggregate, audits, plans });
  }

  if (request.method === "GET" && leadMatch) {
    const dealId = decodeURIComponent(leadMatch[1]);
    const tenantId = safeText(url.searchParams.get("tenantId"));
    if (!tenantId) return json({ error: "tenantId_required" }, 400);
    const [audits, plans, snapshot] = await Promise.all([
      listAudits(env, tenantId, dealId),
      listPlans(env, tenantId, dealId),
      latestSnapshot(env, tenantId, dealId)
    ]);
    return json({ tenantId, dealId, snapshot, audits, plans });
  }

  if (request.method === "GET" && url.pathname === "/v2/aggregate") {
    return json({ clients: await listRollups(env) });
  }

  if (request.method === "POST" && url.pathname === "/v2/snapshots") {
    try {
      const saved = await saveSnapshot(env, await body(request));
      return json({ ok: true, snapshot: saved }, 201);
    } catch (error) {
      return json({ error: error.message || "invalid_snapshot" }, 400);
    }
  }

  if (request.method === "POST" && url.pathname === "/v2/audits") {
    const input = await body(request);
    try {
      const audit = normalizeAuditRecord(input?.audit || input);
      const saved = await saveAudit(env, audit);
      const aggregate = await refreshRollup(env, audit.tenantId);
      return json({ ok: true, audit: saved, aggregate }, 201);
    } catch (error) {
      return json({ error: error.message || "invalid_audit" }, 400);
    }
  }

  if (request.method === "POST" && url.pathname === "/v2/plans") {
    const input = await body(request);
    try {
      const plan = await savePlan(env, input?.plan || input);
      const aggregate = await refreshRollup(env, plan.tenantId);
      return json({ ok: true, plan, aggregate }, 201);
    } catch (error) {
      return json({ error: error.message || "invalid_plan" }, 400);
    }
  }

  return json({ error: "not_found" }, 404);
}

export default { fetch: handleRequest };
