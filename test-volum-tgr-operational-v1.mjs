import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=n=>fs.readFileSync(new URL('./'+n,import.meta.url),'utf8');
const widget=read('VolumWidgetPanel.html');
const ops=read('VolumWidgetRdOps.gs');
const service=read('VolumWidgetService.gs');
const lead=read('VolumIntelligenceLead.gs');
const journey=read('VolumIntelligenceJourneyAgents.gs');
const script=widget.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
for(const code of [script,ops,service,lead,journey])new Function(code);
const ctx=vm.createContext({Date,Intl,Array,Object,String,Math,Number,Set,Map,RegExp,JSON,Boolean,console});
for(const file of [service,ops,lead,journey])vm.runInContext(file,ctx);

const oldId='111111111111111111111111';
const middleId='222222222222222222222222';
const lastId='333333333333333333333333';
const start='2026-10-11T15:13:00Z';
const presentationStart='2026-10-13T12:35:00Z';
const janelas=[
 {passagemId:oldId+'@1',etapaId:oldId,etapaNome:'ETAPA_SEM_NOME_CONFIRMADO',inicio:start,fim:'2026-10-11T15:13:01Z'},
 {passagemId:middleId+'@1',etapaId:middleId,etapaNome:'ETAPA_SEM_NOME_CONFIRMADO',inicio:'2026-10-11T15:13:01Z',fim:presentationStart},
 {passagemId:lastId+'@1',etapaId:lastId,etapaNome:'ETAPA_SEM_NOME_CONFIRMADO',inicio:presentationStart,fim:''}
];
const ev=(id,acao,data,passagemId,texto,etapaNome)=>({
 id,data,acao,passagemId,texto,etapaNome,
 dataTexto:data,autor:'Operador de teste',fonte:'RD_UI_HISTORY'});
const events=[
 ev('UI_1','TAREFA_CRIADA','2026-10-13T11:10:00Z',janelas[1].passagemId,
   'Vendedor de teste criou tarefa: primeira ligação','Cadência'),
 ev('UI_2','ANOTACAO','2026-10-13T11:25:00Z',janelas[1].passagemId,
   'Cliente ainda não respondeu; tentar novamente','Cadência'),
 ev('UI_3','EMAIL_ENVIADO','2026-10-14T13:36:00Z',janelas[2].passagemId,
   'Vendedor de teste enviou e-mail Lembrete 14/10/2026 10:36','Apresentação'),
 ev('UI_66','ANOTACAO','2026-10-16T13:30:00Z',janelas[2].passagemId,
   'Vendedor de teste fez uma anotação: Olá Cliente de teste, Tínhamos nosso compromisso hoje, agora às 10:00, mas você não compareceu à reunião.',
   'Apresentação'),
 ev('UI_70','TAREFA_CRIADA','2026-10-16T14:30:00Z',janelas[2].passagemId,
   'Criada tarefa de recovery, confirmar reagendamento', 'Apresentação'),
 ev('UI_91','EMAIL_ENVIADO','2026-10-22T13:20:00Z',janelas[2].passagemId,
   'Enviou e-mail de acompanhamento', 'Apresentação')
];
const leitura={
 dealId:'aaaaaaaaaaaaaaaaaaaaaaaa',
 idCliente:'CLI-20260803131300-C4455D17',
 negociacao:{criadaEm:start,etapaAtualId:lastId,
   etapaAtualNome:'Apresentação',responsavel:'Closer atual'},
 historicoRdEtapas:{janelas,linhaDoTempo:{eventos:events,cobertura:{
   acessivel:true,completo:true,totalVisual:events.length,
   totalReconciliado:events.length,lacunas:[]}}},
 tarefas:[
   {id:'task-before',criadaEm:'2026-10-13T11:00:00Z',
    previstaPara:'2026-10-13T11:25:00Z',concluida:false,
    assunto:'primeira ligação'},
   {id:'task-after',criadaEm:'2026-10-16T14:00:00Z',
    previstaPara:'2026-10-20T14:00:00Z',concluida:false,
    assunto:'recovery'}],
 ligacoesBoard:[
   {id:'tel-before',data:'2026-10-13T11:26:29Z',funcaoDeclarada:'SDR',
      temReferenciaGravacao:true},
   {id:'tel-after',data:'2026-10-17T13:15:00Z',funcaoDeclarada:'SDR',
      temReferenciaGravacao:true}],
 reunioesCalendarioBoard:[],arquivosRd:[],
 fontes:{tarefas:{acessivel:true,completo:true},
   atividades:{acessivel:true,completo:false},
   arquivosRd:{acessivel:false,completo:false}}
};
const names=ctx.viWidgetNomesEtapasPorEvidencia_(leitura);
assert.equal(names.confirmadasRD,1,'nome atual deve vir do ID da etapa RD');
assert.equal(leitura.historicoRdEtapas.janelas.at(-1).etapaNome,'Apresentação');
assert.equal(leitura.historicoRdEtapas.janelas[1].etapaNome,'Cadência',
  'nome de etapa histórica só com cartas consistentes');
