import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoardForDeal,makeReadOnlySheetsClient} from '../src/board-sheets.mjs';
import {buildHistory,auditSalesOps} from '../src/core.mjs';

const DEAL='6acc888b98976f0023dc583f';
const CLIENT='CLI-TEST-WISETEC';
const SHEET='1s1HWCfqEunoq-iToJMO9mWaZQoYd0FgdT3YqmYrUgck';
const token='test-secret-access-token';
const link='https://crm.rdstation.com/app/deals/'+DEAL;
function interaction(i,{client=CLIENT,deal=link,role='SDR',status='PENDENTE',type='LIGACAO'}={}){
 const c=Array(23).fill('');
 c[0]='interaction-'+i;c[1]='API4COM';c[2]='RD_TASK_'+i;
 c[3]=type;c[4]=client;c[5]='Vendedor Teste';c[7]='SL8';
 c[8]='25/10/2026 08:05:00';c[9]=i===0?'1':i===18?'16':'2';
 c[11]='https://api4com.com/private?token=no-return';
 c[12]=status;c[13]='PENDENTE';c[19]='Operador Teste';c[20]=role;c[22]=deal;
 return c;
}
function fakeSheet({withTranscript=false,allRoles=true}={}){
 const rows=Array.from({length:19},(_,i)=>interaction(i));
 rows.push(interaction(19,{client:'OUTRO_CLIENTE'}));
 rows.push(interaction(20,{deal:'https://crm.rdstation.com/app/deals/aaaaaaaaaaaaaaaaaaaaaaaa'}));
 if(!allRoles)rows[0][20]='';
 const requests=[];
 const dataByRange=(range)=>{
   if(range==="'INTERACOES'!E2:E")return rows.map(x=>[x[4]]);
   if(range==="'INTERACOES'!W2:W")return rows.map(x=>[x[22]]);
   const detail=range.match(/^'INTERACOES'!A(\d+):W\1$/);
   if(detail)return [rows[Number(detail[1])-2]];
   if(range==="'TRANSCRICOES'!B2:B")return withTranscript?
     [['interaction-0']]:[];
   if(range==="'AUDITORIAS'!B2:B")return withTranscript?
     [['interaction-0']]:[];
   if(range==="'TRANSCRICOES'!A2:D2")return [['tr1','interaction-0','API4COM','pt-BR']];
   if(range==="'TRANSCRICOES'!F2:G2")return [['500','CONCLUIDA']];
   if(range==="'TRANSCRICOES'!E2:E2")return [['Cliente confirmou a dor e aceitou proximo passo.']];
   if(range==="'AUDITORIAS'!A2:F2")return [['aud1','interaction-0','tr1',CLIENT,'pitch1','SDR']];
   if(range==="'AUDITORIAS'!K2:K2")return [['CONCLUIDA']];
   throw new Error('Faixa inesperada: '+range);
 };
 async function fetcher(url,options){
   assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
   assert.equal(url.hostname,'sheets.googleapis.com');
   assert.equal(options.headers.Authorization,'Bearer '+token);
   assert.ok(!String(url).includes(token));
   const ranges=url.searchParams.getAll('ranges');
   requests.push(...ranges);
   return {ok:true,status:200,json:async()=>({
     valueRanges:ranges.map(range=>({range,values:dataByRange(range)}))
   })};
 }
 return {fetcher,requests};
}
test('conexao restrita a planilha confiavel, somente GET, sem token em URL',async()=>{
 assert.rejects(()=>makeReadOnlySheetsClient({spreadsheetId:'javascript:evil',accessToken:token}),/invalido/);
 const mock=fakeSheet();
 const c=await makeReadOnlySheetsClient({spreadsheetId:SHEET,accessToken:token,fetcher:mock.fetcher});
 await assert.rejects(()=>c.getRanges(["'CLIENTES'!A1:Z1"]),/Faixa nao autorizada/);
 assert.equal(c.requests(),1); // Rejeicao da faixa nao envia HTTP.
});
test('SL8: 19 chamadas vinculadas SDR 1-16s, sem transcricao, sem texto de outros clientes',async()=>{
 const mock=fakeSheet();
 const data=await readBoardForDeal({dealId:DEAL,clientKey:'wisetec',boardClientId:CLIENT,
   spreadsheetId:SHEET,accessToken:token,fetcher:mock.fetcher});
 assert.equal(data.calls.length,19);
 assert.ok(data.calls.every(x=>x.role==='SDR'&&x.roleOrigin==='BOARD_FUNCAO'));
 assert.equal(data.calls[0].durationSeconds,1);
 assert.equal(data.calls[18].durationSeconds,16);
 assert.equal(data.coverage.interactions.records,19);
 assert.equal(data.coverage.transcripts.records,0);
 assert.equal(data.coverage.audits.records,0);
 assert.equal(data.calls.filter(x=>x.transcriptionStatus==='PENDENTE').length,19);
 assert.equal(mock.requests.filter(x=>x.startsWith("'INTERACOES'!A")).length,19);
 assert.ok(!JSON.stringify(data).includes('api4com.com/private'));
 const h=buildHistory({
   deal:{id:DEAL,name:'SL8 Reciclagem',win:false,deal_stage:{name:'Proposta enviada'},
     amount_total:3000,prediction_date:'2026-11-02'},
   stageName:'Proposta enviada',tasks:[],activities:[],
   coverage:{tasks:{complete:true},activities:{complete:true},
     transcripts:{accessible:false},proposals:{accessible:false}}
 },{dealId:DEAL,clientKey:'wisetec',boardSnapshot:data,now:'2026-10-25T12:00:00Z'});
 const calls=h.events.filter(x=>x.kind==='CALL_RECORDED');
 assert.equal(calls.length,19);
 assert.ok(calls.every(x=>x.role==='SDR'&&x.roleEvidence==='CAMPO_FUNCAO_BOARD'));
 assert.ok(calls.every(x=>x.text.includes('Nao comprova conversa')));
 const audit=auditSalesOps(h,{now:'2026-10-25T12:00:00Z'});
 assert.equal(audit.score,null);
 assert.equal(audit.evidenceSummary.sdrCallsDeclared,19);
 assert.equal(audit.evidenceSummary.transcriptsPending,19);
 assert.ok(audit.actions.some(x=>x.id==='short-sdr-calls'));
 assert.ok(audit.actions.some(x=>x.id==='transcripts-pending'));
 assert.ok(!audit.dataCoverage.transcriptsAvailable);
});
test('transcricao completa e auditoria sao vinculadas por ID e cliente, excerpt exige opt-in',async()=>{
 const mock=fakeSheet({withTranscript:true});
 const without=await readBoardForDeal({dealId:DEAL,clientKey:'wisetec',boardClientId:CLIENT,
   spreadsheetId:SHEET,accessToken:token,fetcher:mock.fetcher});
 assert.equal(without.coverage.transcripts.complete,1);
 assert.equal(without.calls[0].hasTranscript,true);
 assert.equal(without.calls[0].transcriptExcerpt,'');
 assert.equal(without.calls[0].audits[0].type,'SDR');
 assert.ok(!mock.requests.some(r=>r==="'TRANSCRICOES'!E2:E2"));
 const allow=fakeSheet({withTranscript:true});
 const withText=await readBoardForDeal({dealId:DEAL,clientKey:'wisetec',boardClientId:CLIENT,
   spreadsheetId:SHEET,accessToken:token,fetcher:allow.fetcher,
   includeTranscriptExcerpts:true});
 assert.ok(withText.calls[0].transcriptExcerpt.includes('Cliente confirmou'));
 const history=buildHistory({deal:{id:DEAL,name:'Exemplo'},stageName:'Proposta enviada',
   tasks:[],activities:[],coverage:{tasks:{complete:true},activities:{complete:true}}},
   {dealId:DEAL,clientKey:'wisetec',boardSnapshot:withText});
 assert.equal(history.events.filter(e=>e.kind==='TRANSCRIPT_EXCERPT').length,1);
 assert.ok(history.events.some(e=>e.parentEvidenceId?.startsWith('BOARD_LIGACAO')));
});
test('usuario nao identificado nao recebe papel por heuristica de etapa',async()=>{
 const mock=fakeSheet({allRoles:false});
 const data=await readBoardForDeal({dealId:DEAL,clientKey:'wisetec',boardClientId:CLIENT,
   spreadsheetId:SHEET,accessToken:token,fetcher:mock.fetcher});
 assert.equal(data.calls[0].role,'NAO_COMPROVADO');
 assert.equal(data.calls.slice(1).every(c=>c.role==='SDR'),true);
});
