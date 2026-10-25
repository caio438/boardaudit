import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
const lead=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
new Function(source); new Function(lead);
const ctx=vm.createContext({Date,Intl,String,Number,Array,Boolean,Math,RegExp,Set,Error,Object});
vm.runInContext(source,ctx);
const now='2026-10-25T16:00:00Z';
assert.equal(ctx.viWidgetDiaBrasil_('2026-10-27'),'2026-10-27');
assert.equal(ctx.viWidgetDiaBrasil_('2026-10-25T02:00:00Z'),'2026-10-24');
function fixture(changes={}){
 return {dealId:'6acc888b98976f0023dc583f',
 negociacao:{nome:'SL8 reciclagem',etapaAtualNome:'Proposta enviada',etapaOrigem:'CONSULTA_ETAPA_RD',
 responsavel:'Closer Modelo',valorInformado:3500,previsaoFechamento:'2026-11-10',estadoFechamento:'EM_ABERTO'},
 fontes:{tarefas:{acessivel:true,completo:true},atividades:{acessivel:true,completo:true}},
 atividades:[],ligacoesBoard:Array.from({length:19},(_,i)=>({id:'call'+i,
 data:'2026-10-23T10:00:00Z',duracaoSegundos:2,temReferenciaGravacao:true})),
 tarefas:[{id:'abc',tipo:'call',assunto:'CAD 5 - whatsapp 1',concluida:true,
 dataOriginal:'2026-10-12',previstaPara:'2026-10-12T12:00:00Z'},
 {id:'def',tipo:'other',assunto:'Confirmar recebimento de proposta',
 dataOriginal:'2026-10-29',previstaPara:'2026-10-29T12:00:00Z',concluida:false,responsaveis:['Closer Modelo']}],
 eventos:[],cerebros:[],...changes};}
const input=fixture();
const out=ctx.viWidgetRefinarParecerV4_(ctx.viWidgetParecerDeterministico_(input),input);
assert.equal(out.versao,'0.4.4');
assert.equal(out.operacional.tipo,'PROPOSTA_E_FOLLOWUP');
assert.ok(out.operacional.fatos.some(x=>x.texto.includes('29/10/2026')));
assert.equal(out.planoOtimizacaoSdr.itens.find(x=>x.id==='voip').status,'NAO_VERIFICAVEL');
assert.equal(out.planoOtimizacaoSdr.itens.find(x=>x.id==='tarefas').status,'NAO_VERIFICAVEL');
assert.equal(out.inteligenciaComercial.itens.find(x=>x.id==='proposta').status,'NAO_VERIFICAVEL');
assert.ok(out.operacional.acoes.some(x=>x.id==='recebimento'));
assert.equal(out.operacional.papelSdrConfirmado,false);
assert.equal(out.notaCompliance,null);
const playbook=ctx.viWidgetPlaybookSalesOps_(input,out);
assert.equal(playbook.compliance,'NAO_PONTUADO_SEM_REGRA_HOMOLOGADA');
assert.equal(playbook.etapas.find(x=>x.id==='tentativa').status,'NAO_VERIFICAVEL');
assert.equal(playbook.etapas.find(x=>x.id==='proposta').status,'NAO_VERIFICAVEL');
const empty=fixture({atividades:[],tarefas:[],ligacoesBoard:[],
 fontes:{tarefas:{acessivel:false,completo:false},atividades:{acessivel:false,completo:false}}});
const weak=ctx.viWidgetRefinarParecerV4_(ctx.viWidgetParecerDeterministico_(empty),empty);
assert.equal(weak.operacional.fonteRdCompleta,false);
assert.ok(weak.operacional.acoes.some(x=>x.id==='fonte-tarefas'));
assert.ok(!weak.operacional.acoes.some(x=>x.id==='proximo-passo'));
assert.match(panel,/\.volum-embedded \.topbar\{display:none\}/);
assert.match(panel,/\.refresh-wrap\{position:static/);
assert.match(panel,/function operation\(d\)/);
assert.match(panel,/function playbook\(d\)/);
assert.match(panel,/Playbook VOLUM/);
assert.match(panel,/Todos os critérios técnicos/);
const script=(panel.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(script);new Function(script);
console.log('V4: etapa, SLA datado, 19 chamadas nao atribuidas, proposta nao comprovada, fonte parcial, interface embed OK.');
