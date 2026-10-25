import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const BOARD_DEPLOYMENT_ID='AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA';
const LEGACY_WIDGET_VERSION='433';
const OVERLAY=[
  'VolumIntelligenceLead.gs',
  'VolumWidgetService.gs',
  'VolumWidgetWebApp.gs',
  'VolumWidgetPanel.html'
];

export function prepareWidgetPrivateStage(repoDir,liveDir,stageDir,deploymentsText,metaFile) {
  const matches=String(deploymentsText).split(/\r?\n/)
    .map(line=>line.match(/^\s*-\s+(\S+)\s+@(\S+)(?:\s+-\s+(.*))?\s*$/))
    .filter(Boolean).map(m=>({id:m[1],version:m[2],description:m[3]||''}));
  const board=matches.find(x=>x.id===BOARD_DEPLOYMENT_ID);
  if(!board || !/^\d+$/.test(board.version))throw new Error('Implantacao do board nao confirmada');
  const other=matches.filter(x=>x.id!==BOARD_DEPLOYMENT_ID && x.version!=='HEAD');
  // Em publicacoes posteriores a V2 deixa de estar na versao 433.
  // Identificar pelo marcador unico do deployment atual e usar 433 apenas como fallback legado.
  const atuais=other.filter(x=>/^VOLUM Intelligence Sales Ops V[23](?:\s|$)/i.test(x.description.trim()));
  const legados=other.filter(x=>x.version===LEGACY_WIDGET_VERSION && /VOLUM|INTELLIGENCE|WIDGET/i.test(x.description));
  const widget=atuais.length===1?atuais[0]:(atuais.length===0&&legados.length===1?legados[0]:null);
  if(!widget)throw new Error('Implantacao VOLUM privada nao identificada univocamente');
  if(widget.id===board.id)throw new Error('Tentativa de atualizar implantacao do board');
  fs.mkdirSync(stageDir,{recursive:true});
  const sourceFiles=fs.readdirSync(liveDir);
  const entries=sourceFiles.filter(n=>n.endsWith('.js')||n.endsWith('.html')||n==='appsscript.json');
  if(!entries.includes('appsscript.json'))throw new Error('Manifesto remoto ausente');
  const codeNames=entries.filter(n=>n==='Code.js'||n==='Código.js');
  if(codeNames.length!==1)throw new Error('Arquivo Code.js nao identificado de forma segura');
  for(const n of entries){
    const target=n.endsWith('.js')?(n==='Código.js'?'Code.gs':n.replace(/\.js$/,'.gs')):n;
    fs.copyFileSync(path.join(liveDir,n),path.join(stageDir,target));
  }
  const originalCode=fs.readFileSync(path.join(stageDir,'Code.gs'),'utf8');
  const entry=originalCode.match(/\bfunction\s+doGet\s*\(\s*e\s*\)\s*\{/);
  if(!entry || !originalCode.includes('volum_widget')) {
    throw new Error('Entrada doGet e rota VOLUM nao identificadas no projeto ativo');
  }
  const pos=entry.index;
  const already=originalCode.slice(pos,pos+1600);
  let code=originalCode;
  let routePatched=false;
  if(!(already.includes('volum_widget') && already.includes('viWidgetRenderizarWebApp_'))) {
    // A versao viva pode ter o desvio VOLUM mais abaixo ou para o antigo handler.
    // Adiciona APENAS um retorno antecipado para o parametro da widget.
    // Sem volum_widget=1, o restante de doGet permanece byte-a-byte igual.
    const early="function doGet(e) {\n  if (e && e.parameter && String(e.parameter.volum_widget || '') === '1') {\n    return viWidgetRenderizarWebApp_(e);\n  }";
    code=originalCode.slice(0,pos)+early+originalCode.slice(pos+entry[0].length);
    fs.writeFileSync(path.join(stageDir,'Code.gs'),code);
    routePatched=true;
  }
  for(const n of OVERLAY){
    const source=path.join(repoDir,n);
    if(!fs.existsSync(source))throw new Error('Artefato VOLUM nao encontrado: '+n);
    fs.copyFileSync(source,path.join(stageDir,n));
  }
  const manifestPath=path.join(stageDir,'appsscript.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const originalConfig=manifest.webapp||{};
  if(originalConfig.access!=='DOMAIN')throw new Error('Acesso webapp remoto inesperado; nao publicar');
  const scopes=manifest.oauthScopes||[];
  if(!scopes.includes('https://www.googleapis.com/auth/userinfo.email')) {
    throw new Error('Escopo de identidade ausente no projeto remoto');
  }
  // Apenas a nova versao da widget executa como o usuario autenticado.
  // A implantacao BoardAudit antiga fica fixada em seu numero de versao.
  manifest.webapp={executeAs:'USER_ACCESSING',access:'DOMAIN'};
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  const gs=fs.readdirSync(stageDir).filter(n=>n.endsWith('.gs'));
  let getCount=0;
  for(const n of gs){
    const source=fs.readFileSync(path.join(stageDir,n),'utf8');
    new Function(source);
    getCount += [...source.matchAll(/\bfunction\s+doGet\s*\(/g)].length;
  }
  if(getCount!==1)throw new Error('Implantacao VOLUM deve ter somente uma doGet');
  const mainAfter=fs.readFileSync(path.join(stageDir,'Code.gs'),'utf8');
  if(mainAfter!==code)throw new Error('O Codigo do board mudou alem da rota esperada');
  if(routePatched && !mainAfter.endsWith(originalCode.slice(pos+entry[0].length))) {
    throw new Error('Codigo original do board nao foi integralmente preservado');
  }
  const claspPath=path.join(repoDir,'.clasp.json');
  const clasp=JSON.parse(fs.readFileSync(claspPath,'utf8'));
  if(!clasp.scriptId)throw new Error('scriptId do BoardAudit ausente');
  fs.writeFileSync(path.join(stageDir,'.clasp.json'),JSON.stringify({scriptId:clasp.scriptId,rootDir:'.'})+'\n',{mode:0o600});
  const meta={widgetId:widget.id,widgetOldVersion:widget.version,
    boardOldVersion:board.version,boardId:board.id,projectScriptId:clasp.scriptId};
  fs.writeFileSync(metaFile,JSON.stringify(meta),{mode:0o600});
  return {ok:true,files:entries.length,gs:gs.length,widgetVersion:widget.version,
    boardVersion:board.version,boardSourceUnchanged:!routePatched,
    boardRouteOnlyPatch:routePatched,
    manifestBefore:originalConfig.executeAs||'UNKNOWN',manifestAfter:'USER_ACCESSING'};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [repoDir,liveDir,stageDir,deploymentsFile,metaFile]=process.argv.slice(2);
  if(!repoDir||!liveDir||!stageDir||!deploymentsFile||!metaFile)throw new Error('5 parametros obrigatorios');
  const result=prepareWidgetPrivateStage(repoDir,liveDir,stageDir,
    fs.readFileSync(deploymentsFile,'utf8'),metaFile);
  console.log(JSON.stringify(result));
}
