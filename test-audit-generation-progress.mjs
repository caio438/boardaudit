import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const front = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');
const values = new Map();
const CacheService = {
  getScriptCache: () => ({
    put: (key, value) => values.set(key, value),
    get: key => values.get(key) || null
  })
};
const context = { console, Date, JSON, Math, Number, String, Array, Object, Error, isFinite, CacheService };
vm.createContext(context);
vm.runInContext(audit + '\nthis.progressApi={update:audV3AtualizarProgressoGeracao_,read:obterProgressoAuditoriaV3};', context);

context.progressApi.update('AUD-test_1', 'VALIDANDO', 72, 'Validando o resultado', 'Conferindo evidências.');
const progresso = context.progressApi.read('AUD-test_1');
assert.equal(progresso.encontrado, true);
assert.equal(progresso.etapa, 'VALIDANDO');
assert.equal(progresso.percentual, 72);
assert.equal(progresso.mensagem, 'Validando o resultado');
assert.equal(context.progressApi.read('inexistente').encontrado, false);

assert.match(front, /function criarAcompanhamentoGeracaoAuditoria_/);
assert.match(front, /setInterval\(consultar, 2500\)/, 'Polling deve ser leve e ocorrer somente durante a geração.');
assert.match(front, /Esta etapa está levando mais tempo, mas o Board continua acompanhando/);
assert.match(front, /role="progressbar"/);
assert.match(front, /idProgresso: idProgresso/);

const inicio = front.indexOf('function criarAcompanhamentoGeracaoAuditoria_');
const fim = front.indexOf('function renderizarContextoAuditoriaFront_', inicio);
const acompanhamento = front.slice(inicio, fim);
assert.ok(!/enviando ao rd|publicando no rd/i.test(acompanhamento), 'A barra da geração não pode incluir publicação no RD.');
assert.match(audit, /'PREPARANDO', 22/);
assert.match(audit, /'ANALISANDO', 38/);
assert.match(audit, /'VALIDANDO', 72/);
assert.match(audit, /'FINALIZANDO', 90/);
assert.match(audit, /'CONCLUIDA', 100/);
assert.match(audit, /'ERRO', 100/);

console.log('Barra de geração validada: cache leve, etapas reais, aviso de demora e RD fora do acompanhamento.');
