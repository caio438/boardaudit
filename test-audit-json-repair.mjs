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
  Utilities: { formatDate: value => new Date(value).toISOString() }
};
vm.createContext(context);
vm.runInContext(source + `
this.auditJsonApi = {
  parse: audV3ParseJsonRespostaSegura_,
  code: audV3CodigoErroTecnico_,
  describe: audV3DescreverErroTecnico_,
  operatorMessage: audV3MensagemErroOperador_
};`, context);

const api = context.auditJsonApi;
const suzanaInteraction = 'TLDV_6aabd63fa6d95700137fadea';

const fenced = `\n\`\`\`json\n{"interacao_id":"${suzanaInteraction}","tipo":"CLOSER"}\n\`\`\`\n`;
assert.equal(api.parse(fenced).interacao_id, suzanaInteraction, 'Caso Suzana: cercas Markdown precisam ser removidas com segurança.');

const withProse = `Relatório solicitado:\n{"interacao_id":"${suzanaInteraction}","tipo":"CLOSER"}\nFim.`;
assert.equal(api.parse(withProse).tipo, 'CLOSER', 'Texto externo ao primeiro objeto completo não pode invalidar o JSON.');

assert.throws(
  () => api.parse(`{"interacao_id":"${suzanaInteraction}","tipo":"CLOSER",}`),
  error => api.code(error) === 'JSON_INVALIDO' && /sintaxe inválida/.test(error.message),
  'Caso Suzana: JSON completo com vírgula final precisa seguir para reparo sintático controlado.'
);

assert.throws(
  () => api.parse(`{"interacao_id":"${suzanaInteraction}","tipo":"CLOSER","momentos":[`),
  error => api.code(error) === 'RESPOSTA_TRUNCADA' && /Caracteres recebidos/.test(error.message),
  'Caso Suzana: JSON cortado precisa ser classificado como truncamento, não como erro genérico.'
);

assert.equal(api.code(new Error('finishReason=MAX_TOKENS')), 'RESPOSTA_MAX_TOKENS');
assert.equal(api.code(new Error('O critério x está associado ao locutor errado.')), 'VALIDACAO_LOCUTOR');
assert.equal(api.code(new Error('regra que não foi localizada literalmente no pitch oficial.')), 'VALIDACAO_REGRA_PITCH');
assert.equal(api.code(new Error('score oficial inválido.')), 'VALIDACAO_SCORE_STATUS');
assert.equal(api.code(new Error('não contém todas as dimensões oficiais.')), 'VALIDACAO_SCHEMA');

const operatorMaxTokens = api.operatorMessage('RESPOSTA_MAX_TOKENS: O Gemini encerrou a resposta por MAX_TOKENS.');
assert.match(operatorMaxTokens, /^RESPOSTA_MAX_TOKENS:/, 'O Board precisa exibir o código técnico ao operador.');
assert.match(operatorMaxTokens, /MAX_TOKENS/, 'O Board não pode mascarar finishReason=MAX_TOKENS.');
assert.doesNotMatch(operatorMaxTokens, /A geração não foi concluída/, 'A mensagem genérica antiga não pode voltar.');

const startRepair = source.indexOf('function audV3RepararJsonComGemini_');
const startCall = source.indexOf('function audV3ChamarGemini_', startRepair);
const repairSource = source.slice(startRepair, startCall);
assert.ok(startRepair >= 0 && startCall > startRepair, 'A rotina de reparo JSON não foi localizada.');
assert.match(repairSource, /<JSON_COM_DEFEITO>/, 'O segundo passe precisa receber o JSON defeituoso.');
assert.match(repairSource, /<ERRO_PARSE>/, 'O segundo passe precisa receber o erro exato de parse.');
assert.match(repairSource, /Não invente fatos, falas, evidências, regras de pitch, notas ou recomendações/, 'O reparo precisa proibir conteúdo inventado.');
assert.doesNotMatch(repairSource, /ctx\.transcricao|audV3MontarPrompt_/, 'O reparo sintático não pode reenviar a transcrição inteira.');

const callSource = source.slice(startCall, source.indexOf('function audV3MontarPrompt_', startCall));
assert.match(callSource, /candidato\.finishReason/, 'A chamada precisa inspecionar finishReason explicitamente.');
assert.match(callSource, /finishReason === 'MAX_TOKENS'/, 'MAX_TOKENS precisa ter tratamento dedicado.');
assert.match(callSource, /audV3ParseJsonRespostaSegura_\(texto\)/, 'A resposta não pode usar JSON.parse puro.');
assert.match(callSource, /audV3RepararJsonComGemini_/, 'JSON sintaticamente inválido precisa acionar reparo controlado.');

for (const legacyFixture of ['WISETEC-ERRO', 'WISETEC-OK', 'STEC-90', 'STEC-91', 'STEC-92']) {
  assert.ok(
    fs.readFileSync(new URL('./test-auditoria-v5.mjs', import.meta.url), 'utf8').includes(legacyFixture),
    `Regressão operacional existente ausente: ${legacyFixture}.`
  );
}

console.log('Reparo JSON validado: Suzana, MAX_TOKENS e regressões Wisetec/Hitecnet.');
