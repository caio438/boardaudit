import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./VolumIntelligenceV2Core.gs',import.meta.url),'utf8');
const context=vm.createContext({Date,Array,Object,String,Number,Boolean,RegExp,Math,isNaN});
vm.runInContext(source,context,{timeout:3000});

const snapshot=context.VOLUM_V2_SNAPSHOT_FROM_LEAD_({
  modo:'SOMENTE_LEITURA',
  versao:'PILOTO_V2_TIPOS_ATIVIDADE',
  dealId:'deal-1',
  idCliente:'CLI-1',
  negociacao:{
    nome:'Lead Teste',
    etapaAtualId:'s2',
    etapaAtualNome:'Conexão',
    responsavel:'Ana SDR'
  },
  fontes:{
    atividades:{acessivel:true,completo:true},
    tarefas:{acessivel:true,completo:true}
  },
  eventos:[
    {ref:'stage-1',tipo:'ENTRADA_ETAPA',data:'2026-10-27T09:00:00Z',fonte:'RD_NEGOCIACAO',etapaId:'s2',etapaNome:'Conexão'},
    {ref:'note-1',tipo:'ANOTACAO',data:'2026-10-27T10:00:00Z',fonte:'RD_ATIVIDADES'}
  ],
  cerebros:[{agente:'LEAD'}]
},{
  tenantId:'CLI-1',
  crm:'RD_STATION',
  pipelines:[{
    id:'pipe-1',
    name:'Funil',
    stages:[{id:'s2',name:'Conexão',order:2,volumPhase:'CONEXAO',expectedRole:'SDR'}]
  }],
  users:[{id:'u1',name:'Ana SDR',role:'SDR'}]
});

assert.equal(snapshot.schema,'VOLUM_SALES_OPS_V2');
assert.equal(snapshot.deal.id,'deal-1');
assert.equal(snapshot.deal.currentStage.volumPhase,'CONEXAO');
assert.equal(snapshot.events.length,2);
assert.equal(snapshot.events[0].source,'RD_NEGOCIACAO');
assert.equal(snapshot.coverage.complete,true);
assert.equal(snapshot.legacy.readOnly,true);
assert.equal(snapshot.legacy.agentResultsAvailable,true);

console.log('VOLUM V2 lead snapshot adapter: OK');
