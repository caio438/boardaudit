import fs from 'node:fs';
import assert from 'node:assert/strict';

const ops = fs.readFileSync(new URL('./OpsAudit.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('./.github/workflows/ops-audit-publish.yml', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('./.github/workflows/deploy-apps-script-auto.yml', import.meta.url), 'utf8');

assert.ok(ops.includes('function OPS_AUDITAR_PUBLICAR_TRANSCRICAO'), 'Runner operacional nao existe.');
assert.ok(ops.includes("audV3Localizar_('TRANSCRICOES', 'ID_TRANSCRICAO'"), 'Runner nao ancora no ID da transcricao.');
assert.ok(ops.includes('function opsResolverAlvoAuditoria_'), 'Runner nao resolve alvo TLDV por interacao.');
assert.ok(ops.includes("audV3Localizar_('INTERACOES', 'ID_INTERACAO', chave)"), 'Runner nao aceita ID_INTERACAO como alvo.');
assert.ok(ops.includes("audV3Localizar_('INTERACOES', 'ID_EXTERNO', idExternoTldv)"), 'Runner nao resolve o ID externo do TLDV.');
assert.ok(ops.includes("audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', interacao.ID_INTERACAO)"), 'Runner nao encontra a transcricao interna pela interacao.');
assert.ok(ops.includes('audV3ExigirGatePublicavel_'), 'Runner nao exige gate liberado.');
assert.ok(ops.includes('opsPreflightRd_'), 'Runner nao faz preflight do RD antes da aprovacao.');
assert.ok(ops.includes('function opsValidarAuditoriaNoEngineAtual_'), 'Runner nao revalida auditoria antiga no engine atual.');
assert.ok(ops.includes('forcarNovaAnalise = true'), 'Runner nao força nova análise quando a auditoria antiga viola travas atuais.');
assert.ok(ops.includes('evitarDuplicidade: !forcarNovaAnalise'), 'Runner pode reutilizar novamente uma auditoria antiga incompatível.');
assert.ok(ops.includes('será preservada no histórico e uma nova análise será gerada'), 'Runner nao preserva o histórico ao regenerar uma auditoria incompatível.');
assert.ok(ops.includes('aprovarAuditoriaV3'), 'Runner nao usa o fluxo oficial de aprovacao.');
assert.ok(ops.includes('reprocessarAutomacaoAuditoriaV3'), 'Runner nao possui contingencia idempotente para RD.');
assert.ok(!ops.includes('publicarPlanoCircle'), 'Runner de RD nao pode publicar automaticamente no Circle.');

assert.ok(code.includes("parametros.ops_audit_publish"), 'doGet nao expoe a rota operacional autenticada.');
assert.ok(code.includes('Session.getActiveUser().getEmail()'), 'Rota operacional nao valida usuario ativo.');
assert.ok(code.includes('Session.getEffectiveUser().getEmail()'), 'Rota operacional nao valida usuario efetivo.');
assert.ok(code.includes('OPS_AUDITAR_PUBLICAR_TRANSCRICAO'), 'doGet nao chama o runner operacional.');

assert.ok(workflow.includes('Deploy Apps Script automatically'), 'Operacao nao aguarda deploy concluido.');
assert.ok(workflow.includes('environment: apps-script-production'), 'Operacao nao usa ambiente protegido.');
assert.ok(workflow.includes('Authorization: Bearer $TOKEN'), 'Operacao nao autentica a chamada da Execution API.');
assert.ok(workflow.includes('script.googleapis.com/v1/scripts/1-eZr8B0D-PdnQVFh9Qnv2GV23WvQVxa42tlQ-lVknfWbYaz8QpBM4rJ9:run'), 'Workflow nao usa a Apps Script Execution API.');
assert.ok(workflow.includes("function: 'OPS_AUDITAR_PUBLICAR_TRANSCRICAO'"), 'Workflow nao chama o runner operacional pela Execution API.');
assert.ok(workflow.includes('devMode: true'), 'Workflow precisa executar o HEAD sincronizado quando o projeto estiver no limite de versoes.');
assert.ok(!workflow.includes('/dev?ops_audit_publish=1'), 'Workflow ainda depende da sessao HTML do web app /dev.');
assert.ok(workflow.includes("Ops audit publish: "), 'Workflow nao exige commit operacional explicito.');
assert.ok(workflow.includes("rdStatus || '').toUpperCase() !== 'PUBLICADA'"), 'Workflow nao confirma publicacao no RD.');

assert.ok(deploy.includes('if [ "$version_count" -ge 200 ]'), 'Deploy nao trata o limite de 200 versoes do Apps Script.');
assert.ok(deploy.includes('head_only=true'), 'Deploy nao suporta sincronizacao operacional somente no HEAD.');
assert.ok(deploy.includes("if: steps.capacity.outputs.head_only != 'true'"), 'Operacao HEAD-only ainda tentaria criar uma nova versao.');

console.log('Runner operacional validado: gate -> preflight RD -> aprovacao -> publicacao idempotente.');
