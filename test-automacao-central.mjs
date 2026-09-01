import fs from 'node:fs';
import assert from 'node:assert/strict';

const central = fs.readFileSync(new URL('./AutomacaoCentral.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const auditoria = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const jornada = fs.readFileSync(new URL('./JornadaCliente.gs', import.meta.url), 'utf8');

assert.match(central, /handlerDiario:\s*'EXECUTAR_AUTOMACAO_CENTRAL_19H'/);
assert.match(central, /\.atHour\(AUTOMACAO_CENTRAL_19H\.hora\)/);
assert.match(central, /fase === 'AGENDA'/);
assert.match(central, /fase === 'FONTES_EXTERNAS'/);
assert.match(central, /fase === 'LIGACOES'/);
assert.match(central, /fase === 'FORMALIZACOES'/);
assert.match(central, /\.after\(/);
assert.match(code, /tldvSyncHours:\s*\[19\]/);
assert.match(code, /rdTriggerHour:\s*19/);
assert.doesNotMatch(code, /configurada em 7 horários diários/);
assert.match(auditoria, /maxPorExecucao:\s*3/);
assert.match(auditoria, /horarios:\s*\[19\]/);
assert.match(jornada, /Math\.min\(3,/);
assert.doesNotMatch(jornada, /atHour\(13\)/);
assert.doesNotMatch(jornada, /nearMinute\(30\)/);

console.log('Automação central das 19h validada: um acionador permanente, fases sequenciais e lotes de até três.');
