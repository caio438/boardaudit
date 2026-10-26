import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const lead=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
new Function(lead);new Function(service);
const script=(panel.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(script);new Function(script);
const c=vm.createContext({Object,Array,String,Number,Set,Date,Boolean,Math,RegExp,Error,Intl});
vm.runInContext(lead,c);
const t0='2026-10-12T07:13:15.397Z';
const event=(id,date,text)=>({id,data:date,texto:text});
const ctx={criadaEm:t0,negociacao:{responsavel:'Operador A'},cadastro:{},
  timeline:[{tipo:'ENTRADA_ETAPA',data:t0},{tipo:'ATIVIDADE',data:'2026-10-12T07:13:23.543Z'}],
  fontes:{atividades:{acessivel:true,completo:false},tarefas:{acessivel:true,completo:true}},
  tarefas:[{id:'t1',tipo:'call',assunto:'CAD 3 - Ligação 1.1',criadaEm:'2026-10-12T07:25:06Z'}],
  atividades:[event('a1','2026-10-12T07:13:23.543Z','[CAD 1] WHATSAPP - ENVIADO; [CAD 2] EMAIL - ENVIADO')],
  ligacoes:[],etapas:[{etapaId:'x',inicio:t0}]};
const d=c.viCerebroLead_(ctx);
assert.equal(d.agente,'LEAD');
assert.equal(d.criterios.length,9);
assert.equal(d.indicadores.lmvDeclaradoStatus,'NAO_RECUPERADO');
assert.equal(d.indicadores.lmvValidadoStatus,'COMPETENCIA_AGENTE_CONEXAO');
assert.equal(d.criterios.find(x=>x.id==='lmv').status,'NAO_VERIFICAVEL');
assert.equal(d.criterios.find(x=>x.id==='whatsapp0').status,'INDICIO');
assert.equal(d.criterios.find(x=>x.id==='email0').status,'INDICIO');
assert.equal(d.criterios.find(x=>x.id==='primeiro_contato').status,'NAO_VERIFICAVEL');
assert.equal(d.indicadores.minutosAtePrimeiroRegistro,0);
const provis=c.viCerebroLead_({...ctx,cadastro:{lmvDeclarado:'R$ 10 mil',origem:'INBOUND'}});
assert.equal(provis.criterios.find(x=>x.id==='lmv').status,'INDICIO');
assert.equal(provis.indicadores.lmvValidadoStatus,'COMPETENCIA_AGENTE_CONEXAO');
const real=c.viCerebroLead_({...ctx,ligacoes:[{id:'l1',data:'2026-10-13T12:43:47Z'}]});
assert.equal(real.criterios.find(x=>x.id==='primeiro_contato').status,'INDICIO');
assert.ok(real.indicadores.minutosAtePrimeiraLigacao>0);
assert.match(panel,/function leadAgent\(d\)/);
assert.doesNotMatch(panel,/'lead','Agente LEAD'/,
  'Agentes permanecem no backend, fora da navegação principal');
assert.match(service,/parecer\.agentesDetalhados/);
console.log('Agente LEAD: 9 verificacoes, LMV provisório, automacao inicial e primeira ligacao auditados.');
