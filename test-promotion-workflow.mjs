import assert from 'node:assert/strict';
import fs from 'node:fs';

const release = fs.readFileSync(
  new URL('./.github/workflows/release-pr-command.yml', import.meta.url),
  'utf8'
);

const deploy = fs.readFileSync(
  new URL('./.github/workflows/deploy-apps-script-auto.yml', import.meta.url),
  'utf8'
);

const manualDeploy = fs.readFileSync(
  new URL('./.github/workflows/deploy-apps-script.yml', import.meta.url),
  'utf8'
);

const validation = fs.readFileSync(
  new URL('./.github/workflows/validate.yml', import.meta.url),
  'utf8'
);

assert.match(
  release,
  /issue_comment:/,
  'Release precisa ser acionado por comentário no PR.'
);

assert.match(
  release,
  /\/release-boardaudit/,
  'Comando /release-boardaudit não foi configurado.'
);

assert.match(
  release,
  /github\.event\.issue\.pull_request/,
  'Release precisa aceitar comandos apenas dentro de PRs.'
);

assert.match(
  release,
  /github\.event\.comment\.user\.login == 'caio438'/,
  'Release não está restrito ao proprietário autorizado.'
);

assert.match(
  release,
  /contents: write/,
  'Release não possui permissão para incorporar o PR.'
);

assert.match(
  release,
  /pull-requests: write/,
  'Release não possui permissão para manipular o PR.'
);

assert.match(
  release,
  /actions: write/,
  'Release não possui permissão para disparar validação e deploy.'
);

assert.match(
  release,
  /group: boardaudit-chat-release/,
  'Comandos de release não estão serializados.'
);

assert.match(
  release,
  /base_ref=.*\.base\.ref/,
  'Release não identifica a branch base do PR.'
);

assert.match(
  release,
  /test "\$base_ref" = "main"/,
  'Release não exige destino main.'
);

assert.match(
  release,
  /test "\$draft" = "false"/,
  'Release pode incorporar PR ainda em draft.'
);

assert.match(
  release,
  /test "\$state" = "open"/,
  'Release não exige PR aberto.'
);

assert.match(
  release,
  /head_sha=.*\.head\.sha/,
  'Release não captura o SHA exato do PR.'
);

assert.match(
  release,
  /actions\/workflows\/validate\.yml\/runs\?event=pull_request/,
  'Release não consulta a validação do PR.'
);

assert.match(
  release,
  /select\(\.head_sha == \$sha\)/,
  'Release não exige validação do SHA exato.'
);

assert.match(
  release,
  /-f sha="\$HEAD_SHA"/,
  'Squash merge não está preso ao SHA validado.'
);

assert.match(
  release,
  /merge_method=squash/,
  'Release não utiliza squash merge.'
);

assert.match(
  release,
  /actions\/workflows\/validate\.yml\/dispatches/,
  'Release não dispara nova validação da main.'
);

assert.match(
  release,
  /inputs\[expected_sha\]=\$MERGE_SHA/,
  'Release não informa o SHA exato para validação/deploy.'
);

assert.match(
  release,
  /event=workflow_dispatch&branch=main/,
  'Release não aguarda a validação explícita da main.'
);

assert.match(
  release,
  /actions\/workflows\/deploy-apps-script-auto\.yml\/dispatches/,
  'Release não dispara o deploy aprovado.'
);

assert.doesNotMatch(
  release,
  /\bclasp\b/i,
  'Workflow de release não deve publicar diretamente no Apps Script.'
);

assert.doesNotMatch(
  release,
  /OPS_AUDITAR_PUBLICAR_TRANSCRICAO|enviarAuditoriaParaRd|ops-audit-publish/i,
  'Workflow de release não pode executar auditoria ou publicar no RD.'
);

assert.match(
  validation,
  /workflow_dispatch:/,
  'Validate Apps Script não aceita validação explícita da revisão incorporada.'
);

assert.match(
  validation,
  /expected_sha:/,
  'Validate Apps Script não recebe o SHA esperado.'
);

assert.match(
  validation,
  /ACTUAL_SHA: \$\{\{ github\.sha \}\}/,
  'Validate Apps Script não identifica o SHA em execução.'
);

assert.match(
  validation,
  /test "\$ACTUAL_SHA" = "\$EXPECTED_SHA"/,
  'Validate Apps Script não confirma o SHA esperado.'
);

assert.match(
  deploy,
  /workflow_dispatch:/,
  'Deploy não aceita despacho explícito do release.'
);

assert.match(
  deploy,
  /expected_sha:[\s\S]*?required: true/,
  'Deploy não exige o SHA aprovado.'
);

assert.doesNotMatch(
  deploy,
  /workflow_run:/,
  'Deploy não deve disparar sozinho após qualquer validação.'
);

assert.match(
  deploy,
  /github\.sha == inputs\.expected_sha/,
  'Deploy não garante a revisão aprovada.'
);

assert.match(
  deploy,
  /group: apps-script-production/,
  'Deploy aprovado não utiliza a trava global de produção.'
);

assert.match(
  manualDeploy,
  /group: apps-script-production/,
  'Deploy manual não compartilha a mesma trava de produção.'
);

assert.match(
  deploy,
  /Pull current production for rollback/,
  'Snapshot pré-deploy foi removido.'
);

assert.match(
  deploy,
  /Save rollback snapshot/,
  'Rollback snapshot foi removido.'
);

assert.match(
  deploy,
  /Verify live Apps Script after deployment/,
  'Validação pós-deploy foi removida.'
);

assert.match(
  deploy,
  /Probe web app response/,
  'Probe final do web app foi removido.'
);

assert.doesNotMatch(
  deploy,
  /Restore independent automation triggers|ops_restore_automation/,
  'Deploy ainda possui efeito colateral de reinstalar automações.'
);

console.log(
  'Release seguro validado: PR verde -> SHA exato -> squash -> main validada -> deploy da mesma revisao.'
);
