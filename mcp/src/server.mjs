#!/usr/bin/env node
/**
 * MCP stdio, local e privado. Nenhum endpoint publico ou mutacao no CRM.
 * O processo e iniciado por host MCP autorizado com credenciais no ambiente.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import fs from 'node:fs/promises';
import {readRdHistory,buildHistory,auditSalesOps,validateDealId} from './core.mjs';

const token=process.env.VOLUM_RD_TOKEN||'';
const allowedClient=process.env.VOLUM_MCP_CLIENT_KEY||'';
if(!token||!allowedClient){
  process.stderr.write('VOLUM MCP nao iniciado: configure VOLUM_RD_TOKEN e VOLUM_MCP_CLIENT_KEY.\n');
  process.exit(1);
}
const roleMap=(()=>{
  if(!process.env.VOLUM_MCP_ROLES_JSON)return {};
  try{
    const value=JSON.parse(process.env.VOLUM_MCP_ROLES_JSON);
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid');
    return Object.fromEntries(Object.entries(value).filter(([k,v])=>
      /^[a-zA-Z0-9_-]{1,90}$/.test(k)&&['SDR','CLOSER'].includes(String(v).toUpperCase()))
      .map(([k,v])=>[k,String(v).toUpperCase()]));
  }catch{throw new Error('VOLUM_MCP_ROLES_JSON invalido.');}
})();
let snapshot=null;
if(process.env.VOLUM_BOARD_SNAPSHOT_FILE){
  try{
    const file=await fs.readFile(process.env.VOLUM_BOARD_SNAPSHOT_FILE,'utf8');
    snapshot=JSON.parse(file);
    if(!snapshot||snapshot.clientKey!==allowedClient||!Array.isArray(snapshot.calls))
      throw new Error('formato');
  }catch{throw new Error('Snapshot local do board invalido ou fora do cliente autorizado.');}
}

const cache=new Map(),CACHE_TTL_MS=60000;
async function history(clientKey,dealId){
  if(clientKey!==allowedClient)throw new Error('Cliente sem autorizacao neste servidor privado.');
  const id=validateDealId(dealId);
  const key=clientKey+'|'+id;
  const existing=cache.get(key);
  if(existing && existing.expires>Date.now())return existing.promise;
  const promise=(async()=>{
    const raw=await readRdHistory({dealId:id,token});
    return buildHistory(raw,{dealId:id,clientKey,roleMap,boardSnapshot:snapshot});
  })();
  cache.set(key,{expires:Date.now()+CACHE_TTL_MS,promise});
  try{return await promise;}catch(e){cache.delete(key);throw e;}
}
function result(value){return {content:[{type:'text',text:JSON.stringify(value)}]};}
function safeError(error){
  const message=String(error?.message||'Falha de consulta');
  // Nao retornar excecoes completas que possam conter query strings com tokens.
  const safe=/^(?:RD nao confirmou|ID de negociacao|Cliente sem autorizacao|Falha RD HTTP \d{3}|Fonte RD indisponivel|Limite seguro|Consulta RD excedeu|RD respondeu|Operacao de leitura|Filtro RD|Credencial RD)/.test(message);
  return {isError:true,content:[{type:'text',text:safe?message:'Nao foi possivel concluir a leitura privada.'}]};
}
async function invoke(callback){
  try{return result(await callback());}catch(e){return safeError(e);}
}
const dealId=z.string().regex(/^[a-f0-9]{24}$/i);
const clientKey=z.string().min(1).max(100);
const base=z.object({clientKey,dealId});

serveStdio(()=>{
  const server=new McpServer({name:'volum-salesops-readonly',version:'0.1.0'});
  server.registerTool('get_lead_history',{
    description:'Ler linha do tempo por negociacao RD, com evidencias, autoria quando comprovada e cobertura das fontes. Nunca escreve no RD.',
    inputSchema:base.extend({
      offset:z.number().int().min(0).max(10000).default(0),
      limit:z.number().int().min(1).max(100).default(40)
    })
  },async({clientKey,dealId,offset,limit})=>invoke(async()=>{
    const h=await history(clientKey,dealId);
    return {mode:h.mode,clientKey:h.clientKey,dealId:h.dealId,generatedAt:h.generatedAt,
      deal:h.deal,coverage:h.coverage,warnings:h.warnings,
      pagination:{offset,limit,total:h.events.length,
        nextOffset:offset+limit<h.events.length?offset+limit:null},
      events:h.events.slice(offset,offset+limit).map(e=>({
        ...e,evidenceId:e.source+'/'+e.kind+'/'+e.id,
        text:e.text?e.text.slice(0,500):''}))};
  }));
  server.registerTool('get_lead_evidence',{
    description:'Ler evidencia individual pelo evidenceId de get_lead_history; nao inventar dialogo, papel ou resultado de contato.',
    inputSchema:base.extend({evidenceId:z.string().min(1).max(250)})
  },async({clientKey,dealId,evidenceId})=>invoke(async()=>{
    const h=await history(clientKey,dealId);
    const match=h.events.find(e=>(e.source+'/'+e.kind+'/'+e.id)===evidenceId);
    if(!match)throw new Error('Evidencia nao encontrada nesta negociacao.');
    return {mode:'READ_ONLY',dealId:h.dealId,evidenceId,record:match,
      interpretation:'Evento registrado nao comprova conversa, qualidade de pitch nem cumprimento de SLA.'};
  }));
  server.registerTool('audit_sales_ops',{
    description:'Gerar prioridades comerciais por evidencias para lead SDR ou closer, sem score de compliance inventado.',
    inputSchema:base
  },async({clientKey,dealId})=>invoke(async()=>{
    const h=await history(clientKey,dealId);
    return auditSalesOps(h);
  }));
  server.registerTool('get_source_coverage',{
    description:'Conferir fontes, volumes, paginacao e limites da auditoria; ausencia de dado nao comprova falha operacional.',
    inputSchema:base
  },async({clientKey,dealId})=>invoke(async()=>{
    const h=await history(clientKey,dealId);
    return {mode:h.mode,clientKey:h.clientKey,dealId:h.dealId,
      eventCount:h.events.length,coverage:h.coverage,warnings:h.warnings,
      missingRoles:h.events.filter(e=>e.role==='NAO_COMPROVADO').length};
  }));
  return server;
});
