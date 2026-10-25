import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load=name=>fs.readFileSync(new URL('./'+name,import.meta.url),'utf8');
const engine=load('VolumIntelligenceLead.gs');
const journey=load('VolumIntelligenceJourneyAgents.gs');
const service=load('VolumWidgetService.gs');
const panel=load('VolumWidgetPanel.html');
for(const source of [engine,journey,service])new Function(source);
const script=panel.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'widget precisa conservar script unico');
new Function(script);
const ctx=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(engine,ctx);
vm.runInContext(journey,ctx);
vm.runInContext(service,ctx);

const event=(id,data,tipo,texto,acaoVisual='')=>({
  id,data,tipo,texto,acaoVisual,origemClassificacao:'RD_UI_HISTORY',
  autor:'Operador de teste'
});
const t0='2026-10-12T13:00:00Z';
const t1='2026-10-13T12:40:00Z';
const t2='2026-10-13T13:54:00Z';
const t3='2026-10-15T20:00:00Z';
const t4='2026-10-15T21:10:00Z';
const t5='2026-10-15T21:20:00Z';
const dados={
  criadaEm:t0,agora:'2026-10-25T14:00:00Z',
  etapaAtual:'Proposta enviada',negociacao:{responsavel:'Responsavel atual'},
  historicoVisualCompleto:true,
  fontes:{tarefas:{completo:true},atividades:{acessivel:true,completo:true},arquivosRd:{completo:true}},
  atividades:[
    event('UI_0',t0,'whatsapp_open','Abriu um WhatsApp Web','WHATSAPP_ABERTO'),
    event('UI_1',t1,'note','Falei com cliente; confirmamos a necessidade operacional'),
    event('UI_2','2026-10-13T12:42:00Z','note','Faturamento confirmado pelo cliente na ligacao'),
    event('UI_3',t2,'note','Apresentacao agendada para quinta-feira'),
    event('UI_4','2026-10-13T13:57:00Z','email','Enviei um convite para reuniao','EMAIL_ENVIADO'),
    event('UI_5','2026-10-14T14:00:00Z','note','Cliente confirmou presenca para a reuniao'),
    event('UI_6','2026-10-15T15:00:00Z','email','Enviei lembrete da nossa reuniao','EMAIL_ENVIADO'),
    event('UI_7',t4,'note','Reuniao realizada. Diagnostico de dor e necessidade do cliente'),
    event('UI_8',t5,'email','Segue proposta comercial personalizada','EMAIL_ENVIADO'),
    event('UI_9','2026-10-16T14:00:00Z','note','Cliente confirmou recebimento da proposta comercial')
  ],
  tarefas:[
    {id:'t-agenda',tipo:'meeting',assunto:'Reuniao de apresentacao',previstaPara:t3,
      concluida:true,concluidaEm:t4,responsaveis:['Closer de teste'],criadaEm:t2},
    {id:'t-retorno',tipo:'task',assunto:'Follow-up proposta',previstaPara:'2026-10-28T12:00:00Z',
      concluida:false,criadaEm:'2026-10-16T15:00:00Z',responsaveis:['Closer de teste']}
  ],
  ligacoes:[
    {id:'call-sdr',data:t1,duracaoSegundos:180,funcaoDeclarada:'SDR',
      temReferenciaGravacao:true,transcricaoDisponivel:false},
    {id:'call-closer',data:t3,duracaoSegundos:420,funcaoDeclarada:'CLOSER',
      temReferenciaGravacao:true,transcricaoDisponivel:true}
  ],
  reunioesBoard:[{id:'meet-board',data:t3,funcaoDeclarada:'CLOSER',temReferenciaGravacao:true,
    transcricaoDisponivel:true}],
  reunioesCalendario:[{id:'cal-1',data:t3,status:'REALIZADA',gravacaoReferenciada:true,
    transcricaoReferenciada:true}],
  formalizacoes:[],
  arquivos:[{id:'file1',nome:'proposta comercial.pdf',extensao:'pdf'}],
  atividadesApi:[{id:'api-1',data:t4,tipo:'note',temLinkGravacao:true}]
};
function byId(agent,id){return agent.criterios.find(c=>c.id===id);}
const conexao=ctx.viJourneyConexao_(dados);
const agenda=ctx.viJourneyAgenda_(dados);
const reuniao=ctx.viJourneyReuniao_(dados);
assert.equal(conexao.criterios.length,9);
assert.equal(agenda.criterios.length,9);
assert.equal(reuniao.criterios.length,10);
assert.equal(conexao.indicadores.ligacoesTecnicasSdrOuSemPapel,1,
  'Closer nao deve entrar como SDR');
