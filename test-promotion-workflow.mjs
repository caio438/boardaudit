import assert from 'node:assert/strict';
import fs from 'node:fs';

const promotion = fs.readFileSync(new URL('./.github/workflows/promote-approved-revision.yml', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('./.github/workflows/deploy-apps-script-auto.yml', import.meta.url), 'utf8');
const validation = fs.readFileSync(new URL('./.github/workflows/validate.yml', import.meta.url), 'utf8');

assert.match(promotion, /workflow_dispatch:/, 'A promoção não pode ser acionada manualmente.');
assert.match(promotion, /branch:[\s\S]*?required: true/, 'Input branch obrigatório ausente.');
assert.match(promotion, /commit_sha:[\s\S]*?required: true/, 'Input commit_sha obrigatório ausente.');
assert.match(promotion, /permissions:[\s\S]*?contents: write/, 'Workflow não possui a permissão mínima para promover main.');
assert.match(promotion, /permissions:[\s\S]*?actions: write/, 'Workflow não pode acionar a validação após promover main.');
assert.match(promotion, /concurrency:[\s\S]*?group: apps-script-production[\s\S]*?cancel-in-progress: false/, 'Promoção não está serializada com o deploy de produção.');
assert.match(deploy, /concurrency:[\s\S]*?group: apps-script-production[\s\S]*?cancel-in-progress: false/, 'Deploy não compartilha a trava de concorrência da promoção.');

assert.match(promotion, /git check-ref-format --branch/, 'Branch não é validado como ref Git segura.');
assert.match(promotion, /\^\[0-9a-fA-F\]\{40\}\$/, 'SHA completo não é exigido.');
assert.match(promotion, /refs\/heads\/\$TARGET_BRANCH:refs\/remotes\/origin\/\$TARGET_BRANCH/, 'Workflow não busca explicitamente o branch informado.');
assert.match(promotion, /branch_sha=.*refs\/remotes\/origin\/\$TARGET_BRANCH/, 'Ponta do branch não é resolvida.');
assert.match(promotion, /"\$branch_sha" != "\$target_sha"/, 'SHA informado não é comparado com a ponta do branch.');

const mergeIndex = promotion.indexOf('git merge --no-ff --no-commit "$TARGET_SHA"');
const testIndex = promotion.indexOf('run: npm test');
const recheckIndex = promotion.indexOf('main mudou durante a validação');
const pushIndex = promotion.indexOf('git push origin "HEAD:refs/heads/main"');
const dispatchIndex = promotion.indexOf('gh workflow run validate.yml --ref main');
assert.ok(mergeIndex >= 0, 'O resultado real do merge não é preparado.');
assert.ok(testIndex > mergeIndex, 'Os testes precisam rodar depois de preparar o merge real.');
assert.ok(recheckIndex > testIndex, 'main não é reconfirmado depois dos testes.');
assert.ok(pushIndex > recheckIndex, 'A promoção acontece antes da validação final de main.');
assert.ok(dispatchIndex > pushIndex, 'A validação de main precisa ser acionada depois do push promovido.');
assert.match(validation, /on:[\s\S]*?workflow_dispatch:/, 'Validate Apps Script não aceita o disparo explícito da promoção.');

assert.doesNotMatch(promotion, /\bclasp\b/i, 'Workflow de promoção não pode duplicar o deploy do Apps Script.');
assert.doesNotMatch(promotion, /enviarAuditoriaParaRd|OPS_AUDITAR_PUBLICAR_TRANSCRICAO|ops-audit-publish/i, 'Workflow de promoção não pode publicar auditorias no RD.');
assert.match(deploy, /workflow_run:/, 'Deploy existente deixou de assumir o main validado.');
assert.match(deploy, /Pull current production for preservation/, 'Snapshot/preservação de produção foi removido.');
assert.match(deploy, /Save rollback snapshot/, 'Snapshot de rollback foi removido.');
assert.match(deploy, /Probe web app response/, 'Probe final do web app foi removido.');
assert.match(deploy, /Restore independent automation triggers/, 'Restauração de gatilhos foi removida.');

console.log('Promoção segura validada: branch/SHA exatos -> merge real -> testes -> main -> deploy existente.');
