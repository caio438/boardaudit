import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./VolumRdMultiClientBridge.gs',import.meta.url),'utf8');
const clienteRows=[
 {ID_CLIENTE:'CLI-BUFFET',NOME_CLIENTE:'Buffet Mais',STATUS:'ATIVO'},
 {ID_CLIENTE:'CLI-INGEE',NOME_CLIENTE:'INGEE',STATUS:'ATIVO'},
 {ID_CLIENTE:'CLI-CONVERTA',NOME_CLIENTE:'Converta',STATUS:'ATIVO'},
 {ID_CLIENTE:'CLI-WISETEC',NOME_CLIENTE:'Wisetec',STATUS:'ATIVO'}
];
const integrations={
 'CLI-BUFFET':{ATIVO:'SIM',ID_INTEGRACAO:'INT-BUFFET',CONFIG_JSON:'{}'},
 'CLI-INGEE':{ATIVO:'SIM',ID_INTEGRACAO:'INT-INGEE',CONFIG_JSON:JSON.stringify({auditoriaVOLUM:{
 pipelineId:'aaaaaaaaaaaaaaaaaaaaaaaa',closerUserIds:['bbbbbbbbbbbbbbbbbbbbbbbb'],closerStageIds:['cccccccccccccccccccccccc']}})}
};
const ctx={
 Object,String,Array,Boolean,Number,JSON,Date,RegExp,Math,
 APP:{sheets:{clientes:'CLIENTES',interacoes:'INTERACOES'}},
 vmBmCloserAutorizar_(){},
 vmBmCloserId_(v){if(!/^[a-f0-9]{24}$/.test(v))throw Error('ID');return v},
 vmBmCloserTexto_(v){return String(v||'')},
 vmBmCloserAtividades_(){return {cobertura:{},itens:{}}},
 obterIntegracaoCliente_(id){return integrations[id]||null},
 obterSegredo_(key){return key==='INTEGRACAO_TOKEN_INT-BUFFET'?'TOKEN_BUFFET':key==='INTEGRACAO_TOKEN_INT-INGEE'?'TOKEN_INGEE':''},
 lerObjetos_(name){return name==='CLIENTES'?clienteRows:[]},
 viLeadRdGet_(){throw Error('unmocked')},
 viLeadPaginar_(){return {itens:[],completo:true}},
 viLeadTarefas_(){return []},
 viLeadInteracoesBoard_(){return []},
 viLeadArquivosRd_(){return {itens:[],fonte:{acessivel:false}}},
 viLeadDataIso_(x){return x||''},
 Utilities:{DigestAlgorithm:{SHA_256:1},computeDigest(){return Array(32).fill(13)}}
};
vm.createContext(ctx);
vm.runInContext(source,ctx);
assert.equal(ctx.VM_RD_MULTI.permitidas.length,10);
for(const n of ['CONVERTA','WISETEC','IT WORKS','MAQUINACODE']){
 assert.ok(ctx.VM_RD_MULTI.excluidas.includes(n));
}
assert.throws(()=>ctx.vmRdMultiCliente_('CLI-CONVERTA'),/fora do escopo/);
assert.throws(()=>ctx.vmRdMultiCliente_('CLI-WISETEC'),/fora do escopo/);
assert.throws(()=>ctx.vmRdMultiCliente_('UNKNOWN'),/nao registrado/);
assert.equal(ctx.vmRdMultiIntegracao_(ctx.vmRdMultiCliente_('CLI-BUFFET')).token,'TOKEN_BUFFET');
assert.equal(ctx.vmRdMultiIntegracao_(ctx.vmRdMultiCliente_('CLI-INGEE')).token,'TOKEN_INGEE');
assert.equal(ctx.vmRdMultiCtx_('CLI-INGEE').escopo.pipelineId,'aaaaaaaaaaaaaaaaaaaaaaaa');
assert.equal(ctx.vmRdMultiEscopo_(ctx.vmRdMultiCliente_('CLI-BUFFET'),{config:{}}).pipelineId,'5f0f9bb808c0c723ae8d12a6');
const sample={
 id:'dddddddddddddddddddddddd',win:null,closed_at:null,
 user:{id:'bbbbbbbbbbbbbbbbbbbbbbbb'},deal_pipeline:{id:'aaaaaaaaaaaaaaaaaaaaaaaa'},
 deal_stage:{id:'cccccccccccccccccccccccc'}
};
const scope=ctx.vmRdMultiCtx_('CLI-INGEE').escopo;
assert.equal(ctx.vmRdMultiElegivel_(sample,scope),true);
assert.equal(ctx.vmRdMultiElegivel_({...sample,win:true},scope),false);
assert.equal(ctx.vmRdMultiElegivel_({...sample,win:false},scope),false);
assert.equal(ctx.vmRdMultiElegivel_({...sample,hold:true},scope),false);
assert.equal(ctx.vmRdMultiElegivel_({...sample,user:{id:'zzzz'}},scope),false);
assert.equal(ctx.vmRdMultiElegivel_({...sample,status:'lost'},scope),false);
const available=ctx.VOLUM_RD_CONTAS_DISPONIVEIS();
assert.equal(available.totalPermitidas,10);
assert.ok(available.contas.some(x=>x.nome==='INGEE'&&x.credencialRegistrada&&x.escopoConfigurado));
assert.ok(!available.contas.some(x=>x.nome==='Converta'||x.nome==='Wisetec'));
assert.equal(/function\s+doGet|function\s+doPost/.test(source),false);
console.log('VOLUM RD multiclient isolated credentials and exclusion tests passed');
