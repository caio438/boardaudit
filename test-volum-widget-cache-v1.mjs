import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load=n=>fs.readFileSync(new URL('./'+n,import.meta.url),'utf8');
const panel=load('VolumWidgetPanel.html');
const service=load('VolumWidgetService.gs'),ops=load('VolumWidgetRdOps.gs');
const extension=load('extensions/volum-intelligence/content.js');
const bridge=load('VolumWidgetWebApp.gs');
const parsed=panel.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(parsed,'script widget presente');
for(const src of [parsed[1],service,ops,extension,bridge])new Function(src);
assert.match(extension,/lastDealId/,'troca de aba no mesmo deal nao fecha o painel');
assert.match(extension,/VOLUM_CACHE_REQUEST/);
assert.match(extension,/cacheMaxBytes=450000/);
assert.doesNotMatch(extension,/\n\s*refresh\(\);\s*\n\s*\};\s*\n\s*const clean/,
  'historico visual nao deve ser relido incondicionalmente na abertura');

const deal='6ac3c21309badb002bf5a389',scope='a'.repeat(32),nonce='b'.repeat(32);
const complete={
  versao:'0.5.1-RD',
  negociacao:{nome:'Negociacao de teste',etapaAtualNome:'Cadencia'},
  diagnosticoRdOperacional:{ativo:true,titulo:'Leitura por evidencia',etapaAtual:'Cadencia',
    resumo:{total:2,etapas:1,registrosNaEtapaAtual:2},criterios:[],acoes:[],sumario:[]},
  trilhaDadosAgentes:{historicoRd:{completo:true,eventos:2}},
  agentesDetalhados:[],fontesCobertura:[],historicoRdEtapas:{janelas:[]}
};
const history={dealId:deal,events:[{uiIndex:0,kind:'ANOTACAO',detail:'teste'}],
  coverage:{available:true,complete:true,totalVisual:1}};
function runPanel({precache=null}={}){
  const store=new Map();
  const entry={cacheVersion:'VOLUM_WIDGET_CACHE_051',
    analysisRevision:'TGR_OPERATIONAL_20261026',scope,dealId:deal,
    savedAt:Date.now()-10_000,answer:complete};
  if(precache==='valid')store.set('volum_cache_051_'+scope+'_'+deal,JSON.stringify(entry));
  if(precache==='expired')store.set('volum_cache_051_'+scope+'_'+deal,
    JSON.stringify({...entry,savedAt:Date.now()-3_900_000}));
  if(precache==='legacy')store.set('volum_cache_051_'+scope+'_'+deal,
    JSON.stringify({...entry,analysisRevision:undefined}));
  const root={dataset:{dealId:deal}},card={innerHTML:'',textContent:''};
  const listeners={},messages=[],rpcCalls=[],timers=new Map();
  let nextTimer=1;
  const top={postMessage(value,target){messages.push({value,target});}};
  const win={top,addEventListener(name,fn){listeners[name]=fn;},
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),
      removeItem:k=>store.delete(k)}};
  const doc={getElementById:id=>id==='volum-root'?root:card,
    querySelector:sel=>sel.includes('volum-history-nonce')?{content:nonce}:
      sel.includes('volum-cache-scope')?{content:scope}:null,
    documentElement:{classList:{add(){}}}};
  const rpc={withSuccessHandler(handler){
    return {withFailureHandler(error){
      return {
        VOLUM_WIDGET_AUDITAR_SESSAO_COM_HISTORICO(...args){rpcCalls.push({type:'HISTORY',args,handler,error});},
        VOLUM_WIDGET_AUDITAR_SESSAO(...args){rpcCalls.push({type:'API_ONLY',args,handler,error});}
      };
    }};
  }};
  const ctx=vm.createContext({document:doc,window:win,google:{script:{run:rpc}},
    setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;},
    clearTimeout:(id)=>timers.delete(id),console});
  vm.runInContext(parsed[1],ctx);
  const send=(value)=>listeners.message({data:value,origin:'https://crm.rdstation.com',source:top});
  const respondCache=(remoteEntry)=>send({type:'VOLUM_CACHE_RESPONSE',
    dealId:deal,nonce,scope,cacheVersion:'VOLUM_WIDGET_CACHE_051',
    op:'GET',entry:remoteEntry});
  const deliverHistory=(hist=history)=>send({type:'VOLUM_RD_UI_HISTORY',
    dealId:deal,nonce,history:hist});
  function flush(ms){
    const selected=[...timers].filter(([,t])=>t.ms===ms);
    for(const [id,t] of selected){timers.delete(id);t.fn();}
  }
  return {ctx,card,messages,rpcCalls,store,respondCache,deliverHistory,flush,entry};
}

