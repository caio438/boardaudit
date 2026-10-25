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

// Audit earlier SDR stage even when current stage is APRESENTACAO (Tgr scenario).
const sdrUi=makeUi([
 {kind:'TAREFA_CRIADA',stage:'Contato feito',dateText:'23/10/2026 09:00',dataLocal:'2026-10-23T09:00:00',
  detail:'SDR criou tarefa primeira ligação CAD 1'},
 {kind:'TAREFA_CONCLUIDA',stage:'Contato feito',dateText:'23/10/2026 09:13',dataLocal:'2026-10-23T09:13:00',
  detail:'SDR concluiu a tarefa primeira ligação'},
 {kind:'ANOTACAO',stage:'Contato feito',dateText:'23/10/2026 09:18',dataLocal:'2026-10-23T09:18:00',
  detail:'SDR fez anotação: cliente não atendeu a ligação; retorno programado'},
 {kind:'EMAIL_ENVIADO',stage:'Contato feito',dateText:'23/10/2026 10:00',dataLocal:'2026-10-23T10:00:00',
  detail:'SDR enviou um e-mail de contato inicial'},
 {kind:'WHATSAPP_ABERTO',stage:'Contato feito',dateText:'23/10/2026 11:00',dataLocal:'2026-10-23T11:00:00',
  detail:'SDR abriu um WhatsApp Web'},
 {kind:'ANOTACAO',stage:'Contato feito',dateText:'23/10/2026 11:40',dataLocal:'2026-10-23T11:40:00',
  detail:'SDR fez anotação: faturamento declarado e necessidade de reduzir retrabalho'}
]);
const stageSdr=ctx.viRdAuditoriaJanelas_(deal,[],[],catalog,{});
const recSdr=ctx.viRdConciliarHistoricoUi_(stageSdr,sdrUi,deal.id);
assert.equal(recSdr.aceito,true);
const inputSdr={negociacao:{etapaAtualNome:'Apresentação',criadaEm:'2026-10-23T08:00:00Z'},
  historicoRdEtapas:recSdr.historico,tarefas:[],fontes:{}};
const diagSdr=ctx.viWidgetDiagnosticoHistoricoRd_(inputSdr);
assert.equal(diagSdr.ativo,true);
const planoSdr=ctx.viWidgetPlanoSdrHistoricoRd_(inputSdr,diagSdr);
assert.equal(planoSdr.itens.length,16);
assert.equal(planoSdr.itens.filter(x=>x.pilar==='OFICIAL').length,7);
assert.equal(planoSdr.itens.filter(x=>x.pilar==='COMPLEMENTAR').length,9);
assert.ok(planoSdr.itens.every(x=>x.titulo&&x.detalhe&&x.fonte&&x.status),'No empty SDR cards');
assert.equal(planoSdr.escopo.totalEventosSdr,6);
assert.equal(planoSdr.escopo.passagensSdr.length,1);
assert.equal(planoSdr.itens.find(x=>x.id==='cadencia').status,'INDICIO');
assert.equal(planoSdr.itens.find(x=>x.id==='no_show').status,'NAO_APLICAVEL');
assert.equal(planoSdr.itens.find(x=>x.id==='handoff').status,'SEM_EVIDENCIA');
assert.equal(planoSdr.itens.find(x=>x.id==='pitch').status,'NAO_VERIFICAVEL');
assert.equal(planoSdr.itens.find(x=>x.id==='lmv').status,'INDICIO');

assert.equal(planoSdr.itens.find(x=>x.id==='agenda').status,'SEM_EVIDENCIA',
 'The name of the stage Apresentacao must not prove an appointment');
const onlyStage=makeUi([
 {kind:'ANOTACAO',stage:'Apresentação',dateText:'25/10/2026 11:00',
  dataLocal:'2026-10-25T11:00:00',detail:'Nota genérica na etapa Apresentação do funil'},
 {kind:'ANOTACAO',stage:'Apresentação',dateText:'25/10/2026 11:10',
  dataLocal:'2026-10-25T11:10:00',detail:'Reunião não foi agendada, aguardando confirmação'}
]);
const onlyHist=ctx.viRdAuditoriaJanelas_(deal,[],[],catalog,{});
const linkedStage=ctx.viRdConciliarHistoricoUi_(onlyHist,onlyStage,deal.id);
const onlyInput={negociacao:{etapaAtualNome:'Apresentação'},historicoRdEtapas:linkedStage.historico,
  tarefas:[],fontes:{}};
const onlyDiag=ctx.viWidgetDiagnosticoHistoricoRd_(onlyInput);
const onlyPlan=ctx.viWidgetPlanoSdrHistoricoRd_(onlyInput,onlyDiag);
assert.equal(onlyPlan.itens.find(x=>x.id==='agenda').status,'SEM_EVIDENCIA');
assert.equal(onlyPlan.itens.find(x=>x.id==='confirmacao').status,'NAO_APLICAVEL');

assert.ok(planoSdr.itens.some(x=>/UI_[0-9]+/.test(x.evidencia)));
const sdrStart=widget.indexOf('function sdr(d)');
const sdrEnd=widget.indexOf('\nfunction closer(',sdrStart);
assert.ok(sdrStart>=0&&sdrEnd>sdrStart,'SDR renderer must be present');
const renderSdr=vm.runInNewContext('('+widget.slice(sdrStart,sdrEnd)+')',{
  section:(title,detail)=>'<section>'+title+' · '+detail+'</section>',
  esc:x=>String(x||''),
  group:(title,items)=>'<section>'+title+items.map(x=>'<h3>'+x.titulo+'</h3><p>'+x.detalhe+'</p>').join('')+'</section>'
});
const output=renderSdr({diagnosticoRdOperacional:diagSdr,planoOtimizacaoSdr:planoSdr});
assert.match(output,/7 pilares do Plano Wisetec/);
assert.match(output,/9 verificações complementares/);
assert.match(output,/LMV e faturamento validados no CRM/);
assert.match(output,/Passagem de bastão SDR/);
assert.doesNotMatch(output,/<h3><\/h3>/);
assert.doesNotMatch(output,/14 não verificáveis/);
const noVisualSdr=renderSdr({diagnosticoRdOperacional:{ativo:false,motivo:'PAGINACAO_INCOMPLETA'}});
assert.match(noVisualSdr,/PAGINACAO_INCOMPLETA/);
assert.doesNotMatch(noVisualSdr,/7 pilares do Plano Wisetec/);

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
