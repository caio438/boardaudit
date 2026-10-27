/**
 * VOLUM Sales Ops V2 — rastreamento canônico de auditorias e planos.
 * Não coleta dados. Recebe resultados já produzidos pelos motores e cria
 * registros idempotentes para medição por cliente, lead, agente e período.
 */

const STATUS = new Set([
  "CUMPRIDO", "PARCIAL", "NAO_CUMPRIDO", "NAO_VERIFICAVEL",
  "NAO_APLICAVEL", "CONTRADITORIO"
]);

const AGENTS = new Set(["LEAD", "CADENCIA", "CONEXAO", "AGENDA", "REUNIAO"]);

const text = (value) => String(value ?? "").trim();
const upper = (value) => text(value).toUpperCase();
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function normalizeAuditRecord(input = {}) {
  const status = upper(input.status || input.resultado || "NAO_VERIFICAVEL");
  const score = numberOrNull(input.score ?? input.nota);
  const scoreMax = numberOrNull(input.scoreMax ?? input.notaMaxima) ?? 10;
  const agent = upper(input.agent || input.agente || input.cerebro);
  const generatedAt = text(input.generatedAt || input.createdAt || new Date().toISOString());

  if (!text(input.tenantId || input.clientId || input.clienteId)) {
    throw new Error("audit tenantId/clientId is required");
  }
  if (!text(input.dealId || input.leadId)) {
    throw new Error("audit dealId/leadId is required");
  }

  const period = text(input.period || generatedAt.slice(0, 7));
  const auditId = text(input.auditId || input.id) ||
    [
      text(input.tenantId || input.clientId || input.clienteId),
      text(input.dealId || input.leadId),
      agent || "PROCESSO",
      text(input.runId || period)
    ].join(":");

  return {
    auditId,
    tenantId: text(input.tenantId || input.clientId || input.clienteId),
    clientName: text(input.clientName || input.cliente || input.nomeCliente),
    dealId: text(input.dealId || input.leadId),
    agent: AGENTS.has(agent) ? agent : agent || "PROCESSO",
    auditType: upper(input.auditType || input.tipo || "PROCESSO"),
    status: STATUS.has(status) ? status : "NAO_VERIFICAVEL",
    score,
    scoreMax,
    scorePercent: score === null || scoreMax <= 0 ? null : Math.round((score / scoreMax) * 10000) / 100,
    planId: text(input.planId || input.planoId),
    planStatus: upper(input.planStatus || input.statusPlano || ""),
    criteriaTotal: numberOrNull(input.criteriaTotal ?? input.totalCriterios) ?? 0,
    criteriaApplicable: numberOrNull(input.criteriaApplicable ?? input.criteriosAplicaveis) ?? 0,
    criteriaUnresolved: numberOrNull(input.criteriaUnresolved ?? input.criteriosPendentes) ?? 0,
    evidenceCoverage: numberOrNull(input.evidenceCoverage ?? input.coberturaEvidencia),
    sourceSnapshotId: text(input.sourceSnapshotId || input.snapshotId),
    generatedAt,
    period,
    published: input.published === true,
    metadata: input.metadata || {}
  };
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100 : null;
}

function countBy(rows, selector) {
  return rows.reduce((out, row) => {
    const key = selector(row) || "SEM_INFORMACAO";
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
}

export function buildClientAuditAggregate(audits = [], plans = []) {
  const normalizedAudits = audits.map(normalizeAuditRecord);
  const normalizedPlans = plans.map((plan) => ({
    planId: text(plan.planId || plan.id),
    tenantId: text(plan.tenantId || plan.clientId || plan.clienteId),
    clientName: text(plan.clientName || plan.cliente || plan.nomeCliente),
    dealId: text(plan.dealId || plan.leadId),
    owner: text(plan.owner || plan.responsible || plan.responsavel),
    target: upper(plan.target || plan.destino || "SDR"),
    status: upper(plan.status || plan.estado || "NAO_VERIFICAVEL"),
    score: numberOrNull(plan.score ?? plan.nota),
    scorePercent: numberOrNull(plan.scorePercent ?? plan.percentual),
    createdAt: text(plan.createdAt || plan.generatedAt || new Date().toISOString())
  }));

  const clientIds = new Set([
    ...normalizedAudits.map((row) => row.tenantId),
    ...normalizedPlans.map((row) => row.tenantId)
  ]);

  return [...clientIds].map((tenantId) => {
    const clientAudits = normalizedAudits.filter((row) => row.tenantId === tenantId);
    const clientPlans = normalizedPlans.filter((row) => row.tenantId === tenantId);
    const scores = clientAudits.map((row) => row.scorePercent).filter((v) => v !== null);
    const planScores = clientPlans.map((row) => row.scorePercent ?? row.score).filter((v) => v !== null);
    const deals = new Set(clientAudits.map((row) => row.dealId).filter(Boolean));
    const latest = [...clientAudits].sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)))[0] || null;

    return {
      tenantId,
      clientName: clientAudits.find((row) => row.clientName)?.clientName ||
        clientPlans.find((row) => row.clientName)?.clientName || "",
      audits: {
        total: clientAudits.length,
        byAgent: countBy(clientAudits, (row) => row.agent),
        byStatus: countBy(clientAudits, (row) => row.status),
        byPeriod: countBy(clientAudits, (row) => row.period),
        averageScorePercent: average(scores),
        latestScorePercent: latest?.scorePercent ?? null,
        averageEvidenceCoverage: average(clientAudits.map((row) => row.evidenceCoverage).filter((v) => v !== null)),
        unresolvedCriteria: clientAudits.reduce((sum, row) => sum + row.criteriaUnresolved, 0)
      },
      plans: {
        total: clientPlans.length,
        byTarget: countBy(clientPlans, (row) => row.target),
        byStatus: countBy(clientPlans, (row) => row.status),
        averageScore: average(planScores),
        open: clientPlans.filter((row) => !["CONCLUIDO", "CUMPRIDO", "ENCERRADO"].includes(row.status)).length
      },
      coverage: {
        distinctDeals: deals.size,
        auditToPlanRate: clientAudits.length ? Math.round((clientPlans.length / clientAudits.length) * 10000) / 100 : 0
      },
      latestAudit: latest
    };
  }).sort((a, b) => String(a.clientName || a.tenantId).localeCompare(String(b.clientName || b.tenantId)));
}

export function buildAuditLedgerRow(auditInput) {
  const audit = normalizeAuditRecord(auditInput);
  return {
    audit_id: audit.auditId,
    tenant_id: audit.tenantId,
    client_name: audit.clientName,
    deal_id: audit.dealId,
    agent: audit.agent,
    audit_type: audit.auditType,
    status: audit.status,
    score: audit.score,
    score_max: audit.scoreMax,
    score_percent: audit.scorePercent,
    plan_id: audit.planId || null,
    plan_status: audit.planStatus || null,
    criteria_total: audit.criteriaTotal,
    criteria_applicable: audit.criteriaApplicable,
    criteria_unresolved: audit.criteriaUnresolved,
    evidence_coverage: audit.evidenceCoverage,
    source_snapshot_id: audit.sourceSnapshotId || null,
    generated_at: audit.generatedAt,
    period: audit.period,
    published: audit.published ? 1 : 0,
    metadata_json: JSON.stringify(audit.metadata)
  };
}