const hit=runPanel({precache:'valid'});
assert.equal(hit.rpcCalls.length,0,'cache local valido nunca executa Gemini novamente');
assert.match(hit.card.innerHTML,/Análise salva em cache/);
vm.runInContext("changeTab('conexao');changeTab('agenda');changeTab('reuniao');",hit.ctx);
assert.equal(hit.rpcCalls.length,0,'troca de aba nao chama backend');
assert.ok(!hit.messages.some(x=>x.value.type==='VOLUM_REQUEST_RD_UI_HISTORY'),
  'cache valido impede releitura do Historico RD na abertura');

const legacy=runPanel({precache:'legacy'});
assert.equal(legacy.store.size,0,'cache de revisao antiga e descartado ao abrir');
const remote=runPanel();
assert.equal(remote.messages[0].value.op,'GET','consulta armazenamento extensao');
remote.respondCache(remote.entry);
assert.equal(remote.rpcCalls.length,0,'cache remoto deve reidratar sem API');
assert.match(remote.card.innerHTML,/Análise salva em cache/);

const cold=runPanel({precache:'expired'});
assert.equal(cold.store.size,0,'cache expirado removido do localStorage');
cold.respondCache(null);
assert.ok(cold.messages.some(x=>x.value.type==='VOLUM_REQUEST_RD_UI_HISTORY'));
assert.equal(cold.rpcCalls.length,0,'aguardar Historico antes do primeiro processamento');
cold.deliverHistory();
assert.equal(cold.rpcCalls.length,1);
assert.equal(cold.rpcCalls[0].type,'HISTORY');
cold.deliverHistory();
assert.equal(cold.rpcCalls.length,1,'Historico duplicado nao deve duplicar RPC');
cold.rpcCalls[0].handler(complete);
assert.ok([...cold.store.keys()].some(k=>k.startsWith('volum_cache_051')),
  'resultado completo deve ficar persistido');
assert.ok(cold.messages.some(x=>x.value.op==='PUT'));
vm.runInContext("changeTab('sdr');changeTab('closer');",cold.ctx);
assert.equal(cold.rpcCalls.length,1);

vm.runInContext('audit()',cold.ctx);
assert.ok(cold.messages.some(x=>x.value.op==='CLEAR'),'atualizacao invalida cache');
assert.equal(cold.rpcCalls.length,1,'refresh deve esperar Historico novo');
cold.deliverHistory();
assert.equal(cold.rpcCalls.length,2,'refresh executa uma chamada com o Historico');
cold.rpcCalls[1].handler(complete);
assert.equal(cold.rpcCalls.length,2);
assert.ok(cold.messages.filter(x=>x.value.op==='PUT').length>=2);

const timeout=runPanel();
timeout.flush(750);
assert.ok(timeout.messages.some(x=>x.value.type==='VOLUM_REQUEST_RD_UI_HISTORY'));
timeout.flush(14000);
assert.equal(timeout.rpcCalls.length,1,'fallback sem extensao evita tela vazia');
assert.equal(timeout.rpcCalls[0].type,'API_ONLY');
timeout.deliverHistory();
timeout.rpcCalls[0].handler({...complete,diagnosticoRdOperacional:{ativo:false}});
assert.equal(timeout.rpcCalls.length,2,'Historico completo tardio requer uma unica reanalise');
timeout.rpcCalls[1].handler(complete);
assert.equal(timeout.rpcCalls.length,2);

