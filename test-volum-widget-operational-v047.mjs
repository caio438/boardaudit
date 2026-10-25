import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const lead=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
new Function(lead);new Function(service);
const ctx=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(lead,ctx);vm.runInContext(service,ctx);
const deal='6acc888b98976f0023dc583f';
assert.equal(ctx.viLeadReferenciaGravacao_('Reunião: https://meet.google.com/abc'),false);
assert.equal(ctx.viLeadReferenciaGravacao_('Gravação https://tldv.io/app/meetings/token-private'),true);
const safe=ctx.viLeadAtividades_([{id:'e1',deal_id:deal,type:'email',text:'Gravação https://tldv.io/app/meetings/secret'}],true)[0];
assert.equal(safe.temLinkGravacao,true);
assert.doesNotMatch(safe.texto,/secret/);
assert.equal(ctx.viWidgetRecebimentoConfirmado_('Cliente confirmou recebimento da proposta'),true);
assert.equal(ctx.viWidgetRecebimentoConfirmado_('Aguardando confirmação de recebimento da proposta'),false);
assert.equal(ctx.viWidgetRecebimentoConfirmado_('Enviamos a proposta por email'),false);
assert.equal(ctx.viWidgetEhFollowup_({assunto:'Follow-up proposta'}),true);
assert.equal(ctx.viWidgetEhFollowup_({assunto:'Reunião agendada'}),false);
function fixture(p={}) {return {negociacao:{etapaAtualNome:'Proposta enviada'},fontes:{
 atividades:{acessivel:true,completo:true},tarefas:{acessivel:true,completo:true},
 arquivosRd:{acessivel:false,completo:false,motivo:'OAUTH_V2_NAO_CONFIGURADO'}},
 atividades:[],tarefas:[],arquivosRd:[],reunioesCalendarioBoard:[],
 ...p};}
const unknown=ctx.viWidgetAuditoriaOperacional_(fixture());
assert.equal(unknown.criterios.find(x=>x.id==='proposta').estado,'FONTE_INCOMPLETA');
assert.equal(unknown.criterios.find(x=>x.id==='followup').estado,'MARCO_REUNIAO_NAO_VERIFICADO');
const scenario=fixture({atividades:[
 {id:'e1',tipo:'email',data:'2026-10-22T16:00:00Z',texto:'Formalização: enviamos proposta',textoDisponivel:true},
 {id:'n1',tipo:'note',data:'2026-10-23T10:00:00Z',texto:'Cliente confirmou recebimento da proposta',textoDisponivel:true,temLinkGravacao:true}],
 arquivosRd:[{id:'f1',nome:'Proposta comercial.pdf',extensao:'pdf',data:'2026-10-23T15:00:00Z'}],
 reunioesCalendarioBoard:[{id:'r1',data:'2026-10-21T14:00:00Z'}],
 tarefas:[{id:'t1',assunto:'Follow-up da proposta',criadaEm:'2026-10-24T12:00:00Z',previstaPara:'2026-10-27T12:00:00Z',concluida:false}]});
const audit=ctx.viWidgetAuditoriaOperacional_(scenario);
assert.equal(audit.criterios.filter(x=>x.estado==='INDICIO').length,5);
assert.ok(audit.criterios.every(x=>x.fonte&&x.acao));
assert.doesNotMatch(JSON.stringify(audit),/tldv\\.io\\/app\\/meetings\\/secret/);
assert.doesNotMatch(panel,/<header class="topbar"/);
assert.match(panel,/function operationalAudit\\(d\\)/);
const script=(panel.match(/<script>([\\s\\S]*?)<\\/script>/)||[])[1];
new Function(script);
console.log('V0.4.7: fonte inacessivel, falso positivo, link sanitizado, apos reuniao e layout OK.');
