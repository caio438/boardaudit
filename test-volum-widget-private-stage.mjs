import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {prepareWidgetPrivateStage} from './scripts/volum-widget-private-stage.mjs';

const base=fs.mkdtempSync(path.join(os.tmpdir(),'volum-widget-release-'));
const repo=path.join(base,'repo'),live=path.join(base,'live'),stage=path.join(base,'stage'),meta=path.join(base,'meta.json');
const widgetId='AKfycbVOLUMPRIVATE001';
const boardId='AKfycbz9guo1cK-9T5Hdy_RjHt5yn0JuRjY2b37IlqJ9xPdHC47mL_jbliR5TaTK94Hh3SUQEA';
const deployments='Found 3 deployments.\n- HEAD_ID @HEAD\n- '+boardId+' @427 - BoardAudit\n- '+widgetId+' @433 - VOLUM Intelligence privada\n';
try {
 fs.mkdirSync(repo);fs.mkdirSync(live);
 const board="function doGet(e){const parametros=e.parameter||{}; if(String(parametros.volum_widget||'')==='1')return viWidgetRenderizarWebApp_(e);return 'BOARD';}";
 fs.writeFileSync(path.join(live,'Code.js'),board);
 fs.writeFileSync(path.join(live,'Control.js'),"function atividadeDoBoard(){return 'inalterada';}");
 fs.writeFileSync(path.join(live,'VolumWidgetService.js'),"function widget(){return 'antiga';}");
 fs.writeFileSync(path.join(live,'VolumWidgetWebApp.js'),"function viWidgetRenderizarWebApp_(e){return e;}");
 fs.writeFileSync(path.join(live,'VolumWidgetPanel.html'),"ANTIGA");
 const manifest={runtimeVersion:'V8',oauthScopes:['https://www.googleapis.com/auth/userinfo.email'],
  webapp:{executeAs:'USER_DEPLOYING',access:'DOMAIN'}};
 fs.writeFileSync(path.join(live,'appsscript.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(repo,'.clasp.json'),JSON.stringify({scriptId:'TEST_BOARD',rootDir:'.'}));
 for(const name of ['VolumIntelligenceLead.gs','VolumWidgetService.gs','VolumWidgetWebApp.gs'])
   fs.writeFileSync(path.join(repo,name),"function test_"+name.replace(/[^a-z]/gi,'_')+"(){}");
 fs.writeFileSync(path.join(repo,'VolumWidgetPanel.html'),'V2');
 const res=prepareWidgetPrivateStage(repo,live,stage,deployments,meta);
 assert.equal(res.widgetVersion,'433');
 assert.equal(res.boardSourceUnchanged,true);
 assert.equal(fs.readFileSync(path.join(stage,'Code.gs'),'utf8'),board);
 assert.equal(fs.readFileSync(path.join(stage,'Control.gs'),'utf8'),"function atividadeDoBoard(){return 'inalterada';}");
 assert.equal(fs.readFileSync(path.join(stage,'VolumWidgetPanel.html'),'utf8'),'V2');
 assert.equal(JSON.parse(fs.readFileSync(path.join(stage,'appsscript.json'),'utf8')).webapp.executeAs,'USER_ACCESSING');
 assert.equal(JSON.parse(fs.readFileSync(meta,'utf8')).widgetId,widgetId);
 assert.throws(()=>prepareWidgetPrivateStage(repo,live,path.join(base,'invalid'),
    'Found 2 deployments.\n- '+boardId+' @427 - BoardAudit\n- '+widgetId+' @434 - Other\n',path.join(base,'meta2.json')),/nao identificada/);
 console.log('Release privado: fonte do board preservada, implantacao 433 unica e manifesto protegido');
}finally{fs.rmSync(base,{recursive:true,force:true});}
