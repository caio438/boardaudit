/**
 * Leitor somente leitura da planilha BoardAudit via Google Sheets API.
 * Uso com credenciais ADC de um service account com permissao de visualizador.
 * Busca primeiro as colunas de vinculo; le os detalhes somente dos registros
 * efetivamente vinculados ao cliente e ao deal. Nunca lista outros clientes.
 */
import {normalizeDate,redact,validateDealId} from './core.mjs';

const ID_PATTERN=/^[A-Za-z0-9_-]{25,150}$/;
const DEAL_LINK=/^https:\/\/crm\.rdstation\.com\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;
const SHEET_IDS={interactions:'INTERACOES',transcripts:'TRANSCRICOES',audits:'AUDITORIAS'};
function asString(x){return String(x??'').trim();}
function batch(values){return values?.valueRanges?.map(v=>v.values||[])||[];}
export async function makeReadOnlySheetsClient({spreadsheetId,accessToken,fetcher=fetch,timeoutMs=14000}){
  if(!ID_PATTERN.test(spreadsheetId||''))throw new Error('ID da planilha Board invalido.');
  if(!accessToken||typeof accessToken!=='string')throw new Error('Token Google Sheets ausente.');
  let requestCount=0;
  async function getRanges(ranges){
    if(!Array.isArray(ranges)||ranges.length<1||ranges.length>100)
      throw new Error('Faixas de leitura invalidas.');
    if(requestCount++>=20)throw new Error('Limite de leitura do board atingido.');
    const url=new URL('https://sheets.googleapis.com/v4/spreadsheets/'+
      encodeURIComponent(spreadsheetId)+'/values:batchGet');
    for(const range of ranges){
      if(!/^'(?:INTERACOES|TRANSCRICOES|AUDITORIAS)'![A-Z]{1,3}\d*(?::[A-Z]{1,3}\d*)?$/.test(range))
        throw new Error('Faixa nao autorizada.');
      url.searchParams.append('ranges',range);
    }
    url.searchParams.set('valueRenderOption','FORMATTED_VALUE');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const res=await fetcher(url,{
        method:'GET',redirect:'error',signal:controller.signal,
        headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'}
      });
      if(!res.ok)throw new Error('Google Sheets HTTP '+res.status);
      const json=await res.json();
      if(!Array.isArray(json.valueRanges)||json.valueRanges.length!==ranges.length)
        throw new Error('Estrutura Sheets invalida.');
      return batch(json);
    }catch(e){
      if(e?.name==='AbortError')throw new Error('Leitura Sheets excedeu o tempo limite.');
      if(/^(Google Sheets HTTP |Estrutura Sheets invalida|Limite de leitura)/.test(asString(e?.message)))throw e;
      throw new Error('Google Sheets indisponivel ou autorizacao falhou.');
    }finally{clearTimeout(timer);}
  }
  return {getRanges,requests:()=>requestCount};
}
function indexed(rows,columnOffset=2){
  return (rows||[]).map((value,i)=>({row:i+columnOffset,value:asString(value?.[0])}));
}
function chunks(items,n){
  const out=[];for(let i=0;i<items.length;i+=n)out.push(items.slice(i,i+n));
  return out;
}
function classifyStatus(value){
  const s=asString(value).toUpperCase();
  return s||'NAO_INFORMADO';
}
export async function readBoardForDeal({
  dealId,clientKey,boardClientId,spreadsheetId,accessToken,
  fetcher=fetch,includeTranscriptExcerpts=false
}) {
  const id=validateDealId(dealId);
  if(!clientKey||!boardClientId||asString(boardClientId).length>110)
    throw new Error('Cliente Board nao configurado.');
  const client=await makeReadOnlySheetsClient({spreadsheetId,accessToken,fetcher});
  const [clientes,links]=await client.getRanges([
    "'INTERACOES'!E2:E","'INTERACOES'!W2:W"
  ]);
  const ids=indexed(clientes),refs=indexed(links);
  const linkedRows=[];
  const max=Math.max(ids.length,refs.length);
  for(let i=0;i<max;i++){
    if(ids[i]?.value!==boardClientId)continue;
    const match=refs[i]?.value.match(DEAL_LINK);
    if(match&&match[1].toLowerCase()===id)linkedRows.push(i+2);
  }
  if(linkedRows.length>200)
    throw new Error('Vinculos acima do limite seguro; revisar duplicidades.');
  const interactions=[];
  for(const group of chunks(linkedRows,80)){
    const ranges=group.map(n=>"'INTERACOES'!A"+n+":W"+n);
    const entries=await client.getRanges(ranges);
    entries.forEach((values,i)=>{
      const row=values[0]||[],link=asString(row[22]);
      const match=link.match(DEAL_LINK);
      if(asString(row[4])!==boardClientId||!match||match[1].toLowerCase()!==id)return;
      const tipo=classifyStatus(row[3]),fonte=classifyStatus(row[1]);
      const rawRole=classifyStatus(row[20]);
      const funcao=['SDR','CLOSER'].includes(rawRole)?rawRole:'NAO_COMPROVADO';
      const date=normalizeDate(row[8]);
      if(!date)return;
      interactions.push({
        id:asString(row[0]),dealId:id,clientKey,clientId:boardClientId,
        source:fonte,kind:tipo,at:date,
        durationSeconds:Math.max(0,Number(row[9])||0),
        taskId:asString(row[2]).replace(/^RD_TASK_/i,''),
        role:funcao,roleOrigin:funcao==='NAO_COMPROVADO'?'NAO_INFORMADA':'BOARD_FUNCAO',
        responsibleLabel:redact(row[19]||row[5]||'',90),
        hasRecording:Boolean(asString(row[11])),
        transcriptionStatus:classifyStatus(row[12]),auditStatus:classifyStatus(row[13])
      });
    });
  }
  const unique=new Map(),duplicateIds=new Set();
  for(const it of interactions){
    if(!it.id||unique.has(it.id)){duplicateIds.add(it.id||'SEM_ID');continue;}
    unique.set(it.id,it);
  }
  const clean=[...unique.values()];
  const linkedIds=new Set(clean.map(x=>x.id));
  const transcripts={count:0,complete:0,pending:0,duplicate:0};
  const audits={count:0,statuses:{}};
  if(clean.length){
    const [tIds,aIds]=await client.getRanges([
      "'TRANSCRICOES'!B2:B","'AUDITORIAS'!B2:B"
    ]);
    const matchingTr=indexed(tIds).filter(x=>linkedIds.has(x.value));
    const matchingAud=indexed(aIds).filter(x=>linkedIds.has(x.value));
    if(matchingTr.length>200||matchingAud.length>200)
      throw new Error('Numero de transcricoes ou auditorias acima do limite seguro.');
    const seenTr=new Set(), seenAu=new Set();
    for(const group of chunks(matchingTr,30)){
      const ranges=group.flatMap(x=>[
        "'TRANSCRICOES'!A"+x.row+":D"+x.row,
        "'TRANSCRICOES'!F"+x.row+":G"+x.row
      ]);
      const data=await client.getRanges(ranges);
      for(let i=0;i<group.length;i++){
        const left=data[i*2]?.[0]||[],right=data[i*2+1]?.[0]||[];
        const target=unique.get(asString(left[1]));
        if(!target)continue;
        if(seenTr.has(target.id)){target.transcriptionStatus='CONFLITO';transcripts.duplicate++;continue;}
        seenTr.add(target.id);
        const status=classifyStatus(right[1]);
        const count=Math.max(0,Number(right[0])||0);
        target.transcriptionStatus=status;
        target.hasTranscript=status==='CONCLUIDA'&&count>0;
        target.transcriptChars=count;
        transcripts.count++;
        if(target.hasTranscript)transcripts.complete++;
        if(status==='PENDENTE')transcripts.pending++;
      }
    }
    for(const group of chunks(matchingAud,30)){
      const ranges=group.flatMap(x=>[
        "'AUDITORIAS'!A"+x.row+":F"+x.row,
        "'AUDITORIAS'!K"+x.row+":K"+x.row
      ]);
      const data=await client.getRanges(ranges);
      for(let i=0;i<group.length;i++){
        const left=data[i*2]?.[0]||[],right=data[i*2+1]?.[0]||[];
        const it=unique.get(asString(left[1]));
        if(!it||asString(left[3])!==boardClientId)continue;
        const key=asString(left[0])||group[i].row;
        if(seenAu.has(key))continue;
        seenAu.add(key);
        const status=classifyStatus(right[0]);
        const auditType=classifyStatus(left[5]);
        it.audits=it.audits||[];
        it.audits.push({status,type:auditType});
        audits.count++;
        audits.statuses[status]=(audits.statuses[status]||0)+1;
      }
    }
    if(includeTranscriptExcerpts){
      const candidates=clean.filter(x=>x.hasTranscript).slice(0,4);
      const tRows=new Map(matchingTr.map(x=>[x.value,x.row]));
      for(const x of candidates){
        const row=tRows.get(x.id);
        if(!row)continue;
        const values=await client.getRanges(["'TRANSCRICOES'!E"+row+":E"+row]);
        x.transcriptExcerpt=redact(values[0]?.[0]?.[0]||'',4000);
        x.transcriptExcerptPartial=(x.transcriptChars||0)>x.transcriptExcerpt.length;
      }
    }
  }
  return {
    origin:'GOOGLE_SHEETS_READONLY',clientKey,dealId:id,complete:duplicateIds.size===0,
    calls:clean.filter(x=>x.kind==='LIGACAO').map(x=>({
      id:x.id,dealId:id,at:x.at,durationSeconds:x.durationSeconds,
      taskId:x.taskId,role:x.role,roleOrigin:x.roleOrigin,
      responsibleLabel:x.responsibleLabel,source:x.source,
      hasRecording:x.hasRecording,transcriptionStatus:x.transcriptionStatus,
      hasTranscript:Boolean(x.hasTranscript),transcriptExcerpt:x.transcriptExcerpt||'',
      transcriptExcerptPartial:Boolean(x.transcriptExcerptPartial),auditStatus:x.auditStatus,
      audits:x.audits||[]
    })),
    meetings:clean.filter(x=>x.kind==='REUNIAO'||x.kind==='MEETING').map(x=>({
      id:x.id,dealId:id,at:x.at,role:x.role,roleOrigin:x.roleOrigin,
      responsibleLabel:x.responsibleLabel,source:x.source,
      hasRecording:x.hasRecording,transcriptionStatus:x.transcriptionStatus,
      hasTranscript:Boolean(x.hasTranscript),transcriptExcerpt:x.transcriptExcerpt||'',
      transcriptExcerptPartial:Boolean(x.transcriptExcerptPartial),
      audits:x.audits||[]
    })),
    coverage:{
      interactions:{accessible:true,complete:duplicateIds.size===0,records:clean.length,
        duplicateIds:duplicateIds.size,matchMethod:'ID_CLIENTE + LINK_CRM'},
      transcripts:{metadataAccessible:true,contentEnabled:includeTranscriptExcerpts,
        records:transcripts.count,complete:transcripts.complete,pending:transcripts.pending,
        duplicate:transcripts.duplicate},
      audits:{metadataAccessible:true,records:audits.count,statuses:audits.statuses},
      requestCount:client.requests()
    }
  };
}
