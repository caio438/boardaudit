import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('MCP stdio anuncia ferramentas e bloqueia cliente nao autorizado sem consultar RD',async()=>{
  const file=fileURLToPath(new URL('../src/server.mjs',import.meta.url));
  const child=spawn(process.execPath,[file],{env:{
    ...process.env,VOLUM_RD_TOKEN:'private-test-token',
    VOLUM_MCP_CLIENT_KEY:'wisetec',
    VOLUM_BOARD_SNAPSHOT_FILE:'',VOLUM_MCP_ROLES_JSON:''
  },stdio:['pipe','pipe','pipe']});
  const pending=new Map();
  let buffer='',next=0,errorText='';
  child.stderr.on('data',b=>{errorText+=b.toString().slice(0,2000)});
  child.stdout.on('data',b=>{
    buffer+=b.toString();
    for(let i=buffer.indexOf('\n');i>=0;i=buffer.indexOf('\n')){
      const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);
      if(!line)continue;
      let message;try{message=JSON.parse(line)}catch(e){throw new Error('Saida MCP nao e JSON-RPC: '+line.slice(0,100))}
      const cb=pending.get(message.id);
      if(cb){pending.delete(message.id);cb(message);}
    }
  });
  async function request(method,params){
    const id=++next;
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timeout MCP: '+method+' '+errorText.slice(0,200)))},7000);
      pending.set(id,msg=>{clearTimeout(timer);resolve(msg)});
    });
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
    return promise;
  }
  try{
    const ini=await request('initialize',{protocolVersion:'2026-07-28',
      capabilities:{},clientInfo:{name:'volum-test',version:'0.1.0'}});
    assert.ok(ini.result?.serverInfo,JSON.stringify(ini));
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    const list=await request('tools/list',{});
    const names=(list.result?.tools||[]).map(x=>x.name).sort();
    assert.deepEqual(names,[
      'audit_sales_ops','get_lead_evidence','get_lead_history','get_source_coverage'
    ]);
    const denied=await request('tools/call',{name:'audit_sales_ops',arguments:{
      clientKey:'nao-autorizado',dealId:'6acc888b98976f0023dc583f'
    }});
    assert.equal(denied.result?.isError,true,JSON.stringify(denied));
    assert.ok(!JSON.stringify(denied).includes('private-test-token'));
  }finally{
    child.stdin.end();child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();
      child.once('exit',resolve);setTimeout(resolve,1500).unref();});
  }
});
