/**
 * VOLUM Sales Ops MCP - motor somente leitura.
 * Sem uso de credenciais em logs, sem endpoints de escrita no CRM.
 * A origem responde por evidencias; o modelo nao deve inventar um papel ou SLA.
 */
import { createHash } from 'node:crypto';

export const ACTIVITY_TYPES=Object.freeze([
  'note','changelog','call','task','email','proposal','response',
  'messenger','whatsapp_audio','whatsapp_transcription',
  'child_deal_created','resource_log','created_from_parent_deal',
  'workflow_recursive_limit'
]);
export function validateDealId(value) {
  const id=String(value||'').trim().toLowerCase();
  if(!/^[a-f0-9]{24}$/.test(id))throw new Error('ID de negociacao RD invalido.');
  return id;
}
export function redact(value,max=4000) {
  return String(value??'')
    .replace(/https?:\/\/[^\s<>"']+/gi,'[LINK_PRIVADO]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[EMAIL_PRIVADO]')
    .replace(/\b(?:token|authorization|apikey|api_key|password)\s*[=:]\s*[^\s;,]+/gi,'[SEGREDO_PRIVADO]')
    .replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g,'[CPF_PRIVADO]')
    .replace(/\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b/g,'[CNPJ_PRIVADO]')
    .replace(/(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g,'[TELEFONE_PRIVADO]')
    .slice(0,max);
}
export function normalizeDate(value) {
  const s=String(value||'').trim();
  if(!s)return '';
  // Data sem hora permanece data civil; converter para UTC a deslocaria para o dia anterior em Sao Paulo.
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return Number.isNaN(Date.parse(s))?'':s;
  const br=s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if(br){
    const iso=br[3]+'-'+br[2]+'-'+br[1]+'T'+(br[4]||'00')+':'+(br[5]||'00')+':'+(br[6]||'00')+'-03:00';
    const d=new Date(iso);
    return Number.isNaN(d.getTime())?'':d.toISOString();
  }
  const d=new Date(s);
  return Number.isNaN(d.getTime())?'':d.toISOString();
}
export function brazilDay(input) {
  const s=String(input||'');
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const d=new Date(input);
  if(Number.isNaN(d.getTime()))return '';
  const pts=new Intl.DateTimeFormat('en-US',{
    year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Sao_Paulo'
  }).formatToParts(d);
  const o={};pts.forEach(p=>{o[p.type]=p.value;});
  return o.year+'-'+o.month+'-'+o.day;
}
function digest(value){return createHash('sha256').update(String(value)).digest('hex').slice(0,18);}
function listResponse(json,field) {
  if(Array.isArray(json))return json;
  if(json&&Array.isArray(json[field]))return json[field];
  if(json&&Array.isArray(json.data))return json.data;
  throw new Error('RD respondeu com estrutura de lista inesperada em '+field+'.');
}
function dealOf(item) {
  return String(item?.deal_id||item?.deal?.id||item?.deal?._id||'').toLowerCase();
}
export function makeRdClient({token,fetcher=fetch,base='https://crm.rdstation.com/api/v1',timeoutMs=12000}) {
  if(!token || typeof token!=='string')throw new Error('Credencial RD nao configurada no ambiente privado.');
  // Nao aceitar URL remota arbitraria (protege contra SSRF e vazamento de token).
  const root=new URL(base);
  if(root.protocol!=='https:' || root.hostname!=='crm.rdstation.com' || root.pathname!=='/api/v1')
    throw new Error('Base da API RD nao autorizada.');
  let requestCount=0;
  async function get(path,params={}) {
    if(!/^\/(?:deals|tasks|activities|deal_stages)(?:\/[a-f0-9]{24})?$/.test(path))
      throw new Error('Operacao de leitura nao permitida.');
    if(requestCount++>=80)throw new Error('Limite seguro de consultas RD atingido.');
    const url=new URL(root.toString()+path);
    url.searchParams.set('token',token);
    Object.entries(params).forEach(([key,value])=>{
      if(!['page','limit','deal_id','type'].includes(key))throw new Error('Filtro RD nao autorizado.');
      url.searchParams.set(key,String(value));
    });
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetcher(url,{method:'GET',headers:{Accept:'application/json'},
        redirect:'error',signal:controller.signal});
      if(!response.ok)throw new Error('Falha RD HTTP '+response.status);
      return await response.json();
    }catch(e){
      if(e?.name==='AbortError')throw new Error('Consulta RD excedeu o tempo limite.');
      if(/^Falha RD HTTP /.test(String(e?.message||'')))throw e;
      throw new Error('Fonte RD indisponivel ou resposta invalida.');
    }finally{clearTimeout(timer);}
  }
  return {get,requests:()=>requestCount};
}
export async function readRdHistory({dealId,token,fetcher,maxActivityPages=3,maxTaskPages=10}) {
  const id=validateDealId(dealId);
  const api=makeRdClient({token,fetcher});
  const rawDeal=await api.get('/deals/'+id);
  const deal=rawDeal?.deal||rawDeal;
  if(String(deal?.id||deal?._id||'').toLowerCase()!==id)throw new Error('RD nao confirmou o ID da negociacao.');
  async function pages(path,field,extra,maxPages) {
    const rows=[],errors=[];
    let complete=false,unlinked=0,rejected=0;
    for(let page=1;page<=maxPages;page++){
      try {
        const res=await api.get(path,{...extra,deal_id:id,page,limit:200});
        const part=listResponse(res,field);
        for(const item of part){
          const linked=dealOf(item);
          if(linked===id)rows.push(item);
          else if(!linked){unlinked++;}else rejected++;
        }
        const meta=res?.pagination||res?.paging||res?.meta||{};
        const nPages=Number(meta.total_pages||res?.total_pages||0);
        const next=typeof res?.has_more==='boolean'?res.has_more:
          nPages?page<nPages:
          Boolean(res?.next_page||meta?.next_page||meta?.next||part.length===200);
        if(!next){complete=true;break;}
      } catch(e) {
        errors.push(String(e.message||'falha').slice(0,130));
        break;
      }
    }
    // Sem vinculo explicitamente verificavel nao podemos alegar cobertura completa.
    if(unlinked)complete=false;
    return {rows,complete,unlinked,rejected,errors};
  }
  const taskRes=await pages('/tasks','tasks',{},Math.min(10,Math.max(1,maxTaskPages)));
  const all=[],types={},byId=new Map(),conflicts=[];
  for(const type of ACTIVITY_TYPES){
    const res=await pages('/activities','activities',{type},
      Math.min(5,Math.max(1,maxActivityPages)));
    types[type]={complete:res.complete,records:res.rows.length,
      unlinked:res.unlinked,rejected:res.rejected,errors:res.errors};
    for(const item of res.rows){
      const key=String(item.id||item._id||
        'missing:'+digest([item.date,item.user_id,item.text].join('|')));
      const assignedType=String(item.type||type).toLowerCase();
      const existing=byId.get(key);
      if(existing){
        if(existing._volumType!==assignedType){
          existing._volumType='unconfirmed';
          conflicts.push(key);
        }
        continue;
      }
      const annotated={...item,_volumType:assignedType,
        _volumTypeOrigin:item.type?'RD_FIELD':'FILTER_ONLY'};
      byId.set(key,annotated);all.push(annotated);
    }
  }
  let stageName=String(deal?.deal_stage?.name||deal?.deal_stage_name||'').slice(0,100);
  const stageId=String(deal?.deal_stage?.id||deal?.deal_stage?._id||deal?.deal_stage_id||'');
  if(!stageName&&/^[a-f0-9]{24}$/i.test(stageId)){
    try{
      const response=await api.get('/deal_stages/'+stageId.toLowerCase());
      const s=response?.deal_stage||response;
      if(String(s?.id||s?._id||'').toLowerCase()===stageId.toLowerCase())
        stageName=String(s?.name||'').slice(0,100);
    }catch{/* Etapa desconhecida permanece desconhecida. */}
  }
  return {
    deal,stageName,activities:all,tasks:taskRes.rows,
    coverage:{
      deal:{accessible:true,complete:true,records:1},
      tasks:{accessible:!taskRes.errors.length,complete:taskRes.complete,
        records:taskRes.rows.length,unlinked:taskRes.unlinked,errors:taskRes.errors},
      activities:{accessible:Object.values(types).some(t=>!t.errors.length),
        complete:Object.values(types).every(t=>t.complete)&&conflicts.length===0,
        records:all.length,types,conflicts:conflicts.length},
      board:{accessible:false,complete:false,reason:'BOARD_NAO_INTEGRADO'},
      transcripts:{accessible:false,complete:false,reason:'TRANSCRICOES_NAO_INTEGRADAS'},
      proposals:{accessible:false,complete:false,reason:'ANEXOS_NAO_INTEGRADOS'},
      requestCount:api.requests()
    }
  };
}
export function buildHistory(raw,{dealId,clientKey,roleMap={},boardSnapshot=null,now=new Date()}={}) {
  const id=validateDealId(dealId);
  const deal=raw.deal||{};
  const events=[],known=new Set();
  const sourceRoles=roleMap&&typeof roleMap==='object'?roleMap:{};
  const roleOf=userId=>{
    const r=String(sourceRoles[String(userId||'')]||'').toUpperCase();
    return r==='SDR'||r==='CLOSER'?r:'NAO_COMPROVADO';
  };
  function add(event) {
    if(!event.at) return;
    const k=event.source+'|'+event.id+'|'+event.kind;
    if(known.has(k))return;
    known.add(k);
    events.push({...event,role:event.userId?roleOf(event.userId):'NAO_COMPROVADO'});
  }
  const dealCreated=normalizeDate(deal.created_at);
  add({id:'created',source:'RD_NEGOCIACAO',kind:'DEAL_CREATED',at:dealCreated,
    label:'Negociacao criada',userId:'',text:''});
  const histories=Array.isArray(deal.deal_stage_histories)?deal.deal_stage_histories:[];
  histories.forEach((x,i)=>add({id:'stage-'+(x.deal_stage_id||i)+'-'+i,
    source:'RD_NEGOCIACAO',kind:'STAGE_ENTERED',at:normalizeDate(x.start_date),
    label:'Entrada em etapa RD',userId:'',text:'',stageId:String(x.deal_stage_id||'')}));
  (raw.activities||[]).forEach((a,i)=>{
    const aid=String(a.id||a._id||digest([a.date,a.user_id,a.text].join('|')));
    add({id:aid,source:'RD_ATIVIDADE',kind:'ACTIVITY_'+String(a._volumType||a.type||'unknown').toUpperCase(),
      at:normalizeDate(a.date||a.created_at),label:'Atividade '+String(a._volumType||a.type||'desconhecida'),
      userId:String(a.user_id||a.user?.id||''),text:redact(a.text||a.description||a.content),
      classification:String(a._volumTypeOrigin||'DESCONHECIDA')});
  });
  (raw.tasks||[]).forEach((t,i)=>{
    const taskId=String(t.id||t._id||digest([t.date,t.subject,i].join('|')));
    const userId=String(t.user_id||t.user?.id||t.assigned_to?.id||'');
    const label=redact(t.subject||'Tarefa comercial',180);
    const done=t.done===true||String(t.done)==='true';
    const scheduled=normalizeDate(t.date);
    add({id:taskId,source:'RD_TAREFA',kind:'TASK_CREATED',at:normalizeDate(t.created_at),
      label,userId,text:redact(t.notes||t.description,800),dueAt:scheduled,done,
      taskType:String(t.type||'')});
    if(done)add({id:taskId,source:'RD_TAREFA',kind:'TASK_COMPLETED',
      at:normalizeDate(t.done_date||t.done_at||t.completed_at),
      label,userId,text:'Conclusao registrada no RD; nao comprova contato.',
      dueAt:scheduled,done:true,taskType:String(t.type||'')});
  });
  const coverage={...raw.coverage};
  let board=[];
  if(boardSnapshot && boardSnapshot.clientKey===clientKey &&
    String(boardSnapshot.dealId||'').toLowerCase()===id &&
    Array.isArray(boardSnapshot.calls)){
    board=boardSnapshot.calls.filter(c=>String(c.dealId||'').toLowerCase()===id);
    coverage.board={accessible:true,complete:boardSnapshot.complete===true,
      records:board.length,origin:'SNAPSHOT_LOCAL_VALIDADO'};
    board.forEach((c,i)=>{
      const idCall=String(c.id||digest([c.at,c.taskId,i].join('|')));
      add({id:idCall,source:'BOARD_LIGACAO',kind:'CALL_RECORDED',
        at:normalizeDate(c.at),label:'Ligacao registrada no board',
        userId:String(c.userId||''),
        text:'Duracao registrada: '+Math.max(0,Number(c.durationSeconds)||0)+'s. Nao comprova conversa.',
        taskId:String(c.taskId||''),hasRecording:Boolean(c.hasRecording),
        transcriptionStatus:String(c.transcriptionStatus||'DESCONHECIDA')});
    });
  }
  events.sort((a,b)=>a.at.localeCompare(b.at)||
    a.source.localeCompare(b.source)||a.id.localeCompare(b.id));
  const warnings=[];
  if(!coverage.tasks?.complete)warnings.push('Tarefas RD incompletas ou sem vinculo confirmado.');
  if(!coverage.activities?.complete)warnings.push('Atividades RD incompletas, conflitantes ou parcialmente paginadas.');
  if(!coverage.board?.accessible)warnings.push('Ligacoes do board nao integradas nesta execucao.');
  if(!coverage.transcripts?.accessible)warnings.push('Audios e transcricoes nao lidos; nao validar pitch ou conversa.');
  if(!coverage.proposals?.accessible)warnings.push('PDF e comprovante de envio/recebimento nao coletados.');
  return {
    mode:'READ_ONLY',clientKey,dealId:id,generatedAt:normalizeDate(now),
    deal:{name:redact(deal.name,140),stageName:String(raw.stageName||''),
      owner:redact(deal.user?.name||'',90),
      amount:deal.amount_total===null||deal.amount_total===undefined?null:Number(deal.amount_total),
      forecastDate:String(deal.prediction_date||'').slice(0,30),
      closureState:deal.win===true?'GANHA':deal.win===false && (deal.closed_at||deal.closed===true)?'PERDIDA':'NAO_CONFIRMADA'},
    coverage,warnings,events
  };
}
export function auditSalesOps(history,{now=new Date()}={}) {
  const events=history.events||[],d=history.deal||{},c=history.coverage||{};
  const stage=String(d.stageName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const closed=d.closureState==='GANHA'||d.closureState==='PERDIDA'||/perdid|ganh|encerrad/.test(stage);
  const proposal=/proposta|negociacao|follow|recovery|recuperacao/.test(stage);
  const notes=events.filter(e=>e.source==='RD_ATIVIDADE'&&e.text);
  const tasks=events.filter(e=>e.kind==='TASK_CREATED'&&e.dueAt);
  const completed=new Set(events.filter(e=>e.kind==='TASK_COMPLETED').map(e=>e.id));
  const open=tasks.filter(t=>!t.done&&!completed.has(t.id))
    .sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
  const today=brazilDay(now);
  const overdue=open.filter(t=>brazilDay(t.dueAt)<today);
  const next=open[0]||null;
  const trueReceipt=notes.some(n=>/(?:cliente|comprador|lead)\s+(?:confirmou|acusou)\s+(?:o\s+)?recebimento\s+(?:da\s+)?proposta/i.test(n.text));
  const proposalMention=events.some(e=>e.kind==='ACTIVITY_PROPOSAL')||
    notes.some(n=>/proposta\s+(?:foi\s+)?enviada|enviamos\s+(?:a\s+)?proposta/i.test(n.text));
  const actions=[],seen=new Set();
  function action(id,priority,text,why,evidenceIds=[],doneWhen='Evidencia e acordo validados.') {
    if(seen.has(id))return;
    seen.add(id);actions.push({id,priority,text,why,evidenceIds,doneWhen});
  }
  if(closed)action('review-closure','BAIXA',
    'Reconciliar desfecho e registros; nao retomar automaticamente.',
    'Negociacao aparece encerrada no RD.',[], 'Motivo e evidencias conferidos.');
  else {
    if(overdue.length)action('overdue','ALTA',
      'Revisar '+overdue.length+' tarefa(s) vencida(s), comecando por '+overdue[0].label+'.',
      'Prazo no RD anterior a hoje; a tarefa vencida nao prova falta de contato.',
      [overdue[0].id], 'Resultado ou novo acordo confirmado.');
    if(proposal){
      if(!proposalMention)action('proposal-proof','ALTA',
        'Validar documento e envio da proposta com o closer.',
        'A etapa nao prova que o PDF foi entregue; anexos nao sao lidos.',[],
        'PDF correto, destinatario e data de envio verificados.');
      if(!trueReceipt)action('proposal-receipt','MEDIA',
        'Confirmar recebimento e feedback sobre a proposta.',
        'Sem confirmacao inequivoca no historico textual consultado.',[],
        'Resposta do comprador com canal e data verificados.');
      if(d.amount===null||!Number.isFinite(d.amount)||d.amount<=0)
        action('proposal-amount','MEDIA','Reconciliar valor da negociacao e proposta.',
          'Valor da negociacao ausente ou nao positivo.',[],'Valor positivo conferido com proposta.');
      if(!d.forecastDate||brazilDay(d.forecastDate)<today)
        action('forecast','MEDIA','Revalidar previsao de fechamento.',
          'Data ausente ou anterior a hoje.',[],'Forecast alinhado a compromisso real.');
    }
    if(next)action('next-task','MEDIA',
      'Revisar ou executar "'+next.label+'" em '+brazilDay(next.dueAt)+'.',
      'Tarefa datada no RD; nao prova compromisso aceito pelo cliente.',
      [next.id],'Resultado documentado e proximo acordo confirmado.');
    else if(c.tasks?.complete)action('next-step','ALTA',
      'Definir proximo passo com data e responsavel.',
      'Nao ha tarefa datada aberta na coleta concluida do RD.',[],
      'Tarefa e acordo com lead registrados.');
    if(!stage)action('stage','MEDIA','Validar a etapa da negociacao.',
      'A API nao retornou nome de etapa confiavel.',[],'Etapa identificada no RD.');
  }
  if(!c.tasks?.complete||!c.activities?.complete)action('source-coverage','MEDIA',
    'Verificar cobertura das fontes antes de concluir compliance.',
    'Consulta incompleta impede declarar ausencia de acao.',[],
    'Fontes e paginacao validadas.');
  const weights={ALTA:0,MEDIA:1,BAIXA:2};
  actions.sort((a,b)=>weights[a.priority]-weights[b.priority]);
  return {mode:'READ_ONLY',dealId:history.dealId,clientKey:history.clientKey,
    stage:d.stageName||'NAO_CONFIRMADA',score:null,
    dealStatus:d.closureState,actions:actions.slice(0,6),
    nextTask:next?{id:next.id,label:next.label,dueAt:next.dueAt,role:next.role}:null,
    evidenceSummary:{totalEvents:events.length,
      calls:events.filter(e=>e.kind==='CALL_RECORDED').length,
      notes:notes.length,missingRole:events.filter(e=>e.role==='NAO_COMPROVADO').length},
    dataCoverage:{rdComplete:Boolean(c.tasks?.complete&&c.activities?.complete),
      boardAvailable:Boolean(c.board?.accessible),transcriptsAvailable:Boolean(c.transcripts?.accessible),
      proposalsAvailable:Boolean(c.proposals?.accessible)},
    warnings:history.warnings,
    interpretationLimits:['Tarefa nao prova contato','Duracao nao prova dialogo',
      'Etapa comercial nao comprova proposta entregue',
      'Sem operador e papel confirmados nao atribuir a SDR/closer.']};
}
