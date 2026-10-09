import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const context = {
  console, Date, JSON, Math, Number, String, Array, Object, Error, isFinite,
  Utilities: { formatDate: value => new Date(value).toISOString().slice(0, 10) }
};
vm.createContext(context);
vm.runInContext(source + '\nthis.performanceApi={load:carregarAnaliticaAuditoriasV3};', context);

const scores = [3, 3.5, 4, 4.2, 4.4, 4.6, 4.8];
const audits = scores.map((score, index) => ({
  ID_AUDITORIA: `AUD-${index + 1}`,
  ID_CLIENTE: 'CLI-1',
  ID_INTERACAO: `INT-${index + 1}`,
  TIPO_AUDITORIA: 'CLOSER',
  CONCLUIDO_EM: new Date(`2026-10-01T1${index}:00:00-03:00`),
  SCORE: score,
  RESULTADO_JSON: JSON.stringify({ metadados: { closer: 'Closer Teste' }, momentos: [] }),
  SCORES_SUBCRITERIOS_JSON: JSON.stringify([
    { id: 'impacto', nome: 'Impacto financeiro', dimensao_id: 'dor', status: index < 2 ? 'CONFORME' : 'DESVIO_EXECUCAO', nota: index < 2 ? 5 : 2.5 },
    { id: 'proximo', nome: 'Próximo passo', dimensao_id: 'fechamento', status: index < 4 ? 'CONFORME' : 'DESVIO_EXECUCAO', nota: index < 4 ? 5 : 2.5 }
  ])
}));
const interactions = scores.map((_, index) => ({ ID_INTERACAO: `INT-${index + 1}`, COLABORADOR: 'Closer Teste' }));

context.audV3FiltrarAuditoriasVisiveisOperacao_ = items => items;
context.audV3Ler_ = table => ({
  CLIENTES: [{ ID_CLIENTE: 'CLI-1', NOME_CLIENTE: 'Cliente Teste' }],
  INTERACOES: interactions,
  AUDITORIAS: audits
}[table] || []);

const result = context.performanceApi.load({ tipoAuditoria: 'CLOSER', dias: 90 });
assert.equal(result.resumo.auditorias, 7);
assert.equal(result.resumo.mediaScore, 4.1);
assert.equal(result.resumo.medianaScore, 4.2);
assert.equal(result.resumo.notasQuatroOuMais, 5);
assert.equal(result.resumo.taxaQuatroOuMais, 71.4);
assert.equal(result.resumo.mediaRecente, 4.6);
assert.equal(result.resumo.mediaAnterior, 3.9);
assert.equal(result.resumo.tendenciaRecente, 0.7);
assert.equal(result.resumo.baseSuficiente, true);
assert.equal(result.linhaTempo.length, 1, 'A agregação diária deve continuar disponível.');
assert.equal(result.serieAuditorias.length, 7, 'O gráfico executivo não pode colapsar auditorias do mesmo dia em um único ponto.');
assert.equal(result.comportamentos[0].id, 'impacto');
assert.equal(result.comportamentos[0].desvios, 5);

const html = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');
assert.match(html, /Notas ≥ 4\/5/);
assert.match(html, /Média das últimas 3/);
assert.match(html, /Últimas 3 versus até 3 anteriores/);
assert.match(html, /Principais lacunas de execução/);
assert.match(html, /dados\.serieAuditorias/);
assert.match(html, /volumeRd\.style\.display = 'none'/);

console.log('Painel executivo de performance validado com tendência robusta, recorrência e série por auditoria.');
