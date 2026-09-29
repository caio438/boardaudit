import assert from 'node:assert/strict';
import fs from 'node:fs';

const gs = fs.readFileSync(new URL('./OpsSdrBatch.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const runner = fs.readFileSync(new URL('./ops/sdr-publish-latest-runner.mjs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('./.github/workflows/sdr-publish-latest.yml', import.meta.url), 'utf8');

assert.ok(gs.includes('function OPS_SDR_LISTAR_RECENTES_PARA_PUBLICAR'));
assert.ok(gs.includes('function OPS_SDR_PUBLICAR_INTERACAO_SEGURO'));
assert.ok(gs.includes("classificacao = 'AGUARDANDO_VINCULO'"));
assert.ok(gs.includes("classificacao = 'REVISAO_HUMANA'"));
assert.ok(code.includes('ops_sdr_batch_targets'));
assert.ok(code.includes('ops_sdr_publish_one'));
assert.ok(runner.includes('ops_sdr_publish_one'));
assert.ok(runner.includes('single: 1'));
assert.ok(code.includes("parametros.single"));
assert.ok(runner.includes('const limit = 1;'));
assert.ok(runner.includes("'/sdr-publish-next'"));
assert.ok(runner.includes('sdr-batch-report.md'));
assert.ok(workflow.includes("github.event.comment.body == '/sdr-publish-next'"));
assert.ok(workflow.includes('Comment final result on Ops Control'));

console.log('Controlled SDR latest batch publication validated.');
