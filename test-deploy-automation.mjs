import fs from 'node:fs';
import assert from 'node:assert/strict';

const yaml = fs.readFileSync(
  new URL('./.github/workflows/deploy-apps-script-auto.yml', import.meta.url),
  'utf8'
);

assert.match(
  yaml,
  /workflow_dispatch:/,
  'Deploy aprovado precisa ser acionado explicitamente pelo release.'
);

assert.match(
  yaml,
  /expected_sha:[\s\S]*?required: true/,
  'Deploy não exige o SHA exato aprovado.'
);

assert.doesNotMatch(
  yaml,
  /workflow_run:/,
  'Deploy não deve mais acontecer automaticamente após qualquer validação da main.'
);

assert.match(
  yaml,
  /github\.sha == inputs\.expected_sha/,
  'Deploy não confirma que está executando o SHA aprovado.'
);

assert.match(
  yaml,
  /concurrency:[\s\S]*?group: apps-script-production[\s\S]*?cancel-in-progress: false/,
  'Deploy não está serializado com as demais operações de produção.'
);

assert.match(
  yaml,
  /environment: apps-script-production/,
  'Deploy não usa o environment de produção.'
);

assert.match(
  yaml,
  /Check Apps Script version capacity/,
  'Deploy não verifica o limite de versões do Apps Script.'
);

assert.match(
  yaml,
  /APPS_SCRIPT_VERSION_COUNT=/,
  'Deploy não registra a quantidade de versões.'
);

assert.match(
  yaml,
  /limite de 200 versões/,
  'Deploy não bloqueia quando o limite de versões é atingido.'
);

assert.match(
  yaml,
  /Pull current production for rollback/,
  'Deploy não captura a produção atual antes da publicação.'
);

assert.match(
  yaml,
  /Save rollback snapshot/,
  'Deploy não salva snapshot para rollback.'
);

assert.match(
  yaml,
  /Build exact deployment source/,
  'Deploy não monta uma fonte de publicação controlada.'
);

assert.match(
  yaml,
  /prepare-dark-mode-deploy\.mjs/,
  'Build ID/frontend não é preparado antes do deploy.'
);

assert.match(
  yaml,
  /clasp" push --force/,
  'Deploy não envia a revisão aprovada ao Apps Script.'
);

assert.match(
  yaml,
  /AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA/,
  'Deployment de produção não está explicitamente definido.'
);

assert.match(
  yaml,
  /BoardAudit approved deploy \$\{\{ inputs\.expected_sha \}\}/,
  'Descrição do deployment não registra o SHA aprovado.'
);

assert.match(
  yaml,
  /Verify live Apps Script after deployment/,
  'Deploy não reconfirma a fonte ao vivo.'
);

assert.match(
  yaml,
  /POST_DEPLOY_SOURCE_MATCH=1/,
  'Deploy não confirma correspondência entre GitHub e Apps Script.'
);

assert.match(
  yaml,
  /DEPLOYED_SHA=\$\{\{ inputs\.expected_sha \}\}/,
  'Deploy não registra o SHA efetivamente publicado.'
);

assert.match(
  yaml,
  /Probe web app response/,
  'Deploy não verifica se o web app continua respondendo.'
);

assert.doesNotMatch(
  yaml,
  /Restore independent automation triggers/,
  'Deploy não pode reinstalar automações.'
);

assert.doesNotMatch(
  yaml,
  /ops_restore_automation/,
  'Deploy não pode chamar o restaurador de automações.'
);

assert.doesNotMatch(
  yaml,
  /Run one-time journey sync/,
  'Deploy não pode executar sincronização operacional da jornada.'
);

assert.doesNotMatch(
  yaml,
  /ops_sync_jornada/,
  'Deploy não pode disparar sincronização de jornada.'
);

assert.doesNotMatch(
  yaml,
  /Run one-time Drive folder batches/,
  'Deploy não pode processar lotes operacionais do Drive.'
);

assert.doesNotMatch(
  yaml,
  /ops_sync_jornada_pastas/,
  'Deploy não pode disparar lotes da jornada.'
);

assert.doesNotMatch(
  yaml,
  /Ops audit publish:/,
  'Deploy não pode possuir exceções para publicar auditorias.'
);

console.log(
  'Deploy seguro validado: SHA aprovado -> snapshot -> push -> deployment -> verificacao ao vivo, sem efeitos operacionais.'
);
