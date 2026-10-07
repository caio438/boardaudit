import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const context = { console, Date, JSON, Math, Number, String, Array, Object, Error, isFinite, Utilities: { formatDate: value => String(value) } };
vm.createContext(context);
vm.runInContext(source + `
  this.api = {
    criteria: audV3CriteriosCloser_,
    catalog: audV3CatalogoSubcriteriosCloser_,
    reconcile: audV3ReconciliarInteligenciaCanonicaCloser_,
    validate: audV3ValidarCoerenciaCanonicaCloser_,
    derive: audV3DerivarSuperficiesExecutivasCloser_,
    dateFromTranscript: audV3DataDeclaradaTranscricaoCloser_,
    durationFromTranscript: audV3DuracaoDeclaradaTranscricaoCloser_
  };
`, context);

const transcript = [
  'set. 30, 2026 Sinergia & Zuni Manutenção - Transcrição',
  '00:00:00 Jéssica Paulo: Quero entender a licença, o cenário e o processo atual.',
  '00:04:10 Carolline Marini: A licença está vencida há mais de um ano.',
  '00:12:20 Jéssica Paulo: Vamos preparar uma proposta para regularizar a licença.',
  '00:21:05 Jéssica Paulo: Ficou para sexta-feira, dia 2, às 16:30.',
  'A reunião foi encerrada após 00:22:40.'
].join('\n');
const pitch = 'Pergunte o impacto financeiro. Depois pergunte: de zero a dez, o quanto a solução resolve seu problema?';
const criterios = context.api.criteria();
const status = {
  contexto_agenda: 'PARCIAL', motivacao: 'ATINGIDO', dor_principal: 'ATINGIDO', processo_atual: 'ATINGIDO', decisao_autoridade: 'ATINGIDO',
  impacto_operacional: 'ATINGIDO', impacto_financeiro: 'ATINGIDO', impacto_inacao: 'PARCIAL', urgencia_prioridade: 'ATINGIDO',
  conexao_solucao_dor: 'ATINGIDO', personalizacao: 'ATINGIDO', validacao_entendimento: 'ATINGIDO',
  fit_percebido: 'ATINGIDO', validacao_objetiva: 'ATINGIDO', percepcao_valor: 'PARCIAL',
  objecoes: 'NAO_APLICAVEL', condicao_avanco: 'ATINGIDO', proximo_passo: 'ATINGIDO', data_hora: 'ATINGIDO', responsavel: 'ATINGIDO'
};
const resultado = {
  contexto_interacao: { classificacao: 'PRIMEIRA_REUNIAO' },
  criterios_avaliados: criterios.dimensoes.map(item => ({
    id: item.id, nome: item.nome, aplicavel: true, status: 'CONFORME', pontuacao: 5,
    o_que_foi_dito: 'Evidência literal.', divergencia: '', justificativa_nota: 'Conforme.'
  })),
  momentos: criterios.momentos.map(item => ({ id: item.id, nome: item.nome, cor: 'VERDE', status: 'VERDE', nota: 5, gatilho_alcancado: true })),
  subcriterios: context.api.catalog().map(item => ({ ...item, status: status[item.id], aplicavel: status[item.id] !== 'NAO_APLICAVEL', evidencia: 'Evidência', analise: 'Análise' })),
  mapa_oportunidade: { impacto_financeiro: 'Alto', decisor: 'Carolline Marini' },
  proximos_passos: []
};

context.api.reconcile(resultado, transcript, pitch);
context.api.validate(resultado);
context.api.derive(resultado);

assert.equal(context.api.dateFromTranscript(transcript).iso, '2026-09-30');
assert.equal(context.api.durationFromTranscript(transcript), 1360);
assert.equal(resultado.metadados.data_hora, '30/09/2026');
assert.equal(resultado.duracao.segundos, 1360);
assert.equal(resultado.mapa_oportunidade.impacto_financeiro, 'Não quantificado na reunião.');
assert.equal(resultado.mapa_oportunidade.decisor, 'Não confirmado na reunião.');
assert.equal(resultado.subcriterios.find(item => item.id === 'impacto_financeiro').status, 'NAO_EXECUTADO');
assert.equal(resultado.subcriterios.find(item => item.id === 'validacao_objetiva').status, 'NAO_EXECUTADO');
assert.equal(resultado.pontuacao_calculada.score_5, 3.7);
assert.equal(resultado.momentos.find(item => item.id === 'momento_1').nota, 4);
assert.equal(resultado.momentos.find(item => item.id === 'momento_2').nota, 3.5);
assert.equal(resultado.semaforo_geral.cor, 'AMARELO');
assert.equal(resultado.score_schema_versao, '6.1');
assert.ok(resultado.proximos_passos.some(item => /impacto financeiro/i.test(item.acao)));
assert.ok(resultado.proximos_passos.some(item => /quem decide/i.test(item.acao)));
assert.ok(resultado.proximos_passos.some(item => /validação objetiva/i.test(item.acao)));

console.log('Inteligência canônica do Closer validada: fonte, 20 subcritérios, score, mapa e ações permanecem coerentes.');
