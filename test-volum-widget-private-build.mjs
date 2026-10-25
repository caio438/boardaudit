import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'volum-private-build-'));
try{
 const cmd=new URL('./scripts/build-volum-widget-private.mjs',import.meta.url).pathname;
 const run=spawnSync(process.execPath,[cmd,dir],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'appsscript.json'),'utf8'));
 assert.equal(manifest.webapp.executeAs,'USER_ACCESSING');
 assert.equal(manifest.webapp.access,'DOMAIN');
 assert.ok(!fs.existsSync(path.join(dir,'.clasp.json')));
 const board=fs.readFileSync(path.join(dir,'Code.gs'),'utf8');
 assert.doesNotMatch(board,/\bfunction\s+doGet\s*\(/);
 assert.match(board,/function boardDoGet_\(/);
 const entry=fs.readFileSync(path.join(dir,'WidgetEntrypoint.gs'),'utf8');
 assert.match(entry,/function doGet\(e\)/);
 assert.match(entry,/viWidgetRenderizarWebApp_\(e\)/);
 for(const name of ['VolumWidgetService.gs','VolumIntelligenceLead.gs','VolumWidgetPanel.html'])
   assert.ok(fs.existsSync(path.join(dir,name)),name+' ausente');
 const filenames=fs.readdirSync(dir).filter(x=>x.endsWith('.gs'));
 assert.equal(filenames.reduce((acc,f)=>acc+(fs.readFileSync(path.join(dir,f),'utf8').match(/\bfunction\s+doGet\s*\(/g)||[]).length,0),1);
 console.log('Private Widget build: entrada unica e board isolado.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
