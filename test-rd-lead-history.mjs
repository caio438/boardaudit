import fs from 'node:fs';
import assert from 'node:assert/strict';

const rd=fs.readFileSync('RdAuditorias.gs','utf8');
const code=fs.readFileSync('Code.gs','utf8');
const audit=fs.readFileSync('AuditoriaV3.gs','utf8');
const workflow=fs.readFileSync('.github/workflows/rd-lead-history-backfill.yml','utf8');

assert.match(rd,/function RECONCILIAR_VINCULOS_RD_LEAD_HISTORY\(\)/);
assert.match(rd,/function audRdResolverVinculoLeadHistory_/);
assert.match(rd,/normalizarTextoComparacao_\(String\(v\|\|''\)\)\.toUpperCase\(\)/);
assert.match(rd,/candidatos\.length!==1/);
assert.match(rd,/\[0-9a-f\]\{24\}/i);
assert.match(rd,/enviosRd:0/);
assert.match(code,/ops_rd_lead_history_backfill/);
assert.match(audit,/audRdResolverVinculoLeadHistory_\(interacao, \{ persistir: true \}\)/);
assert.match(workflow,/github\.event\.comment\.body == '\/rd-lead-history-backfill'/);
assert.match(workflow,/data\.envioRd==='NAO_EXECUTADO'/);

console.log('Lead History RD reconciliation checks passed.');
