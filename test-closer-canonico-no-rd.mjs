import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const rd = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');
const front = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');
function trecho(source, start, end) {
  const i = source.indexOf(start);
  const f = source.indexOf(end, i + start.length);
  assert.ok(i >= 0 && f > i, 'Função ausente: ' + start);
  return source.slice(i, f);
}
const sourceFinalizar = trecho(audit, 'function audV3FinalizarAutomaticamente_(', 'function audV3EncontrarSubstitutaAtual_(');
const sourceGuard = trecho(rd, 'function audRdPublicacaoCloserLiberada_()', 'function audRdPublicarAutomaticamente_(');
const sourcePublicar = trecho(rd, 'function audRdPublicarAutomaticamente_(', 'function salvarIdRdAuditoriaV3(');
const sourceSalvar = trecho(rd, 'function salvarIdRdAuditoriaV3(', 'function audRdPreviewCtx_(');
const sourceEnviar = trecho(rd, 'function enviarAuditoriaParaRd(', 'function aprovarEEnviarAuditoriaRd(');
const ctx={
  updates:[], calls:[], obj:{ ID_AUDITORIA:'AUD-1', ID_INTERACAO:'INT-1', TIPO_AUDITORIA:'CLOSER', STATUS:'APROVADA', VALIDACAO_STATUS:'VALIDADA' },
  Date, String,
  obterConfiguracao_:()=>'', 
  aprovarAuditoriaV3:()=>({sucesso:true}),
  audV3Localizar_:()=>ctx.obj,
  audV3Atualizar_:(s,k,id,payload)=>ctx.updates.push({s,k,id,payload}),
  audRdPublicarAutomaticamente_:()=>{ctx.calls.push('publication');return{aplicavel:true,publicada:true,status:'PUBLICADA'};},
  audRdEstr_:()=>ctx.calls.push('schema'),
  audRdStatus_:(id,status)=>ctx.updates.push({id,status}),
  audRdDeal_:()=>{ctx.calls.push('deal');return'RD-1';},
  audRdNormalizarDeal_:()=> 'RD-1',
  audV3RdLinkNegociacao_:()=> 'https://crm.rdstation.com/app/deals/RD-1',
  limparCachesDados_:()=>{},
  audV3AuditoriaFront_:()=>({}),
  audV3ListarAuditoriasFront_:()=>[],
  audRdCtx_:()=>{ctx.calls.push('context');throw new Error('Não deveria chegar ao contexto RD.');}
};
vm.createContext(ctx);
vm.runInContext(sourceGuard+sourceFinalizar+sourcePublicar+sourceSalvar+sourceEnviar, ctx);
assert.equal(ctx.audRdPublicacaoCloserLiberada_(),false,'Modo Closer deve ser bloqueado por padrão.');
assert.equal(ctx.audRdBloqueioCanonicoCloser_(ctx.obj),true);

const closer=ctx.audV3FinalizarAutomaticamente_('AUD-1');
assert.equal(closer.rd.status,'AGUARDANDO_CANONICO');
assert.equal(closer.rd.publicada,false);
assert.equal(ctx.calls.includes('publication'),false,'Closer não deve acionar envio.');
assert.equal(ctx.updates.find(u=>u.payload?.RD_STATUS)?.payload.RD_STATUS,'AGUARDANDO_CANONICO');
assert.equal(ctx.updates.find(u=>u.payload?.AUTOMACAO_STATUS)?.payload.AUTOMACAO_STATUS,'CONCLUIDA_AGUARDANDO_CANONICO');
ctx.calls.length=0;ctx.updates.length=0;

const naoPublicar=ctx.audRdPublicarAutomaticamente_('AUD-1');
assert.equal(naoPublicar.status,'AGUARDANDO_CANONICO');
assert.equal(ctx.calls.includes('deal'),false,'Não pode ler negociação nem contatar RD sem liberação.');
assert.equal(naoPublicar.publicada,false);
ctx.calls.length=0;

assert.throws(()=>ctx.enviarAuditoriaParaRd({idAuditoria:'AUD-1'}),/bloqueada até o vínculo Canônico/);
assert.deepEqual(ctx.calls,[], 'Envio manual não pode chegar ao contexto RD.');

const salvo=ctx.salvarIdRdAuditoriaV3({idAuditoria:'AUD-1',rdDealId:'RD-1'});
assert.equal(salvo.sucesso,true);
assert.equal(salvo.publicacaoRd,null);
assert.match(salvo.mensagem,/permanece sem envio ao RD/);
assert.equal(ctx.calls.includes('publication'),false,'Salvar vínculo Canônico não pode publicar Closer.');

ctx.calls.length=0;ctx.updates.length=0;
// Exercitar o guard real para Closer e isolar a chamada SDR no teste.
ctx.audRdPublicarAutomaticamente_=()=>{ctx.calls.push('publication');return{aplicavel:true,publicada:true,status:'PUBLICADA'};};
ctx.obj={ ID_AUDITORIA:'AUD-2', ID_INTERACAO:'INT-2', TIPO_AUDITORIA:'SDR', STATUS:'APROVADA', VALIDACAO_STATUS:'VALIDADA' };
const sdr=ctx.audV3FinalizarAutomaticamente_('AUD-2');
assert.equal(sdr.rd.publicada,true);
assert.deepEqual(ctx.calls,['publication'],'Publicação automática do SDR precisa permanecer intacta.');
ctx.calls.length=0;
const salvarSdr=ctx.salvarIdRdAuditoriaV3({idAuditoria:'AUD-2',rdDealId:'RD-2'});
assert.equal(salvarSdr.publicacaoRd.publicada,true,'Salvar vínculo do SDR deve continuar enviando.');
assert.deepEqual(ctx.calls,['publication']);
assert.equal(ctx.audRdBloqueioCanonicoCloser_(ctx.obj),false);

assert.match(audit,/aguardandoCanonico/);
assert.match(front,/const closerSemRd = String\(item\.tipoAuditoria \|\| ''\)\.toUpperCase\(\) === 'CLOSER' && !rdPublicado;/);
assert.match(front,/!rdPublicado && !closerSemRd && String\(item\.rdStatus/);
assert.match(front,/Closer: aguardando Canônico · sem envio ao RD/);
assert.match(audit,/tipo === 'CLOSER'[\s\S]{0,800}AGUARDANDO_CANONICO/);
assert.match(rd,/AUDITORIA_CLOSER_RD_AUTORIZADA/);
assert.match(rd,/if\(audRdBloqueioCanonicoCloser_\(registro\)\)throw/);
console.log('OK: auditoria Closer automática concluída sem RD e bloqueio manual; SDR continua publicando.');
