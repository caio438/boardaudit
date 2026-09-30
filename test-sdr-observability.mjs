import assert from 'node:assert/strict';
import fs from 'node:fs';

const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('./.github/workflows/sdr-observability.yml', import.meta.url), 'utf8');

assert.ok(audit.includes('function OBSERVAR_AUTOMACAO_SDR_V3()'), 'Snapshot de observabilidade SDR ausente.');
assert.ok(audit.includes('transcritasAguardandoAuditoria'), 'Resumo nao expoe transcritas aguardando auditoria.');
assert.ok(audit.includes('clientesSemPitchAtual'), 'Resumo nao expoe clientes sem pitch.');
assert.ok(audit.includes('errosNoBacklog'), 'Resumo nao expoe erros do backlog.');
assert.ok(code.includes("parametros.ops_sdr_status"), 'Endpoint autenticado de observabilidade SDR ausente.');
assert.ok(code.includes('OBSERVAR_AUTOMACAO_SDR_V3()'), 'Endpoint nao chama o snapshot SDR.');
assert.ok(workflow.includes('issue_comment:'), 'Workflow nao aceita comando via issue.');
assert.ok(workflow.includes("github.event.issue.number == 142"), 'Workflow nao esta restrito ao Ops Control.');
assert.ok(workflow.includes("github.event.comment.user.login == 'caio438'"), 'Workflow nao restringe o autor.');
assert.ok(workflow.includes("github.event.comment.body == '/sdr-status'"), 'Comando /sdr-status ausente.');
assert.ok(workflow.includes('ops_sdr_status=1'), 'Workflow nao consulta o endpoint de producao.');
assert.ok(workflow.includes('issues: write'), 'Workflow nao consegue devolver o diagnostico no issue.');
assert.ok(workflow.includes("github.event.comment.body == '/board-manual-mode'"), 'Comando de modo manual ausente.');
assert.ok(workflow.includes('ops_disable_all_automation=1'), 'Workflow nao chama o endpoint de desligamento global.');
assert.ok(code.includes("parametros.ops_disable_all_automation"), 'Endpoint de desligamento global ausente.');

console.log('Observabilidade SDR validada: endpoint autenticado, backlog, erros e comando GitHub presentes.');
