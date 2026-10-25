import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const core=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const stages=fs.readFileSync(new URL('./VolumRdStageTimeline.gs',import.meta.url),'utf8');
const ops=fs.readFileSync(new URL('./VolumWidgetRdOps.gs',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const widget=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
const chrome=fs.readFileSync(new URL('./extensions/volum-intelligence/content.js',import.meta.url),'utf8');
const sidebar=fs.readFileSync(new URL('./extensions/volum-intelligence/sidebar.js',import.meta.url),'utf8');
const webapp=fs.readFileSync(new URL('./VolumWidgetWebApp.gs',import.meta.url),'utf8');
[core,stages,ops,service,chrome,sidebar].forEach(src=>new Function(src));
assert.match(widget,/function rdDiagnosticoView\(/);
new Function((widget.match(/<script>([\s\S]*?)<\/script>/)||[])[1]);
const ctx=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(core+'\n'+stages+'\n'+ops+'\n'+service,ctx);
const S=['621fc34e5067d00010caa810','621fc34e5067d00010caa811'];
const deal={id:'aaaaaaaaaaaaaaaaaaaaaaaa',
 deal_stage:{id:S[1],name:'Apresentação'},
 deal_stage_histories:[
  {deal_stage_id:S[0],start_date:'2026-10-23T08:00:00Z',end_date:'2026-10-24T12:00:00Z'},
  {deal_stage_id:S[1],start_date:'2026-10-24T12:00:00Z',end_date:null}
 ]};
const catalog={nomes:{[S[0]]:'Contato feito',[S[1]]:'Apresentação'},fonte:{acessivel:true,completo:true}};
function makeUi(rows,complete=true){
 return {dealId:deal.id,coverage:{available:true,complete,totalVisual:rows.length,pagesLoaded:10},
 events:rows.map((x,i)=>({uiIndex:i,dateText:x.dateText||'25/10/2026 10:00',
   dataLocal:x.dataLocal||'2026-10-25T10:00:00',
   author:x.author||'Atendente A',stage:x.stage||'Apresentação',
   kind:x.kind,detail:x.detail}))};
}
function result(rows,stage='Apresentação',tasks=[],complete=true){
 const obj={...deal,deal_stage:{id:S[1],name:stage}};
 const historico=ctx.viRdAuditoriaJanelas_(obj,[],tasks,catalog,{});
 const ui=makeUi(rows,complete);
 const linked=ctx.viRdConciliarHistoricoUi_(historico,ui,deal.id);
 assert.equal(linked.aceito,true);
 return {res:ctx.viWidgetDiagnosticoHistoricoRd_({
   historicoRdEtapas:linked.historico,negociacao:{etapaAtualNome:stage},
   tarefas:tasks,arquivosRd:[],fontes:{arquivosRd:{completo:false}}}),
   linked};
}
const base=[
 {kind:'ETAPA_ALTERADA',detail:'Atendente alterou a etapa para Apresentação na negociação'},
 {kind:'WHATSAPP_ABERTO',detail:'Atendente abriu um WhatsApp Web para o contato'},
 {kind:'TAREFA_CRIADA',detail:'Atendente criou a tarefa terceira ligação'},
 {kind:'ANOTACAO',detail:'Atendente fez uma anotação: apresentação agendada para 26/10 às 08:00'},
 {kind:'EMAIL_ENVIADO',detail:'Atendente enviou um e-mail Lembrete da apresentação'},
 {kind:'ANOTACAO',author:'Atendente A',detail:'Atendente fez uma anotação: registro de contato'},
 {kind:'ANOTACAO',author:'Atendente B',detail:'Atendente fez uma anotação: registro de contato'}
];
const pending={id:'terceira',assunto:'terceira ligação',tipo:'call',concluida:false,
 criadaEm:'2026-10-25T08:00:00Z',previstaPara:'2026-10-26T11:00:00Z'};
const {res,linked}=result(base,'Apresentação',[pending]);
assert.equal(res.ativo,true);
assert.equal(res.fase,'APRESENTACAO');
assert.equal(res.resumo.total,7,'two real cards in same minute must not collapse');
assert.equal(linked.historico.linhaDoTempo.eventos[0].data,'2026-10-25T13:00:00.000Z',
 'RD local 10:00 BRT must translate to 13:00 UTC');
const semanticCtx=ctx.viWidgetContextoHistoricoRd_({
  historicoRdEtapas:linked.historico,negociacao:{etapaAtualNome:'Apresentação'}
},res);
assert.equal(semanticCtx.fonte,'RD_UI_HISTORY');
assert.equal(semanticCtx.historicoCompleto,true);
assert.ok(semanticCtx.referencias.every(x=>/^UI_/.test(x.ref)));
const semanticOk=ctx.viWidgetValidarInterpretacaoRd_({fatos:[
  {criterio:'Agenda',conclusao:'Há anotação de agenda',referencia:'UI_3'},
  {criterio:'Inventado',conclusao:'Afirma reunião sem referência',referencia:'UI_999'}
]}, {historicoRdEtapas:linked.historico});
assert.equal(semanticOk.fatos.length,1);
assert.equal(semanticOk.fatos[0].referencia,'UI_3');
assert.equal(res.canais.whatsappAbertos,1);
assert.equal(res.canais.emailsEnviados,1);
assert.equal(res.criterios.find(x=>x.id==='lembrete').estado,'EVIDENCIADO');
assert.equal(res.criterios.find(x=>x.id==='confirmacao').estado,'SEM_REGISTRO');
assert.equal(res.criterios.find(x=>x.id==='pendencia_etapa').estado,'ATENCAO');
assert.ok(res.acoes.every(x=>!/^executar.{0,30}terceira liga/i.test(x.acao)),
 'an overdue/next SDR call cannot be generic next best action in presentation');
assert.equal(res.criterios.some(x=>x.id==='email_proposta'),false,
 'never audit proposal formalization as mandatory while deal still in presentation');

// Proposal stage: sent email IS a sent event. Asking if it arrived isn't confirmation.
const proposta=result([
 {kind:'EMAIL_ENVIADO',detail:'Atendente enviou um e-mail PROPOSTA COMERCIAL'},
 {kind:'ANOTACAO',detail:'Atendente anotou: te mandei a proposta por email. Chegou tudo ai pra você?'},
 {kind:'EMAIL_RESPONDIDO',detail:'Atendente respondeu um email de Atendente'}
],'Proposta enviada').res;
assert.equal(proposta.fase,'PROPOSTA');
assert.equal(proposta.criterios.find(x=>x.id==='email_proposta').estado,'EVIDENCIADO');
assert.equal(proposta.criterios.find(x=>x.id==='recebimento').estado,'SEM_REGISTRO');
assert.equal(proposta.criterios.find(x=>x.id==='arquivo_proposta').estado,'NAO_VERIFICAVEL');
assert.ok(proposta.resumo.total===3);

// If the history is not fully paginated, do not report negative operational conclusions.
const incompleto=result(base,'Apresentação',[pending],false).res;
assert.equal(incompleto.ativo,false);
assert.equal(incompleto.estado,'COLETA_NAO_HOMOLOGADA');

// 103 distinct cards, including same minute and repeated content, are 103 evidence events.
const cards=Array.from({length:103},(_,i)=>({
 kind:'TAREFA_CRIADA',author:i%2?'Atendente A':'Atendente B',
 detail:'Tarefa criada e registrada',dateText:'23/10/2026 16:06',
 dataLocal:'2026-10-23T16:06:00'
}));
const big=result(cards).res;
assert.equal(big.resumo.total,103);
assert.equal(big.resumo.coberturaCompleta,true);

// Must get actual DOM history into sandboxed Google HTML, not postMessage to wrapper.
assert.match(chrome,/VOLUM_REQUEST_RD_UI_HISTORY/);
assert.match(chrome,/INLINE_ID/);
assert.match(chrome,/host.__volumHistoryCleanup/);
assert.match(chrome,/volum_history_nonce/);
assert.match(widget,/volum-history-nonce/);
assert.match(webapp,/template.historyNonce/);
assert.match(sidebar,/msg.nonce!==historyNonce/);
assert.match(widget,/window\.top\.postMessage/);
assert.match(widget,/chrome-extension/);
assert.match(chrome,/waitHistoryChange/);
assert.match(chrome,/findHistoryTab/);
assert.match(service,/viWidgetDiagnosticoHistoricoRd_\(leitura\)/);
console.log('RD Intelligence: 103 cards retained; BRT windows, full-coverage gate, stage-specific actions and visual iframe handshake passed.');