assert.equal(byId(conexao,'marco_conexao').status,'INDICIO');
assert.equal(byId(conexao,'lmv_validado').status,'INDICIO');
assert.equal(byId(conexao,'pitch_sdr').status,'NAO_VERIFICAVEL');
assert.equal(byId(agenda,'agenda_registro').status,'INDICIO');
assert.equal(byId(agenda,'agenda_data').status,'EVIDENCIADO');
assert.equal(byId(agenda,'agenda_confirmacao').status,'INDICIO');
assert.equal(byId(agenda,'agenda_no_show').status,'NAO_APLICAVEL');
assert.equal(byId(agenda,'agenda_recovery').status,'NAO_APLICAVEL');
assert.equal(agenda.indicadores.noShowsComStatusNoCalendario,0);
assert.equal(byId(reuniao,'reuniao_realizacao').status,'EVIDENCIADO');
assert.equal(byId(reuniao,'reuniao_gravacao').status,'EVIDENCIADO');
assert.equal(byId(reuniao,'reuniao_transcricao').status,'EVIDENCIADO');
assert.equal(byId(reuniao,'reuniao_pitch').status,'NAO_VERIFICAVEL',
  'metadado de transcricao nao comprova qualidade de pitch');
assert.equal(byId(reuniao,'reuniao_formalizacao').status,'EVIDENCIADO');
assert.equal(byId(reuniao,'reuniao_proposta').status,'EVIDENCIADO');
assert.equal(byId(reuniao,'reuniao_recebimento').status,'INDICIO');
assert.equal(byId(reuniao,'reuniao_followup').status,'INDICIO');
for(const agent of [conexao,agenda,reuniao]){
  assert.equal(agent.indicadores.pontuacaoCompliance,null,'sem nota sem regra homologada');
  assert.ok(agent.criterios.every(c=>!['CONFORME','NAO_CONFORME'].includes(c.conformidade)));
  assert.ok(agent.criterios.every(c=>c.paraFicarVerde));
  assert.ok(agent.recomendacoes.every(x=>x.acao&&x.origem));
}

const neg={
  ...dados,etapaAtual:'Cadencia',reunioesCalendario:[],reunioesBoard:[],
  arquivos:[],atividadesApi:[],ligacoes:[],tarefas:[],
  atividades:[
    event('UI_0','2026-10-13T10:00:00Z','whatsapp_open','Abriu um WhatsApp Web','WHATSAPP_ABERTO'),
    event('UI_1','2026-10-13T11:00:00Z','note',
      'Nao foi agendada reuniao. Cliente nao confirmou presenca. Nao houve no-show. Nao foi realizada a apresentacao.'),
    event('UI_2','2026-10-13T12:00:00Z','note',
      'Perguntei se recebeu a proposta; ainda aguardando confirmacao de recebimento.')
  ]
};
const aNeg=ctx.viJourneyAgenda_(neg);
const rNeg=ctx.viJourneyReuniao_(neg);
assert.notEqual(byId(aNeg,'agenda_registro').status,'INDICIO',
  'negativa nao prova agendamento');
assert.notEqual(byId(aNeg,'agenda_confirmacao').status,'INDICIO');
assert.notEqual(byId(aNeg,'agenda_no_show').status,'INDICIO',
  'nao houve no-show nao e ocorrencia');
assert.equal(byId(aNeg,'agenda_recovery').status,'NAO_APLICAVEL');
assert.notEqual(byId(rNeg,'reuniao_realizacao').status,'INDICIO');
assert.equal(byId(rNeg,'reuniao_formalizacao').status,'NAO_APLICAVEL');
assert.equal(byId(rNeg,'reuniao_recebimento').status,'NAO_APLICAVEL');
const notaTardia={
  ...neg,
  atividades:[
    event('UI_AG','2026-10-13T13:00:00Z','note','Apresentacao agendada para quinta-feira'),
    event('UI_CL','2026-10-16T18:00:00Z','note','Cliente respondeu ao email da proposta')
  ],
  ligacoes:[{id:'sdr1',data:'2026-10-13T12:30:00Z',funcaoDeclarada:'SDR'},
    {id:'later',data:'2026-10-16T18:00:00Z',funcaoDeclarada:'NAO_COMPROVADO'}],
  janelas:[{etapaNome:'Proposta enviada',inicio:'2026-10-15T20:00:00Z'}]
};
const cTardia=ctx.viJourneyConexao_(notaTardia);
assert.equal(cTardia.indicadores.ligacoesTecnicasSdrOuSemPapel,1,
  'ligacao nao atribuida depois da agenda nao deve virar SDR');
assert.notEqual(byId(cTardia,'marco_conexao').status,'INDICIO',
  'resposta posterior de proposta nao deve virar primeira conexao SDR');
assert.equal(cTardia.indicadores.causaFimJanelaConexao,'AGENDA_REGISTRADA');
const confusao={
  ...neg,etapaAtual:'Proposta enviada',
  atividades:[event('UI_INV','2026-10-15T21:00:00Z','note','Enviei convite para a reuniao'),
    event('UI_LINK','2026-10-15T21:10:00Z','note','Enviei link da reuniao via WhatsApp')]
};
const rConfusao=ctx.viJourneyReuniao_(confusao);
assert.equal(byId(rConfusao,'reuniao_formalizacao').status,'NAO_VERIFICAVEL',
  'convite enviado nao prova formalizacao de proposta');