assert.equal(names.semNome,1,'etapa antiga sem nome permanece indeterminada');
assert.equal(leitura.historicoRdEtapas.janelas[1].proximaEtapaNome,'Apresentação');

const diag=ctx.viWidgetDiagnosticoHistoricoRd_(leitura);
assert.equal(diag.ativo,true);
const d=id=>diag.criterios.find(x=>x.id===id);
assert.equal(d('agendamento').estado,'INDICIO',
 'No-show relatado + compromisso não permite alegar que a reunião nunca foi agendada');
assert.match(d('agendamento').evidencia,/compromisso|no-show/i);
assert.equal(d('convite').estado,'NAO_VERIFICAVEL',
 'Lembrete enviado não comprova convite com link');
assert.equal(d('lembrete').estado,'EVIDENCIADO');
assert.equal(d('realizacao').estado,'NAO_VERIFICAVEL',
 'No-show é indício de ausência, não de reunião realizada');
assert.equal(d('no_show').estado,'INDICIO');
assert.equal(d('confirmacao').estado,'NAO_VERIFICAVEL');
assert.ok(!diag.acoes.some(x=>/registrar ou localizar data, horário, participantes/i.test(x.acao)),
  'Não priorizar ausência de agenda ignorando o relato no mesmo histórico');
assert.ok(diag.acoes.every(x=>x.criterioConclusao&&
  !x.criterioConclusao.startsWith('Registro correspondente identificado no Histórico')),
 'Critérios prioritários devem ter uma condição de encerramento específica');

const sdr=ctx.viWidgetPlanoSdrHistoricoRd_(leitura,diag);
assert.equal(sdr.escopo.passagensSdr.length,3,
  'Etapa Apresentação permanece SDR enquanto não houver handoff comprovado');
assert.equal(sdr.escopo.totalEventosSdr,6,
  'No-show e recovery pertencem ao SDR até uma passagem comprovada');
assert.equal(sdr.itens.find(x=>x.id==='agenda').status,'INDICIO',
 'Compromisso/no-show registrado é indício de agendamento, não ausência absoluta');
assert.equal(sdr.itens.find(x=>x.id==='confirmacao').status,'NAO_VERIFICAVEL');
assert.equal(sdr.itens.find(x=>x.id==='no_show').status,'INDICIO');
assert.equal(sdr.itens.find(x=>x.id==='voip').status,'INDICIO',
 'Chamada técnica pré-Closer no Board pode reforçar uso de VoIP');
assert.match(sdr.itens.find(x=>x.id==='registros').detalhe,/2 chamada\(s\) técnica\(s\)/,
 'Sem handoff comprovado, as chamadas posteriores não podem ser deslocadas ao Closer.');
assert.ok(sdr.itens.every(x=>x.conformidade!=='NAO_CONFORME'),
 'Sem versão de playbook não converter lacuna em vermelho');
const closerTgr=ctx.viWidgetPlanoCloserHistoricoRd_(leitura,diag);
assert.equal(closerTgr.closer_iniciado.valor,false,
  'Apresentação e no-show não comprovam entrada do Closer');
assert.equal(closerTgr.itens.length,0,
  'Sem entrada comprovada, Plano Closer é nulo e não cria pendências');
const leituraCloser={...leitura,
  ligacoesBoard:leitura.ligacoesBoard.concat([{id:'closer-1',data:'2026-10-17T13:15:00Z',funcaoDeclarada:'CLOSER'}]),
  reunioesBoard:[{id:'meet-1',data:'2026-10-17T13:00:00Z',funcaoDeclarada:'CLOSER'}]};
const closerAtivo=ctx.viWidgetPlanoCloserHistoricoRd_(leituraCloser,diag);
assert.equal(closerAtivo.closer_iniciado.valor,true,
  'Interação vinculada com papel CLOSER ativa o plano');
assert.equal(closerAtivo.itens.length,7);

const ctxCad={
 criadaEm:start,inicioCadenciaEm:'2026-10-13T11:00:00Z',
 agora:'2026-10-25T13:00:00Z',janelas,
 atividades:[
  {id:'cad1',data:'2026-10-13T11:25:00Z',tipo:'note',
   origemClassificacao:'RD_UI_HISTORY',texto:'Enviei e-mail de prospecção'},
  {id:'future-note',data:'2026-10-22T13:20:00Z',tipo:'email',
   origemClassificacao:'RD_UI_HISTORY',texto:'Enviei e-mail de acompanhamento'}],
 ligacoes:leitura.ligacoesBoard,tarefas:leitura.tarefas,
 regraCadencia:{modoSdr:'HUMANO',fluxo:'INBOUND_EM_VALIDACAO',
   lmv:'NAO_CONFIRMADO',feriadosExtras:[]},
 fontes:{tarefas:{completo:true},atividades:{completo:true}}
};
const cad=ctx.viCerebroCadencia_(ctxCad);
assert.equal(cad.indicadores.paradaMotivo,'ENTRADA_ETAPA_CLOSER');
assert.equal(cad.indicadores.paradaEm,presentationStart);
assert.equal(cad.indicadores.ligacoesNoBoard,1);
assert.equal(cad.indicadores.ligacoesAposParada,1);
assert.equal(cad.indicadores.diasUteisComRegistro,1,
  'Cadência não abrange emails de acompanhamento na etapa Apresentação');
