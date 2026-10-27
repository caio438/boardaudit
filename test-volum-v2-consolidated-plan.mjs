import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./VolumIntelligenceV2Core.gs',import.meta.url),'utf8');
const context=vm.createContext({Date,Array,Object,String,Number,Boolean,RegExp,Math,isNaN});
vm.runInContext(source,context,{timeout:3000});

const plan=context.VOLUM_V2_CONSOLIDAR_PLANO_({
  deal:{id:'deal-1',currentStage:{volumPhase:'REUNIAO',stageName:'Reunião'},owner:{name:'Bruno',role:'CLOSER'}},
  events:[
    {occurredAt:'2026-10-27T09:00:00Z',type:'STAGE_CHANGED',source:'CRM',volumPhase:'CONEXAO',actorName:'Ana'},
    {occurredAt:'2026-10-27T11:00:00Z',type:'NO_SHOW',source:'CRM',volumPhase:'AGENDA',actorName:'Bruno'}
  ],
  coverage:{complete:true}
},[
  {agent:'LEAD',items:[{id:'entrada',title:'Entrada do lead',status:'CUMPRIDO',evidence:'CRM'}]},
  {agent:'CADENCIA',items:[{id:'cadencia',title:'Cadência SDR',status:'PARCIAL',evidence:'Tarefas',action:'Completar sequência'}]},
  {agent:'CONEXAO',items:[{id:'conexao',title:'Registro da conexão',status:'CUMPRIDO',evidence:'Canvas + CRM'}]},
  {agent:'AGENDA',items:[{id:'noshow',title:'No-show identificado',status:'CUMPRIDO',evidence:'CRM'}]},
  {agent:'REUNIAO',items:[{id:'recovery',title:'Recovery após no-show',status:'NAO_CUMPRIDO',evidence:'Nenhuma tarefa posterior',action:'Criar recovery com data'}]}
]);

assert.equal(plan.schema,'VOLUM_SALES_OPS_V2_PLAN');
assert.equal(plan.process.status,'NAO_CUMPRIDO');
assert.equal(plan.planSdr.status,'PARCIAL');
assert.equal(plan.planCloser.status,'NAO_CUMPRIDO');
assert.equal(plan.planSdr.items.length,4);
assert.equal(plan.planCloser.items.length,1);
assert.equal(plan.planCloser.unresolved[0].id,'recovery');
assert.equal(plan.currentState.phase,'REUNIAO');
assert.equal(plan.history.length,2);
assert.equal(plan.history[1].type,'NO_SHOW');

const noCloser=context.VOLUM_V2_CONSOLIDAR_PLANO_({deal:{id:'deal-2'},events:[]},[
  {agent:'LEAD',items:[{id:'x',status:'CUMPRIDO'}]}
]);
assert.equal(noCloser.planCloser.status,'NAO_APLICAVEL');
assert.equal(noCloser.planCloser.items.length,0);

console.log('VOLUM V2 consolidated SDR/Closer plan: OK');
