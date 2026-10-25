import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('./VolumWidgetWebApp.gs',import.meta.url),'utf8');
const lead=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const dealId='6acc888b98976f0023dc583f';

assert.match(panel,/<main class="shell" id="volum-root" data-deal-id="<\?= dealId \?>">/);
assert.doesNotMatch(panel,/<\?=\s*JSON\.stringify\(dealId\)/);
assert.match(panel,/document\.getElementById\("volum-root"\)\.dataset\.dealId/);
assert.match(entry,/template\.dealId\s*=\s*dealId/);
const idSource=lead.match(/function viLeadId_\(entrada\) \{[\s\S]*?\n\}/);
assert.ok(idSource,'Validator do ID RD nao encontrado');
const validateId=new Function(idSource[0]+';return viLeadId_;')();
assert.equal(validateId(dealId),dealId);
assert.equal(validateId('https://crm.rdstation.com/app/deals/'+dealId+'?view=pipeline'),dealId);

const script=panel.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script,'JavaScript da widget nao encontrado');
new Function(script[1]);

function runPanel(id) {
  const calls=[],messages=[];
  const card={textContent:'',innerHTML:''};
  const nonce='a'.repeat(32),scope='b'.repeat(32);
  const top={postMessage:m=>messages.push(m)};
  const listeners={};
  const document={
    getElementById:key=>key==='volum-root'?{dataset:{dealId:id}}:key==='card'?card:null,
    querySelector:s=>s.includes('volum-history-nonce')?{content:nonce}:
      s.includes('volum-cache-scope')?{content:scope}:null,
    documentElement:{classList:{add(){}}}
  };
  const store=new Map();
  const window={top,addEventListener:(k,fn)=>{listeners[k]=fn;},
    localStorage:{getItem:k=>store.get(k)||null,
      setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
  const runner={
    withSuccessHandler(handler){this.onSuccess=handler;return this;},
    withFailureHandler(handler){this.onFailure=handler;return this;},
    VOLUM_WIDGET_AUDITAR_SESSAO(deal,enableGemini){
      calls.push({id:deal,enableGemini,mode:'API'});
    },
    VOLUM_WIDGET_AUDITAR_SESSAO_COM_HISTORICO(deal,history,enableGemini){
      calls.push({id:deal,history,enableGemini,mode:'HISTORICO'});
    }
  };
  const context={document,window,google:{script:{run:runner}},
    setTimeout:()=>1,clearTimeout:()=>{},console};
  vm.runInNewContext(script[1],context,{timeout:3000});
  return {calls,card,messages,nonce,scope,top,listeners};
}
const valid=runPanel(dealId);
assert.equal(valid.calls.length,0,'cache deve ser consultado antes do motor de IA');
assert.equal(valid.messages[0].op,'GET');
valid.listeners.message({data:{type:'VOLUM_CACHE_RESPONSE',
  dealId,nonce:valid.nonce,scope:valid.scope,cacheVersion:'VOLUM_WIDGET_CACHE_051',
  op:'GET',entry:null},origin:'https://crm.rdstation.com',source:valid.top});
assert.equal(valid.calls.length,0,'sem historico aguardar leitura UI');
const history={dealId,events:[{uiIndex:0,kind:'ANOTACAO',detail:'Teste de auditoria'}],
  coverage:{available:true,complete:true,totalVisual:1}};
valid.listeners.message({data:{type:'VOLUM_RD_UI_HISTORY',
  dealId,nonce:valid.nonce,history},origin:'https://crm.rdstation.com',source:valid.top});
assert.equal(valid.calls.length,1);
assert.equal(valid.calls[0].id,dealId);
assert.equal(valid.calls[0].enableGemini,true);
assert.equal(valid.calls[0].mode,'HISTORICO');
const jsonWrapped=runPanel('"'+dealId+'"');
assert.equal(jsonWrapped.calls.length,0);
assert.match(jsonWrapped.card.textContent,/inv[aá]lida/);
const encoded=runPanel('%22'+dealId+'%22');
assert.equal(encoded.calls.length,0);
const missing=runPanel('');
assert.equal(missing.calls.length,0);
console.log('Widget RD dealId: identidade, cache, historico antes de RPC e IDs invalidos protegidos');
