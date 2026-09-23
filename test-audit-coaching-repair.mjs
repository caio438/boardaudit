import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Array,
  Object,
  Error,
  isFinite,
  encodeURIComponent,
  Utilities: { formatDate: value => new Date(value).toISOString() }
};
vm.createContext(context);
vm.runInContext(source + `
this.coachingApi = {
  isGeneric: audV3TemRecomendacaoGenerica_,
  collect: audV3ColetarOrientacoesGenericas_,
  buildContext: audV3ContextoCampoCoaching_,
  apply: audV3AplicarRespostaReparoCoaching_,
  validateBoard: audV3ValidarQualidadeBoard_
};`, context);

const api = context.coachingApi;
const suzanaInteraction = 'TLDV_6aabd63fa6d95700137fadea';
const pitchLiteral = 'Pergunte qual é o impacto financeiro do problema para a operação.';
const evidencia = 'Hoje perdemos horas conferindo cada orçamento manualmente.';

const resultadoSuzana = {
  contexto_interacao: {
    classificacao: 'PRIMEIRA_REUNIAO',
    objetivo_principal: 'Diagnosticar o cenário e apresentar a solução',
    confianca: 'ALTA',
    etapas_aplicaveis: ['Diagnóstico', 'Apresentação', 'Fechamento'],
    etapas_ja_concluidas: [],
    continuidade_confirmada: false,
    necessita_revisao: false
  },
  metadados: { interacao_id: suzanaInteraction, closer: 'Suzana Silvestre' },
  criterios_avaliados: [{
    id: 'exploracao_dor_impacto',
    nome: 'Exploração de Dor e Impacto Financeiro',
    aplicavel: true,
    status: 'DESVIO_EXECUCAO',
    pontuacao: 2.5,
    o_que_foi_dito: evidencia,
    locutor_evidencia: 'CLOSER',
    regra_pitch: pitchLiteral,
    divergencia: 'O problema foi identificado, mas a consequência financeira não foi dimensionada.',
    justificativa_nota: 'Houve exploração parcial do impacto.',
    correcao_pratica: 'Revisar as Aulas 11 e 12 do treinamento Venda Perfeita para aprimorar a exploração de impacto financeiro no diagnóstico.'
  }],
  momentos: [{
    id: 'momento_1',
    nome: 'Momento 1 — Diagnóstico',
    status: 'AMARELO',
    cor: 'AMARELO',
    o_que_foi_dito: evidencia,
    divergencia: 'A consequência financeira não foi dimensionada.',
    como_agir: 'Aprimorar diagnóstico.',
    aulas_revisar: ['Aula 11', 'Aula 12']
  }],
  proximos_passos: [{
    acao: 'Seguir rigorosamente o cardápio.',
    equipe: 'OUTRA',
    responsavel: 'Suzana Silvestre',
    criterio_conclusao: 'Aprimorar o diagnóstico.'
  }],
  semaforo_geral: {
    cor: 'AMARELO',
    orientacao: 'Rever as aulas correspondentes aos momentos com desvio.'
  },
  resumo_publicacao: {
    resumo: 'Revisar o treinamento para melhorar a condução.',
    correcoes_prioritarias: [{ acao: 'Estudar o pitch.', criterio_conclusao: 'Seguir o script.' }],
    proximos_passos: ['Aprimorar diagnóstico.']
  }
};

for (const texto of [
  'Revisar as Aulas 11 e 12 para aprimorar a exploração de impacto.',
  'Seguir rigorosamente o cardápio.',
  'Aprimorar diagnóstico.',
  'Estudar o pitch.'
]) {
  assert.equal(api.isGeneric(texto), true, `O gate deveria bloquear: ${texto}`);
}

const especifica = 'Após o lead descrever o problema, pergunte "Qual impacto financeiro isso gera por mês?", confirme o valor ou a impossibilidade de mensurá-lo e considere concluído quando a resposta estiver registrada antes da apresentação.';
assert.equal(api.isGeneric(especifica), false, 'Coaching observável e verificável não pode ser bloqueado.');

const campos = api.collect(resultadoSuzana, 'CLOSER');
const caminhos = campos.map(item => item.caminho);
for (const caminho of [
  'criterios_avaliados.0.correcao_pratica',
  'momentos.0.como_agir',
  'proximos_passos.0.acao',
  'proximos_passos.0.criterio_conclusao',
  'semaforo_geral.orientacao',
  'resumo_publicacao.resumo',
  'resumo_publicacao.correcoes_prioritarias.0.acao',
  'resumo_publicacao.correcoes_prioritarias.0.criterio_conclusao',
  'resumo_publicacao.proximos_passos.0'
]) {
  assert.ok(caminhos.includes(caminho), `Campo genérico não rastreado: ${caminho}`);
}

