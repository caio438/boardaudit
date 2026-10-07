import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const rd = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');
const context = { console, Date, JSON, Math, Number, String, Array, Object, Error, isFinite };
vm.createContext(context);
vm.runInContext(source + `
this.api = {
  criterios: audV3CriteriosCloser_,
  catalogo: audV3CatalogoSubcriteriosCloser_,
  normalizarSubcriterios: audV3NormalizarSubcriteriosCloser_,
  normalizarMapa: audV3NormalizarMapaOportunidadeCloser_,
  completarMercado: audV3CompletarInteligenciaMercadoCloser_,
  validarSubcriterios: audV3ValidarSubcriteriosCloser_,
  schema: audV3SchemaRespostaCloser_,
  analiticaLegada: audV3AnaliticaSubcriterios_
};`, context);

assert.deepEqual(
  Array.from(context.api.criterios().dimensoes).map(item => item.id),
  ['aderencia_diagnostico', 'exploracao_dor_impacto', 'demonstracao_solucao', 'validacao_interesse', 'tratamento_objecoes'],
  'As cinco dimensões oficiais e seus IDs não podem mudar.'
);

const ids = Array.from(context.api.catalogo()).map(item => item.id);
assert.equal(ids.length, 20, 'O catálogo Closer deve possuir exatamente 20 subcritérios canônicos.');
assert.equal(new Set(ids).size, 20, 'IDs de subcritérios devem ser únicos.');

const parcial = { subcriterios: [{ id: 'impacto_financeiro', status: 'DESVIO_EXECUCAO', aplicavel: true, evidencia: 'Trecho literal', analise: 'Exploração parcial.' }] };
context.api.normalizarSubcriterios(parcial);
assert.deepEqual(Array.from(parcial.subcriterios).map(item => item.id), ids, 'A normalização deve sempre materializar o catálogo na ordem canônica.');
assert.equal(parcial.subcriterios.find(item => item.id === 'impacto_financeiro').status, 'PARCIAL');
assert.equal(parcial.subcriterios.find(item => item.id === 'contexto_agenda').status, 'NAO_EVIDENCIADO');
assert.doesNotThrow(() => context.api.validarSubcriterios(parcial));

const mapa = {};
context.api.normalizarMapa(mapa);
assert.equal(Object.keys(mapa.mapa_oportunidade).length, 12, 'O mapa da oportunidade deve manter os 12 campos oficiais.');
assert.ok(Object.values(mapa.mapa_oportunidade).every(valor => valor === 'Não evidenciado'), 'Campos sem fonte devem permanecer explicitamente não evidenciados.');

const mercadoVazio = {
  resumo_reuniao: {
    cenario_atual: 'A equipe controla o processo em planilhas separadas.',
    dor_principal: 'Retrabalho para consolidar informações.',
    impacto_principal: 'O fechamento demora e há perda de visibilidade.',
    objetivo_lead: 'Centralizar o processo em uma única operação.'
  },
  mapa_oportunidade: {
    dor_principal: 'Retrabalho para consolidar informações.',
    impacto_operacional: 'Mais tempo gasto em conferências manuais.',
    impacto_financeiro: 'Não evidenciado',
    impacto_nao_avancar: 'Manutenção do retrabalho atual.',
    ganhos_esperados: 'Ganhar visibilidade e reduzir tarefas manuais.'
  },
  perguntas_diagnostico: {
    perguntas_realizadas: [
      { resposta_lead: 'Hoje a gente usa várias planilhas e perde muito tempo conferindo tudo.' },
      { resposta_lead: 'O ideal seria centralizar para o time enxergar tudo em um lugar só.' }
    ]
  },
  objecoes_respostas: [],
  analise_impacto_implicacao: { impactos_identificados: ['Atraso na consolidação das informações.'] },
  inteligencia_mercado: {
    dores: [], desafios: [], impactos_consequencias: [], ferramentas_processos_atuais: [],
    resultados_desejados: [], linguagem_do_lead: [], insights_para_midia: []
  }
};
context.api.completarMercado(mercadoVazio);
assert.ok(mercadoVazio.inteligencia_mercado.desafios.length > 0, 'Desafios não podem permanecer vazios quando a dor já foi extraída.');
assert.ok(mercadoVazio.inteligencia_mercado.impactos_consequencias.length > 0, 'Impactos não podem permanecer vazios quando o impacto já foi extraído.');
assert.ok(mercadoVazio.inteligencia_mercado.ferramentas_processos_atuais.length > 0, 'Processo atual não pode permanecer vazio quando o cenário atual já foi extraído.');
assert.ok(mercadoVazio.inteligencia_mercado.resultados_desejados.length > 0, 'Resultados desejados não podem permanecer vazios quando o objetivo do lead já foi extraído.');
assert.ok(mercadoVazio.inteligencia_mercado.linguagem_do_lead.length > 0, 'Linguagem do lead deve reaproveitar respostas já estruturadas da reunião.');
assert.ok(mercadoVazio.inteligencia_mercado.insights_para_midia.length > 0, 'Hipóteses de mídia devem ser criadas somente a partir dos temas já evidenciados.');

const mercadoSemFonte = { inteligencia_mercado: {} };
context.api.completarMercado(mercadoSemFonte);
assert.deepEqual(Array.from(mercadoSemFonte.inteligencia_mercado.desafios), [], 'Sem fonte não deve haver desafio inventado.');
assert.deepEqual(Array.from(mercadoSemFonte.inteligencia_mercado.linguagem_do_lead), [], 'Sem fonte não deve haver fala inventada.');

assert.match(source, /audV3AuditoriaFront_\(a, contexto\)[\s\S]*?audV3CompletarInteligenciaMercadoCloser_\(resultado\)/, 'Auditorias antigas precisam receber o fallback de inteligência de mercado ao serem abertas no Board.');

const schema = context.api.schema();
assert.equal(schema.properties.subcriterios.minItems, 20);
assert.ok(schema.properties.mapa_oportunidade.required.includes('impacto_financeiro'));
assert.deepEqual(Array.from(context.api.analiticaLegada({ SCORE_SCHEMA_VERSAO: '5.0' }, {})), [], 'Auditorias antigas não podem ganhar subcritérios retroativos inventados.');

for (const coluna of ['SCORES_SUBCRITERIOS_JSON', 'MAPA_OPORTUNIDADE_JSON']) assert.ok(source.includes("'" + coluna + "'"), 'Coluna ausente: ' + coluna);
assert.match(source, /SCORE_SCHEMA_VERSAO:\s*tipo === 'CLOSER' \? '6\.1'/);
assert.match(rd, /audRdTextoCloserCanonico_/);
assert.match(rd, /Auditoria completa:/);
assert.match(rd, /só pode ser publicada no RD após a criação do Google Doc completo/);
assert.match(rd, /audRdSanitizarTextoPublico_/);

console.log('Schema Closer 6.0 validado: dimensões preservadas, 20 subcritérios, mapa factual, legado compatível e gate de publicação com Google Doc.');
