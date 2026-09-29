import fs from 'node:fs';
import assert from 'node:assert/strict';

const ops = fs.readFileSync(new URL('./OpsAudit.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('./.github/workflows/ops-audit-publish.yml', import.meta.url), 'utf8');
const previewWorkflow = fs.readFileSync(new URL('./.github/workflows/ops-audit-preview.yml', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('./.github/workflows/deploy-apps-script-auto.yml', import.meta.url), 'utf8');

assert.ok(ops.includes('function OPS_AUDITAR_PUBLICAR_TRANSCRICAO'), 'Runner operacional nao existe.');
assert.ok(ops.includes("audV3Localizar_('TRANSCRICOES', 'ID_TRANSCRICAO'"), 'Runner nao ancora no ID da transcricao.');
assert.ok(ops.includes('function opsResolverAlvoAuditoria_'), 'Runner nao resolve alvo TLDV por interacao.');
assert.ok(ops.includes("audV3Localizar_('INTERACOES', 'ID_INTERACAO', chave)"), 'Runner nao aceita ID_INTERACAO como alvo.');
assert.ok(ops.includes("audV3Localizar_('INTERACOES', 'ID_EXTERNO', idExternoTldv)"), 'Runner nao resolve o ID externo do TLDV.');
assert.ok(ops.includes("audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', interacao.ID_INTERACAO)"), 'Runner nao encontra a transcricao interna pela interacao.');
assert.ok(ops.includes('audV3ExigirGatePublicavel_'), 'Runner nao consulta a validacao de qualidade antes de publicar.');
assert.ok(ops.includes('opsPreflightRd_'), 'Runner nao faz preflight do RD antes da aprovacao.');
assert.ok(ops.includes('function opsValidarAuditoriaNoEngineAtual_'), 'Runner nao revalida auditoria antiga no engine atual.');
assert.ok(ops.includes('audV3NormalizarTranscricaoTexto_(conteudoOriginal, interacao || {})'), 'Runner nao recalcula a fonte com a identidade atual da interacao.');
assert.ok(ops.includes('const hashAtual = audV3HashFonte_('), 'Runner nao compara o hash atual antes do reparo seletivo.');
assert.ok(ops.includes('A fonte atual difere da auditoria existente; preserve o histórico e gere uma nova análise.'), 'Runner nao invalida auditoria antiga quando a fonte mudou.');
assert.ok(ops.includes('forcarNovaAnalise = true'), 'Runner nao força nova análise quando a auditoria antiga viola travas atuais.');
assert.ok(ops.includes('falhaCriterioLegada'), 'Runner nao distingue a falha legada de criterio verificavel.');
assert.ok(ops.includes('/Critério de conclusão não verificável no reparo/i'), 'Runner nao restringe a regeneracao ao erro legado conhecido.');
assert.ok(ops.includes('o reparo anterior falhou apenas no validador legado de critério verificável'), 'Runner nao registra a causa controlada da nova analise.');
assert.ok(ops.includes('evitarDuplicidade: !forcarNovaAnalise'), 'Runner pode reutilizar novamente uma auditoria antiga incompatível.');
assert.ok(ops.includes('será preservada no histórico e uma nova análise será gerada'), 'Runner nao preserva o histórico ao regenerar uma auditoria incompatível.');
assert.ok(ops.includes('aprovarAuditoriaV3'), 'Runner nao usa o fluxo oficial de aprovacao.');
assert.ok(ops.includes('reprocessarAutomacaoAuditoriaV3'), 'Runner nao possui contingencia idempotente para RD.');
assert.ok(!ops.includes('publicarPlanoCircle'), 'Runner de RD nao pode publicar automaticamente no Circle.');
assert.ok(ops.includes('function opsCriarReparoDeterministico_'), 'Preview nao possui fallback deterministico para indisponibilidade de modelo.');
assert.ok(ops.includes('function opsUltimaFalhaModeloInteracao_'), 'Preview nao reconhece falha recente de modelo para evitar nova rodada inútil de IA.');
assert.ok(ops.includes('falhaModeloRecente && anteriorValidada'), 'Preview nao prefere reparo deterministico quando a mesma interacao ja falhou por modelo indisponivel.');
assert.ok(ops.includes("codigoErro === 'MODELO_INDISPONIVEL'"), 'Preview nao aciona fallback apenas para indisponibilidade de modelo.');
assert.ok(ops.includes("MODELO_IA: 'REPARO_DETERMINISTICO_SEM_IA'"), 'Auditoria reparada sem IA nao fica rastreavel.');
assert.ok(ops.includes('function OPS_AUDITAR_PREVIEW_TRANSCRICAO'), 'Runner seguro de preview real nao existe.');
const inicioPreview = ops.indexOf('function OPS_AUDITAR_PREVIEW_TRANSCRICAO');
const fimPreview = ops.indexOf('function opsResolverAlvoAuditoria_', inicioPreview);
assert.ok(inicioPreview >= 0 && fimPreview > inicioPreview, 'Runner de preview nao pode ser isolado.');
const trechoPreview = ops.slice(inicioPreview, fimPreview);
assert.ok(trechoPreview.includes('opsAuditoriaAtualInteracao_'), 'Preview precisa tentar reutilizar a auditoria atual antes de gerar outra.');
assert.ok(trechoPreview.includes('opsValidarAuditoriaNoEngineAtual_'), 'Preview precisa revalidar a auditoria atual no engine antes de reutiliza-la.');
assert.match(trechoPreview, /audV3NormalizarVersao_\(auditoria\.ENGINE_VERSAO\) === audV3NormalizarVersao_\(AUDITORIA_V3\.versao\)/, 'Preview não restringe reutilização à versão exata do engine atual.');
assert.ok(trechoPreview.includes('evitarDuplicidade: false'), 'Preview precisa gerar nova analise apenas quando nao houver auditoria atual valida.');
assert.ok(
  trechoPreview.indexOf('falhaModeloRecente') >= 0 &&
  trechoPreview.indexOf('falhaModeloRecente') < trechoPreview.indexOf('executarAuditoriaV3'),
  'O reparo imediato precisa acontecer antes de uma nova chamada de IA quando ja existe falha recente de modelo.'
);
assert.ok(trechoPreview.includes('reutilizada: reutilizada'), 'Preview precisa informar quando reutilizou a auditoria atual.');
assert.ok(trechoPreview.includes('audV3ExigirGatePublicavel_'), 'Preview precisa validar o gate publicavel.');
assert.ok(trechoPreview.includes('audRdTexto_(contextoRd)'), 'Preview precisa gerar exatamente o formatter atual do RD.');
assert.ok(trechoPreview.includes("modo: 'PREVIEW_SEM_PUBLICACAO'"), 'Preview nao identifica explicitamente o modo seguro.');
assert.ok(trechoPreview.includes('rdPublicada: false'), 'Preview deve declarar que nao publicou no RD.');
assert.ok(trechoPreview.includes('aprovada: false'), 'Preview deve declarar que nao aprovou a auditoria.');
assert.ok(!trechoPreview.includes('aprovarAuditoriaV3('), 'Preview nao pode aprovar auditoria.');
assert.ok(!trechoPreview.includes('enviarAuditoriaParaRd('), 'Preview nao pode publicar no RD.');
assert.ok(!trechoPreview.includes('reprocessarAutomacaoAuditoriaV3('), 'Preview nao pode acionar automacao de publicacao.');

assert.ok(code.includes("parametros.ops_audit_preview"), 'doGet nao expoe a rota autenticada de preview.');
assert.ok(code.includes('OPS_AUDITAR_PREVIEW_TRANSCRICAO'), 'doGet nao chama o runner seguro de preview.');

assert.ok(previewWorkflow.includes('Deploy Apps Script automatically'), 'Preview operacional nao aguarda deploy concluido.');
assert.ok(previewWorkflow.includes('environment: apps-script-production'), 'Preview operacional nao usa ambiente protegido.');
assert.ok(previewWorkflow.includes("Ops audit preview: "), 'Preview exige commit operacional explicito.');
assert.ok(previewWorkflow.includes('ops_audit_preview=1'), 'Workflow de preview nao chama a rota segura.');
assert.ok(previewWorkflow.includes('OPS_RD_PREVIEW_BEGIN'), 'Workflow de preview nao expoe o texto final do RD para conferencia.');
assert.ok(previewWorkflow.includes('result.rdPublicada !== false || result.aprovada !== false'), 'Workflow nao bloqueia qualquer aprovacao/publicacao acidental no preview.');


assert.ok(code.includes("parametros.ops_audit_publish"), 'doGet nao expoe a rota operacional autenticada.');
assert.ok(code.includes('Session.getActiveUser().getEmail()'), 'Rota operacional nao valida usuario ativo.');
assert.ok(code.includes('Session.getEffectiveUser().getEmail()'), 'Rota operacional nao valida usuario efetivo.');
assert.ok(code.includes('OPS_AUDITAR_PUBLICAR_TRANSCRICAO'), 'doGet nao chama o runner operacional.');
assert.ok(code.includes('TRA-[A-Za-z0-9-]+'), 'Rota operacional nao aceita ID interno de transcricao TRA-.');
assert.ok(code.includes('INT-[A-Za-z0-9-]+'), 'Rota operacional nao aceita ID interno de interacao INT-.');

assert.ok(workflow.includes('Deploy Apps Script automatically'), 'Operacao nao aguarda deploy concluido.');
assert.ok(workflow.includes('environment: apps-script-production'), 'Operacao nao usa ambiente protegido.');
assert.ok(workflow.includes('--oauth2-bearer "$TOKEN"'), 'Operacao nao autentica a chamada ao web app HEAD.');
assert.ok(workflow.includes('AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA/exec?ops_audit_publish=1'), 'Workflow nao chama o web app de producao para a operacao.');
assert.ok(!workflow.includes('/dev?ops_audit_publish=1'), 'Workflow operacional ainda depende do endpoint /dev.');
assert.ok(workflow.includes('--location-trusted'), 'Workflow nao preserva autenticacao OAuth nos redirects do Google.');
assert.ok(workflow.includes('--oauth2-bearer "$TOKEN"'), 'Workflow nao envia o OAuth Bearer de forma explicita.');
assert.ok(workflow.includes("sed -E 's/ \\(#[0-9]+\\)$//'"), 'Workflow nao remove o sufixo de PR adicionado pelo squash merge.');
assert.ok(!workflow.includes('script.googleapis.com/v1/scripts/'), 'Workflow ainda depende da Execution API bloqueada por permissao.');
assert.ok(workflow.includes("Ops audit publish: "), 'Workflow nao exige commit operacional explicito.');
assert.ok(workflow.includes("rdStatus || '').toUpperCase() !== 'PUBLICADA'"), 'Workflow nao confirma publicacao no RD.');

assert.ok(deploy.includes('if [ "$version_count" -ge 200 ]'), 'Deploy nao trata o limite de 200 versoes do Apps Script.');
assert.ok(deploy.includes('head_only=true'), 'Deploy nao suporta sincronizacao operacional somente no HEAD.');
assert.ok(deploy.includes("if: steps.capacity.outputs.head_only != 'true'"), 'Operacao HEAD-only ainda tentaria criar uma nova versao.');

console.log('Runner operacional validado: gate -> preflight RD -> aprovacao -> publicacao idempotente.');
