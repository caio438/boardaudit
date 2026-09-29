import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');

function trecho(inicio, fim) {
  const de = source.indexOf('function ' + inicio + '(');
  const ate = source.indexOf('function ' + fim + '(', de + 1);
  assert.ok(de >= 0 && ate > de, 'Não foi possível localizar ' + inicio + '.');
  return source.slice(de, ate);
}

const helper = trecho('audV3ComLockPersistenciaSdr_', 'transcreverAudioMp3V3');
const importacao = trecho('importarTranscricaoManualV3', 'audV3NormalizarUrlAudio_');
const transcricao = trecho('transcreverAudioMp3V3', 'executarAuditoriaV3');
const reparo = trecho('repararCoachingAuditoriaV3', 'audV3ExigirGatePublicavel_');

assert.match(helper, /LockService\.getUserLock\(\)/);
assert.doesNotMatch(helper, /getScriptLock|waitLock/);
assert.match(importacao, /audV3ComLockPersistenciaSdr_\('nova-interacao:' \+ idInteracao/);
assert.doesNotMatch(importacao, /getScriptLock|waitLock/);
assert.match(transcricao, /audV3ComLockPersistenciaSdr_\('transcricao:' \+ interacaoExistente\.ID_INTERACAO/);
assert.doesNotMatch(transcricao, /getScriptLock|waitLock/);
assert.match(reparo, /audV3ComLockPersistenciaSdr_\('auditoria:' \+ auditoria\.ID_AUDITORIA/);
assert.match(reparo, /A auditoria mudou durante o reparo; nenhuma alteração foi persistida/);
assert.match(reparo, /A fonte da auditoria mudou durante o reparo; nenhuma alteração foi persistida/);
assert.doesNotMatch(reparo, /getScriptLock|waitLock/);

let adquirido = true;
let liberacoes = 0;
let chamadas = 0;
let flushes = 0;
const lock = {
  tryLock(timeoutMs) {
    assert.equal(timeoutMs, 5000);
    return adquirido;
  },
  releaseLock() {
    liberacoes++;
  }
};
const contexto = vm.createContext({
  console,
  LockService: { getUserLock: () => lock },
  SpreadsheetApp: { flush: () => flushes++ }
});
vm.runInContext(source + '\nthis.lockSdr = audV3ComLockPersistenciaSdr_;', contexto);

assert.equal(contexto.lockSdr('transcricao:INT-1', () => {
  chamadas++;
  return 'ok';
}), 'ok');
assert.equal(chamadas, 1);
assert.equal(liberacoes, 1);
assert.equal(flushes, 1);

assert.throws(() => contexto.lockSdr('auditoria:AUD-1', () => {
  throw new Error('falha de persistência');
}), /falha de persistência/);
assert.equal(liberacoes, 2, 'O lock precisa ser liberado mesmo quando a persistência falha.');
assert.equal(flushes, 2, 'Escritas pendentes precisam ser confirmadas antes de liberar o lock.');

adquirido = false;
assert.throws(
  () => contexto.lockSdr('transcricao:INT-2', () => { chamadas++; }),
  /Persistência SDR ocupada para transcricao:INT-2/
);
assert.equal(chamadas, 1, 'A operação não pode executar sem adquirir o lock dedicado.');
assert.equal(liberacoes, 2, 'Lock não adquirido não pode ser liberado.');
assert.equal(flushes, 2, 'Lock não adquirido não pode confirmar uma seção que não executou.');

console.log('Lock dedicado e curto de persistência SDR validado sem dependência do ScriptLock global.');
