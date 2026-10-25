import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDealId,redact,normalizeDate,brazilDay,makeRdClient,
  readRdHistory,buildHistory,auditSalesOps,ACTIVITY_TYPES
} from '../src/core.mjs';

const ID='6acc888b98976f0023dc583f';
const STAGE='aaaaaaaaaaaaaaaaaaaaaaaa';
function fixtures({partial=false}={}){
  const calls=[];
  const handler=async(url,options)=>{
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal(url.hostname,'crm.rdstation.com');
    assert.equal(url.searchParams.get('token'),'private-test-token');
    calls.push({path:url.pathname,type:url.searchParams.get('type'),page:url.searchParams.get('page')});
    const path=url.pathname.replace('/api/v1','');
    let body;
    if(path==='/deals/'+ID)body={deal:{
      id:ID,name:'SL8 Reciclagem',deal_stage:{id:STAGE},user:{name:'Closer de Teste'},
      created_at:'2026-10-01T10:00:00-03:00',win:false,
      amount_total:17500,prediction_date:'2026-11-12'}};
    else if(path==='/deal_stages/'+STAGE)body={deal_stage:{id:STAGE,name:'Proposta enviada'}};
    else if(path==='/tasks')body={tasks:[
      {id:'t1',deal_id:ID,subject:'Acompanhar proposta',date:'2026-11-03',
        created_at:'2026-10-22T09:00:00-03:00',done:false,user_id:'closer-1'},
      {id:'t2',deal_id:ID,subject:'Dia 2 - tentativa de contato',
        date:'2026-10-20',created_at:'2026-10-19T13:00:00Z',
        done:true,done_date:'2026-10-20T13:10:00Z'},
      {id:'outsider',deal_id:'bbbbbbbbbbbbbbbbbbbbbbbb',subject:'Outro cliente',done:false}
    ]};
    else if(path==='/activities'){
      const type=url.searchParams.get('type');
      body={activities:type==='note'?[{
        id:'n1',deal_id:ID,type:'note',date:'2026-10-21T13:10:00Z',
        user_id:'closer-1',text:'O lead não atendeu. Email teste@acme.com'
      }]:[]};
      if(type==='note'&&partial)body.has_more=true;
    }else throw Error('Wrong path '+path);
    return {ok:true,status:200,json:async()=>body};
  };
  return {handler,calls};
}
test('bloqueia IDs invalidos, URLs, endpoints arbitrarios e segredos',()=>{
  assert.equal(validateDealId(ID),ID);
  assert.throws(()=>validateDealId('https://evil/abc'),/invalido/);
  assert.throws(()=>makeRdClient({token:'x',base:'https://fake.local/api/v1'}),/autorizada/);
  const s=redact('token=abc https://example.com?t=x email teste@acme.com');
  assert.ok(!s.includes('abc'));assert.ok(!s.includes('example.com'));assert.ok(!s.includes('teste@acme.com'));
});
test('datas brasileiras nao sofrem deslocamento por fuso',()=>{
  assert.equal(normalizeDate('2026-10-29'),'2026-10-29');
  assert.equal(brazilDay('2026-10-29'),'2026-10-29');
  assert.equal(brazilDay('2026-10-29T02:10:00Z'),'2026-10-28');
  assert.equal(normalizeDate('20/10/2026 10:30'),'2026-10-20T13:30:00.000Z');
});
test('reconstrucao RD usa GET, confere vinculo e nao deduz papel',async()=>{
  const mock=fixtures(),raw=await readRdHistory({dealId:ID,token:'private-test-token',fetcher:mock.handler});
  assert.equal(raw.stageName,'Proposta enviada');
  assert.equal(raw.coverage.tasks.records,2);
  assert.equal(raw.coverage.activities.records,1);
  assert.equal(raw.coverage.activities.complete,true);
  assert.equal(raw.coverage.tasks.rejected,1);
  assert.equal(mock.calls.filter(x=>x.path.endsWith('/activities')).length,ACTIVITY_TYPES.length);
  assert.ok(mock.calls.every(x=>x.page===null||Number(x.page)===1));
  const h=buildHistory(raw,{dealId:ID,clientKey:'wisetec',now:'2026-10-25T12:00:00Z'});
  assert.equal(h.deal.closureState,'NAO_CONFIRMADA');
  assert.equal(h.deal.stageName,'Proposta enviada');
  assert.ok(h.events.some(x=>x.id==='t1'&&x.dueAt==='2026-11-03'));
  assert.equal(h.events.filter(e=>e.id==='n1').length,1);
  assert.ok(h.events.every(e=>e.role==='NAO_COMPROVADO'));
  assert.ok(!JSON.stringify(h).includes('teste@acme.com'));
  const verdict=auditSalesOps(h,{now:'2026-10-25T12:00:00Z'});
  assert.equal(verdict.score,null);
  assert.ok(verdict.actions.some(x=>x.id==='proposal-proof'));
  assert.ok(verdict.actions.some(x=>x.id==='proposal-receipt'));
  assert.ok(verdict.actions.some(x=>x.id==='next-task'));
  assert.ok(!verdict.actions.some(x=>/fechad.*concorrente|perdid/i.test(x.text)));
  assert.equal(verdict.nextTask.dueAt,'2026-11-03');
});
test('sem autoria SDR, chamadas nao sao atribuidas ao SDR; snapshot rejeita outro cliente',async()=>{
  const mock=fixtures(),raw=await readRdHistory({dealId:ID,token:'private-test-token',fetcher:mock.handler});
  const calls=[{id:'call1',dealId:ID,at:'2026-10-23T12:00:00Z',
    durationSeconds:125,hasRecording:true,userId:'sdr-verified'}];
  let h=buildHistory(raw,{dealId:ID,clientKey:'wisetec',
    boardSnapshot:{dealId:ID,clientKey:'outro',calls}});
  assert.equal(h.events.filter(e=>e.kind==='CALL_RECORDED').length,0);
  h=buildHistory(raw,{dealId:ID,clientKey:'wisetec',
    boardSnapshot:{dealId:ID,clientKey:'wisetec',calls,complete:true}});
  const call=h.events.find(e=>e.kind==='CALL_RECORDED');
  assert.equal(call.role,'NAO_COMPROVADO');
  assert.match(call.text,/Nao comprova conversa/);
  h=buildHistory(raw,{dealId:ID,clientKey:'wisetec',roleMap:{'sdr-verified':'SDR'},
    boardSnapshot:{dealId:ID,clientKey:'wisetec',calls,complete:true}});
  assert.equal(h.events.find(e=>e.kind==='CALL_RECORDED').role,'SDR');
});
test('atividade truncada sinaliza cobertura parcial e nao presume falta de acao',async()=>{
  const mock=fixtures({partial:true});
  const raw=await readRdHistory({dealId:ID,token:'private-test-token',fetcher:mock.handler,maxActivityPages:1});
  assert.equal(raw.coverage.activities.complete,false);
  const h=buildHistory(raw,{dealId:ID,clientKey:'wisetec'});
  const a=auditSalesOps(h);
  assert.equal(a.dataCoverage.rdComplete,false);
  assert.ok(a.actions.some(x=>x.id==='source-coverage'));
});