const sandbox=vm.createContext({console});
vm.runInContext(service,sandbox);
vm.runInContext(ops,sandbox);
const visual=[
  {id:'UI_0',data:'2026-10-13T13:00:00Z',acao:'EMAIL_ENVIADO',tipo:'email',
    texto:'Enviou um e-mail',passagemId:'p1'},
  {id:'UI_1',data:'2026-10-13T13:01:00Z',acao:'WHATSAPP_ABERTO',tipo:'whatsapp_open',
    texto:'Abriu um WhatsApp Web',passagemId:'p1'},
  {id:'UI_2',data:'2026-10-13T15:00:00Z',acao:'EMAIL_ENVIADO',tipo:'email',
    texto:'Enviou um e-mail',passagemId:'p1'}
];
const read={dealId:deal,atividades:[
  {id:'a1',dealId:deal,data:'2026-10-13T13:00:20Z',tipo:'email',
    texto:'Segue convite para a reunião',temLinkGravacao:false},
  {id:'a2',dealId:'ffffffffffffffffffffffff',data:'2026-10-13T15:00:00Z',
    tipo:'email',texto:'PROPOSTA OUTRO CLIENTE'},
  {id:'a3',dealId:deal,data:'2026-10-13T15:00:00Z',tipo:'email',texto:'Email primeiro'},
  {id:'a4',dealId:deal,data:'2026-10-13T15:00:01Z',tipo:'email',texto:'Email segundo'}
]};
const mapped=sandbox.viWidgetConciliarAtividadesAgentes_(read,visual);
assert.equal(mapped.rastreio.eventosConciliados,1);
assert.equal(mapped.rastreio.pareamentosAmbiguos,1);
assert.equal(mapped.atividades[0].idAtividadeApi,'a1');
assert.match(mapped.atividades[0].texto,/convite/);
assert.doesNotMatch(JSON.stringify(mapped),/PROPOSTA OUTRO CLIENTE/);
assert.equal(mapped.atividades[1].fontesConciliadas.length,1,
  'WhatsApp aberto nao se transforma em envio');
assert.equal(mapped.atividades[2].fontesConciliadas.length,1,
  'ambiguidade nao pode preencher email');
const ia=sandbox.viWidgetValidarInterpretacaoRd_({
  fatos:[
    {criterio:'WhatsApp',conclusao:'Enviou uma mensagem pelo WhatsApp',referencia:'UI_1'},
    {criterio:'Envio',conclusao:'Cliente confirmou recebimento da proposta',referencia:'UI_0'},
    {criterio:'E-mail',conclusao:'Há registro de envio de email',referencia:'UI_0'},
    {criterio:'Inexistente',conclusao:'Cliente falou com SDR',referencia:'UI_999'}
  ]
},{historicoRdEtapas:{linhaDoTempo:{eventos:visual}}});
assert.equal(ia.fatos.length,1,'só interpretação compativel com o evento entra');
assert.equal(ia.referenciasDescartadas,3);
assert.equal(ia.fatos[0].referencia,'UI_0');
assert.equal(ia.fatos[0].agente,'CADENCIA');
assert.equal(ia.fatos[0].confianca,'INDICIO_INTERPRETATIVO_COM_REFERENCIA_RD');
// Garantia do ZIP distribuivel: arquivos sao exatamente os fontes da
// extensao 0.3.2, sem ZIP invalido, caminho escapando ou versao anterior.
const zip=fs.readFileSync(new URL('./dist/volum-intelligence-chrome-0.3.2.zip',import.meta.url));
const expected=['content.js','manifest.json','options.html','options.js',
  'service-worker.js','sidebar.css','sidebar.html','sidebar.js'];
const zipFiles=new Map();
let pos=0;
while(pos+30<=zip.length&&zip.readUInt32LE(pos)===0x04034b50){
  const method=zip.readUInt16LE(pos+8),compressed=zip.readUInt32LE(pos+18);
  const size=zip.readUInt32LE(pos+22),len=zip.readUInt16LE(pos+26),
    extra=zip.readUInt16LE(pos+28);
  const filename=zip.subarray(pos+30,pos+30+len).toString('utf8');
  const start=pos+30+len+extra,end=start+compressed;
  assert.equal(method,0,'ZIP armazenado sem compressao irregular');
  assert.equal(compressed,size,'ZIP coerente sem compressao');
  assert.ok(expected.includes(filename),'ZIP somente contem arquivos da extensao');
  assert.ok(end<=zip.length,'ZIP sem byte overflow');
  const contents=zip.subarray(start,end).toString('utf8');
  assert.equal(contents,load('extensions/volum-intelligence/'+filename),
    'Pacote difere do codigo aprovado: '+filename);
  zipFiles.set(filename,contents);
  pos=end;
}
assert.equal(zipFiles.size,8,'ZIP da extensao completo');
assert.equal(JSON.parse(zipFiles.get('manifest.json')).version,'0.3.2');
assert.equal(zip.readUInt32LE(pos),0x02014b50,'central directory ZIP presente');
assert.ok(zip.includes(Buffer.from([0x50,0x4b,0x05,0x06])),'registro final do ZIP presente');

console.log('VOLUM cache: 1h/conta/negociacao, abas sem RPC, refresh explícito, dedupe, fallback, API-RD/Board/IA com fonte.');
