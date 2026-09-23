import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');

assert.match(source, /chaveErros:\s*'AUDITORIA_AUTO_LIGACOES_ERROS_V1'/);
assert.match(source, /atrasoRetryMs:\s*6 \* 60 \* 60 \* 1000/);
assert.match(source, /maxTentativasErro:\s*3/);
assert.match(source, /horarios:\s*\[7, 10, 13, 16, 19\]/);
assert.match(source, /function audV3ErroAutomacaoElegivelRetry_\(/);
assert.match(source, /tentativas >= AUTOMACAO_LIGACOES_V3\.maxTentativasErro/);
assert.match(source, /audV3ErroAutomacaoElegivelRetry_\(item, estadoErros, agoraMs\)/);
assert.doesNotMatch(source, /status !== 'ERRO_AUTOMACAO';/);
assert.match(source, /audV3RegistrarErroAutomacaoLigacao_\(interacao\.ID_INTERACAO, mensagem\)/);
assert.match(source, /audV3LimparErroAutomacaoLigacao_\(interacao\.ID_INTERACAO\)/);
assert.match(source, /proximaTentativaEm: tentativas >= AUTOMACAO_LIGACOES_V3\.maxTentativasErro/);

console.log('Retry controlado de ERRO_AUTOMACAO validado sem perder os cinco horarios automaticos.');
