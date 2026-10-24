import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./VolumIntelligenceLead.gs', import.meta.url), 'utf8');
new Function(source);
const ctx = vm.createContext({
  Object, Array, String, Number, Set, Date, Boolean, Math, RegExp, Error,
  VI_FAKE: true
});
vm.runInContext(source, ctx);
assert.equal(ctx.viLeadId_('https://crm.rdstation.com/app/deals/6acc888b98976f0023dc583f?view=pipeline'), '6acc888b98976f0023dc583f');
assert.throws(() => ctx.viLeadId_('https://evil.test/deals/6acc888b98976f0023dc583f'), /ID de negociacao/);
assert.equal(ctx.viLeadDataIso_('13/10/2026 09:47:25').endsWith('T09:47:25.000Z'), true); // TZ Node em UTC no teste
assert.equal(ctx.viLeadTextoSeguro_('Gravacao: https://api4com.com/test.mp3?token=segredo', true).includes('segredo'), false);
const deal='6acc888b98976f0023dc583f';
const fake = [
 { ID_INTERACAO:'i1', ID_EXTERNO:'RD_TASK_t1', TIPO_INTERACAO:'LIGACAO', LINK_CRM:'https://crm.rdstation.com/app/deals/'+deal+'?view=pipeline', DATA_INTERACAO:'13/10/2026 09:43:47', DURACAO_SEGUNDOS:2, URL_GRAVACAO:'https://api4com.com/test.mp3', STATUS_TRANSCRICAO:'PENDENTE' },
 { ID_INTERACAO:'i2', ID_EXTERNO:'RD_TASK_t2', TIPO_INTERACAO:'LIGACAO', LINK_CRM:'https://crm.rdstation.com/app/deals/'+deal+'?view=pipeline', DATA_INTERACAO:'13/10/2026 09:47:25', DURACAO_SEGUNDOS:174, URL_GRAVACAO:'https://api4com.com/test2.mp3', STATUS_TRANSCRICAO:'PENDENTE' },
 { ID_INTERACAO:'ix', ID_EXTERNO:'RD_TASK_tx', TIPO_INTERACAO:'LIGACAO', LINK_CRM:'https://crm.rdstation.com/app/deals/aaaaaaaaaaaaaaaaaaaaaaaa' }
];
const calls=ctx.viLeadLigacoesBoard_(fake,deal);
assert.equal(calls.length,2);
const tasks=ctx.viLeadTarefas_([{id:'t1',type:'call',done:true,notes:'gravacao https://api4com.com/a.mp3?token=secret'}, {id:'t3',type:'call',done:true}],false);
const cad=ctx.viCerebroCadencia_({ligacoes:calls,tarefas:tasks});
assert.equal(cad.indicadores.ligacoesNoBoard,2);
assert.equal(cad.indicadores.chamadasConcluidasNoRdSemCorrespondenciaNoBoard,1);
assert.equal(cad.indicadores.tentativasCandidatasSemDuplicacao,3);
assert.equal(tasks[0].anotacao,'');
assert.equal(ctx.viLeadHistoricoEtapas_({deal_stage_histories:[{deal_stage_id:'S1',start_date:'2026-10-13T10:00:00Z',end_date:'2026-10-13T10:30:00Z'}]})[0].duracaoMinutos,30);
assert.equal(ctx.viLeadLinhaTempo_([],[],calls,[]).length,2);
assert.doesNotMatch(source, /\b(?:adicionarObjeto_|atualizarPorCampo_|registrarLog_|salvarSegredo_)\s*\(/);
console.log('VOLUM Intelligence: testes de validacao, sanitizacao, vinculo, deduplicacao e linha do tempo passaram.');
