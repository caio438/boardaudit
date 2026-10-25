import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./VolumProvaApiWisetec.gs',import.meta.url),'utf8');
new Function(source);
const dealId='6acc888b98976f0023dc583f';
const urls=[], logs=[];
const resultContext=vm.createContext({
  Object,Number,Date,Array,String,Boolean,JSON,RegExp,Error,
  console:{log(value){logs.push(value);}},
  APP:{rdBaseUrl:'https://crm.rdstation.com/api/v1'},
  obterIntegracaoCliente_(id,tipo){
    assert.equal(id,'CLI-20260803131300-C4455D17');
    assert.equal(tipo,'RD_STATION');
    return {ATIVO:'SIM',ID_INTEGRACAO:'INTEG_TEST'};
  },
  obterSegredo_(k){
    assert.equal(k,'INTEGRACAO_TOKEN_INTEG_TEST');
    return 'DUMMY_TOKEN_TEST';
  },
  requisicaoJson_(url,options){
    assert.equal(options.method,'get');
    urls.push(url);
    const parsed=new URL(url);
    assert.equal(parsed.searchParams.get('token'),'DUMMY_TOKEN_TEST');
    if(parsed.pathname.endsWith('/deals/'+dealId))return {deal:{id:dealId}};
    if(parsed.pathname.endsWith('/activities'))return {
      activities:[
        {id:'a1',deal_id:dealId,text:'Wagner desmarcou a reuniao. Tenta reagendar.'},
        {id:'a2',deal_id:dealId,text:'Nao atendeu'},
        {id:'a3',deal_id:'aaaaaaaaaaaaaaaaaaaaaaaa',text:'OUTRO CLIENTE'}
      ]
    };
    if(parsed.pathname.endsWith('/tasks'))return {has_more:false,tasks:[
      {id:'t1',deal_id:dealId,subject:'Recovery Dia 1 Ligacao 3',done:true},
      {id:'t2',deal_id:dealId,subject:'Retorno do cliente',done:false}
    ]};
    throw new Error('Unexpected endpoint');
  }
});
vm.runInContext(source,resultContext);
const result=resultContext.VOLUM_PROVA_API_RD_WISETEC();
assert.equal(result.sucesso,true);
assert.equal(result.anotacoes,2);
assert.equal(result.anotacoesComTexto,2);
assert.equal(result.tarefas,2);
assert.equal(result.tarefasConcluidas,1);
assert.equal(result.sinais.desmarcouOuReagendou,1);
assert.equal(result.sinais.naoAtendeu,1);
assert.equal(result.sinais.recoveryDia1Ligacao3,1);
assert.equal(urls.length,3);
assert.equal(logs.length,1);
const publicText=JSON.stringify(result)+'\n'+logs.join('\n');
assert.doesNotMatch(publicText,/Wagner|DUMMY_TOKEN_TEST|OUTRO CLIENTE|a1|t1/);
assert.doesNotMatch(source,/UrlFetchApp\.fetch|(?<!\/)\/api\/v1\/activities.*method:\s*'post'/);
console.log('Teste RD isolado aprovado: 3 GET, vinculo validado, evidencias resumidas sem texto ou token.');
