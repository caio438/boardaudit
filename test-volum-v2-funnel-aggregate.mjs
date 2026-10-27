import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./VolumIntelligenceV2Core.gs',import.meta.url),'utf8');
const context=vm.createContext({Date,Array,Object,String,Number,Boolean,RegExp,Math,isNaN});
vm.runInContext(source,context,{timeout:3000});

const result=context.VOLUM_V2_AGREGAR_FUNIL_([
  {dealId:'d1',phase:'CONEXAO',coverage:{complete:true},sdrStatus:'PARCIAL',closerStatus:'NAO_APLICAVEL',
   owner:{id:'u1',name:'Ana',role:'SDR'},unresolvedCriteria:2},
  {dealId:'d2',phase:'REUNIAO',coverage:{complete:false},sdrStatus:'CUMPRIDO',closerStatus:'NAO_CUMPRIDO',
   owner:{id:'u2',name:'Bruno',role:'CLOSER'},unresolvedCriteria:3,withoutNextStep:true}
]);

assert.equal(result.schema,'VOLUM_SALES_OPS_V2_FUNNEL');
assert.equal(result.totalLeads,2);
assert.equal(result.leadsWithCompleteCoverage,1);
assert.equal(result.leadsWithoutNextStep,1);
assert.equal(result.byPhase.CONEXAO,1);
assert.equal(result.byPhase.REUNIAO,1);
assert.equal(result.sdr.parciais,1);
assert.equal(result.closer.naoAplicaveis,1);
assert.equal(result.closer.desvios,1);
assert.equal(result.priorities[0].dealId,'d2');
assert.equal(result.byOwner.u2.unresolved,3);

console.log('VOLUM V2 funnel macro aggregate: OK');