assert.equal(byId(rConfusao,'reuniao_gravacao').status,'NAO_VERIFICAVEL',
  'link de reuniao nao prova gravacao');

const parcial=ctx.viJourneyConexao_({...neg,historicoVisualCompleto:false});
assert.equal(byId(parcial,'marco_conexao').status,'FONTE_INCOMPLETA',
  'coleta incompleta nunca prova ausencia de conexao');

const noShow=ctx.viJourneyAgenda_({
  ...neg,etapaAtual:'Apresentacao',
  reunioesCalendario:[{id:'r1',data:t3,status:'NO_SHOW'},{
    id:'r2',data:'2026-10-17T20:00:00Z',status:'REALIZADA'
  }],
  atividades:[event('UI_NO','2026-10-15T20:20:00Z','note','No-show registrado'),
    event('UI_NO_DUP','2026-10-15T20:25:00Z','note','No-show no compromisso de hoje')],
  tarefas:[{id:'new-1',assunto:'Recovery de no-show',tipo:'task',
    criadaEm:'2026-10-16T13:00:00Z',previstaPara:'2026-10-16T17:00:00Z',
    concluida:true}]
});
assert.equal(noShow.indicadores.noShowsComStatusNoCalendario,1,
  '2 notas sobre mesmo compromisso nao equivalem a 2 no-shows');
assert.equal(noShow.indicadores.anotacoesNoShowNaoDeduplicadas,2);
assert.equal(byId(noShow,'agenda_no_show').status,'INDICIO');
assert.equal(byId(noShow,'agenda_recovery').status,'INDICIO',
  'tarefa de recovery observavel nao prova chamada efetuada');

assert.ok(!JSON.stringify(ctx.viJourneyConexao_({
  ...neg,atividades:[event('UI_URL','2026-10-13T13:00:00Z','note',
    'Falei com cliente; veja https://example.test/grava?token=PRIVATE')]
})).includes('token=PRIVATE'),'nao expor URLs/token');

const visual={
  ...neg,atividades:[],
  ligacoesBoard:dados.ligacoes,
  reunioesBoard:dados.reunioesBoard,reunioesCalendarioBoard:dados.reunioesCalendario,
  arquivosRd:dados.arquivos,atividadesApi:dados.atividadesApi,
  negociacao:{responsavel:'Responsavel atual',etapaAtualNome:'Proposta enviada',criadaEm:t0,historicoEtapas:[]},
  cerebros:[
    {agente:'LEAD',indicadores:{},estado:'BASE'},
    {agente:'CADENCIA',indicadores:{modoSdr:'HUMANO',fluxo:'NAO_CONFIRMADO',lmv:'NAO_CONFIRMADO'},estado:'BASE'},
    {agente:'CONEXAO',estado:'BASE'},
    {agente:'AGENDA',estado:'BASE'},
    {agente:'REUNIAO',estado:'BASE'}
  ],
  historicoRdEtapas:{janelas:[],linhaDoTempo:{cobertura:{
    acessivel:true,completo:true,totalVisual:dados.atividades.length,lacunas:[]},
    eventos:dados.atividades.map(e=>({id:e.id,data:e.data,acao:e.acaoVisual||
      (e.tipo==='note'?'ANOTACAO':e.tipo==='email'?'EMAIL_ENVIADO':'OUTRO_VISUAL_RD'),
      texto:e.texto,autor:e.autor}))
  }}
};
const integrados=ctx.viWidgetAgentesDetalhados_(visual);
assert.equal(integrados.length,5);
for(const nome of ['CONEXAO','AGENDA','REUNIAO']){
  assert.equal(integrados.find(x=>x.agente===nome).estado,'AUDITORIA_CONTEXTUAL_PARCIAL',
    'agente deve interpretar historico completo');
}
const prontidao=ctx.viWidgetProntidaoAgentes_(visual,integrados);
assert.equal(prontidao.conexao.totalCriterios,9);
assert.equal(prontidao.agenda.totalCriterios,9);
assert.equal(prontidao.reuniao.totalCriterios,10);
assert.equal(prontidao.reuniao.bloqueadoParaPontuacao,true);
for(const [id,display] of [['conexao','CONEXÃO'],['agenda','AGENDA'],['reuniao','REUNIÃO']]){
  assert.ok(panel.includes("'"+id+"','Agente "+display+"'"),
    'aba deve existir no widget: '+id);
}
assert.match(panel,/function journeyAgent\(d,nome,chave,titulo,subtitulo\)/);
assert.doesNotMatch(journey,/registrarLog_\s*\(|adicionarObjeto_\s*\(|salvarSegredo_\s*\(/);
console.log('Jornada: CONEXAO (9), AGENDA (9), REUNIAO (10), flags, contexto, no-show, pitch e continuidade.');
