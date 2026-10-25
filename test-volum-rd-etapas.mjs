import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const core=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const stages=fs.readFileSync(new URL('./VolumRdStageTimeline.gs',import.meta.url),'utf8');
const widget=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
new Function(core);new Function(stages);new Function(service);
const scripts=[...widget.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length);
scripts.forEach(x=>new Function(x[1]));
const ctx=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(core+'\n'+stages,ctx);

// Regression using ANONYMIZED timing/shape from RD Beaga snapshot 24/10/2026.
const S=['621fc34e5067d00010caa810','621fc34e5067d00010caa811',
  '621fc34e5067d00010caa812','621fc34e5067d00010caa813',
  '621fc34e5067d00010caa814'];
const h=[
 {deal_stage_id:S[0],start_date:'2026-10-12T07:13:15.387Z',end_date:'2026-10-12T07:13:20.769Z'},
 {deal_stage_id:S[0],start_date:'2026-10-12T07:13:15.404Z',end_date:'2026-10-12T07:13:20.769Z'},
 {deal_stage_id:S[1],start_date:'2026-10-12T07:13:20.769Z',end_date:'2026-10-13T12:47:48.040Z'},
 {deal_stage_id:S[2],start_date:'2026-10-13T12:47:48.040Z',end_date:'2026-10-13T12:47:50.510Z'},
 {deal_stage_id:S[3],start_date:'2026-10-13T12:47:50.510Z',end_date:'2026-10-16T13:28:04.513Z'},
 {deal_stage_id:S[4],start_date:'2026-10-16T13:28:04.514Z',end_date:null}
];
const deal={
 id:'6acc888b98976f0023dc583f',
 created_at:'2026-10-12T07:13:15.397Z',updated_at:'2026-10-23T19:06:21Z',
 deal_stage:{id:S[4],name:'Proposta enviada'},
 deal_pipeline:{id:'62a0a0a0a0a0a0a0a0a0a0a0',name:'Funil Comercial'},
 deal_stage_histories:h,
 deal_source:{name:'Inbound pago'},campaign:{name:'Campanha teste'},
 user:{name:'Responsável atual'},
 deal_custom_fields:[{custom_field_id:'cf-lmv',custom_field:{name:'Faturamento declarado'},
   value:'R$ 100 mil a R$ 250 mil',created_at:'2026-10-12T07:13:15Z',
   updated_at:'2026-10-13T12:54:00Z'}]
};
const catalog={nomes:Object.fromEntries(S.map((id,i)=>[id,['LEAD','CADENCIA','CONEXAO','AGENDA','PROPOSTA'][i]])),
  fonte:{acessivel:true,completo:true}};
const at=[
 {id:'a-inicio',tipo:'nao_confirmado',origemClassificacao:'CONFLITO_FILTROS',
  data:'2026-10-12T07:13:23.543Z',texto:'Automação inicial',etapaId:S[1]},
 {id:'a-changelog',tipo:'changelog',origemClassificacao:'CAMPO_API',
  data:'2026-10-13T12:47:48.040Z',texto:'Mudou campo registrado',etapaId:S[2]},
 {id:'a-cadastro',tipo:'note',origemClassificacao:'CAMPO_API',
  data:'2026-10-13T12:54:00.899Z',texto:'Qualificou o cliente',etapaId:S[3]},
 {id:'a-ambiguo',tipo:'nao_confirmado',origemClassificacao:'CONFLITO_FILTROS',
  data:'2026-10-16T15:08:36Z',texto:'Enviei email',etapaId:S[4]},
 {id:'a-dissonante',tipo:'note',origemClassificacao:'CAMPO_API',
  data:'2026-10-21T19:37:28Z',texto:'Falou com cliente',etapaId:S[1]}
];
const tasks=[
 {id:'t-inicio',criadaEm:'2026-10-12T07:25:06Z',
  concluida:true,concluidaEm:'2026-10-13T12:50:41Z',previstaPara:'2026-10-12T12:00:00Z',
  tipo:'call',assunto:'Tarefa inicial'},
 {id:'t-futuro',criadaEm:'2026-10-23T19:05:58Z',previstaPara:'2026-10-26T11:00:00Z',
  concluida:false,tipo:'whatsapp',assunto:'Recovery previsto'}
];
const leitura=ctx.viRdAuditoriaJanelas_(deal,at,tasks,catalog,{fontesParciais:true});
assert.equal(leitura.resumo.passagensOriginais,6);
assert.equal(leitura.resumo.passagensConsolidadas,5);
assert.equal(leitura.resumo.duplicatasConciliadas,1);
assert.equal(leitura.janelas[0].referenciasHistorico.length,2);
assert.equal(leitura.janelas[4].status,'EM_ANDAMENTO');
assert.equal(leitura.janelas[1].inicio,'2026-10-12T07:13:20.769Z');
assert.equal(leitura.janelas[2].inicio,'2026-10-13T12:47:48.040Z');
assert.equal(leitura.janelas[1].contagens.alteracoesConfirmadas,0,'boundary is exclusive');
assert.equal(leitura.janelas[2].contagens.alteracoesConfirmadas,1,'stage-change timestamp belongs next stage');
assert.equal(leitura.janelas[1].contagens.tarefasCriadas,1);
assert.equal(leitura.janelas[3].contagens.tarefasConcluidas,1,'completion belongs stage where it happened');
assert.equal(leitura.janelas[1].contagens.atividadesTipoNaoConfirmado,1);
assert.equal(leitura.janelas[4].contagens.atividadesTipoNaoConfirmado,1);
assert.equal(leitura.janelas[4].contagens.tarefasCriadas,1);
assert.equal(leitura.janelas[4].contagens.tarefasConcluidas,0,'future task is not executed');
assert.ok(leitura.janelas[4].eventos.some(x=>x.divergenciaEtapaRegistrada),
  'RD source stage can diverge from timestamp window');