const gateAntes = api.validateBoard(resultadoSuzana, 'CLOSER');
assert.equal(gateAntes.status, 'BLOQUEADO', 'O gate precisa continuar bloqueando conteúdo realmente inválido.');
assert.match(gateAntes.bloqueios.join(' | '), /criterios_avaliados\.0\.correcao_pratica/, 'O bloqueio precisa apontar o campo exato.');

const contextos = campos.map(campo => api.buildContext(resultadoSuzana, campo, pitchLiteral));
const contextoCriterio = contextos.find(item => item.caminho === 'criterios_avaliados.0.correcao_pratica');
assert.equal(contextoCriterio.evidencia_correspondente, evidencia, 'O reparo precisa usar a evidência correspondente.');
assert.equal(contextoCriterio.regra_literal_pitch, pitchLiteral, 'A regra literal do pitch precisa ser preservada.');
assert.ok(!JSON.stringify(contextos).includes('transcricao_completa'), 'O reparo não pode receber a transcrição inteira.');

const respostaReparo = {
  reparos: contextos.map(item => ({
    caminho: item.caminho,
    comportamento_faltante: 'Não foi obtida uma dimensão objetiva da consequência do problema relatado pelo lead',
    acao_pergunta_concreta: 'Pergunte "Qual impacto financeiro ou operacional esse problema gera hoje?"',
    momento_aplicacao: 'Após o lead descrever o problema e antes de iniciar a apresentação da solução',
    informacao_obter_confirmar: 'A consequência operacional ou financeira, inclusive quando o lead ainda não conseguir mensurá-la',
    criterio_verificavel: 'O item está concluído quando a resposta do lead estiver registrada antes da apresentação',
    origem: item.regra_literal_pitch === 'NAO_PREVISTO_NO_PITCH' ? 'SUGESTAO_ENABLEMENT' : 'PITCH'
  }))
};

const candidato = JSON.parse(JSON.stringify(resultadoSuzana));
const protegidosAntes = JSON.stringify({
  nota: candidato.criterios_avaliados[0].pontuacao,
  status: candidato.criterios_avaliados[0].status,
  evidencia: candidato.criterios_avaliados[0].o_que_foi_dito,
  regra: candidato.criterios_avaliados[0].regra_pitch,
  criterio: candidato.criterios_avaliados[0].id,
  aulas: candidato.momentos[0].aulas_revisar
});
api.apply(candidato, campos, contextos, respostaReparo);
const protegidosDepois = JSON.stringify({
  nota: candidato.criterios_avaliados[0].pontuacao,
  status: candidato.criterios_avaliados[0].status,
  evidencia: candidato.criterios_avaliados[0].o_que_foi_dito,
  regra: candidato.criterios_avaliados[0].regra_pitch,
  criterio: candidato.criterios_avaliados[0].id,
  aulas: candidato.momentos[0].aulas_revisar
});
assert.equal(protegidosDepois, protegidosAntes, 'O reparo seletivo alterou nota, status, evidência, critério, regra ou material complementar.');
assert.equal(api.collect(candidato, 'CLOSER').length, 0, 'A saída reparada ainda contém orientação genérica.');
assert.match(candidato.criterios_avaliados[0].correcao_pratica, /Comportamento faltante:/);
assert.match(candidato.criterios_avaliados[0].correcao_pratica, /Ação concreta:/);
assert.match(candidato.criterios_avaliados[0].correcao_pratica, /Momento de aplicação:/);
assert.match(candidato.criterios_avaliados[0].correcao_pratica, /Informação a obter ou confirmar:/);
assert.match(candidato.criterios_avaliados[0].correcao_pratica, /Critério verificável:/);
assert.deepEqual(candidato.momentos[0].aulas_revisar, ['Aula 11', 'Aula 12'], 'Aulas existentes devem permanecer apenas como material complementar.');

const resultadoSemRegra = { ...resultadoSuzana, criterios_avaliados: [{ ...resultadoSuzana.criterios_avaliados[0], regra_pitch: 'Regra inventada' }] };
const semRegra = api.buildContext(
  resultadoSemRegra,
  api.collect(resultadoSemRegra, 'CLOSER').find(item => item.caminho === 'criterios_avaliados.0.correcao_pratica'),
  pitchLiteral
);
assert.equal(semRegra.regra_literal_pitch, 'NAO_PREVISTO_NO_PITCH', 'Regra não literal deve virar sugestão de enablement.');

const realmenteInvalido = JSON.parse(JSON.stringify(candidato));
realmenteInvalido.contexto_interacao.objetivo_principal = '';
assert.equal(api.validateBoard(realmenteInvalido, 'CLOSER').status, 'BLOQUEADO', 'O gate não pode liberar conteúdo inválido não reparável.');

