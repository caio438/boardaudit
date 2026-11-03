import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('./VolumBuffetCloserBridge.gs', import.meta.url), 'utf8');
const context = {
  Object, String, Array, Boolean, Number, JSON, Date, RegExp, Math,
  viWidgetExigirEmail_(email) { if (email !== 'crm@govolum.com') throw Error('DENIED'); },
  viWidgetEmailSessao_() { return 'crm@govolum.com'; },
  obterIntegracaoCliente_() { return { ATIVO: 'SIM', ID_INTEGRACAO: 'INTG-BUFFET' }; },
  obterSegredo_(key) { return key === 'INTEGRACAO_TOKEN_INTG-BUFFET' ? 'PRIVATE_TOKEN' : ''; },
  viLeadDataIso_(s) { return String(s || ''); },
  viLeadReferenciaGravacao_(s) { return /tldv\.io/.test(String(s || '')); },
  viLeadPaginar_() { return { itens: [], completo: true, ignoradosOutroLead: 0 }; },
  viLeadTarefas_() { return []; },
  viLeadInteracoesBoard_() { return []; },
  viLeadArquivosRd_() { throw Error('missing v2 OAuth'); },
  lerObjetos_() { return []; },
  APP: { sheets: { interacoes: 'INTERACOES' }, spreadsheetId: 'SHEET_ID' }
};
vm.createContext(context);
vm.runInContext(code, context);

const eligible = {
  id: '6ad966bd481fb30001fd1563',
  name: 'Espaço Havilá',
  user: { id: '69eead1427862e0018e09a24', name: 'Vinícius Cordeiro' },
  deal_pipeline: { id: '5f0f9bb808c0c723ae8d12a6' },
  deal_stage: { id: '5d3f5e31019fdc000f24043a', name: 'REUNIÃO' },
  win: null, amount_total: 1800, updated_at: '2026-11-03T11:39:07-03:00'
};
assert.equal(context.vmBmCloserElegivel_(eligible), true);
assert.equal(context.vmBmCloserElegivel_({...eligible, win: true}), false);
assert.equal(context.vmBmCloserElegivel_({...eligible, win: false}), false);
assert.equal(context.vmBmCloserElegivel_({...eligible, user: {id: 'WRONG'}}), false);
assert.equal(context.vmBmCloserElegivel_({...eligible, deal_stage: {id: 'WRONG'}}), false);
assert.equal(context.vmBmCloserElegivel_({...eligible, deal_pipeline: {id: 'WRONG'}}), false);
assert.equal(context.vmBmCloserElegivel_({...eligible, hold: true}), false);
assert.equal(context.vmBmCloserElegivel_({...eligible, closed_at: '2026-10-01'}), false);
assert.match(context.vmBmCloserTexto_('teste https://tldv.io/secret?token=sensitive', 100), /LINK_OMITIDO/);
assert.equal(context.vmBmCloserToken_().token, 'PRIVATE_TOKEN');

let calls = [];
context.viLeadRdGet_ = (token, endpoint, params) => {
  assert.equal(token, 'PRIVATE_TOKEN');
  calls.push({endpoint, params});
  if (endpoint === '/deals') return {deals: [{id: eligible.id}], has_more: false};
  if (endpoint === '/deals/' + eligible.id) return {deal: eligible};
  throw Error('unexpected endpoint');
};
const ids = context.vmBmCloserListarIds_('PRIVATE_TOKEN');
assert.deepEqual(Array.from(ids), [eligible.id]);
assert.equal(calls[0].params.user_id, '69eead1427862e0018e09a24');
assert.equal(calls[0].params.deal_pipeline_id, '5f0f9bb808c0c723ae8d12a6');
assert.equal(calls[0].params.deal_stage_id, '5d3f5e31019fdc000f24043a');
const data = context.VOLUM_RD_BUFFET_CLOSER_CONSULTAR(eligible.id);
assert.equal(data.elegivel, true);
assert.equal(data.modo, 'SOMENTE_LEITURA_RD');
assert.equal(data.negociacao.valorTotal, 1800);
assert.equal(data.cobertura.tarefas.completo, true);
assert.equal(data.cobertura.arquivos.acessivel, false);
context.viLeadRdGet_ = () => ({deal: {...eligible, user: {id: 'WRONG'}}});
assert.equal(context.VOLUM_RD_BUFFET_CLOSER_CONSULTAR(eligible.id).elegivel, false);
assert.throws(() => context.VOLUM_RD_BUFFET_CLOSER_CONSULTAR('invalid'), /ID RD invalido/);
assert.equal(/\bfunction\s+(doGet|doPost)\b/.test(code), false);
console.log('Buffet closer bridge: read-only scope and security passed');