assert.ok(leitura.janelas[3].eventos.some(x=>x.acao==='ULTIMA_ATUALIZACAO_CAMPO'),
  'field update is just latest timestamp, never a prior value');
assert.equal(leitura.cadastroAtual.camposPersonalizados[0].natureza,'ESTADO_ATUAL_NAO_HISTORICO');
assert.equal(leitura.cadastroAtual.origem,'Inbound pago');
assert.equal(leitura.cadastroAtual.campanha,'Campanha teste');
assert.equal(leitura.janelas.every(x=>x.compliance==='NAO_PONTUADO_SEM_REGRAS_HOMOLOGADAS'),true);

// Re-entry into same stage at a later point must be a NEW audit window.
const volta={...deal,deal_stage:{id:S[1]},deal_stage_histories:h.concat([
 {deal_stage_id:S[1],start_date:'2026-10-24T15:00:00Z',end_date:null}])};
const reentry=ctx.viRdAuditoriaJanelas_(volta,[],[],catalog,{});
assert.equal(reentry.janelas.length,6);
assert.equal(reentry.janelas[1].visita,1);
assert.equal(reentry.janelas[5].visita,2);
assert.notEqual(reentry.janelas[1].passagemId,reentry.janelas[5].passagemId);

// A gap / unexpected current stage should be exposed without inventing events.
const gap={...deal,deal_stage_histories:[
 {deal_stage_id:S[0],start_date:'2026-10-12T07:13:15Z',
  end_date:'2026-10-13T08:00:00Z'},
 {deal_stage_id:S[1],start_date:'2026-10-14T08:00:00Z',end_date:null}]};
const check=ctx.viRdAuditoriaJanelas_(gap,[],[],catalog,{});
assert.equal(check.janelas[0].fim,'2026-10-14T08:00:00.000Z');
assert.ok(check.janelas[0].alertas.includes('SAIDA_E_ENTRADA_NAO_COINCIDEM'));
assert.ok(check.inconsistencias.some(x=>x.tipo==='ETAPA_ATUAL_DIFERE_ULTIMA_PASSAGEM'));
assert.equal(ctx.viRdCanonizarPassagens_({...deal,deal_stage_histories:[]},catalog.nomes).passagens.length,0);

// Catalog must be selected by correct pipeline and not fall back silently to default.
const orig=ctx.viLeadRdGet_;
let queried=[];
ctx.viLeadRdGet_=(token,path,params)=>{
  queried.push({path,params});
  return {deal_stages:S.map((id,i)=>({id,name:['LEAD','CADENCIA','CONEXAO','AGENDA','PROPOSTA'][i]})),
    has_more:false,total:5};
};
const fetched=ctx.viRdCatalogoEtapas_('read-only-token',deal);
assert.equal(queried[0].path,'/deal_stages');
assert.equal(queried[0].params.deal_pipeline_id,deal.deal_pipeline.id);
assert.equal(fetched.fonte.completo,true);
assert.equal(fetched.nomes[S[2]],'CONEXAO');
ctx.viLeadRdGet_=orig;
const noPipeline=ctx.viRdCatalogoEtapas_('safe-token',{deal_stage:{id:S[0],name:'LEAD'}});
assert.equal(noPipeline.fonte.acessivel,false);
assert.equal(noPipeline.nomes[S[0]],'LEAD');

assert.match(widget,/'etapasrd','Etapas RD'/);
assert.match(widget,/function rdWindows\(d\)/);
assert.match(service,/parecer\.historicoRdEtapas/);
assert.doesNotMatch(stages,/\b(?:registrarLog_|atualizarPorCampo_|adicionarObjeto_|salvarSegredo_)\s*\(/);
console.log('RD stage windows: Beaga 6 -> 5, exact boundaries, re-entry, evidence, current fields and source status validated.');
