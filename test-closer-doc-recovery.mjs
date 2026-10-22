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
  audV3PersistirDocumentoAprovacao_:(id,opcoes)=>{
    assert.equal(opcoes.somenteDocumento,true);
    calls.finished++;
    const a=auditorias.find(x=>x.ID_AUDITORIA===id);
    assert.equal(a.STATUS,'EM_REVISAO');
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
assert.equal(auditorias[0].STATUS,'EM_REVISAO','Reparo não aprova a auditoria.');
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


// Exercita a implementação real: documento não equivale a aprovação e não contata RD.
const persistStart=audit.indexOf('function aprovarAuditoriaV3(');
const persistEnd=audit.indexOf('function descartarAuditoriaV3(',persistStart);
const registro={...original,ID_TRANSCRICAO:'TX',CONTEUDO_PITCH_SNAPSHOT:'pitch'};
let docs=0,gateFails=false;
const persist={
  Object,Array,String,Number,Date,JSON,Boolean,
  audV3Localizar_:(tab)=>tab==='AUDITORIAS'?registro:{ID_CLIENTE:'CLI-1',ID_INTERACAO:'INT-1',LINK_CRM:''},
  audV3TranscricaoExataAuditoria_:()=>({CONTEUDO:'fala original'}),
  audV3HashFonteSnapshotPersistido_:()=>({confere:true,conteudo:'fala original'}),
  audV3ParseJson_:JSON.parse,
  audV3ValidarResultadoOficial_:()=>{if(gateFails)throw Error('fonte inconsistente');},
  audV3ExigirGatePublicavel_:()=>({status:'OK'}),
  audV3HashResultado_:()=> 'hash',audV3ResultadoTexto_:()=> 'relatório',
  audV3CriarDocumento_:()=>{docs++;return {id:'doc',url:'https://docs.google.com/document/d/doc/edit'};},
  audV3Atualizar_:(tab,key,id,fields)=>{if(tab==='AUDITORIAS')Object.assign(registro,fields);},
  audV3VersaoPersistida_:()=> 'test',
  audV3AuditoriaFront_:a=>a,audV3ListarAuditoriasFront_:()=>[],
  limparCachesDados_:()=>{},registrarLog_:()=>{}
};
vm.createContext(persist);vm.runInContext(audit.slice(persistStart,persistEnd),persist);
persist.audV3PersistirDocumentoAprovacao_('AUD-1',{somenteDocumento:true});
assert.equal(registro.STATUS,'EM_REVISAO');assert.equal(docs,1);
assert.equal(registro.RD_STATUS,original.RD_STATUS);
persist.audV3PersistirDocumentoAprovacao_('AUD-1',{somenteDocumento:true});
assert.equal(docs,1,'Repetir documento não cria cópia.');
gateFails=true;
assert.throws(()=>persist.aprovarAuditoriaV3('AUD-1'),/fonte inconsistente/,'Link existente não pula validação humana.');
assert.equal(registro.STATUS,'EM_REVISAO');
gateFails=false;persist.aprovarAuditoriaV3('AUD-1');
assert.equal(registro.STATUS,'APROVADA');assert.equal(docs,1,'Aprovação reutiliza documento de revisão.');
assert.equal(registro.RD_STATUS,'AGUARDANDO_VINCULO');
console.log('OK: documento real preserva revisão, idempotência e gate na aprovação posterior.');