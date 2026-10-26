import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(new URL('./'+f,import.meta.url),'utf8');
const source=read('VolumWidgetWisetecPilot.gs');
const agents=read('VolumIntelligenceJourneyAgents.gs');
const service=read('VolumWidgetService.gs');
const html=read('VolumWidgetPanel.html');
new Function(source);new Function(agents);new Function(service);
const content=(html.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(content,'script do painel presente');new Function(content);
const v=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(source,v);vm.runInContext(agents,v);vm.runInContext(service,v);
const client='CLI-20260803131300-C4455D17';
const head=['ID_AUDITORIA','ID_INTERACAO','ID_CLIENTE','TIPO_AUDITORIA','VALIDACAO_STATUS','HASH_FONTE',
  'STATUS','RD_STATUS','VALIDADA_EM','RESULTADO_JSON','RESULTADO_JSON__PARTE_02'];
const resultSdr={
  contexto_interacao:{classificacao:'PRIMEIRO_CONTATO'},
  resumo_contato:{resultado_contato:'Retorno combinado sem oferta de duas opções de horário.'},
  aderencia_script:{aderencia_pitch_percentual:62.5},
  perguntas_qualificacao:{total_ausentes:1},
  qualidade_perguntas_respostas:{validacao_lmv:'LMV validado na conversa.'},
  etapas_pitch:[{
    etapa:'Oferta de dois horários',status:'PARCIAL',divergencia_identificada:true,
    fato_transcricao:'SDR ofereceu somente uma opção de horário.',
    desvio:'Não ofereceu duas opções.',impacto_resultado:'Reduz a chance de agendar a demonstração.',
    correcao_pratica:'Oferecer duas opções objetivas e confirmar a escolha.'
  }]
};
const resultCloser={
  contexto_interacao:{classificacao:'PRIMEIRA_REUNIAO'},
  resumo_reuniao:{resultado_reuniao:'Reunião encerrada com proposta a ser enviada.'},
  momentos:[{
    nome:'Momento 1 — Diagnóstico',cor:'AMARELO',status:'PARCIAL',
    divergencia_identificada:true,o_que_foi_dito:'Não foram quantificados os custos atuais.',
    divergencia:'Implicação financeira não explorada.',
    o_que_fazer:'Quantificar impacto do problema antes da demonstração.'
  }],
  perguntas_diagnostico:{perguntas_esperadas_nao_realizadas:[{pergunta:'Qual é o custo atual?'}]},
  analise_impacto_implicacao:{correcao_pratica:'Explorar a perda financeira.'}
};
const row=(clientId=client,id='INT-EXEMPLO',tipo='SDR',status='APROVADA',validation='VALIDADA',hash='HASH')=>
  ['AUD-EXEMPLO',id,clientId,tipo,validation,hash,status,'PUBLICADA','25/10/2026',
    JSON.stringify(tipo==='SDR'?resultSdr:resultCloser),''];
const ids=new Set(['INT-EXEMPLO']);
const ok=v.viPilotAuditoriaRow_(head,row(),client,ids);
assert.equal(ok.tipo,'SDR');
assert.equal(ok.estado,'APROVADA');
assert.equal(ok.aderenciaPct,62.5);
assert.equal(ok.pontos.length,1);
assert.match(ok.pontos[0].acao,/Oferecer duas opções/);
const cl=v.viPilotAuditoriaRow_(head,row(client,'INT-EXEMPLO','CLOSER','EM_REVISAO'),client,ids);
assert.equal(cl.estado,'EM_REVISAO','auditoria validada mas ainda nao aprovada');
assert.equal(cl.lacunasPerguntas,1);
assert.equal(cl.pontos[0].etapa,'Momento 1 — Diagnóstico');
assert.equal(v.viPilotAuditoriaRow_(head,row('CLIENTE_DIFERENTE'),client,ids),null,
  'nunca associar a auditoria de outro cliente');
assert.equal(v.viPilotAuditoriaRow_(head,row(client,'OUTRA_INTERACAO'),client,ids),null,
  'nome similar nao pode compensar falta de ID_INTERACAO');
assert.equal(v.viPilotAuditoriaRow_(head,row(client,'INT-EXEMPLO','SDR','EM_REVISAO','PENDENTE'),client,ids),null);
assert.equal(v.viPilotAuditoriaRow_(head,row(client,'INT-EXEMPLO','SDR','APROVADA','VALIDADA',''),client,ids),null);
assert.equal(v.viPilotAuditoriaRow_(head,row(client,'INT-EXEMPLO','PLANO'),client,ids),null,
  'PLANO mensal nao e auditoria de chamada da negociacao');
const corrupt=row();corrupt[9]='{';
assert.equal(v.viPilotAuditoriaRow_(head,corrupt,client,ids),null);
const sanitized=v.viPilotTexto_('Link: https://example.test/file?token=PRIVATE e email@teste.com',120);
assert.ok(!sanitized.includes('PRIVATE')&&!sanitized.includes('email@teste.com'),
  'nao enviar URL/token/email pessoal ao frontend');

const sdrIds=['cadencia','voip','pitch','no_show','handoff','registros','tarefas'];
const closerIds=['gravacao','anotacao','proposta_pdf','proximo_passo','valores','recebimento','followup'];
const mk=(ids)=>({itens:ids.map((id,i)=>({
  id,titulo:'Critério '+id,pilar:'OFICIAL',
  status:i===0?'ATENCAO':i===1?'SEM_EVIDENCIA':i===2?'EVIDENCIADO':'INDICIO',
  conformidade:i===0?'NAO_CONFORME':'PENDENTE',
  detalhe:'Registro analisado a partir de fonte RD',
  evidencia:i?'UI_'+i+' · 2026-10-13':'',
  acao:'Validar '+id+' com comprovante e autoria.',fonte:'RD_UI_HISTORY'
}))});
const audit={itens:[ok,cl],cobertura:{acessivel:true,completo:true,associacao:'ID_CLIENTE + ID_INTERACAO + LINK_CRM'}};
const leitura={
  idCliente:client,auditoriasBoard:audit,
  historicoRdEtapas:{linhaDoTempo:{cobertura:{
    acessivel:true,completo:true,lacunas:[],totalVisual:1},
    eventos:[{id:'UI_1',data:'2026-10-13T12:00:00Z',acao:'ANOTACAO',
      texto:'Reunião agendada para quinta-feira'}]}},
  fontes:{board:{acessivel:true,completo:true}},
  ligacoesBoard:[{id:'INT-EXEMPLO',idCliente:client,data:'2026-10-13T11:00:00Z',
    funcaoDeclarada:'SDR'}],
  reunioesBoard:[],
  cerebros:[],
  negociacao:{criadaEm:'2026-10-12T12:00:00Z',etapaAtualNome:'Apresentacao'}
};
const parecer={
  planoOtimizacaoSdr:mk(sdrIds),planoOtimizacaoCloser:mk(closerIds),
  agentesDetalhados:[{agente:'CONEXAO'},{agente:'AGENDA'},{agente:'REUNIAO'}]
};
const p=v.viPilotPlanosWisetec_(leitura,parecer);
assert.equal(p.ativo,true);
assert.equal(p.sdr.pilares.length,7);
assert.equal(p.closer.pilares.length,7);
assert.equal(p.sdr.quantidadeAuditorias,1);
assert.equal(p.closer.quantidadeAuditorias,1);
assert.equal(p.sdr.auditorias[0].idInteracao,'INT-EXEMPLO');
assert.equal(p.sdr.pilares[0].status,'ATENCAO_A_VALIDAR');
assert.equal(p.sdr.pilares[2].status,'REGISTRO_ENCONTRADO');
assert.ok(p.sdr.melhorias.some(x=>/duas opções/i.test(x.acao)),
  'recomendacao do Board validado deve aparecer no Plano SDR');
assert.ok(p.closer.melhorias.some(x=>/Quantificar impacto/i.test(x.acao)),
  'recomendacao do Board Closer deve aparecer no Plano Closer');
assert.equal(p.sdr.semNota,true);
assert.equal(v.viPilotPlanosWisetec_({...leitura,idCliente:'OUTRO'},parecer).ativo,false);
assert.equal(v.viPilotPlanosWisetec_({...leitura,
  historicoRdEtapas:{linhaDoTempo:{cobertura:{acessivel:true,completo:false,lacunas:['PAGINACAO']}}}},parecer).ativo,false);
const contexto={
  criadaEm:'2026-10-12T12:00:00Z',
  atividades:[{id:'ui1',data:'2026-10-13T12:00:00Z',tipo:'note',
    texto:'Cliente respondeu e combinamos uma reunião. Apresentação agendada para quinta.'}],
  ligacoes:[{id:'INT-EXEMPLO',data:'2026-10-13T11:00:00Z',funcaoDeclarada:'SDR'}],
  tarefas:[],reunioesCalendario:[],reunioesBoard:[],arquivos:[],
  etapaAtual:'Proposta enviada',
  historicoVisualCompleto:true,
  auditoriasBoard:[ok,cl]
};
const conexao=v.viJourneyConexao_(contexto);
const reuniao=v.viJourneyReuniao_(contexto);
assert.equal(conexao.criterios.find(x=>x.id==='pitch_sdr').status,'INDICIO');
assert.equal(conexao.indicadores.auditoriasSdrVinculadas,1);
assert.equal(reuniao.criterios.find(x=>x.id==='reuniao_pitch').status,'INDICIO');
assert.equal(reuniao.indicadores.auditoriasCloserVinculadas,1);
assert.notEqual(reuniao.criterios.find(x=>x.id==='reuniao_pitch').conformidade,'CONFORME',
  'auditoria validada sob revisao nao concede conformidade integral');
assert.match(html,/function pilotPlan\(d,tipo\)/);
assert.doesNotMatch(html,/pilotPlan\(d,'sdr'\)/,
  'O plano executivo não deve renderizar o processamento técnico do piloto');
assert.doesNotMatch(html,/pilotPlan\(d,'closer'\)/,
  'O plano executivo não deve renderizar o processamento técnico do piloto');
assert.match(service,/leitura\.auditoriasBoard=typeof viPilotLerAuditoriasBoard_/);
assert.doesNotMatch(source,/(?:setValues|setValue|UrlFetchApp\.fetch|registrarLog_)\s*\(/,
  'piloto nao pode escrever no CRM nem no Board');
console.log('Wisetec pilot: isolamento por ID_CLIENTE/ID_INTERACAO, auditorias aprovadas vs. revisao, pitch 2 agentes, 7+7 e planos sem score.');
