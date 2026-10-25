import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const engine=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const stage=fs.readFileSync(new URL('./VolumRdStageTimeline.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
new Function(engine);new Function(service);new Function(stage);
const sandbox=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(engine,sandbox);vm.runInContext(service,sandbox);vm.runInContext(stage,sandbox);
const deal={
  idCliente:'CLI-EXEMPLO',negociacao:{criadaEm:'2026-10-12T07:13:15.397Z',responsavel:'SDR teste',historicoEtapas:[]},
  cadastroRd:{origem:'INBOUND'},fontes:{tarefas:{acessivel:true,completo:true}},
  tarefas:[],ligacoesBoard:[
    {id:'L0',data:'2026-10-13T12:43:00Z',tarefaId:'T1',funcaoDeclarada:'SDR'},
    {id:'L1',data:'2026-10-17T12:43:00Z',tarefaId:'T2',funcaoDeclarada:'CLOSER'}
  ],
  cerebros:[
    {agente:'LEAD',estado:'SEM_LEITURA'},
    {agente:'CADENCIA',estado:'SEM_LEITURA',
      indicadores:{modoSdr:'HUMANO',fluxo:'INBOUND_EM_VALIDACAO',lmv:'NAO_CONFIRMADO'}},
    {agente:'CONEXAO',estado:'PRESERVADO'}
  ],
  historicoRdEtapas:{linhaDoTempo:{
    cobertura:{acessivel:true,completo:true,totalVisual:4,lacunas:[]},
    eventos:[
      {id:'UI_0',data:'2026-10-12T07:13:23Z',acao:'WHATSAPP_ABERTO',texto:'Abriu um WhatsApp Web'},
      {id:'UI_1',data:'2026-10-13T13:10:00Z',acao:'EMAIL_ENVIADO',texto:'Enviou um e-mail'},
      {id:'UI_2',data:'2026-10-13T13:11:00Z',acao:'ANOTACAO',texto:'Enviei e-mail com detalhes'},
      {id:'UI_3',data:'2026-10-13T13:54:00Z',acao:'ANOTACAO',texto:'Apresentação agendada para quinta'}
    ]
  }}
};
const agents=sandbox.viWidgetAgentesDetalhados_(deal);
const lead=agents.find(x=>x.agente==='LEAD');
const cadence=agents.find(x=>x.agente==='CADENCIA');
assert.equal(agents.length,3);
assert.equal(lead.criterios.length,9);
assert.equal(lead.indicadores.fontePrincipal,'RD_UI_HISTORY');
assert.equal(lead.criterios.find(x=>x.id==='whatsapp0').status,'NAO_VERIFICAVEL',
  'Abrir WhatsApp nao prova mensagem enviada');
assert.equal(lead.criterios.find(x=>x.id==='email0').status,'INDICIO');
assert.equal(cadence.criterios.length,9);
assert.equal(cadence.indicadores.paradaMotivo,'AGENDAMENTO_CONFIRMADO');
assert.equal(cadence.indicadores.ligacoesNoBoard,1);
assert.equal(cadence.calendario[0].observado.email,1,
  'Nota simultanea nao duplica evento de envio de e-mail');
assert.equal(cadence.calendario[0].observado.whatsapp,0);
assert.equal(agents.find(x=>x.agente==='CONEXAO').estado,'PRESERVADO');
const partial={...deal,historicoRdEtapas:{linhaDoTempo:{
  cobertura:{acessivel:true,completo:false,totalVisual:4,lacunas:['PAGINACAO_UI_INCOMPLETA']},
  eventos:deal.historicoRdEtapas.linhaDoTempo.eventos
}}};
assert.equal(sandbox.viWidgetAgentesDetalhados_(partial)[0].estado,'SEM_LEITURA',
  'Historico incompleto nao substitui fonte original');
console.log('RD UI + agentes: abertura WhatsApp sem envio, e-mail nao duplicado, parada por agenda e Closer excluido.');

const apiCadastro=sandbox.viRdCamposNegociacao_({
  created_at:'2026-10-12T07:13:15.397Z',
  deal_source:{name:'Inbound pago'},
  campaign:{name:'Formulario e-commerce'},
  deal_custom_fields:[{
    custom_field:{label:'Faturamento Mensal'},
    value:'R$ 50 mil',created_at:'2026-10-12T07:13:15Z',
    updated_at:'2026-10-17T15:00:00Z'
  }]
});
assert.equal(apiCadastro.camposPersonalizados[0].nome,'Faturamento Mensal',
  'API RD utiliza custom_field.label; nao perder nome do campo');
const dados=sandbox.viWidgetCadastroLeadApi_(apiCadastro);
assert.equal(dados.origem,'Inbound pago');
assert.equal(dados.lmvAtual,'R$ 50 mil');
assert.equal(dados.lmvDeclarado,'','campo atual nunca vira LMV original');
const aval=sandbox.viCerebroLead_({
  criadaEm:deal.negociacao.criadaEm,
  timeline:[],atividades:[],tarefas:[],ligacoes:[],
  etapas:[],negociacao:{responsavel:'SDR teste'},
  fontes:{tarefas:{completo:true},atividades:{acessivel:true,completo:true}},
  cadastro:dados,regraLead:{}
});
assert.equal(aval.criterios.find(x=>x.id==='origem').status,'INDICIO');
assert.equal(aval.criterios.find(x=>x.id==='lmv').status,'NAO_VERIFICAVEL');
assert.match(aval.criterios.find(x=>x.id==='lmv').detalhe,/NAO comprova o informado originalmente/);
assert.equal(sandbox.viCadenciaCanaisTexto_({
  texto:'Abriu um WhatsApp Web',
  tipo:'messenger',origemClassificacao:'CAMPO_API'
}).length,0,'evento messenger sem acao comprovada nao vira envio de WhatsApp');
const prontidao=sandbox.viWidgetProntidaoAgentes_(deal,agents);
assert.equal(prontidao.lead.totalCriterios,9);
assert.equal(prontidao.cadencia.totalCriterios,9);
assert.equal(prontidao.cadencia.bloqueadoParaPontuacao,true);
assert.equal(prontidao.fontes.historicoVisualCompleto,true);
assert.ok(prontidao.cadencia.bloqueios.some(x=>x.includes('LMV')));
const pos=panel.indexOf('function agentDia(d){');
const prox=panel.indexOf('function agentReadiness',pos);
assert.ok(pos>=0&&prox>pos,'formato data esperado antes de prontidao');
const mostrarDia=new Function('rdMomento',panel.slice(pos,prox)+'return agentDia;')((x)=>x);
assert.equal(mostrarDia('2026-10-13'),'13/10/2026','data brasileira nao pode voltar ao dia anterior via UTC');
console.log('API: custom_field.label, LMV atual distinto do original, canal messenger, readiness 9+9, data local corretos.');
