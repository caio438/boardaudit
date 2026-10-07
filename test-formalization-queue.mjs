import fs from 'node:fs';
import assert from 'node:assert/strict';

const jornada = fs.readFileSync(new URL('./JornadaCliente.gs', import.meta.url), 'utf8');
const auditoria = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const front = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');
const formalWeekWorkflow = fs.readFileSync(new URL('./.github/workflows/formalizacoes-week-control.yml', import.meta.url), 'utf8');

assert.match(jornada, /const transcricoesPorId = \{\};/);
assert.match(jornada, /lerObjetos_\(APP\.sheets\.transcricoes\)\.forEach/);
assert.match(jornada, /String\(transcricao\.FONTE \|\| ''\)\.toUpperCase\(\) === 'GOOGLE_MEET'/);
assert.match(jornada, /return jornadaConteudoPareceTranscricao_\(conteudo\);/);
assert.match(jornada, /String\(transcricao\.STATUS \|\| ''\)\.toUpperCase\(\) !== 'CONCLUIDA'/);
assert.match(jornada, /diagnosticoFila\.transcritas = todasReunioes\.filter/);

// Janela temporaria: 3 formalizacoes por execucao, somente ate 11/10/2026.
assert.match(jornada, /limitePorHora:\s*3/);
assert.match(jornada, /liberacaoTemporariaAtePadrao:\s*'2026-10-11'/);
assert.match(jornada, /function jornadaFormalizacaoTemporariaAtiva_\(\)/);
assert.match(jornada, /function jornadaDesativarFormalizacaoTemporariaSeExpirada_\(\)/);
assert.match(jornada, /function ATIVAR_FORMALIZACOES_TEMPORARIAS_SEMANA\(\)/);
assert.match(jornada, /maximoNominalPorMadrugada/);
assert.match(jornada, /jornadaHorariosFormalizacaoNoturna_\(\)\.length \* FORMALIZACAO_NOTURNA_CONFIG\.limitePorHora/);
assert.match(code, /parametros\.ops_formalizacoes_week_enable/);
assert.match(code, /jornadaFormalizacaoTemporariaAtiva_/);
assert.match(code, /delete bloqueados\.EXECUTAR_FORMALIZACOES_NOTURNAS_AGENDA/);
assert.match(formalWeekWorkflow, /\/formalizacoes-week-enable/);
assert.match(formalWeekWorkflow, /ops_formalizacoes_week_enable=1/);
assert.match(formalWeekWorkflow, /Number\(r\.limitePorExecucao \|\| 0\) === 3/);
assert.match(formalWeekWorkflow, /Number\(r\.maximoNominalPorMadrugada \|\| 0\) === 24/);
assert.match(formalWeekWorkflow, /String\(r\.modoBoard \|\| ''\)\.toUpperCase\(\) === 'MANUAL'/);
assert.match(formalWeekWorkflow, /r\.ingestaoRdApi4comAtiva === true/);
assert.match(formalWeekWorkflow, /r\.pipelineRdApi4comAtivo === true/);

const trechoFila = jornada.slice(
  jornada.indexOf('const transcricoesPorId = {}'),
  jornada.indexOf('const limiteLote =', jornada.indexOf('const transcricoesPorId = {}'))
);
assert.match(trechoFila, /GOOGLE_MEET/);
assert.match(trechoFila, /jornadaConteudoPareceTranscricao_\(conteudo\)/);

// Resultado operacional separado do STATUS técnico.
assert.match(code, /'RESULTADO_REUNIAO', 'RESULTADO_REUNIAO_ATUALIZADO_EM'/);
assert.match(jornada, /function jornadaNormalizarResultadoReuniao_/);
assert.match(jornada, /\['NO_SHOW', 'REMARCADA', 'CANCELADA', 'SEM_TRANSCRICAO'\]\.includes/);
assert.match(jornada, /jornadaResultadoReuniaoEncerraAutomacao_\(reuniao\.RESULTADO_REUNIAO\)/);
assert.match(jornada, /RESULTADO_REUNIAO: existente \? existente\.RESULTADO_REUNIAO \|\| '' : ''/);
assert.match(jornada, /versao: '1\.9\.7'/);

// Endpoint manual valida o enum e não precisa alterar o STATUS técnico.
assert.match(auditoria, /function salvarResultadoReuniaoFormalizacao\(dados\)/);
assert.match(auditoria, /permitidos = \['REALIZADA', 'NO_SHOW', 'REMARCADA', 'CANCELADA', 'SEM_TRANSCRICAO', 'NAO_IDENTIFICADA'\]/);
assert.match(auditoria, /RESULTADO_REUNIAO: resultado/);
assert.match(auditoria, /resultadoReuniao: formalNormalizarResultadoReuniao_\(item\.RESULTADO_REUNIAO\)/);

// UX: aprovação rápida, classificação visual, filtro e cards recolhíveis.
assert.match(front, />Aprovar agora<\/button>/);
assert.match(front, /Iniciar fila de revisão/);
assert.match(front, /formalAvancarFilaRevisao_/);
assert.match(front, /SEM_TRANSCRICAO/);
assert.match(front, /Revisar\/editar/);
assert.match(front, />Classificar reunião<\/summary>/);
assert.match(front, /id="formalHistoricoResultado"/);
assert.match(front, /class="formal-history-card"/);
assert.match(front, /class="formal-card-details"/);
assert.match(front, /name="formal-editor-section"/);
assert.match(front, /Sem transcrição disponível/);

console.log('Fila de formalização validada: transcrição literal, resultado da reunião, guards e UX compacta presentes.');
