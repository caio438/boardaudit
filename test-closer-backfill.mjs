import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const audit=fs.readFileSync(new URL('./AuditoriaV3.gs',import.meta.url),'utf8');
const code=fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const rd=fs.readFileSync(new URL('./RdAuditorias.gs',import.meta.url),'utf8');
const flow=fs.readFileSync(new URL('./.github/workflows/closer-tldv-backfill.yml',import.meta.url),'utf8');
function section(src,start,end) {
  const i=src.indexOf(start),j=src.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,'Trecho ausente '+start);
  return src.slice(i,j);
}
const source=section(audit,'const AUTOMACAO_REUNIOES_CLOSER_V3 = Object.freeze(','function obterStatusAutomacaoReunioesCloserV3(');
const dateFns=section(code,'function tldvReuniaoOperacional_(','function tldvNormalizarPessoa_(');
let props={};
const ctx={
  Object,Date,Math,JSON,String,Number,Boolean,Array,
  APP:{timezone:'America/Sao_Paulo'},
  Utilities:{formatDate:()=> '2026-10-09'},
  obterConfiguracao_:()=> '',
  PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>props[key]||'',
    setProperty:(key,v)=>{props[key]=String(v);},
    deleteProperty:key=>{delete props[key];}
  })},
  audV3Ler_:()=>[],
  audV3PitchAtualAutomatico_:(id,tipo,pitches)=>pitches.find(x=>x.ID_CLIENTE===id&&x.TIPO_PITCH===tipo)||null,
  audV3FiltrarAuditoriasVisiveisOperacao_:xs=>xs
};
vm.createContext(ctx);
vm.runInContext(dateFns+source,ctx);
const cutoff=Date.parse('2026-10-09T17:21:33.642Z');
const historico={ID_INTERACAO:'HIST', FONTE:'TLDV',TIPO_INTERACAO:'REUNIAO',
 ID_CLIENTE:'BUFFET',COLABORADOR:'Fabiana Fermino',FUNCAO:'CLOSER',
 TITULO:'Salão de eventos Gran fiesta - Buffet Mais',DATA_INTERACAO:new Date('2026-08-12T18:30:00Z')};
const nova={...historico,ID_INTERACAO:'NEW',DATA_INTERACAO:new Date('2026-10-10T14:30:00Z')};
const dup={...historico,ID_INTERACAO:'DUP'};
const operacional={...historico,ID_INTERACAO:'OPS',TITULO:'[Buffet Mais + VOLUM] Operacional Closer'};
const incerta={...historico,ID_INTERACAO:'UNKNOWN',COLABORADOR:'',FUNCAO:''};
const antigaSemData={...historico,ID_INTERACAO:'INVALID',DATA_INTERACAO:'inválida'};
const tx=['HIST','NEW','DUP','OPS','UNKNOWN','INVALID'].map(ID_INTERACAO=>({ID_INTERACAO,STATUS:'CONCLUIDA',CONTEUDO:'Transcrição válida de reunião entre prospect e vendedor.'}));
const pitches=[{ID_CLIENTE:'BUFFET',TIPO_PITCH:'CLOSER'}];
const auditorias=[{ID_AUDITORIA:'AUD-OLD',ID_INTERACAO:'DUP',TIPO_AUDITORIA:'CLOSER',STATUS:'EM_REVISAO',RESULTADO_JSON:''}];
const data={pitches,interacoes:[historico,nova,dup,operacional,incerta,antigaSemData],transcricoes:tx,auditorias};
const opts={cutoffMs:cutoff,backfillAtivo:false,maxBackfillDia:5};
let queue=ctx.audV3FilaAutomacaoReunioesCloser_(opts,data);
assert.deepEqual(Array.from(queue,x=>x.interacao.ID_INTERACAO),['NEW'],'Modo normal ignora histórico.');
opts.backfillAtivo=true;
queue=ctx.audV3FilaAutomacaoReunioesCloser_(opts,data);
assert.deepEqual(Array.from(queue,x=>x.interacao.ID_INTERACAO),['NEW','HIST'],'Backfill seleciona só histórico elegível e sem auditoria.');
assert.equal(queue[0].backfill,false);
assert.equal(queue[1].backfill,true);
assert.equal(ctx.audV3JaExisteAuditoriaCloserInteracao_('DUP',auditorias),true);
assert.equal(ctx.audV3JaExisteAuditoriaCloserInteracao_('HIST',auditorias),false);
for(const state of ['APROVADA','DESCARTADA','EM_REVISAO','ERRO','PROCESSANDO']) {
  data.auditorias=[{ID_AUDITORIA:'AUD-OLD',ID_INTERACAO:'HIST',TIPO_AUDITORIA:'CLOSER',STATUS:state}];
  queue=ctx.audV3FilaAutomacaoReunioesCloser_(opts,data);
  assert.deepEqual(Array.from(queue,x=>x.interacao.ID_INTERACAO),['NEW'],'Deve pular qualquer auditoria existente: '+state);
}
ctx.audV3RegistrarTentativaBackfillCloser_();
ctx.audV3RegistrarTentativaBackfillCloser_();
assert.equal(ctx.audV3UsoDiarioBackfillCloser_().tentativas,2);
assert.equal(ctx.tldvDataMs_('12/08/2026 15:30:00')>0,true);
assert.equal(ctx.tldvReuniaoOperacional_('[INGEE + VOLUM] Operacional Closer'),true);
assert.equal(ctx.tldvReuniaoOperacional_('Buffet Mais + VOLUM demonstração para cliente'),false);

const processor=section(audit,'function PROCESSAR_PIPELINE_CLOSER_TLDV()','/* =========================================================\n   AUTOMAÇÃO DE LIGAÇÕES');
assert.match(processor,/audV3JaExisteAuditoriaCloserInteracao_\(idInteracao\)/);
assert.match(processor,/if \(item\.backfill\) audV3RegistrarTentativaBackfillCloser_\(\)/);
assert.match(processor,/saldoBackfill > 0/);
assert.match(audit,/maxBackfillDia: 5/);
assert.match(code,/ops_closer_tldv_backfill/);
assert.match(code,/tldvReconciliarClientesHistoricos_\(\)/);
assert.match(code,/tldvReconciliarCloserTranscricoes_\(0\)/);
assert.match(flow,/github\.event\.comment\.body == '\/closer-tldv-backfill'/);
assert.match(flow,/ops_closer_tldv_backfill=1/);
assert.match(rd,/audRdBloqueioCanonicoCloser_/);
const endpoint=section(code,"if (String(parametros.ops_closer_tldv_backfill || '') === '1')","if (String(parametros.ops_closer_tldv_status || '') === '1')");
assert.doesNotMatch(endpoint,/salvarConfiguracao_\('AUDITORIA_AUTO_REUNIOES_CLOSER_CUTOFF_ISO'/);
assert.doesNotMatch(endpoint,/salvarConfiguracao_\('AUDITORIA_AUTO_LIGACOES/);
console.log('OK: backfill idempotente, histórico seguro, prioridade de reuniões novas, limite diário e bloqueio RD.');
