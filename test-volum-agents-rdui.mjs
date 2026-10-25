import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const engine=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
new Function(engine);new Function(service);
const sandbox=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(engine,sandbox);vm.runInContext(service,sandbox);
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