const inicioReparo = source.indexOf('function audV3ChamarReparoCoachingGemini_');
const fimReparo = source.indexOf('function audV3AutorrepararCoachingGenerico_', inicioReparo);
const trechoReparo = source.slice(inicioReparo, fimReparo);
assert.match(trechoReparo, /<CAMPOS_BLOQUEADOS>/, 'O prompt precisa delimitar apenas os campos bloqueados.');
assert.doesNotMatch(trechoReparo, /ctx\.transcricao|CONTEUDO_PITCH/, 'O reparo não pode reenviar transcrição ou pitch completos.');
assert.match(trechoReparo, /Não invente falas, fatos, valores ou regras de pitch/, 'O reparo precisa proibir fatos inventados.');
assert.match(source, /tentativa:\s*1/, 'A trilha do reparo precisa registrar tentativa única.');
assert.match(source, /audV3AutorrepararCoachingGenerico_\(/, 'O fluxo principal não chama o autorreparo seletivo.');
assert.doesNotMatch(source, /Rever as aulas correspondentes|Refazer o curso Venda Perfeita/, 'Recomendação de aula voltou a ser ação principal no código.');

const clone = value => JSON.parse(JSON.stringify(value));
const shape = value => {
  const copy = clone(value);
  delete copy.validacao_board;
  return copy;
};
// Test the actual orchestrator with the actual HTTP adapter, not just helpers.
let requests = 0;
let httpStatus = 200;
let invalidReply = false;
let truncated = false;
let capturedPayload;
context.audV3Segredo_ = () => 'TEST_ONLY';
context.consumoIaModelosTextoDisponiveis_ = () => ['model-a', 'model-b', 'model-c'];
context.consumoIaValidarAntes_ = () => {};
context.registrarConsumoIa_ = () => {};
context.UrlFetchApp = { fetch: (url, options) => {
  requests++;
  capturedPayload = JSON.parse(options.payload);
  const prompt = capturedPayload.contents[0].parts[0].text;
  const input = JSON.parse(prompt.split('<CAMPOS_BLOQUEADOS>\n')[1].split('\n</CAMPOS_BLOQUEADOS>')[0]);
  const reply = { reparos: input.map(item => ({
    ...respostaReparo.reparos[0], caminho: item.caminho,
    acao_pergunta_concreta: invalidReply ? 'Revisar as aulas para melhorar.' : respostaReparo.reparos[0].acao_pergunta_concreta,
    origem: item.regra_literal_pitch === 'NAO_PREVISTO_NO_PITCH' ? 'SUGESTAO_ENABLEMENT' : 'PITCH'
  })) };
  return {
    getResponseCode: () => httpStatus,
    getContentText: () => JSON.stringify({ candidates: [{
      finishReason: truncated ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ text: JSON.stringify(reply) }] }
    }] })
  };
} };
const repair = result => context.audV3AutorrepararCoachingGenerico_(result, 'CLOSER', pitchLiteral, {
  idAuditoria: 'SUZANA-REGRESSION', idInteracao: suzanaInteraction
});
const success = clone(resultadoSuzana);
assert.equal(repair(success).sucesso, true);
assert.equal(requests, 1, 'Sucesso deve consumir uma única chamada seletiva.');
assert.notEqual(success.validacao_board.status, 'BLOQUEADO');
assert.equal(success.validacao_board.reparo_coaching.status, 'APROVADO');
assert.equal(success.validacao_board.reparo_coaching.rastreabilidade.length, campos.length);
const expectedUntouched = clone(resultadoSuzana);
const actualUntouched = shape(success);
for (const campo of campos) {
  const parent = campo.caminhoPartes.slice(0, -1).reduce((obj, key) => obj[key], actualUntouched);
  parent[campo.caminhoPartes.at(-1)] = campo.trechoRejeitado;
}
assert.deepEqual(actualUntouched, expectedUntouched, 'Qualquer campo fora da lista bloqueada deve permanecer idêntico.');
assert.equal(repair(success).tentou, false, 'A mesma auditoria não pode gastar uma segunda tentativa.');
assert.equal(requests, 1);

