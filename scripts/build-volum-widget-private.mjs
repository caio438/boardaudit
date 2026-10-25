/**
 * Empacota codigo do VOLUM Intelligence para um projeto Apps Script privado.
 * Nunca use como destino o projeto/deployment do BoardAudit.
 * Uso: node scripts/build-volum-widget-private.mjs /tmp/volum-private-build
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2] || path.join(root,'.volum-private-build'));
if(output===root || !output.includes('volum')) throw new Error('Saida dedicada a VOLUM obrigatoria');
fs.mkdirSync(output,{recursive:true});
const gs=fs.readdirSync(root).filter(name=>name.endsWith('.gs'));
for(const name of gs){
  let body=fs.readFileSync(path.join(root,name),'utf8');
  new Function(body);
  if(name==='Code.gs'){
    const matches=[...body.matchAll(/\bfunction\s+doGet\s*\(/g)];
    if(matches.length!==1) throw new Error('Esperada uma doGet do board');
    body=body.replace(/\bfunction\s+doGet\s*\(/,'function boardDoGet_(');
  }else if(/\bfunction\s+doGet\s*\(/.test(body)) throw new Error('doGet inesperada em '+name);
  fs.writeFileSync(path.join(output,name),body);
}
const bridge=fs.readFileSync(path.join(root,'VolumWidgetWebApp.gs'),'utf8');
if(!bridge.includes('function viWidgetRenderizarWebApp_(')) throw new Error('Handler privado ausente');
fs.writeFileSync(path.join(output,'WidgetEntrypoint.gs'),
 '/** Entrada HTTP exclusiva da widget. */\nfunction doGet(e){return viWidgetRenderizarWebApp_(e);}\n');
fs.copyFileSync(path.join(root,'VolumWidgetPanel.html'),path.join(output,'VolumWidgetPanel.html'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'appsscript.json'),'utf8'));
manifest.webapp={executeAs:'USER_ACCESSING',access:'DOMAIN'};
manifest.executionApi={access:'MYSELF'};
manifest.oauthScopes=[
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/userinfo.email'
];
fs.writeFileSync(path.join(output,'appsscript.json'),JSON.stringify(manifest,null,2)+'\n');
const outputs=fs.readdirSync(output).filter(name=>name.endsWith('.gs'));
let doGets=0;
for(const name of outputs){
  const content=fs.readFileSync(path.join(output,name),'utf8');
  new Function(content);
  doGets += [...content.matchAll(/\bfunction\s+doGet\s*\(/g)].length;
}
if(doGets!==1) throw new Error('Bundle deve ter uma unica doGet');
if(fs.existsSync(path.join(output,'.clasp.json')))throw new Error('Nao incluir .clasp.json do board');
console.log(JSON.stringify({ok:true,gs:outputs.length,doGets,output,
  privateEntry:'WidgetEntrypoint.gs',boardRouteDisabled:true}));
