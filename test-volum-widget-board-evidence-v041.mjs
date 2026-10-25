import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lead=fs.readFileSync(new URL('./VolumIntelligenceLead.gs',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('./VolumWidgetService.gs',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('./VolumWidgetPanel.html',import.meta.url),'utf8');
new Function(lead);new Function(service);
const dealId='6acc888b98976f0023dc583f';
const client='CLIENTE_TESTE';
const fakeBoard=Array.from({length:19},(_,i)=>({
 ID_INTERACAO:'call'+i,ID_CLIENTE:client,
 LINK_CRM:'https://crm.rdstation.com/app/deals/'+dealId,
 FONTE:'API4COM',TIPO_INTERACAO:'LIGACAO',FUNCAO:'SDR',
 COLABORADOR:'Vendedor Modelo',DATA_INTERACAO:'2026-10-2'+(i%4+1)+'T12:00:00Z',
 DURACAO_SEGUNDOS:i===0?1:i===18?16:2,
 STATUS_TRANSCRICAO:'PENDENTE',STATUS_AUDITORIA:'PENDENTE',
 URL_GRAVACAO:'https://api4com.com/private/test.mp3'
}));
const ctx=vm.createContext({String,Number,Array,Boolean,Math,RegExp,Set,Date,Object,Error,Intl});
vm.runInContext(lead,ctx);
vm.runInContext(service,ctx);
const outside={...fakeBoard[0],ID_INTERACAO:'other-client',ID_CLIENTE:'OUTRO_CLIENTE'};
const all=ctx.viLeadInteracoesBoard_([...fakeBoard,outside],dealId,client);
assert.equal(all.length,19);
assert.equal(ctx.viLeadLigacoesBoard_([...fakeBoard,outside],dealId,client).length,19);
assert.ok(all.every(x=>x.funcaoDeclarada==='SDR'&&x.origemFuncao==='CAMPO_FUNCAO_BOARD'));
assert.equal(all.filter(x=>x.temReferenciaGravacao).length,19);
const blank=ctx.viLeadInteracoesBoard_([{...fakeBoard[0],FUNCAO:''}],dealId,client);
assert.equal(blank[0].funcaoDeclarada,'NAO_COMPROVADO');
const sheet={
 getLastRow:()=>3,getLastColumn:()=>17,
 getRange(row,col,nrows,ncols) {
  const headers=['ID_TRANSCRICAO','ID_INTERACAO','FONTE','IDIOMA','CONTEUDO',
    'TAMANHO_CARACTERES','STATUS','ERRO','IMPORTADO_EM','ATUALIZADO_EM',
    'CONTEUDO_NORMALIZADO','QUALIDADE_TRANSCRICAO','QUALIDADE_JSON',
    'NORMALIZACAO_VERSAO','NORMALIZADA_EM','CONTEUDO__PARTE_02','CONTEUDO_NORMALIZADO__PARTE_02'];
  const data=[['tr1','call0','API4COM','pt-BR','[NAO_LER]',0,'PENDENTE'],
    ['tr2','OTHER','API4COM','pt-BR','[NAO_LER]',500,'CONCLUIDA']];
  if(row===1)return {getDisplayValues:()=>[headers]};
  assert.ok(col!==5 && col!==11 && col!==16 && col!==17,
    'Nunca ler coluna de texto da transcricao em massa');
  return {getDisplayValues:()=>data.map(x=>[x[col-1]??''])};
 }
};
ctx.abrirPlanilha_=()=>({getSheetByName:()=>sheet});
ctx.APP={sheets:{transcricoes:'TRANSCRICOES'}};
const m=ctx.viLeadMetadadosTranscricoesBoard_(all.map(x=>x.id));
assert.equal(m.fonte.acessivel,true);
assert.equal(m.fonte.vinculadas,1);
assert.equal(m.fonte.concluidas,0);
assert.equal(m.porInteracao.call0.status,'PENDENTE');
const enriched=all.map(x=>({
 ...x,transcricaoBoardStatus:m.porInteracao[x.id]?.status||'SEM_REGISTRO',
 transcricaoDisponivel:m.porInteracao[x.id]?.temConteudo===true
}));
const input={modo:'SOMENTE_LEITURA',dealId,
 negociacao:{nome:'SL8 Reciclagem (fixture)',etapaAtualNome:'Proposta enviada',
   etapaOrigem:'CONSULTA_ETAPA_RD',valorInformado:1000},
 fontes:{atividades:{acessivel:true,completo:true},tarefas:{acessivel:true,completo:true},
   transcricoesBoard:m.fonte},
 atividades:[],tarefas:[],ligacoesBoard:enriched,reunioesBoard:[],eventos:[],cerebros:[]};
const p=ctx.viWidgetAdicionarEvidenciasBoard_(
 ctx.viWidgetRefinarParecerV4_(ctx.viWidgetParecerDeterministico_(input),input),input);
assert.equal(p.versao,'0.4.3');
assert.equal(p.evidenciasBoardResumo.ligacoes,19);
assert.equal(p.evidenciasBoardResumo.sdrDeclaradas,19);
assert.equal(p.evidenciasBoardResumo.duracaoSdrMinima,1);
assert.equal(p.evidenciasBoardResumo.duracaoSdrMaxima,16);
assert.equal(p.evidenciasBoardResumo.transcricoesPendentes,19);
assert.equal(p.planoOtimizacaoSdr.itens.find(x=>x.id==='voip').status,'EVIDENCIADO');
assert.equal(p.planoOtimizacaoSdr.itens.find(x=>x.id==='pitch').status,'NAO_VERIFICAVEL');
assert.equal(p.notaCompliance,null);
assert.ok(!(p.operacional.notasDeConfiabilidade||[]).some(x=>/Nenhuma liga.+atribu.+papel SDR/i.test(x)),
  'Nao deve haver aviso dizendo que SDR e desconhecido quando as 19 chamadas tem FUNCAO=SDR');
assert.ok(!p.resumoExecutivo.join(' ').includes('comprovam conversa'));
const anonymous={...input,ligacoesBoard:enriched.map(x=>({...x,funcaoDeclarada:'NAO_COMPROVADO',
  origemFuncao:'NAO_INFORMADA'}))};
const a=ctx.viWidgetAdicionarEvidenciasBoard_(
 ctx.viWidgetRefinarParecerV4_(ctx.viWidgetParecerDeterministico_(anonymous),anonymous),anonymous);
assert.equal(a.planoOtimizacaoSdr.itens.find(x=>x.id==='voip').status,'NAO_VERIFICAVEL');
const script=(panel.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
new Function(script);
assert.match(panel,/function boardEvidence\(d\)/);
assert.match(panel,/Transcrição pendente/);
const card={textContent:'',innerHTML:''};
const root={dataset:{dealId}};
const doc={documentElement:{classList:{add(){}}},
 getElementById:(id)=>id==='volum-root'?root:id==='card'?card:null};
const runner={withSuccessHandler(x){this.success=x;return this;},
 withFailureHandler(x){this.failure=x;return this;},
 VOLUM_WIDGET_AUDITAR_SESSAO(){}};
const ui=vm.createContext({document:doc,google:{script:{run:runner}},
 Intl,Date,Array,Number,Math,RegExp,Set,String,Object});
vm.runInContext(script,ui,{timeout:3000});
runner.success(p);
ui.changeTab('evidencias');
assert.match(card.innerHTML,/19/);
assert.match(card.innerHTML,/FUNCAO|Função SDR/);
assert.match(card.innerHTML,/PENDENTE/);
console.log('VOLUM widget 0.4.1: 19 chamadas SDR 1-16s, transcricoes pendentes, cliente isolado, roles e UI verificados.');