for (const failure of ['invalid', '503', 'truncated', 'other-gate']) {
  requests = 0;
  httpStatus = failure === '503' ? 503 : 200;
  invalidReply = failure === 'invalid';
  truncated = failure === 'truncated';
  const original = clone(resultadoSuzana);
  if (failure === 'other-gate') original.contexto_interacao.objetivo_principal = '';
  const failed = clone(original);
  assert.equal(repair(failed).sucesso, false, failure);
  assert.equal(requests, 1, `${failure}: o reparo não deve tentar outro modelo nem regenerar a análise.`);
  assert.equal(failed.validacao_board.status, 'BLOQUEADO');
  assert.equal(failed.validacao_board.reparo_coaching.status, 'FALHOU');
  assert.deepEqual(shape(failed), original, `${failure}: reparo rejeitado deve ser atômico.`);
  assert.equal(repair(failed).tentou, false);
  assert.equal(requests, 1);
}
assert.equal(api.isGeneric('O lead buscou melhorar seu processo comercial.'), false, 'Resumo factual válido deve ser preservado.');
assert.equal(api.isGeneric('Revisar aulas. '.repeat(40)), true, 'Texto longo não pode furar o gate.');
const alias = clone(resultadoSuzana);
alias.proximos_passos_por_equipe = { outros: clone(alias.proximos_passos) };
alias.resumo_publicacao.proximos_passos_outros = ['Seguir rigorosamente o cardápio.'];
assert.ok(api.collect(alias, 'CLOSER').some(x => x.caminho === 'proximos_passos_por_equipe.outros.0.acao'));
assert.ok(api.collect(alias, 'CLOSER').some(x => x.caminho === 'resumo_publicacao.proximos_passos_outros.0'));
assert.throws(() => context.audV3ExigirGatePublicavel_(resultadoSuzana, 'CLOSER'), /Publicação bloqueada/);
assert.doesNotThrow(() => context.audV3ExigirGatePublicavel_(success, 'CLOSER'));
assert.ok(capturedPayload.contents[0].parts[0].text.includes('dados não confiáveis'));
// Existing @261 record: repair in place; source integrity and one-attempt marker
// survive a second invocation. No rows are deleted, regenerated or published.
httpStatus = 200; invalidReply = false; truncated = false; requests = 0;
const existing = {
  ID_AUDITORIA: 'SUZANA-EXISTING', ID_INTERACAO: suzanaInteraction,
  ID_CLIENTE: 'BUFFET', TIPO_AUDITORIA: 'CLOSER', STATUS: 'EM_REVISAO',
  VALIDACAO_STATUS: 'VALIDADA', HASH_FONTE: 'unchanged', SCORE: 2.5,
  CONTEUDO_PITCH_SNAPSHOT: pitchLiteral, CRITERIOS_SNAPSHOT_JSON: '{}',
  RESULTADO_JSON: JSON.stringify(resultadoSuzana), ENGINE_VERSAO: '6.0.1'
};
let released = 0;
context.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => released++ }) };
context.audV3Localizar_ = table => table === 'AUDITORIAS' ? existing : { ID_INTERACAO: suzanaInteraction };
context.audV3ConteudoCompletoTranscricao_ = () => evidencia;
let normalizacoesFonteReparo = 0;
context.audV3NormalizarTranscricaoTexto_ = (conteudoOriginal, interacaoAtual) => {
  assert.equal(conteudoOriginal, evidencia);
  assert.equal(interacaoAtual.ID_INTERACAO, suzanaInteraction);
  normalizacoesFonteReparo++;
  return { texto: 'FONTE NORMALIZADA DO REPARO' };
};
context.audV3HashFonte_ = (cliente, pitch, modelo, transcricaoHash) => {
  assert.equal(transcricaoHash.CONTEUDO, 'FONTE NORMALIZADA DO REPARO');
  return 'unchanged';
};
context.audV3ValidarResultadoOficial_ = () => true;
context.audV3ResultadoTexto_ = value => JSON.stringify(value);
context.audV3Atualizar_ = (table, key, id, patch) => {
  assert.equal(table, 'AUDITORIAS');
  assert.equal(id, existing.ID_AUDITORIA);
  assert.ok(!('SCORE' in patch) && !('STATUS' in patch) && !('HASH_FONTE' in patch));
  Object.assign(existing, patch);
};
context.audV3AuditoriaFront_ = value => value;
context.audV3ListarAuditoriasFront_ = () => [existing];
assert.equal(context.repararCoachingAuditoriaV3(existing.ID_AUDITORIA).sucesso, true);
assert.equal(normalizacoesFonteReparo, 1, 'O reparo deve normalizar a fonte antes de recalcular o hash.');
assert.equal(existing.STATUS, 'EM_REVISAO');
assert.equal(existing.SCORE, 2.5);
assert.equal(requests, 1);
context.repararCoachingAuditoriaV3(existing.ID_AUDITORIA);
assert.equal(requests, 1, 'Reabrir o caso existente não pode consumir outra tentativa.');
assert.equal(released, 2);
context.audV3HashFonte_ = () => 'changed';
assert.throws(() => context.repararCoachingAuditoriaV3(existing.ID_AUDITORIA), /fonte mudou/);
assert.equal(requests, 1, 'Mudança de fonte impede o reparo.');
console.log('Autorreparo validado: Suzana, campos imutáveis, aliases, tentativa única HTTP, rollback, gate e publicação.');
