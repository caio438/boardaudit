import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const Utilities = { formatDate: data => new Date(data).toISOString() };
const context = { console, Date, JSON, Math, Number, String, Array, Object, Error, isFinite, Utilities };
vm.createContext(context);
vm.runInContext(source + '\nthis.api={criteria:audV3CriteriosCloser_,normalize:audV3NormalizarResultado_,schema:audV3SchemaResposta_,apiSchema:audV3SchemaRespostaApi_};', context);

const criterios = context.api.criteria();
const momentos = criterios.momentos.map((item, index) => ({
  id: item.id,
  nome: item.nome,
  status: index === 2 ? 'VERMELHO' : 'VERDE',
  gatilho_alcancado: index !== 2,
  o_que_se_espera: item.objetivo,
  o_que_foi_dito: 'Evidência objetiva da transcrição.',
  pontos_fortes: ['Boa condução'],
  pontos_melhorar: index === 2 ? ['Não confirmou o próximo passo'] : [],
  o_que_fazer: 'Aplicar o comportamento esperado.',
  texto_script: 'Exemplo recomendado.',
  como_agir: 'Confirmar e registrar.',
  aulas_revisar: []
}));
const pontuacao = criterios.dimensoes.map(item => ({
  id: item.id,
  nome: item.nome,
  aplicavel: true,
  pontuacao: 4.5,
  observacao: 'Execução consistente.'
}));
const checklist = criterios.checklist.map(item => ({ item, resultado: 'SIM', observacao: 'Evidenciado.' }));
const resultado = context.api.normalize(
  { momentos, pontuacao, checklist, semaforo_geral: { justificativa: 'Um gatilho não alcançado.' } },
  criterios,
  { empresa: 'Cliente', sdr: 'Closer Teste', lead: 'Lead', empresaArquivo: '', numeroChamada: '' },
  { DATA_INTERACAO: new Date('2026-08-03T12:00:00Z') },
  { NOME_VERSAO: 'Pitch Closer', NUMERO_VERSAO: '1' },
  'CLOSER'
);

if (resultado.momentos.length !== 4) throw new Error('Quantidade de momentos inválida.');
if (resultado.semaforo !== 'AMARELO') throw new Error('Semáforo deveria ser AMARELO.');
if (resultado.pontuacao_calculada.score_5 !== 4.5) throw new Error('Score calculado incorretamente.');
if (resultado.checklist.length !== criterios.checklist.length) throw new Error('Checklist derivado incompleto.');
if (resultado.metadados.closer !== 'Closer Teste') throw new Error('Closer não identificado.');

const schemaCompleto = context.api.schema('CLOSER');
const schemaApi = context.api.apiSchema('CLOSER');
if (!schemaCompleto.properties.semaforo_geral) throw new Error('Schema final Closer perdeu campos derivados.');
if (schemaApi.properties.semaforo_geral) throw new Error('Schema enviado à API ainda contém campo derivado.');
if (!schemaApi.properties.momentos || !schemaApi.properties.analise_impacto_implicacao) {
  throw new Error('Schema compacto perdeu campos analíticos essenciais.');
}
if (schemaApi.required.length >= schemaCompleto.required.length) {
  throw new Error('Schema Closer enviado à API não foi efetivamente simplificado.');
}
if (!context.api.schema('SDR').properties.aderencia_script) throw new Error('Schema SDR foi afetado.');
if (!source.includes("if (tipo !== 'CLOSER') generationConfig.responseSchema")) {
  throw new Error('O Closer ainda tenta enviar o responseSchema recusado pelo Gemini.');
}
const inicioChamada = source.indexOf('function audV3ChamarGemini_');
const inicioPrompt = source.indexOf('function audV3MontarPrompt_', inicioChamada);
const trechoChamada = source.slice(inicioChamada, inicioPrompt);
if (!trechoChamada.includes('const generationConfig') || !trechoChamada.includes('generationConfig: generationConfig')) {
  throw new Error('A configuração condicional não está dentro da chamada de auditoria.');
}
const trechoFormalizacao = source.slice(source.indexOf('function formalChamarGemini_'), source.indexOf('function formalMontarPrompt_'));
if (trechoFormalizacao.includes("tipo !== 'CLOSER'")) {
  throw new Error('A configuração Closer vazou para a formalização.');
}
if (!source.includes('<SCHEMA_SAIDA_OBRIGATORIO>')) {
  throw new Error('O contrato JSON Closer não foi preservado no prompt.');
}

console.log(`Teste Closer válido: schema da API reduzido de ${schemaCompleto.required.length} para ${schemaApi.required.length} blocos obrigatórios, mantendo análise e normalização final.`);
