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
assert.equal(res.criterios.find(x=>x.id==='confirmacao').estado,'NAO_VERIFICAVEL',
 'Sem resposta positiva e sem calendario nao implica reprovacao de confirmacao.');
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

assert.equal(planoSdr.itens.find(x=>x.id==='agenda').status,'NAO_VERIFICAVEL',
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
assert.equal(onlyPlan.itens.find(x=>x.id==='agenda').status,'NAO_VERIFICAVEL');
assert.equal(onlyPlan.itens.find(x=>x.id==='confirmacao').status,'NAO_APLICAVEL');

assert.ok(planoSdr.itens.some(x=>/UI_[0-9]+/.test(x.evidencia)));
const sdrStart=widget.indexOf('function sdr(d)');
const sdrEnd=widget.indexOf('\nfunction closer(',sdrStart);
assert.ok(sdrStart>=0&&sdrEnd>sdrStart,'SDR renderer must be present');
const uiStart=widget.indexOf('const CRITERIOS_VERDE=');
const uiEnd=widget.indexOf('function group(',uiStart);
assert.ok(uiStart>=0&&uiEnd>uiStart,'accordion helper must exist');
const ux=vm.createContext({esc:x=>String(x===null||x===undefined?'':x),String,Array,Number,Object,Set});
vm.runInContext(widget.slice(uiStart,uiEnd)+
  String.fromCharCode(10)+'this.criteriaAccordion=criterionSection;this.criteriaCard=criterionCard;this.criteriaLight=criterionLight;',ux);
const renderSdr=vm.runInNewContext('('+widget.slice(sdrStart,sdrEnd)+')',{
  section:(title,detail)=>'<section>'+title+' · '+detail+'</section>',
  esc:x=>String(x||''),
  criterionSection:ux.criteriaAccordion,
  group:(title,items)=>'<section>'+title+items.map(x=>'<h3>'+x.titulo+'</h3><p>'+x.detalhe+'</p>').join('')+'</section>'
});
const output=renderSdr({diagnosticoRdOperacional:diagSdr,planoOtimizacaoSdr:planoSdr});
assert.match(output,/7 pilares do Plano Wisetec/);
assert.match(output,/9 verificações complementares/);
assert.match(output,/LMV e faturamento validados no CRM/);
assert.match(output,/Passagem de bastão SDR/);
assert.doesNotMatch(output,/<h3><\/h3>/);
assert.doesNotMatch(output,/14 não verificáveis/);

assert.match(output,/<details class="criteria-tile tone-[a-z]+"><summary>/,
  'Each criterion must be collapsed by default');
assert.equal((output.match(/<details class="criteria-tile tone-[a-z]+">/g)||[]).length,16);
assert.match(output,/<b>Para ficar verde:<\/b>/);
assert.match(ux.criteriaCard({id:'cadencia',titulo:'Cadência',
  status:'EVIDENCIADO'}),/criteria-light yellow/,
  'A recorded clue must NOT automatically be treated as full compliance');
assert.match(ux.criteriaCard({id:'cadencia',titulo:'Cadência',
  conformidade:'CONFORME'}),/criteria-light green/);
assert.match(ux.criteriaCard({id:'cadencia',titulo:'Cadência',
  conformidade:'NAO_CONFORME'}),/criteria-light red/);
assert.match(ux.criteriaCard({id:'no_show',titulo:'No-show',
  status:'NAO_APLICAVEL'}),/criteria-light na/);
assert.equal(planoSdr.itens.find(x=>x.id==='handoff').conformidade,'PENDENTE',
 'Sem playbook e ownership confirmado, handoff ausente nao e desvio homologado');
assert.equal(planoSdr.itens.find(x=>x.id==='cadencia').conformidade,'PENDENTE',
 'Cadence cannot be green without the version and expected channels');

function sdrForOneNote(line){
 const h=ctx.viRdAuditoriaJanelas_(deal,[],[],catalog,{});
 const visual=makeUi([{kind:'ANOTACAO',stage:'Contato feito',
  dateText:'23/10/2026 11:40',dataLocal:'2026-10-23T11:40:00',
  detail:'SDR fez anotação: '+line}]);
 const c=ctx.viRdConciliarHistoricoUi_(h,visual,deal.id);
 const read={negociacao:{etapaAtualNome:'Apresentação',criadaEm:'2026-10-23T08:00:00Z'},
  historicoRdEtapas:c.historico,tarefas:[],fontes:{}};
 return ctx.viWidgetPlanoSdrHistoricoRd_(read,ctx.viWidgetDiagnosticoHistoricoRd_(read));
}
assert.equal(sdrForOneNote('LMV: positivo').itens.find(x=>x.id==='lmv').conformidade,'PENDENTE',
 'LMV declared, but not validated, must not turn green');
assert.equal(sdrForOneNote('LMV validado: positivo').itens.find(x=>x.id==='lmv').conformidade,'CONFORME',
 'Structured LMV validation by SDR is a sufficient CRM evidence for this narrow rule');
assert.equal(sdrForOneNote('Segmento: Engenharia').itens.find(x=>x.id==='segmento').conformidade,'CONFORME');

const planoCloser=ctx.viWidgetPlanoCloserHistoricoRd_(inputSdr,diagSdr);
assert.equal(planoCloser.itens.length,7);
assert.ok(planoCloser.itens.every(x=>x.titulo&&x.detalhe&&x.conformidade));
assert.equal(planoCloser.itens.find(x=>x.id==='proposta_pdf').conformidade,'NAO_APLICAVEL',
  'Proposal not due when in Apresentacao without an evidenced meeting');
const proposalInput={
  negociacao:{etapaAtualNome:'Proposta enviada',valorInformado:15000},
  historicoRdEtapas:linkedStage.historico,tarefas:[],
  atividades:[],arquivosRd:[{id:'proposal-1',nome:'Proposta Comercial.pdf',extensao:'pdf'}],
  fontes:{arquivosRd:{completo:true},atividades:{completo:true},tarefas:{completo:true}}
};
const closerModel=ctx.viWidgetPlanoCloserHistoricoRd_(proposalInput,onlyDiag);
assert.equal(closerModel.itens.length,7);
assert.equal(closerModel.itens.find(x=>x.id==='proposta_pdf').conformidade,'CONFORME');
assert.equal(closerModel.itens.find(x=>x.id==='valores').conformidade,'PENDENTE',
  'CRM amount cannot prove price matches the attached PDF');
assert.equal(closerModel.itens.find(x=>x.id==='recebimento').conformidade,'PENDENTE');
const closerMissing=ctx.viWidgetPlanoCloserHistoricoRd_({
  ...proposalInput,arquivosRd:[]},onlyDiag);
assert.equal(closerMissing.itens.find(x=>x.id==='proposta_pdf').conformidade,'NAO_CONFORME',
  'Only a complete file source can establish missing PDF');
const closerPartial=ctx.viWidgetPlanoCloserHistoricoRd_({
  ...proposalInput,arquivosRd:[],fontes:{arquivosRd:{completo:false},
    atividades:{completo:false},tarefas:{completo:false}}},onlyDiag);
assert.equal(closerPartial.itens.find(x=>x.id==='proposta_pdf').conformidade,'PENDENTE',
  'Never paint red for an inaccessible document source');
const closerStart=widget.indexOf('function closer(d)');
const closerEnd=widget.indexOf(String.fromCharCode(10)+'function ',closerStart+10);
assert.ok(closerStart>=0&&closerEnd>closerStart);
const renderCloser=vm.runInNewContext('('+widget.slice(closerStart,closerEnd)+')',{
  section:(title,detail)=>'<section>'+title+' · '+detail+'</section>',
  esc:x=>String(x||''),
  criterionSection:ux.criteriaAccordion
});
const closerHtml=renderCloser({diagnosticoRdOperacional:onlyDiag,
  planoOtimizacaoCloser:closerModel});
assert.match(closerHtml,/7 critérios do Plano Closer/);
assert.equal((closerHtml.match(/<details class="criteria-tile">/g)||[]).length,7);
assert.match(closerHtml,/criteria-light green/);
assert.match(closerHtml,/criteria-light yellow/);

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
