import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./VolumIntelligenceV2Core.gs',import.meta.url),'utf8');
const context=vm.createContext({Date,Array,Object,String,Number,Boolean,RegExp,Math,isNaN});
vm.runInContext(source,context,{timeout:3000});

const config=context.VOLUM_V2_NORMALIZAR_CONFIG_({
  tenantId:'Wisetec',
  crm:'rd_station',
  pipelines:[{
    id:'pipe-1',
    name:'Funil Comercial',
    stages:[
      {id:'s1',name:'Entrada',order:1,volumPhase:'LEAD',expectedRole:'SDR'},
      {id:'s2',name:'Conexão',order:2,volumPhase:'CONEXAO',expectedRole:'SDR'},
      {id:'s3',name:'Reunião',order:3,volumPhase:'REUNIAO',expectedRole:'CLOSER'}
    ]
  }],
  users:[
    {id:'u1',name:'Ana SDR',role:'SDR',team:'Pré-vendas'},
    {id:'u2',name:'Bruno Closer',role:'CLOSER',team:'Vendas'}
  ]
});

assert.equal(config.tenantId,'wisetec');
assert.equal(config.crm,'RD_STATION');
assert.equal(config.pipelines[0].stages[1].volumPhase,'CONEXAO');
assert.equal(context.VOLUM_V2_MAPEAR_ETAPA_(config,'pipe-1','s2','').found,true);
assert.equal(context.VOLUM_V2_MAPEAR_ETAPA_(config,'pipe-1','','Reunião').expectedRole,'CLOSER');

const timeline=context.VOLUM_V2_CONSTRUIR_LINHA_TEMPO_({
  dealId:'deal-1',
  deal:{id:'deal-1',name:'Lead Teste',pipelineId:'pipe-1',stageId:'s2',stageName:'Conexão',ownerId:'u1'},
  events:[
    {id:'e2',dealId:'deal-1',type:'NOTE',occurredAt:'2026-10-27T10:00:00Z',actorUserId:'u1',payload:{text:'conexão registrada'}},
    {id:'e1',dealId:'deal-1',type:'STAGE_CHANGED',occurredAt:'2026-10-27T09:00:00Z',actorUserId:'u1',pipelineId:'pipe-1',stageId:'s2',stageName:'Conexão',evidenceStatus:'COMPROVADO'}
  ],
  coverage:{complete:true,missingSources:[],authorizedSources:['CRM']}
},config);

assert.equal(timeline.schema,'VOLUM_SALES_OPS_V2');
assert.equal(timeline.deal.currentStage.volumPhase,'CONEXAO');
assert.equal(timeline.deal.currentStage.expectedRole,'SDR');
assert.equal(timeline.deal.owner.role,'SDR');
assert.equal(timeline.events.length,2);
assert.equal(timeline.events[0].id,'e1');
assert.equal(timeline.events[0].evidence.status,'COMPROVADO');
assert.equal(timeline.events[1].actorName,'Ana SDR');
assert.equal(timeline.coverage.complete,true);

console.log('VOLUM V2 core contract and timeline: OK');