assert.ok(cad.indicadores.contatosForaDaCadencia>=1);
assert.ok(cad.indicadores.diasUteisPlanejados<=2,
  'Não gerar nove dias de prospecção por causa de atividades de Closer');

const notes=events.filter(e=>['ANOTACAO','EMAIL_ENVIADO'].includes(e.acao)).map(e=>({
 id:e.id,data:e.data,tipo:e.acao==='ANOTACAO'?'note':'email',
 texto:e.texto,acaoVisual:e.acao,origemClassificacao:'RD_UI_HISTORY'}));
const ag=ctx.viJourneyAgenda_({
 atividades:notes,tarefas:leitura.tarefas,reunioesCalendario:[],
 historicoVisualCompleto:true,agora:'2026-10-25T13:00:00Z'
});
const byId=(agent,id)=>agent.criterios.find(x=>x.id===id);
assert.equal(byId(ag,'agenda_registro').status,'INDICIO');
assert.equal(byId(ag,'agenda_data').status,'INDICIO',
 'Horário anotado não é agendamento estruturado');
assert.match(byId(ag,'agenda_data').detalhe,/16\/10\/2026/);
assert.equal(byId(ag,'agenda_convite').status,'NAO_VERIFICAVEL');
assert.equal(byId(ag,'agenda_lembrete').status,'INDICIO');
assert.equal(byId(ag,'agenda_no_show').status,'INDICIO');
assert.equal(byId(ag,'agenda_recovery').status,'INDICIO',
 'Tarefa de recovery existe, mas execução ainda pendente');

const conexao=ctx.viJourneyConexao_({
 atividades:notes,ligacoes:leitura.ligacoesBoard,
 historicoVisualCompleto:true,janelas
});
assert.equal(byId(conexao,'canal_conexao').status,'NAO_VERIFICAVEL',
 'Duas chamadas técnicas, sem resposta, não são conexão');
assert.equal(byId(conexao,'marco_conexao').status,'NAO_VERIFICAVEL');

const nullNoShow=ctx.viJourneyAgenda_({
 atividades:[{id:'negative',data:'2026-10-16T13:30:00Z',tipo:'note',
   texto:'Hoje não houve no-show, realizamos a reunião normalmente.'}],
 tarefas:[],reunioesCalendario:[],historicoVisualCompleto:true
});
assert.notEqual(byId(nullNoShow,'agenda_no_show').status,'INDICIO',
 'Negação de no-show não é um no-show positivo');

const dom={getElementById:()=>({dataset:{dealId:leitura.dealId}}),
 querySelector:()=>({content:''}),
 documentElement:{classList:{add(){}}}};
const win={top:{postMessage(){}},addEventListener(){},
 localStorage:{getItem(){return null},setItem(){},removeItem(){}}};
const v=vm.createContext({document:dom,window:win,console,Date,Intl,Set,Array,
 Object,Number,String,Math,JSON,setTimeout:()=>1,clearTimeout(){}});
vm.runInContext(script,v);
assert.match(vm.runInContext("criterionCard({id:'cadencia',titulo:'Cadencia',status:'INDICIO'})",v),
 /criteria-tile tone-yellow/,'Critério amarelo com fundo/sombra próprios');
assert.match(vm.runInContext("criterionCard({id:'proposta',titulo:'Proposta',conformidade:'CONFORME'})",v),
 /criteria-tile tone-green/);
assert.match(vm.runInContext("criterionCard({id:'no_show',titulo:'No-show',status:'NAO_APLICAVEL'})",v),
 /criteria-tile tone-na/);
assert.match(vm.runInContext("itemValidation({titulo:'Interpretacao',status:'INDICIO',detalhe:'Conferir'})",v),
 /validation tone-violet/);
assert.match(widget,/\.criteria-tile\.tone-yellow/);
assert.match(widget,/box-shadow:0 7px 20px/);
assert.doesNotMatch(vm.runInContext("leadAgent({agentesDetalhados:[{agente:'LEAD',indicadores:{criadaEm:'2026-10-11T15:13:00Z'},criterios:[]}],prontidaoAgentes:{}})",v),
 /undefined min/,'Sem dado não se mostra undefined min');
assert.match(widget,/CACHE_ANALYSIS_REVISION='RD_FULL_EVIDENCE_OWNERSHIP_V3_20261026'/);
console.log('TGR: no-show/agenda vs convite, escopo SDR/Closer, VoIP real, cadencia, cores e cache atualizados.');
