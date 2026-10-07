import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync('Code.gs', 'utf8');
const central = fs.readFileSync('AutomacaoCentral.gs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/board-full-automation.yml', 'utf8');

assert.match(code, /const BOARD_RUNTIME_MODE_KEY = 'BOARD_RUNTIME_MODE'/);
assert.match(code, /function boardModoAtual_\(\)/);
assert.match(code, /function ATIVAR_BOARD_AUTOMATICO_COMPLETO\(\)/);
assert.match(code, /ops_board_enable_full/);
assert.match(code, /setProperty\(BOARD_RUNTIME_MODE_KEY, 'MANUAL'\)/);
assert.match(code, /props\.setProperty\(BOARD_RUNTIME_MODE_KEY, 'AUTOMATICO'\)/);
assert.match(code, /salvarConfiguracao_\(RD_API4COM_AUTOMACAO\.chaveCutoff, RD_API4COM_AUTOMACAO\.cutoffPadraoIso\)/);
assert.match(code, /salvarConfiguracao_\('FORMALIZACAO_TEMPORARIA_LIBERADA_ATE', ''\)/);
assert.match(code, /Number\(acionadores\.watchdogsSdr \|\| 0\) === RD_API4COM_AUTOMACAO\.watchdogHours\.length/);
assert.doesNotMatch(
  central.match(/function automacaoCentralHandlersLegados_\(\)[\s\S]*?\n}/)?.[0] || '',
  /SINCRONIZAR_RD_DIARIO/,
  'A rotina central nao pode remover a ingestao diaria do SDR.'
);
assert.match(central, /return garantirIngestaoSdrRecente_\(\)/);
assert.match(workflow, /github\.event\.comment\.body == '\/board-enable-full'/);
assert.match(workflow, /ops_board_enable_full=1/);
assert.match(workflow, /String\(r\.modoBoard \|\| ''\) === 'AUTOMATICO'/);
assert.match(workflow, /Number\(t\.watchdogsSdr \|\| 0\) === 5/);

console.log('OK: ativacao automatica completa do Board validada.');

