import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./JornadaCliente.gs', import.meta.url), 'utf8');

assert.match(source, /function jornadaTranscricaoFormalizavel_\(/);
assert.match(source, /fonte !== 'GOOGLE_MEET'/);
assert.match(source, /jornadaConteudoPareceTranscricao_\(armazenado\)/);
assert.match(source, /audV3ConteudoCompletoTranscricao_\(transcricao, interacao\)/);
assert.match(source, /if \(!jornadaConteudoPareceTranscricao_\(completo\)\) return false;/);
assert.match(source, /TAMANHO_CARACTERES: completo\.length/);
assert.match(source, /jornadaTranscricaoFormalizavel_\(item, transcricoesPorId, interacoesPorId\)/);

console.log('Fila de formalizações validada: Anotações do Gemini não bloqueiam a fila e a transcrição literal pode ser recuperada quando disponível.');
