import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAuditRecord,
  buildClientAuditAggregate,
  buildAuditLedgerRow
} from "../src/auditTracking.mjs";

const audits = [
  { auditId: "a1", tenantId: "acme", clientName: "Acme", dealId: "d1", agent: "LEAD", status: "CUMPRIDO", score: 8, scoreMax: 10, period: "2026-10" },
  { auditId: "a2", tenantId: "acme", clientName: "Acme", dealId: "d1", agent: "CADENCIA", status: "PARCIAL", score: 6, scoreMax: 10, criteriaUnresolved: 2, period: "2026-10" },
  { auditId: "a3", tenantId: "acme", clientName: "Acme", dealId: "d2", agent: "REUNIAO", status: "NAO_CUMPRIDO", score: 4, scoreMax: 10, period: "2026-09" },
  { auditId: "b1", tenantId: "beta", clientName: "Beta", dealId: "d9", agent: "LEAD", status: "NAO_VERIFICAVEL", score: null }
];

test("normalizes audit identity, score and status", () => {
  const row = normalizeAuditRecord({ tenantId: "x", dealId: "d", agent: "lead", status: "conforme", score: 7.5 });
  assert.equal(row.agent, "LEAD");
  assert.equal(row.status, "NAO_VERIFICAVEL");
  assert.equal(row.scorePercent, 75);
  assert.equal(row.period.length, 7);
});

test("aggregates audit volume, scores and plans by client", () => {
  const result = buildClientAuditAggregate(audits, [
    { planId: "p1", tenantId: "acme", clientName: "Acme", dealId: "d1", target: "SDR", status: "ABERTO", scorePercent: 60 },
    { planId: "p2", tenantId: "acme", clientName: "Acme", dealId: "d2", target: "CLOSER", status: "CONCLUIDO", scorePercent: 80 }
  ]);
  const acme = result.find((row) => row.tenantId === "acme");
  assert.equal(acme.audits.total, 3);
  assert.equal(acme.audits.byAgent.LEAD, 1);
  assert.equal(acme.audits.byStatus.PARCIAL, 1);
  assert.equal(acme.audits.averageScorePercent, 60);
  assert.equal(acme.audits.unresolvedCriteria, 2);
  assert.equal(acme.plans.total, 2);
  assert.equal(acme.plans.open, 1);
  assert.equal(acme.coverage.distinctDeals, 2);
});

test("creates a D1-ready ledger row", () => {
  const row = buildAuditLedgerRow({ tenantId: "x", dealId: "d", agent: "AGENDA", status: "CUMPRIDO", score: 9 });
  assert.equal(row.audit_id, "x:d:AGENDA:2026-10");
  assert.equal(row.score_percent, 90);
  assert.equal(row.published, 0);
});
