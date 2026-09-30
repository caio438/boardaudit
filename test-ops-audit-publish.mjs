import fs from 'node:fs';
import assert from 'node:assert/strict';

const ops = fs.readFileSync(new URL('./OpsAudit.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(
  new URL('./.github/workflows/ops-audit-publish.yml', import.meta.url),
  'utf8'
);
const previewWorkflow = fs.readFileSync(
  new URL('./.github/workflows/ops-audit-preview.yml', import.meta.url),
  'utf8'
);
const deploy = fs.readFileSync(
  new URL('./.github/workflows/deploy-apps-script-auto.yml', import.meta.url),
  'utf8'
);

assert.ok(
  ops.includes('function OPS_AUDITAR_PUBLICAR_TRANSCRICAO'),
  'Runner operacional nao existe.'
);

assert.ok(
  ops.includes("audV3Localizar_('TRANSCRICOES', 'ID_TRANSCRICAO'"),
  'Runner nao ancora no ID da transcricao.'
);

assert.ok(
  ops.includes('function opsResolverAlvoAuditoria_'),
  'Runner nao resolve alvo TLDV por interacao.'
);

assert.ok(
  ops.includes("audV3Localizar_('INTERACOES', 'ID_INTERACAO', chave)"),
  'Runner nao aceita ID_INTERACAO como alvo.'
);

assert.ok(
  ops.includes("audV3Localizar_('INTERACOES', 'ID_EXTERNO', idExternoTldv)"),
  'Runner nao resolve o ID externo do TLDV.'
);

assert.ok(
  ops.includes("audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', interacao.ID_INTERACAO)"),
  'Runner nao encontra a transcricao interna pela interacao.'
);

assert.ok(
  ops.includes('audV3ExigirGatePublicavel_'),
  'Runner nao consulta a validacao de qualidade antes de publicar.'
);

assert.ok(
  ops.includes('opsPreflightRd_'),
  'Runner nao faz preflight do RD antes da aprovacao.'
);

assert.ok(
  ops.includes('function opsValidarAuditoriaNoEngineAtual_'),
  'Runner nao revalida auditoria antiga no engine atual.'
);

assert.ok(
  ops.includes(
    'audV3PrepararTranscricaoParaIntegridade_(transcricao, interacao, auditoria.ENGINE_VERSAO)'
  ),
  'Runner nao recompõe a mesma fonte persistida usada no hash da auditoria.'
);

assert.ok(
  ops.includes('const hashAtual = audV3HashFonte_('),
  'Runner nao compara o hash atual antes do reparo seletivo.'
);

assert.ok(
  ops.includes('NORMALIZACAO_VERSAO: fontePreparada.normalizacaoVersao'),
  'Runner nao inclui a versao de normalizacao persistida ao revalidar o hash.'
);

assert.ok(
  ops.includes(
    'A fonte atual difere da auditoria existente; preserve o histórico e gere uma nova análise.'
  ),
  'Runner nao invalida auditoria antiga quando a fonte mudou.'
);

assert.ok(
  ops.includes('forcarNovaAnalise = true'),
  'Runner nao força nova análise quando a auditoria antiga viola travas atuais.'
);

assert.ok(
  ops.includes('falhaCriterioLegada'),
  'Runner nao distingue a falha legada de criterio verificavel.'
);

assert.ok(
  ops.includes('/Critério de conclusão não verificável no reparo/i'),
  'Runner nao restringe a regeneracao ao erro legado conhecido.'
);

assert.ok(
  ops.includes(
    'o reparo anterior falhou apenas no validador legado de critério verificável'
  ),
  'Runner nao registra a causa controlada da nova analise.'
);

assert.ok(
  ops.includes('evitarDuplicidade: !forcarNovaAnalise'),
  'Runner pode reutilizar novamente uma auditoria antiga incompatível.'
);

assert.ok(
  ops.includes(
    'será preservada no histórico e uma nova análise será gerada'
  ),
  'Runner nao preserva o histórico ao regenerar uma auditoria incompatível.'
);

assert.ok(
  ops.includes('aprovarAuditoriaV3'),
  'Runner nao usa o fluxo oficial de aprovacao.'
);

assert.ok(
  ops.includes('reprocessarAutomacaoAuditoriaV3'),
  'Runner nao possui contingencia idempotente para RD.'
);

assert.ok(
  !ops.includes('publicarPlanoCircle'),
  'Runner de RD nao pode publicar automaticamente no Circle.'
);

assert.ok(
  ops.includes('function opsCriarReparoDeterministico_'),
  'Reparo deterministico legado precisa permanecer disponivel.'
);

assert.ok(
  ops.includes('function opsUltimaFalhaModeloInteracao_'),
  'Historico de falha de modelo precisa permanecer rastreavel.'
);

assert.ok(
  ops.includes("MODELO_IA: 'REPARO_DETERMINISTICO_SEM_IA'"),
  'Auditoria reparada sem IA nao fica rastreavel.'
);

assert.ok(
  ops.includes('function opsPrepararTranscricaoPersistidaValidadaParaReparo_'),
  'Reparo deterministico precisa reutilizar gate persistido validado.'
);

assert.ok(
  ops.includes(
    'return audV3PrepararTranscricaoPersistidaValidada_(transcricao, interacao);'
  ),
  'Reparo deterministico precisa delegar para a fonte persistida canonica.'
);

assert.ok(
  audit.includes('function audV3PrepararTranscricaoPersistidaValidada_'),
  'Helper canonico de fonte persistida nao existe no motor.'
);

assert.ok(
  audit.includes('CONTEUDO_NORMALIZADO'),
  'Helper canonico nao consome o conteudo persistido.'
);

assert.ok(
  ops.includes(
    'const preparada = opsPrepararTranscricaoPersistidaValidadaParaReparo_(transcricao, interacao);'
  ),
  'Reparo deterministico ainda recalcula o gate.'
);

const inicioReparoDet = ops.indexOf('function opsCriarReparoDeterministico_');
const fimReparoDet = ops.indexOf(
  'function opsValidarAuditoriaNoEngineAtual_',
  inicioReparoDet
);
const trechoReparoDet = ops.slice(inicioReparoDet, fimReparoDet);

assert.ok(
  trechoReparoDet.includes('audV3ValidarQualidadeBoard_'),
  'Reparo em revisão precisa calcular o gate sem abortar.'
);

assert.ok(
  !trechoReparoDet.includes('audV3ExigirGatePublicavel_'),
  'Reparo em revisão não pode exigir gate publicável antes de salvar.'
);

assert.ok(
  trechoReparoDet.includes("'BLOQUEADA' : 'VALIDADA'"),
  'Reparo bloqueado precisa ficar explicitamente marcado.'
);

assert.ok(
  ops.includes('function OPS_AUDITAR_PREVIEW_TRANSCRICAO'),
  'Runner seguro de preview real nao existe.'
);

const inicioPreview = ops.indexOf('function OPS_AUDITAR_PREVIEW_TRANSCRICAO');
const fimPreview = ops.indexOf(
  'function opsResolverAlvoAuditoria_',
  inicioPreview
);

assert.ok(
  inicioPreview >= 0 && fimPreview > inicioPreview,
  'Runner de preview nao pode ser isolado.'
);

const trechoPreview = ops.slice(inicioPreview, fimPreview);

assert.ok(
  !trechoPreview.includes('opsAuditoriaAtualInteracao_'),
  'Preview operacional nao deve reaproveitar auditoria antiga.'
);

assert.ok(
  !trechoPreview.includes('opsValidarAuditoriaNoEngineAtual_'),
  'Preview nao deve bloquear nova auditoria por hash antigo.'
);

assert.ok(
  trechoPreview.includes('evitarDuplicidade: false'),
  'Preview precisa sempre gerar uma auditoria nova.'
);

assert.ok(
  !trechoPreview.includes('opsCriarReparoDeterministico_'),
  'Preview nao deve cair em reparo deterministico.'
);

assert.ok(
  !trechoPreview.includes('repararCoachingAuditoriaV3'),
  'Preview nao deve reparar auditoria antiga.'
);

assert.ok(
  trechoPreview.includes('reutilizada: false'),
  'Preview precisa declarar que a auditoria e nova.'
);

assert.ok(
  trechoPreview.includes('audV3ExigirGatePublicavel_'),
  'Preview precisa validar o gate publicavel.'
);

assert.ok(
  trechoPreview.includes('audRdTexto_(contextoRd)'),
  'Preview precisa gerar o formatter atual do RD.'
);

assert.ok(
  trechoPreview.includes("modo: 'PREVIEW_SEM_PUBLICACAO'"),
  'Preview nao identifica o modo seguro.'
);

assert.ok(
  trechoPreview.includes('rdPublicada: false'),
  'Preview deve declarar que nao publicou no RD.'
);

assert.ok(
  trechoPreview.includes('aprovada: false'),
  'Preview deve declarar que nao aprovou.'
);

assert.ok(
  !trechoPreview.includes('aprovarAuditoriaV3('),
  'Preview nao pode aprovar auditoria.'
);

assert.ok(
  !trechoPreview.includes('enviarAuditoriaParaRd('),
  'Preview nao pode publicar no RD.'
);

assert.ok(
  !trechoPreview.includes('reprocessarAutomacaoAuditoriaV3('),
  'Preview nao pode acionar automacao.'
);

assert.ok(
  code.includes("parametros.ops_audit_preview"),
  'doGet nao expoe a rota autenticada de preview.'
);

assert.ok(
  code.includes('OPS_AUDITAR_PREVIEW_TRANSCRICAO'),
  'doGet nao chama o runner seguro de preview.'
);

assert.ok(
  code.includes('resultadoPreviewOps'),
  'Rota autenticada de preview nao encapsula o resultado.'
);

assert.ok(
  code.includes("modo: 'PREVIEW_SEM_PUBLICACAO'"),
  'Rota de preview nao devolve erro seguro.'
);

assert.ok(
  code.includes('erroPreviewOps'),
  'Rota de preview ainda pode esconder excecoes em HTML.'
);

assert.ok(
  previewWorkflow.includes('environment: apps-script-production'),
  'Preview operacional nao usa ambiente protegido.'
);

assert.ok(
  previewWorkflow.includes("Ops audit preview: "),
  'Preview exige commit operacional explicito.'
);

assert.ok(
  previewWorkflow.includes('ops_audit_preview=1'),
  'Workflow de preview nao chama a rota segura.'
);

assert.ok(
  previewWorkflow.includes('OPS_RD_PREVIEW_BEGIN'),
  'Workflow de preview nao expoe o texto final do RD.'
);

assert.ok(
  previewWorkflow.includes(
    'result.rdPublicada !== false || result.aprovada !== false'
  ),
  'Workflow nao bloqueia publicacao acidental no preview.'
);

assert.ok(
  code.includes("parametros.ops_audit_publish"),
  'doGet nao expoe a rota operacional autenticada.'
);

assert.ok(
  code.includes('Session.getActiveUser().getEmail()'),
  'Rota operacional nao valida usuario ativo.'
);

assert.ok(
  code.includes('Session.getEffectiveUser().getEmail()'),
  'Rota operacional nao valida usuario efetivo.'
);

assert.ok(
  code.includes('OPS_AUDITAR_PUBLICAR_TRANSCRICAO'),
  'doGet nao chama o runner operacional.'
);

assert.ok(
  code.includes('TRA-[A-Za-z0-9-]+'),
  'Rota operacional nao aceita ID TRA-.'
);

assert.ok(
  code.includes('INT-[A-Za-z0-9-]+'),
  'Rota operacional nao aceita ID INT-.'
);

assert.ok(
  workflow.includes('environment: apps-script-production'),
  'Operacao nao usa ambiente protegido.'
);

assert.ok(
  workflow.includes("headers: { Authorization: 'Bearer ' + token }"),
  'Operacao nao autentica a chamada ao web app.'
);

assert.ok(
  workflow.includes(
    'AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA/exec'
  ),
  'Workflow nao chama o web app de producao.'
);

assert.ok(
  workflow.includes("url.searchParams.set('ops_audit_publish', '1')"),
  'Workflow nao fixa a operacao de publicacao.'
);

assert.ok(
  workflow.includes("url.searchParams.set('ops_sdr_publish_one', '1')"),
  'Interacao INT nao entra pelo fluxo SDR completo.'
);

assert.ok(
  workflow.includes("url.searchParams.set('single', '1')"),
  'Fluxo SDR explicito nao exige execucao unitaria.'
);

assert.ok(
  workflow.includes("url.searchParams.set('interaction', target)"),
  'Fluxo SDR nao fixa o ID solicitado.'
);

assert.ok(
  workflow.includes(
    "String(envelope.idInteracaoSolicitada || '') !== target"
  ),
  'Workflow nao bloqueia resposta de outra interacao.'
);

assert.ok(
  workflow.includes(
    "String(envelope.classificacao || '').toUpperCase() !== 'PUBLICADA'"
  ),
  'Workflow nao exige classificacao PUBLICADA.'
);

assert.ok(
  !workflow.includes('/dev?ops_audit_publish=1'),
  'Workflow operacional ainda depende do /dev.'
);

assert.ok(
  workflow.includes("redirect: 'follow'"),
  'Workflow nao acompanha redirects do Google.'
);

assert.ok(
  !workflow.includes('--location-trusted'),
  'Workflow nao deve voltar ao curl antigo.'
);

assert.ok(
  workflow.includes("sed -E 's/ \\(#[0-9]+\\)$//'"),
  'Workflow nao remove sufixo de PR.'
);

assert.ok(
  !workflow.includes('script.googleapis.com/v1/scripts/'),
  'Workflow ainda depende da Execution API.'
);

assert.ok(
  workflow.includes("Ops audit publish: "),
  'Workflow nao exige commit operacional explicito.'
);

assert.ok(
  workflow.includes("rdStatus || '').toUpperCase() !== 'PUBLICADA'"),
  'Workflow nao confirma publicacao no RD.'
);

/*
 * NOVO CONTRATO DE DEPLOY
 *
 * O deploy nao executa mais operacoes.
 * Ele recebe somente um SHA aprovado pelo release.
 */

assert.ok(
  deploy.includes('workflow_dispatch:'),
  'Deploy nao aceita despacho explicito.'
);

assert.ok(
  deploy.includes('expected_sha:'),
  'Deploy nao exige SHA aprovado.'
);

assert.ok(
  deploy.includes("github.sha == inputs.expected_sha"),
  'Deploy nao garante que publica o SHA aprovado.'
);

assert.ok(
  deploy.includes('if [ "$version_count" -ge 200 ]'),
  'Deploy nao trata o limite de 200 versoes.'
);

assert.ok(
  deploy.includes('Pull current production for rollback'),
  'Deploy nao captura snapshot da producao.'
);

assert.ok(
  deploy.includes('Save rollback snapshot'),
  'Deploy nao salva rollback.'
);

assert.ok(
  deploy.includes('Verify live Apps Script after deployment'),
  'Deploy nao verifica a fonte ao vivo.'
);

assert.ok(
  !deploy.includes('head_only=true'),
  'Deploy nao deve possuir excecao operacional HEAD-only.'
);

assert.ok(
  !deploy.includes("steps.capacity.outputs.head_only"),
  'Deploy nao deve possuir caminho alternativo HEAD-only.'
);

assert.ok(
  !deploy.includes('Restore independent automation triggers'),
  'Deploy nao pode restaurar automacoes.'
);

assert.ok(
  !deploy.includes('ops_restore_automation'),
  'Deploy nao pode chamar restaurador de automacoes.'
);

assert.ok(
  !deploy.includes('Run one-time journey sync'),
  'Deploy nao pode executar sincronizacao operacional.'
);

assert.ok(
  !deploy.includes('Run one-time Drive folder batches'),
  'Deploy nao pode executar lotes operacionais.'
);

console.log(
  'Runner operacional validado e deploy isolado: operacao explicita separada do release/deploy.'
);
