import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const main=fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('./VolumWidgetWebApp.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
const blocks=main.match(/function doGet\(e\) \{[\s\S]*?\n\}\n\nfunction verificarAcessoBoard\(/);
assert.ok(blocks,'Rota board nao identificada');
new Function(main);
new Function(bridge);
const mock={
  Session:{getActiveUser:()=>({getEmail:()=> 'crm@govolum.com'})},
  viLeadId_:value=> {
    if(!/^[0-9a-f]{24}$/.test(String(value)))throw new Error('ID invalido');
    return value;
  },
  VOLUM_WIDGET:{emailsAutorizados:['crm@govolum.com']},
  HtmlService:{
    XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},
    createTemplateFromFile:name=>({
      name,dealId:null,
      evaluate(){return {
        name:this.name,dealId:this.dealId,
        setTitle(){return this},
        setXFrameOptionsMode(){return this},
        addMetaTag(){return this}
      }}
    })
  },
  APP:{nome:'BoardAudit',versao:'teste'},
  audBuildAtual_:()=>({id:'SHA',versao:'teste'})
};
let chamadas=0;
vm.createContext(mock);
vm.runInContext(bridge, mock);
const original=mock.viWidgetRenderizarWebApp_;
mock.viWidgetRenderizarWebApp_=function(e){chamadas++;return original(e)};
vm.runInContext(blocks[0].replace(/\n\nfunction verificarAcessoBoard\($/,''),mock);
const dealId='6acc888b98976f0023dc583f';
const widget=mock.doGet({parameter:{volum_widget:'1',dealId}});
assert.equal(widget.name,'VolumWidgetPanel');
assert.equal(widget.dealId,dealId);
assert.equal(chamadas,1);
const board=mock.doGet({parameter:{}});
assert.equal(board.name,'Index');
assert.equal(chamadas,1);
const boardOther=mock.doGet({parameter:{volum_widget:'0',dealId}});
assert.equal(boardOther.name,'Index');
assert.equal(chamadas,1);
assert.throws(()=>mock.doGet({parameter:{volum_widget:'1',dealId:'not-id'}}),/invalido/);
mock.Session.getActiveUser=()=>({getEmail:()=> 'outro@example.org'});
assert.throws(()=>mock.doGet({parameter:{volum_widget:'1',dealId}}),/autorizado/);
const script=panel.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script,'Script do painel ausente');
new Function(script[1]);
assert.ok(panel.includes('data-deal-id="<?= dealId ?>"'));
console.log('VOLUM widget route: board preservado, autenticacao obrigatoria, dealId validado e painel legivel');
