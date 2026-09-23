import fs from 'node:fs';
import assert from 'node:assert/strict';

const jornada = fs.readFileSync(new URL('./JornadaCliente.gs', import.meta.url), 'utf8');

assert.match(jornada, /const transcricoesPorId = \{\};/);
assert.match(jornada, /lerObjetos_\(APP\.sheets\.transcricoes\)\.forEach/);
assert.match(jornada, /String\(transcricao\.FONTE \|\| ''\)\.toUpperCase\(\) === 'GOOGLE_MEET'/);
assert.match(jornada, /return jornadaConteudoPareceTranscricao_\(conteudo\);/);
assert.match(jornada, /String\(transcricao\.STATUS \|\| ''\)\.toUpperCase\(\) !== 'CONCLUIDA'/);
assert.match(jornada, /diagnosticoFila\.transcritas = todasReunioes\.filter/);

const trechoFila = jornada.slice(
  jornada.indexOf('const transcricoesPorId = {}'),
  jornada.indexOf('const limiteLote =', jornada.indexOf('const transcricoesPorId = {}'))
);
assert.match(trechoFila, /GOOGLE_MEET/);
assert.match(trechoFila, /jornadaConteudoPareceTranscricao_\(conteudo\)/);

console.log('Fila de formalização validada: Anotações do Gemini não entram como transcrição literal.');
