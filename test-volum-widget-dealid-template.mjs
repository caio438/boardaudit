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
  const calls=[];
  const card={textContent:''};
  const document={getElementById:key=>key==='volum-root'?{dataset:{dealId:id}}:key==='card'?card:null};
  const runner={
    withSuccessHandler(handler){this.onSuccess=handler;return this;},
    withFailureHandler(handler){this.onFailure=handler;return this;},
    VOLUM_WIDGET_AUDITAR_SESSAO(id,enableGemini){calls.push({id,enableGemini});}
  };
  vm.runInNewContext(script[1],{document,google:{script:{run:runner}}},{timeout:3000});
  return {calls,card};
}
const valid=runPanel(dealId);
assert.deepEqual(valid.calls,[{id:dealId,enableGemini:true}]);
assert.equal(valid.card.textContent,'Atualizando…');
const jsonWrapped=runPanel('"'+dealId+'"');
assert.equal(jsonWrapped.calls.length,0);
assert.match(jsonWrapped.card.textContent,/N[aã]o foi poss.vel identificar/);
const encoded=runPanel('%22'+dealId+'%22');
assert.equal(encoded.calls.length,0);
const missing=runPanel('');
assert.equal(missing.calls.length,0);
console.log('Widget RD dealId: URL, passagem no DOM e RPC exata testadas, valor duplicado rejeitado sem consulta');
