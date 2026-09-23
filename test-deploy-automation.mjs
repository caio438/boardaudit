import fs from 'node:fs';
import assert from 'node:assert/strict';

const yaml = fs.readFileSync(new URL('./.github/workflows/deploy-apps-script-auto.yml', import.meta.url), 'utf8');

assert.ok(yaml.includes('workflow_run:'), 'Deploy automático não depende da validação.');
assert.ok(yaml.includes('Validate Apps Script'), 'Deploy automático não observa o workflow de validação.');
assert.ok(yaml.includes("github.event.workflow_run.conclusion == 'success'"), 'Deploy não exige validação com sucesso.');
assert.ok(yaml.includes("github.event.workflow_run.head_branch == 'main'"), 'Deploy automático não está restrito à main.');
assert.ok(yaml.includes('environment: apps-script-production'), 'Deploy não usa o Environment que contém a credencial do clasp.');
assert.ok(yaml.includes('Check Apps Script version capacity'), 'Deploy não verifica o limite de versões antes de publicar.');
assert.ok(yaml.includes('APPS_SCRIPT_VERSION_COUNT='), 'Deploy não registra a contagem de versões.');
assert.ok(yaml.includes('limite de 200 versões'), 'Deploy não explica como corrigir o limite de versões.');
assert.ok(yaml.includes('head_only=true'), 'Deploy não prevê sincronização HEAD-only no limite de versões.');
assert.ok(yaml.includes("if: steps.capacity.outputs.head_only != 'true'"), 'Deploy HEAD-only ainda tentaria atualizar o deployment versionado.');

assert.ok(yaml.indexOf('Check Apps Script version capacity') < yaml.indexOf('Push exact validated source'), 'Limite de versões só é verificado depois do push.');
assert.ok(!yaml.includes('Probe authenticated web app debug'), 'Deploy ainda depende do probe antigo com access_token direto.');
assert.ok(yaml.includes('Restore independent automation triggers'), 'Deploy não reinstala os acionadores operacionais após publicar.');
assert.ok(yaml.includes('ops_restore_automation=1'), 'Deploy não chama o restaurador autenticado de automações.');
assert.ok(yaml.includes('AUTOMATION_TRIGGERS_RESTORED=1'), 'Deploy não confirma a restauração dos acionadores.');

assert.ok(yaml.includes('Pull current production for preservation'), 'Deploy não preserva a produção atual antes da publicação.');
assert.ok(yaml.includes('Save rollback snapshot'), 'Deploy não cria snapshot de rollback.');
assert.ok(yaml.includes('preserving remote-only files'), 'Deploy pode apagar arquivos existentes apenas na produção.');
assert.ok(yaml.includes('prepare-dark-mode-deploy.mjs'), 'Build ID/refresh do frontend não é atualizado no deploy.');
assert.ok(yaml.includes('clasp" push --force'), 'Deploy não envia o projeto para Apps Script.');
assert.ok(yaml.includes('AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA'), 'Deployment ID de produção não está fixado no workflow.');
assert.ok(yaml.includes('Verify live Apps Script after deployment'), 'Deploy não reconfirma a fonte ao vivo após publicar.');
assert.ok(yaml.includes('POST_DEPLOY_SOURCE_MATCH=1'), 'Deploy não valida correspondência pós-publicação.');
assert.ok(yaml.includes('function audV3FinalizarAutomaticamente_'), 'Deploy não verifica o pipeline automático no Apps Script ao vivo.');
assert.ok(yaml.includes('function audRdPublicarAutomaticamente_'), 'Deploy não verifica a publicação automática no RD ao vivo.');
assert.ok(yaml.includes('Probe web app response'), 'Deploy não testa a resposta do web app após publicar.');

console.log('Deploy automático validado: main verde -> snapshot -> preservação -> push -> deployment -> verificação ao vivo.');
