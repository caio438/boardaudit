import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
const ext=fs.readFileSync(new URL('./extensions/volum-intelligence/sidebar.js',import.meta.url),'utf8');
const content=fs.readFileSync(new URL('./extensions/volum-intelligence/content.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('./extensions/volum-intelligence/service-worker.js',import.meta.url),'utf8');
const extCss=fs.readFileSync(new URL('./extensions/volum-intelligence/sidebar.css',import.meta.url),'utf8');
const extHtml=fs.readFileSync(new URL('./extensions/volum-intelligence/sidebar.html',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('./extensions/volum-intelligence/manifest.json',import.meta.url),'utf8'));
new Function(service);
new Function(ext);
const serviceContext=vm.createContext({Date,Intl,String,Number,Array,Boolean,Math,RegExp,Set,Error,Object});
vm.runInContext(service,serviceContext,{timeout:3000});
function base(overrides={}) {
 return {
  modo:'SOMENTE_LEITURA',dealId:'6acc888b98976f0023dc583f',
  negociacao:{
    nome:'Exemplo Wisetec',etapaAtualNome:'Proposta enviada',etapaOrigem:'CONSULTA_ETAPA_RD',
    criadaEm:'2026-10-20T08:30:00Z',responsavel:'Closer Modelo',
    previsaoFechamento:'2026-10-21',valorInformado:3500,estadoFechamento:'EM_ABERTO'
  },
  fontes:{tarefas:{acessivel:true,completo:true},atividades:{acessivel:true,completo:true}},
  atividades:[
    {tipo:'note',data:'2026-10-20T10:00:00Z',textoDisponivel:true,texto:'Segmento: distribuidora. LMV: 90 mil. Dor: estoque manual. Decisor: diretoria. Reunião agendada.'},
    {tipo:'note',data:'2026-10-21T10:00:00Z',textoDisponivel:true,texto:'No-show. O lead não atendeu.'}
  ],
  tarefas:[
    {id:'a',tipo:'call',assunto:'Cadência dia 1 ligação 1',criadaEm:'2026-10-20T10:30:00Z',
     previstaPara:'2026-10-20T12:30:00Z',concluida:true,concluidaEm:'2026-10-20T12:33:00Z'},
    {id:'b',tipo:'call',assunto:'Retomada no-show',criadaEm:'2026-10-22T10:30:00Z',
     previstaPara:'2026-11-02T12:30:00Z',concluida:false}
  ],
  ligacoesBoard:[{data:'2026-10-20T12:33:00Z',duracaoSegundos:65,temReferenciaGravacao:true}],
  eventos:[{data:'2026-10-20T10:00:00Z',tipo:'CRIACAO_TAREFA',fonte:'RD'}],
  cerebros:[],
  ...overrides
 };
}
const leitura=base();
const sdr=serviceContext.viWidgetPlanoSdr_(leitura);
const intel=serviceContext.viWidgetInteligenciaComercial_(leitura);
const parecer=serviceContext.viWidgetParecerDeterministico_(leitura);
assert.equal(sdr.total,16);
assert.equal(sdr.oficial,7);
assert.equal(sdr.complementar,9);
assert.equal(intel.total,27);
assert.equal(parecer.inteligenciaComercial.total,27);
assert.equal(parecer.planoOtimizacaoSdr.total,16);
assert.equal(sdr.pontuacao,null);
assert.equal(parecer.notaCompliance,null);
const s=id=>sdr.itens.find(x=>x.id===id);
assert.equal(s('pitch').status,'NAO_VERIFICAVEL');
assert.equal(s('cadencia').status,'INDICIO');
assert.equal(s('voip').status,'EVIDENCIADO');
assert.equal(s('no_show').status,'INDICIO');
assert.equal(s('lmv').status,'INDICIO');
assert.equal(s('segmento').status,'INDICIO');
assert.equal(s('handoff').status,'NAO_VERIFICAVEL');
assert.equal(intel.itens.find(x=>x.id==='retorno').status,'SEM_EVIDENCIA');
assert.ok(!parecer.status.includes('CONCORRENTE'),'Nao atendeu nao implica perda');
assert.equal(parecer.agenteAtual,'FOLLOW-UP / RECOVERY');
assert.equal(parecer.criteriosPlanoWisetec.length,7);
assert.ok(sdr.itens.every(x=>x.acao&&x.fonte&&x.detalhe));
const noHistory=base({
 atividades:[],tarefas:[],ligacoesBoard:[],eventos:[],
 fontes:{tarefas:{acessivel:false},atividades:{acessivel:false}}
});
const weak=serviceContext.viWidgetPlanoSdr_(noHistory);
assert.equal(weak.contagem.ATENCAO,0);
assert.equal(weak.itens.find(x=>x.id==='pitch').status,'NAO_VERIFICAVEL');
assert.equal(weak.itens.find(x=>x.id==='lmv').status,'NAO_VERIFICAVEL');
assert.equal(weak.itens.find(x=>x.id==='voip').status,'NAO_VERIFICAVEL');

const script=(panel.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(script,'Painel V3 deve ter script.');
new Function(script);
assert.match(panel,/Space\+Grotesk/);
assert.match(panel,/Geist\+Mono/);
assert.match(panel,/color-scheme:dark/);
assert.match(panel,/data-deal-id="<\?= dealId \?>"/);
assert.match(panel,/id="card"/);
assert.match(ext,/searchParams\.set\('volum_widget','1'\)/);
assert.match(ext,/searchParams\.set\('dealId',id\)/);
assert.match(extCss,/color-scheme:dark/);
assert.doesNotMatch(extHtml,/<footer|<header/);
assert.equal(manifest.version,'0.3.2');
assert.ok(!manifest.permissions.includes('sidePanel'),'Painel nativo cria a tarja cinza que não pode ser estilizada.');
assert.equal(Object.hasOwn(manifest,'side_panel'),false);
assert.match(content,/VOLUM_OPEN_INLINE_WIDGET/);
assert.match(content,/volum-intelligence-inline-shell/);
assert.match(content,/box-shadow:none/);
assert.match(content,/resize:horizontal/);
assert.match(content,/Minimizar VOLUM/);
assert.match(content,/Fechar VOLUM/);

const card={textContent:'',innerHTML:''};
const doc={getElementById:id=>id==='volum-root'?{dataset:{dealId:'6acc888b98976f0023dc583f'}}:id==='card'?card:null};
const runner={withSuccessHandler(fn){this.success=fn;return this;},withFailureHandler(fn){this.failure=fn;return this;},
  VOLUM_WIDGET_AUDITAR_SESSAO(id,useIa){this.args=[id,useIa];}};
const app=vm.createContext({document:doc,google:{script:{run:runner}},Intl,Date,Array,Number,Math,RegExp,Set,String,Object});
vm.runInContext(script,app,{timeout:3000});
assert.equal(runner.args[0],'6acc888b98976f0023dc583f');
assert.equal(runner.args[1],true);
assert.equal(card.textContent,'Atualizando…');
runner.success(parecer);
assert.match(card.innerHTML,/Visão geral/);
assert.match(card.innerHTML,/Inteligência/);
assert.match(card.innerHTML,/Plano SDR/);
assert.match(card.innerHTML,/Plano Closer/);
assert.match(card.innerHTML,/Evidências/);
app.changeTab('sdr');
assert.match(card.innerHTML,/7 pilares do Plano Wisetec/);
assert.match(card.innerHTML,/9 verificações complementares/);
assert.match(card.innerHTML,/Aplicacao do pitch de qualificacao/);
app.changeTab('inteligencia');
assert.match(card.innerHTML,/Inteligência comercial/);
assert.match(card.innerHTML,/Contexto e qualificacao/);
app.changeFilter('ATENCAO');
assert.match(card.innerHTML,/Atenção/);
app.changeTab('closer');
assert.match(card.innerHTML,/Plano de Otimização Closer/);
app.changeTab('evidencias');
assert.match(card.innerHTML,/Cobertura e rastreabilidade/);
const fake=base({negociacao:{...leitura.negociacao,nome:'<img src=x onerror=alert(1)>'}});
runner.success(serviceContext.viWidgetParecerDeterministico_(fake));
assert.ok(!card.innerHTML.includes('<img src=x onerror=alert(1)>'),'Texto do RD deve ser escapado');
console.log('Widget V3: 27 criterios Sales Ops, 16 SDR (7 oficiais), 7 Closer, 5 abas, dark UI, ID e XSS testados.');
