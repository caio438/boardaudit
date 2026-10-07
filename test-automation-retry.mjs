import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');

assert.match(source, /chaveErros:\s*'AUDITORIA_AUTO_LIGACOES_ERROS_V1'/);
assert.match(source, /atrasoRetryMs:\s*6 \* 60 \* 60 \* 1000/);
assert.match(source, /atrasoRetryTransitorioMs:\s*10 \* 60 \* 1000/);
assert.match(source, /atrasoMaxRetryTransitorioMs:\s*60 \* 60 \* 1000/);
assert.match(source, /maxTentativasErro:\s*3/);
assert.match(source, /maxTentativasErroTransitorio:\s*12/);
assert.match(source, /horarios:\s*\[7, 10, 13, 16, 19\]/);
assert.match(source, /function audV3ErroAutomacaoElegivelRetry_\(/);
assert.match(source, /tentativas >= audV3LimiteTentativasErro_\(registro\)/);
assert.match(source, /audV3ErroAutomacaoElegivelRetry_\(item, estadoErros, agoraMs\)/);
assert.doesNotMatch(source, /status !== 'ERRO_AUTOMACAO';/);
assert.match(source, /audV3RegistrarErroAutomacaoLigacao_\(interacao\.ID_INTERACAO, mensagem\)/);
assert.match(source, /audV3LimparErroAutomacaoLigacao_\(interacao\.ID_INTERACAO\)/);
assert.match(source, /proximaTentativaEm: tentativas >= limiteTentativas/);
assert.match(source, /function audV3ErroAutomacaoTransitorio_\(/);
assert.match(source, /429\|500\|502\|503\|504/);
assert.match(source, /Math\.pow\(2, Math\.max\(0, tentativas - 1\)\)/);
assert.match(source, /function audV3ProximaTentativaAutomacaoLigacoes_\(/);
assert.match(source, /function audV3AtrasoRetrySugeridoMs_\(/);
assert.match(source, /retry in\\s\*/);
assert.match(source, /audV3LimiteTentativasErro_\(registro\)/);
assert.match(source, /SUBSTITUIDA_REGERACAO_AUTO/);
assert.match(source, /evitarDuplicidade: false/);

console.log('Retry controlado de ERRO_AUTOMACAO validado sem perder os cinco horarios automaticos.');
