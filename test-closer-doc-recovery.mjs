import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const flow = fs.readFileSync(new URL('./.github/workflows/closer-docs-repair.yml', import.meta.url), 'utf8');
const inicio = audit.indexOf('function audV3FilaReparoDocumentoCloser_(');
const fim = audit.indexOf('function audV3ResumoAuditoriasCloser_(', inicio);
assert.ok(inicio > 0 && fim > inicio, 'Rotina de reparo ausente.');

const transcricoes = [{ID_INTERACAO:'INT-1', STATUS:'CONCLUIDA', CONTEUDO:'Transcrição comercial válida e suficientemente detalhada.'}];
const interacoes = [{ID_INTERACAO:'INT-1', ID_CLIENTE:'CLI-1', FONTE:'TLDV', TIPO_INTERACAO:'REUNIAO', TITULO:'Demonstração comercial'}];
const original = {
  ID_AUDITORIA:'AUD-1', ID_INTERACAO:'INT-1', ID_CLIENTE:'CLI-1', TIPO_AUDITORIA:'CLOSER',
  STATUS:'EM_REVISAO', VALIDACAO_STATUS:'VALIDADA', RESULTADO_JSON:'{"resultado":"ok"}',
  HASH_FONTE:'hash-real', CRITERIOS_SNAPSHOT_JSON:'{}', LINK_DOCUMENTO:'', RD_STATUS:'AGUARDANDO_CANONICO'
};
const auditorias=[{...original}];
const calls={ai:0,rd:0,finished:0,updated:0};
const dados={AUDITORIAS:auditorias,INTERACOES:interacoes,TRANSCRICOES:transcricoes};
const context={
  Object, Array, String, Number, Date, JSON, Math,
  audV3Ler_: (tab)=>dados[tab]||[],
  tldvReuniaoOperacional_:()=>false,
  boardModoManual_:()=>false,
  audV3ConfigAutomacaoReunioesCloser_:()=>({ativa:true}),
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  audV3Localizar_:(tab,key,id)=>(dados[tab]||[]).find(row=>row[key]===id),
  audV3FinalizarAutomaticamente_:(id)=>{
    calls.finished++;
    const a=auditorias.find(x=>x.ID_AUDITORIA===id);
    a.STATUS='APROVADA';
    a.VALIDACAO_STATUS='VALIDADA';
    a.LINK_DOCUMENTO='https://docs.google.com/document/d/doc-1/edit';
    a.RD_STATUS='AGUARDANDO_CANONICO';
    return {sucesso:true,rd:{publicada:false,status:'AGUARDANDO_CANONICO'}};
  },
  audV3Atualizar_:(tab,key,id,change)=>{
    calls.updated++;
    Object.assign(dados[tab].find(x=>x[key]===id),change);
  },
  audRdPublicarAutomaticamente_:()=>{calls.rd++;throw new Error('Proibido');},
  executarAuditoriaV3:()=>{calls.ai++;throw new Error('Proibido');}
};
vm.createContext(context);
vm.runInContext(audit.slice(inicio,fim),context);
const fila = context.audV3FilaReparoDocumentoCloser_();
assert.equal(fila.length,1);
const reparo = context.PROCESSAR_REPARO_DOCUMENTOS_CLOSER_TLDV();
assert.equal(reparo.sucesso,true);
assert.equal(reparo.recuperadas,1);
assert.equal(calls.finished,1);
assert.equal(calls.ai,0);
assert.equal(calls.rd,0);
assert.equal(context.audV3FilaReparoDocumentoCloser_().length,0);
assert.equal(context.PROCESSAR_REPARO_DOCUMENTOS_CLOSER_TLDV().recuperadas,0,'Repetição deve ser idempotente.');

// Uma auditoria já documentada para a mesma interação não pode gerar outro documento.
auditorias.splice(0,1,{...original},{...original,ID_AUDITORIA:'AUD-2',LINK_DOCUMENTO:'https://docs.google.com/document/d/doc-2/edit'});
assert.equal(context.audV3FilaReparoDocumentoCloser_().length,0);
auditorias.splice(0,2,{...original,STATUS:'ERRO'});
assert.equal(context.audV3FilaReparoDocumentoCloser_().length,0,'Falha não é validada automaticamente.');
auditorias.splice(0,1,{...original,VALIDACAO_STATUS:''});
assert.equal(context.audV3FilaReparoDocumentoCloser_().length,0,'Sem validação não é elegível.');
auditorias.splice(0,1,{...original,RESULTADO_JSON:'{invalid'});
assert.equal(context.audV3FilaReparoDocumentoCloser_().length,0,'JSON inválido não é elegível.');
auditorias.splice(0,1,{...original,RD_STATUS:'PUBLICADA'});
assert.equal(context.audV3FilaReparoDocumentoCloser_().length,0,'Publicado no RD não pode ser tocado.');
auditorias.splice(0,1,{...original,AUTOMACAO_STATUS:'REPARO_DOCUMENTO_CLOSER_BLOQUEADO'});
assert.equal(context.audV3FilaReparoDocumentoCloser_().length,0,'Não repetir tentativa bloqueada.');

assert.match(code,/ops_closer_docs_repair/);
assert.match(code,/PROCESSAR_REPARO_DOCUMENTOS_CLOSER_TLDV\(\)/);
assert.match(flow,/github\.event\.comment\.body == '\/closer-docs-repair'/);
assert.match(flow,/ops_closer_docs_repair=1/);
assert.doesNotMatch(flow,/ops_closer_tldv_(?:sync|backfill|repair)=1/);
const rd=fs.readFileSync(new URL('./RdAuditorias.gs',import.meta.url),'utf8');
assert.match(rd,/audRdBloqueioCanonicoCloser_/);
console.log('OK: repair docs sem IA, sem RD, sem duplicidade e apenas em registro Closer validado.');
