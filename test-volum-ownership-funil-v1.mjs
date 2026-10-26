import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const ops=fs.readFileSync(new URL('./VolumWidgetRdOps.gs',import.meta.url),'utf8');
const stages=fs.readFileSync(new URL('./VolumRdStageTimeline.gs',import.meta.url),'utf8');
const lead=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const ctx=vm.createContext({Date,Intl,Array,Object,String,Math,Number,Set,Map,RegExp,JSON,Boolean});
vm.runInContext(service,ctx);
vm.runInContext(ops,ctx);
vm.runInContext(lead,ctx);
vm.runInContext(stages,ctx);
const deal='aaaaaaaaaaaaaaaaaaaaaaaa';
const S='111111111111111111111111',P='222222222222222222222222';
const dealObj={id:deal,created_at:'2026-08-23T20:28:00Z',deal_stage:{id:P,name:'Proposta enviada'},
  deal_stage_histories:[{deal_stage_id:S,start_date:'2026-08-23T20:28:00Z',end_date:'2026-09-23T19:08:00Z'},
    {deal_stage_id:P,start_date:'2026-09-23T19:08:00Z'}]};
const raw=ctx.viRdAuditoriaJanelas_(dealObj,[],[],{nomes:{[S]:'Identificacao do interesse',[P]:'Proposta enviada'}},{});
const events=[
 ['NEGOCIACAO_CRIADA','2026-08-23T20:28:00Z','Negociação criada','VOLUM Sales Ops','Identificacao do interesse'],
 ['CHAMADA_REGISTRADA','2026-08-24T13:20:00Z','Atendimento para contato com duração de 00:00:05','Ezequiel Souza','Identificacao do interesse'],
 ['ANOTACAO','2026-08-27T14:45:00Z','[27/08/2026 11:44:18] Aloizio Junior: Posso falar pelo WhatsApp','Ezequiel Souza','Identificacao do interesse'],
 ['ANOTACAO','2026-09-21T19:41:00Z','[21/09/2026 16:41:06] Lena: Poderemos sim, agendada reunião quarta 09:00','Ezequiel Souza','Identificacao do interesse'],
 ['TAREFA_CRIADA','2026-09-23T19:08:00Z','Apresentação do sistema','Ezequiel Souza','Proposta enviada'],
 ['RESPONSAVEL_ALTERADO','2026-09-23T19:09:00Z','Ezequiel Souza alterou o responsável para Plinio Savagin na etapa Proposta enviada do funil','Ezequiel Souza','Proposta enviada'],
 ['EMAIL_ENVIADO','2026-09-24T16:43:00Z','Plinio Savagin enviou proposta comercial','Plinio Savagin','Proposta enviada'],
 ['ANOTACAO','2026-10-06T14:16:00Z','[06/10/2026 11:16:37] Lena: Deixaremos em Stand by','Plinio Savagin','Proposta enviada'],
 ['TAREFA_CRIADA','2026-10-26T16:28:00Z','Passo 11 Cadência Follow','Plinio Savagin','Proposta enviada']
];
const ui={dealId:deal,coverage:{available:true,complete:true,totalVisual:events.length},events:events.map((e,i)=>({
 uiIndex:i,kind:e[0],dataLocal:e[1].slice(0,19).replace('T','T'),dateText:'',detail:e[2],author:e[3],stage:e[4]}))};
const merged=ctx.viRdConciliarHistoricoUi_(raw,ui,deal);
assert.equal(merged.aceito,true);
const leitura={negociacao:{criadaEm:'2026-08-23T20:28:00Z',etapaAtualNome:'Proposta enviada'},
  historicoRdEtapas:merged.historico,ligacoesBoard:[],reunioesBoard:[],tarefas:[],arquivosRd:[],fontes:{}};
const mapa=ctx.viWidgetMapaResponsabilidades_(leitura);
assert.equal(mapa.marcoCloser.tipo,'TROCA_COM_ATUACAO');
assert.equal(mapa.marcoCloser.autor,'Plinio Savagin');
assert.equal(mapa.contagem.REUNIAO,4);
assert.equal(mapa.contagem.LEAD,1);
assert.equal(mapa.contagem.CONEXAO,1);
assert.equal(mapa.contagem.AGENDA,1);
assert.ok(mapa.atribuicoes.every(a=>a.papel==='CLOSER'?a.data>=mapa.marcoCloser.data:a.data<mapa.marcoCloser.data));
leitura.mapaResponsabilidades=mapa;
const diag={ativo:true};
const sdr=ctx.viWidgetPlanoSdrHistoricoRd_(leitura,diag);
const closer=ctx.viWidgetPlanoCloserHistoricoRd_(leitura,diag);
assert.equal(sdr.escopo.eventoInicioCloser,mapa.marcoCloser.data);
assert.equal(closer.closer_iniciado.valor,true);
assert.equal(closer.escopo.eventosCloser,4);
const nohandoff=JSON.parse(JSON.stringify(leitura));
nohandoff.historicoRdEtapas.linhaDoTempo.eventos=nohandoff.historicoRdEtapas.linhaDoTempo.eventos.filter(e=>e.acao!=='RESPONSAVEL_ALTERADO');
nohandoff.mapaResponsabilidades=ctx.viWidgetMapaResponsabilidades_(nohandoff);
assert.equal(nohandoff.mapaResponsabilidades.closerIniciado,false);
assert.equal(ctx.viWidgetPlanoCloserHistoricoRd_(nohandoff,diag).itens.length,0);
const many=Array.from({length:320},(_,i)=>({uiIndex:i,kind:'TAREFA_CRIADA',detail:'Tarefa',dataLocal:'2026-09-01T12:00:00'}));
const long=ctx.viRdConciliarHistoricoUi_(ctx.viRdAuditoriaJanelas_(dealObj,[],[],{nomes:{[S]:'Contato feito',[P]:'Proposta enviada'}},{}),{dealId:deal,coverage:{available:true,complete:true,totalVisual:many.length},events:many},deal);
assert.equal(long.aceito,true);
assert.equal(long.historico.linhaDoTempo.eventos.length,320);
console.log('OK: agentes, fronteira SDR/Closer, evento unico e historico longo');
