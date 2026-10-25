import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Regressao anonima derivada da captura real da Beaga Calçados (24/10/2026).
// Sem nome de contato, e-mail, numero de telefone, URL de gravacao ou tokens.
const source=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
new Function(source);
const context=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(source,context);
const actividade=(id,data,texto)=>({id,data,texto,tipo:'nao_confirmado',origemClassificacao:'CONFLITO_FILTROS'});
const agenda=actividade('nota-agenda','2026-10-13T12:54:00.899Z',
  'Faturamento confirmado 100 a 250k. Apresentação agendada quinta-feira 15/10 às 17h.');
const atividades=[
  actividade('cad-inicial','2026-10-12T07:13:23.543Z',
    '[CAD 1] WHATSAPP - ENVIADO; [CAD 2] EMAIL - ENVIADO'),
  agenda,
  actividade('email-posterior','2026-10-16T16:08:10.000Z','Enviei o e-mail com a proposta.'),
  actividade('reagendamento','2026-10-22T12:54:30.159Z',
    'Reunião desmarcada, tentando agendar nova data.')
];
const dates=[
  '2026-10-13T12:43:47.215Z','2026-10-13T12:44:20.722Z',
  '2026-10-13T12:47:24.732Z','2026-10-21T19:35:00.000Z',
  '2026-10-23T13:39:54.972Z','2026-10-23T17:29:00.000Z',
  '2026-10-23T17:31:00.000Z','2026-10-23T19:06:16.204Z'
];
const ligacoes=dates.map((data,i)=>({id:'chamada-'+i,tarefaId:'atendimento-'+i,
  data,duracaoSegundos:[2,3,174,9,3,3,3,4][i],temReferenciaGravacao:true}));
const tarefas=Array.from({length:6},(_,i)=>({id:'cad-'+i,tipo:'call',
  assunto:'CAD '+(i<3?'3':'4')+' - Ligação',concluida:true,
  criadaEm:'2026-10-12T07:25:00.000Z',concluidaEm:'2026-10-13T12:50:41.125Z'}))
 .concat([
 {id:'rec-whats',tipo:'task',assunto:'Recovery Dia 2 Whatsapp',concluida:false,
  criadaEm:'2026-10-23T19:05:58.000Z',previstaPara:'2026-10-26T11:00:00.000Z'},
 {id:'rec-email',tipo:'task',assunto:'Recovery Dia 2 E-mail',concluida:false,
  criadaEm:'2026-10-23T19:06:14.000Z',previstaPara:'2026-10-26T11:00:00.000Z'}
]);
const ctx={
  criadaEm:'2026-10-12T07:13:15.397Z',agora:'2026-10-25T19:25:00.000Z',
  negociacao:{responsavel:'Responsavel atual'},
  atividades,tarefas,ligacoes,etapas:[{inicio:'2026-10-12T07:13:15.387Z'}],
  timeline:[{tipo:'ENTRADA_ETAPA',data:'2026-10-12T07:13:15.387Z'},
    {tipo:'ATIVIDADE_NAO_CONFIRMADO',data:'2026-10-12T07:13:23.543Z'}],
  cadastro:{},regraLead:{},
  regraCadencia:{modoSdr:'HUMANO',fluxo:'INBOUND_EM_VALIDACAO',lmv:'NAO_CONFIRMADO',
    feriadosExtras:[],calendarioLocalConfirmado:false},
  fontes:{atividades:{acessivel:true,completo:false},tarefas:{acessivel:true,completo:true}}
};
const lead=context.viCerebroLead_(ctx);
assert.equal(lead.indicadores.lmvDeclaradoStatus,'NAO_RECUPERADO');
assert.equal(lead.criterios.find(x=>x.id==='lmv').status,'NAO_VERIFICAVEL',
  'faturamento confirmado em anotacao posterior nao e LMV original do formulario');
const cand=context.viCerebroCadencia_(ctx);
assert.equal(cand.indicadores.paradaMotivo,'AGENDAMENTO_CONFIRMADO');
assert.equal(cand.indicadores.paradaEm,agenda.data);
assert.equal(cand.indicadores.diasUteisPlanejados,1);
assert.equal(cand.calendario[0].dia,'2026-10-13','12/10/2026 e feriado nacional');
assert.equal(cand.calendario[0].observado.ligacoes,3);
assert.equal(cand.indicadores.diasComLacuna,0,'nao pontuar cadencia apos agendamento');
assert.equal(cand.indicadores.ligacoesNoBoard,3);
assert.equal(cand.indicadores.ligacoesAposParada,5);
assert.equal(cand.indicadores.contatosForaDaCadencia,6);
assert.equal(cand.indicadores.chamadasConcluidasNoRdSemCorrespondenciaNoBoard,6);
assert.equal(cand.criterios.find(x=>x.id==='pendencias').detalhe.includes('2 pendencia(s) em Agenda/Follow-up/Recovery'),true);
assert.equal(cand.criterios.find(x=>x.id==='perfil').status,'NAO_VERIFICAVEL');
assert.equal(cand.calendario[0].esperado,null,'sem LMV/regra homologados nao inferir faltas');
assert.equal(context.viCadenciaSinalParada_([
  actividade('nao','2026-10-13T12:54:00.899Z','Não foi agendada reunião.'),
  actividade('tentando','2026-10-13T12:55:00.899Z','Estou tentando agendar a reunião.')
]),null,'negativa e tentativa de reagendar nao sao prova de agenda');
console.log('Beaga (snapshot anonimo): dia 13/10, 3 ligacoes iniciais, agenda reconhecida, 5 pos-agenda excluidas, zero falsos gaps.');
