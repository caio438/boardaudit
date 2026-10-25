import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lead=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
new Function(lead);new Function(service);
const script=panel.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);new Function(script);
const c=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(lead,c);

assert.equal(c.viCadenciaDiaBrasil_('2026-10-12T02:30:00Z'),'2026-10-11');
assert.equal(c.viCadenciaDiaBrasil_('2026-10-12'),'2026-10-12');
assert.equal(c.viCadenciaSextaPaixao_(2026),'2026-04-03');
assert.equal(c.viCadenciaEhUtil_('2026-10-12',[]),false,'12/10 e feriado nacional');
assert.equal(c.viCadenciaEhUtil_('2026-10-17',[]),false,'sabado nao e util');
assert.equal(c.viCadenciaEhUtil_('2026-10-13',[]),true,'terca-feira util');
assert.equal(c.viCadenciaEhUtil_('2026-10-14',['2026-10-14']),false,'feriado local configurado');
assert.equal(c.viCadenciaIntervaloDiasUteis_('2026-10-09','2026-10-13',[]),1);
assert.equal(c.viCadenciaDiasUteis_('2026-10-12',2,[]).join(','),'2026-10-13,2026-10-14');
assert.equal(c.viCadenciaPadraoDia_(1,'POSITIVO').LIGACAO,2);
assert.equal(c.viCadenciaPadraoDia_(7,'POSITIVO').LIGACAO,2);
assert.equal(c.viCadenciaPadraoDia_(2,'NEGATIVO').WHATSAPP,1);
assert.equal(c.viCadenciaPadraoDia_(1,'NEGATIVO').LIGACAO,undefined);

const act=(id,data,texto)=>({id,data,texto,tipo:'nao_confirmado',origemClassificacao:'CONFLITO_FILTROS'});
assert.equal(c.viCadenciaCanaisTexto_(act('a','2026-10-13T13:00:00Z','Mandei mensagem no WhatsApp')).join(','),'WHATSAPP');
assert.equal(c.viCadenciaCanaisTexto_(act('b','2026-10-13T13:00:00Z','Enviei e-mail com apresentação')).join(','),'EMAIL');
assert.equal(c.viCadenciaCanaisTexto_(act('c','2026-10-13T13:00:00Z','Vou enviar o email amanhã')).length,0);
assert.equal(c.viCadenciaCanaisTexto_(act('d','2026-10-13T13:00:00Z','Não enviei email')).length,0);
assert.equal(c.viCadenciaCanaisTexto_({...act('d2','2026-10-13T13:00:00Z','Não enviei email'),tipo:'note',origemClassificacao:'CAMPO_API'}).length,0);
assert.equal(c.viCadenciaCanaisTexto_(act('e','2026-10-13T13:00:00Z','[CAD 1] WHATSAPP - ENVIADO; [CAD 2] EMAIL - ENVIADO')).length,2);

const ctx={
  criadaEm:'2026-10-12T07:13:15.397Z',
  agora:'2026-10-25T15:00:00Z',
  regraCadencia:{modoSdr:'HUMANO',fluxo:'INBOUND',lmv:'POSITIVO',calendarioLocalConfirmado:false,feriadosExtras:[]},
  fontes:{atividades:{acessivel:true,completo:false},tarefas:{acessivel:true,completo:true}},
  tarefas:[
    {id:'t1',tipo:'call',concluida:true,assunto:'Contato inicial',previstaPara:'2026-10-13'},
    {id:'t2',tipo:'call',concluida:true,assunto:'Ligar novamente',previstaPara:'2026-10-14'},
    {id:'t3',tipo:'call',concluida:true,assunto:'Retornar no final do dia',previstaPara:'2026-10-15'}
  ],
  atividades:[
    act('a1','2026-10-13T13:00:00Z','Mandei mensagem no WhatsApp'),
    act('a2','2026-10-13T15:00:00Z','Enviei e-mail de abertura'),
    act('a3','2026-10-15T18:00:00Z','Cliente respondeu pelo WhatsApp. Agendou reunião.')
  ],
  ligacoes:[
    {id:'l1',tarefaId:'t1',data:'2026-10-13T12:43:47Z',duracaoSegundos:3,funcaoDeclarada:'SDR'},
    {id:'l2',tarefaId:'t2',data:'2026-10-14T12:47:24Z',duracaoSegundos:174,funcaoDeclarada:'NAO_COMPROVADO'},
    {id:'l3',tarefaId:'tc',data:'2026-10-14T14:47:24Z',duracaoSegundos:300,funcaoDeclarada:'CLOSER'}
  ]
};
const resultado=c.viCerebroCadencia_(ctx);
assert.equal(resultado.agente,'CADENCIA');
assert.equal(resultado.criterios.length,9);
assert.equal(resultado.indicadores.diasUteisPlanejados,18);
assert.equal(resultado.calendario[0].dia,'2026-10-13');
assert.equal(resultado.calendario[0].numero,1);
assert.equal(resultado.calendario[0].observado.ligacoes,1);
assert.equal(resultado.calendario[0].observado.whatsapp,1);
assert.equal(resultado.calendario[1].observado.ligacoes,1,'chamada do closer deve ser excluida');
assert.equal(resultado.calendario[3].estado,'SUSPENSO_POR_CONEXAO');
assert.equal(resultado.indicadores.ligacoesCloserExcluidas,1);
assert.equal(resultado.indicadores.chamadasConcluidasNoRdSemCorrespondenciaNoBoard,1);
const comTarefaCloser=c.viCerebroCadencia_({...ctx,tarefas:ctx.tarefas.concat([
  {id:'tc',tipo:'call',concluida:true,assunto:'Ligação técnica do closer'}
])});
assert.equal(comTarefaCloser.indicadores.chamadasConcluidasNoRdSemCorrespondenciaNoBoard,1,
  'tarefa vinculada a ligação de closer não pode virar tentativa de SDR');
assert.notEqual(resultado.calendario[0].estado,'DESVIO');
const withoutLmvs=c.viCerebroCadencia_({...ctx,regraCadencia:{...ctx.regraCadencia,lmv:'NAO_CONFIRMADO'}});
assert.equal(withoutLmvs.calendario[0].esperado,null);
assert.equal(withoutLmvs.calendario.length,2,'sem LMV conhecido, so dias com tentativas observadas; resposta nao e tentativa');
assert.equal(withoutLmvs.criterios.find(x=>x.id==='perfil').status,'NAO_VERIFICAVEL');
const robot=c.viCerebroCadencia_({...ctx,regraCadencia:{...ctx.regraCadencia,modoSdr:'ROBO'}});
assert.equal(robot.calendario[0].esperado,null,'robô não recebe régua de SDR humano');
const onlyTasks=c.viCerebroCadencia_({...ctx,ligacoes:[],atividades:[]});
assert.equal(onlyTasks.criterios.find(x=>x.id==='inicio').status,'NAO_VERIFICAVEL');
assert.equal(onlyTasks.indicadores.tentativasCandidatasSemDuplicacao,3);
assert.match(panel,/function cadenceAgent\(d\)/);
assert.match(panel,/'cadencia','Agente CADÊNCIA'/);
assert.match(service,/calendario:a\.calendario/);
console.log('CADENCIA: dia util Brasil 12/10, feriados, nome livre, canal, telefonia, papel, interrupcao, fonte e robô protegidos.');
