import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const Utilities = { formatDate: data => new Date(data).toISOString() };
const context = { console, Date, JSON, Math, Number, String, Array, Object, Error, isFinite, Utilities };
vm.createContext(context);
vm.runInContext(source + '\nthis.api={criteria:audV3CriteriosCloser_,normalize:audV3NormalizarResultado_,schema:audV3SchemaResposta_,apiSchema:audV3SchemaRespostaApi_,documentText:audV3TextoDocumento_};', context);

const criterios = context.api.criteria();
const momentos = criterios.momentos.map((item, index) => ({
  id: item.id,
  nome: item.nome,
  status: index === 2 ? 'VERMELHO' : 'VERDE',
  gatilho_alcancado: index !== 2,
  o_que_se_espera: item.objetivo,
  o_que_foi_dito: 'Evidência objetiva da transcrição.',
  divergencia: index === 2 ? 'A solução não foi conectada ao impacto declarado.' : 'Não houve divergência.',
  justificativa_nota: index === 2 ? 'Gatilho não alcançado.' : 'Gatilho alcançado sem desvio relevante.',
  pontos_fortes: ['Boa condução'],
  pontos_melhorar: index === 2 ? ['Não confirmou o próximo passo'] : [],
  o_que_fazer: 'Aplicar o comportamento esperado.',
  texto_script: 'Exemplo recomendado.',
  como_agir: 'Confirmar e registrar.',
  aulas_revisar: [],
  timestamp_inicio: ['00:00', '03:00', '17:00', '46:00'][index],
  timestamp_fim: ['03:00', '17:00', '46:00', '1:03:50'][index]
}));
const criteriosAvaliados = criterios.dimensoes.map(item => ({
  id: item.id,
  nome: item.nome,
  aplicavel: true,
  status: 'CONFORME',
  o_que_foi_dito: 'Evidência objetiva da transcrição.',
  regra_pitch: 'Comportamento obrigatório descrito no pitch.',
  divergencia: 'Não houve divergência.',
  correcao_pratica: 'Manter a execução.',
  pontuacao: 4.5,
  justificativa_nota: 'Execução consistente e aderente.'
}));
const checklist = criterios.checklist.map(item => ({ item, resultado: 'SIM', observacao: 'Evidenciado.' }));
const resultado = context.api.normalize(
  { momentos, criterios_avaliados: criteriosAvaliados, checklist, semaforo_geral: { justificativa: 'Um gatilho não alcançado.' } },
  criterios,
  { empresa: 'Cliente', sdr: 'Closer Teste', lead: 'Lead', empresaArquivo: '', numeroChamada: '' },
  { DATA_INTERACAO: new Date('2026-08-03T12:00:00Z'), DURACAO_SEGUNDOS: 3830 },
  { NOME_VERSAO: 'Pitch Closer', NUMERO_VERSAO: '1' },
  'CLOSER'
);

if (resultado.momentos.length !== 4) throw new Error('Quantidade de momentos inválida.');
if (resultado.semaforo !== 'AMARELO') throw new Error('Semáforo deveria ser AMARELO.');
if (resultado.pontuacao_calculada.score_5 !== 4.5) throw new Error('Score calculado incorretamente.');
if (resultado.checklist.length !== criterios.checklist.length) throw new Error('Checklist derivado incompleto.');
if (resultado.metadados.closer !== 'Closer Teste') throw new Error('Closer não identificado.');
if (!resultado.analise_temporal.mensuravel) throw new Error('Timestamps válidos deveriam produzir análise temporal completa.');
if (resultado.analise_temporal.duracao_total !== '63 min 50 s') throw new Error('Duração total da reunião não foi normalizada.');
if (resultado.analise_temporal.diagnostico.duracao_minutos !== 17) throw new Error('Duração do diagnóstico calculada incorretamente.');
if (resultado.analise_temporal.fechamento.inicio !== '46:00') throw new Error('Timestamp do fechamento não foi preservado.');

const criteriosContraditorios = JSON.parse(JSON.stringify(criteriosAvaliados));
criteriosContraditorios[0].divergencia = 'A pergunta obrigatória não foi feita.';
let contradicaoRejeitada = false;
try {
  context.api.normalize(
    { momentos: JSON.parse(JSON.stringify(momentos)), criterios_avaliados: criteriosContraditorios, checklist: JSON.parse(JSON.stringify(checklist)) },
    criterios,
    { empresa: 'Cliente', sdr: 'Closer Teste', lead: 'Lead' },
    { DATA_INTERACAO: new Date('2026-08-03T12:00:00Z'), DURACAO_SEGUNDOS: 3830 },
    { NOME_VERSAO: 'Pitch Closer', NUMERO_VERSAO: '1' },
    'CLOSER'
  );
} catch (erro) {
  contradicaoRejeitada = /contradiz esse status/.test(String(erro.message || erro));
}
if (!contradicaoRejeitada) throw new Error('Uma nota CONFORME com divergência deveria ser rejeitada.');

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
if (!source.includes("if (tipo === 'PLANO') generationConfig.responseSchema")) {
  throw new Error('SDR ou Closer ainda podem receber o responseSchema complexo recusado pelo Gemini.');
}
const inicioChamada = source.indexOf('function audV3ChamarGemini_');
const inicioPrompt = source.indexOf('function audV3MontarPrompt_', inicioChamada);
const trechoChamada = source.slice(inicioChamada, inicioPrompt);
if (!trechoChamada.includes('const generationConfig') || !trechoChamada.includes('generationConfig: generationConfig')) {
  throw new Error('A configuração condicional não está dentro da chamada de auditoria.');
}
const trechoFormalizacao = source.slice(source.indexOf('function formalChamarGemini_'), source.indexOf('function formalMontarPrompt_'));
if (trechoFormalizacao.includes("tipo === 'PLANO'")) {
  throw new Error('A configuração Closer vazou para a formalização.');
}
if (!source.includes('<SCHEMA_SAIDA_OBRIGATORIO>')) {
  throw new Error('O contrato JSON Closer não foi preservado no prompt.');
}
if (context.api.documentText('', 'Não evidenciado.') !== 'Não evidenciado.') {
  throw new Error('Campo vazio ainda pode quebrar a geração do Google Docs.');
}
if (context.api.documentText('', '') !== '') {
  throw new Error('A normalização de itens vazios das listas está incorreta.');
}
if (!source.includes("linha.map(valor => audV3TextoDocumento_(valor, 'Não evidenciado.'))")) {
  throw new Error('As células vazias das tabelas não estão protegidas para o Google Docs.');
}

console.log(`Teste Closer válido: schema da API reduzido de ${schemaCompleto.required.length} para ${schemaApi.required.length} blocos obrigatórios, mantendo análise e normalização final.`);
