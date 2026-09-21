import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  loadStoredCredential,
  validateExecutionResponse
} from './scripts/run-apps-script-function.mjs';

assert.equal(
  loadStoredCredential({tokens:{default:{access_token:'a',refresh_token:'r',client_id:'c',client_secret:'s'}}}).refresh_token,
  'r'
);

assert.equal(
  loadStoredCredential({
    token:{access_token:'a',refresh_token:'r'},
    oauth2ClientSettings:{clientId:'c',clientSecret:'s'}
  }).client_id,
  'c'
);

assert.deepEqual(
  validateExecutionResponse(200,{response:{result:{sucesso:true,score:4.3}}},'sucesso'),
  {sucesso:true,score:4.3}
);

assert.throws(
  () => validateExecutionResponse(200,{response:{}},'sucesso'),
  /EXECUTION_RESULT_MISSING/
);

assert.throws(
  () => validateExecutionResponse(200,{error:{message:'ScriptError',details:[{errorMessage:'boom'}]}}),
  /EXECUTION_SCRIPT_FAILED.*boom/
);

assert.throws(
  () => validateExecutionResponse(401,{error:{status:'UNAUTHENTICATED',message:'bad token'}}),
  /EXECUTION_AUTHENTICATION_FAILED/
);

assert.throws(
  () => validateExecutionResponse(403,{error:{status:'PERMISSION_DENIED',message:'caller'}}),
  /EXECUTION_PERMISSION_DENIED/
);

assert.throws(
  () => validateExecutionResponse(200,{response:{result:{sucesso:false}}},'sucesso'),
  /EXECUTION_SUCCESS_MARKER_MISSING/
);

const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('./.github/workflows/qa-hitecnet-force-verified.yml', import.meta.url), 'utf8');
const probe = code.match(/function\s+QA_EXECUTION_API_READ_ONLY_PROBE\s*\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';

assert.match(probe, /sucesso:\s*true/);
assert.match(probe, /versao:/);
assert.match(probe, /timestamp:/);
assert.doesNotMatch(probe, /SpreadsheetApp|DriveApp|DocumentApp|UrlFetchApp|PropertiesService|Gemini|RD|auditoria|tarefa/i);
assert.match(workflow, /--function QA_EXECUTION_API_READ_ONLY_PROBE/);
assert.doesNotMatch(workflow, /QA_HITECNET_STEC_FORCAR_AUDITORIA/);
assert.doesNotMatch(workflow, /^\s*push:/m);

console.log('Verified Apps Script execution parser validated.');
