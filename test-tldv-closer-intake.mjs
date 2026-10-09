import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const closer = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const central = fs.readFileSync(new URL('./AutomacaoCentral.gs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('./.github/workflows/closer-tldv-repair.yml', import.meta.url),'utf8');
function section(src,start,end){
  const i=src.indexOf(start), j=src.indexOf(end,i+start.length);
  assert.ok(i>=0 && j>i,'Trecho não encontrado: '+start);
  return src.slice(i,j);
}
const config = {TLDV_AUTOMACAO_ATIVA:'SIM',TLDV_AUTOMACAO_MODELO:''};
let triggers=[], created=0;
const callbacks = {
  documentTitle:'', spy:[],
  boardModoManual_:()=>false,
  obterConfiguracao_:key=>config[key]||'',
  salvarConfiguracao_:(key,val)=>{config[key]=val;},
  registrarLog_:()=>{},
  serializarData_:()=> '',
  ScriptApp:{
    getProjectTriggers:()=>triggers,
    deleteTrigger:t=>{triggers=triggers.filter(x=>x!==t);},
    newTrigger:handler=>({
      timeBased(){return this;},
      everyHours(h){assert.equal(h,2);return this;},
      create(){triggers.push({getHandlerFunction:()=>handler});created++;}
    })
  },
  APP:{timezone:'America/Sao_Paulo'},
  Date,JSON,String,Boolean,Array
};
vm.createContext(callbacks);
const triggerSection=section(code,'function instalarAutomacaoTldv()','/**\n * Função executada pelos acionadores.');
vm.runInContext(triggerSection,callbacks);
const installed=callbacks.instalarAutomacaoTldv();
assert.equal(installed.ativa,true);
assert.equal(installed.automacao.totalAcionadores,1);
assert.equal(installed.automacao.intervaloHoras,2);
callbacks.instalarAutomacaoTldv();
assert.equal(created,1,'Reconciliar não pode recriar o gatilho toda vez.');
assert.equal(triggers.length,1);
assert.doesNotMatch(section(central,'function automacaoCentralHandlersLegados_()','function automacaoCentralRemoverAcionadores_('),/SINCRONIZAR_TLDV_AGENDADO/,'Central não deve remover o gatilho dedicado.');
assert.match(code,/const agendaTldv = instalarAutomacaoTldv\(\)/);
assert.match(code,/Number\(acionadores\.tldvDedicado \|\| 0\) === 1/);
assert.match(code,/ops_closer_tldv_repair/);
assert.match(workflow,/github\.event\.comment\.body == '\/closer-tldv-repair'/);
assert.match(workflow,/ops_closer_tldv_repair=1/);
assert.match(code,/tldvDataMs_\(item\.DATA_INTERACAO\) >= cutoffMs/);
assert.match(code,/\.slice\(0, 10\)\.map\(item => item\.ID_INTERACAO\)/);

const roster=[
 {ID_CLIENTE:'INGEE',PAPEL:'CLOSER',NOME:'Jéssica Paulo',EMAIL:'jessica@ingee.com.br',ATIVO:'SIM'},
 {ID_CLIENTE:'INGEE',PAPEL:'CLOSER',NOME:'João Silva',EMAIL:'joao@ingee.com.br',ATIVO:'SIM'},
 {ID_CLIENTE:'INGEE',PAPEL:'SDR',NOME:'Mariana Silva',EMAIL:'mariana@ingee.com.br',ATIVO:'SIM'}
];
const closers=callbacks.identificarCloserReuniaoTldv_;
assert.equal(closers({name:'[INGEE] Apresentação Unimed',organizer:{name:'VOLUM'},invitees:[{email:'jessica@ingee.com.br',name:'Jéssica Paulo'}]},'INGEE',roster,''),'Jéssica Paulo');
assert.equal(closers({name:'INGEE - negociação Unimed',organizer:{name:'VOLUM'},invitees:[{name:'Prospect'}]},'INGEE',roster,'[00:01] Jéssica Paulo: Vamos revisar o diagnóstico.'),'Jéssica Paulo');
assert.equal(closers({name:'INGEE - negociação Unimed',organizer:{name:'VOLUM'},invitees:[]},'INGEE',roster,'João: Vamos iniciar.'),'', 'Primeiro nome João é ambíguo sem registro exato e não deve gerar.');
assert.equal(closers({name:'INGEE + VOLUM Operacional Closer',organizer:{email:'jessica@ingee.com.br'}},'INGEE',roster,''),'');
assert.equal(closers({name:'INGEE apresentação',organizer:{name:'VOLUM'},invitees:[]},'INGEE',roster,''),'','Não atribuir Closer genérico.');
assert.equal(closers({name:'INGEE apresentação',invitees:[{name:'Jéssica Paulo'},{name:'João Silva'}]},'INGEE',roster,''),'','Dois closers diferentes, identificação ambígua.');

const finder=section(code,'function identificarClienteReuniaoTldv_(reuniao, regras, clientes)','function importarTranscricoesTldv(');
const context={jornadaIdentificarClienteEvento_:()=>null,Array,Number,String};
vm.createContext(context);
vm.runInContext(finder,context);
const clients=[
 {ID_CLIENTE:'INGEE',NOME_CLIENTE:'INGEE',TIPO_CLIENTE:'EMPRESA',STATUS:'ATIVO'},
 {ID_CLIENTE:'GRUPO',NOME_CLIENTE:'Grupo Sinergia',TIPO_CLIENTE:'GRUPO',STATUS:'ATIVO'},
 {ID_CLIENTE:'SIN',NOME_CLIENTE:'Sinergia',TIPO_CLIENTE:'EMPRESA',STATUS:'ATIVO'},
 {ID_CLIENTE:'VOLUM',NOME_CLIENTE:'VOLUM',TIPO_CLIENTE:'EMPRESA',STATUS:'ATIVO'}
];
assert.equal(context.identificarClienteReuniaoTldv_({name:'INGEE - Apresentação para Unimed'},[],clients).idCliente,'INGEE');
assert.equal(context.identificarClienteReuniaoTldv_({name:'Grupo Sinergia - Operacional'},[],clients),null,'Grupo não deve cair em Sinergia.');
assert.equal(context.identificarClienteReuniaoTldv_({name:'VOLUM reunião comercial'},[],clients),null);

const queueSource=section(closer,'function audV3FilaAutomacaoReunioesCloser_(', 'function obterStatusAutomacaoReunioesCloserV3(');
const qCtx={
 Date,Number,String,Boolean,Object,Array,
 tldvReuniaoOperacional_:callbacks.tldvReuniaoOperacional_,
 audV3PitchAtualAutomatico_:()=>({ID_PITCH:'PITCH'}),
 audV3FiltrarAuditoriasVisiveisOperacao_:()=>[],
 audV3EstadoErrosReunioesCloser_:()=>({}),
 audV3Ler_:()=>[]
};
vm.createContext(qCtx);vm.runInContext(queueSource,qCtx);
const inter={ID_INTERACAO:'TLDV-1',ID_CLIENTE:'INGEE',TIPO_INTERACAO:'REUNIAO',FONTE:'TLDV',TITULO:'INGEE - proposta Unimed',DATA_INTERACAO:new Date('2026-10-10T13:00:00Z')};
const args={interacoes:[inter],transcricoes:[{ID_INTERACAO:'TLDV-1',STATUS:'CONCLUIDA',CONTEUDO:'X'.repeat(40)}],pitches:[],auditorias:[]};
const opts={cutoffMs:Date.parse('2026-10-09T17:21:33.642Z')};
assert.equal(qCtx.audV3FilaAutomacaoReunioesCloser_(opts,args).length,0,'Sem closer confirmado deve ficar fora da fila.');
args.interacoes=[{...inter,COLABORADOR:'Jéssica Paulo',FUNCAO:'CLOSER'}];
assert.equal(qCtx.audV3FilaAutomacaoReunioesCloser_(opts,args).length,1);
args.interacoes=[{...inter,COLABORADOR:'Jéssica Paulo',FUNCAO:'CLOSER',TITULO:'INGEE + VOLUM Operacional Closer'}];
assert.equal(qCtx.audV3FilaAutomacaoReunioesCloser_(opts,args).length,0);
args.interacoes=[{...inter,COLABORADOR:'Jéssica Paulo',FUNCAO:'CLOSER',DATA_INTERACAO:new Date('2026-10-07T12:00:00Z')}];
assert.equal(qCtx.audV3FilaAutomacaoReunioesCloser_(opts,args).length,0,'Nunca reprocessar anteriores ao cutoff.');

console.log('OK: acionador 2h idempotente, status, cliente/Closer confiáveis, fila segura, operacional e histórico ignorados.');
