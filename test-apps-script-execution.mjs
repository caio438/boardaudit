import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  loadStoredCredential,
  validateExecutionContract,
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

const contractSuccess = {
  sucesso: true,
  requestId: 'REQ-20260921120000-ABCDEF12',
  codigo: 'EXECUTION_API_PROBE_OK',
  etapa: 'PROBE_READ_ONLY',
  versao: '4.25.7',
  timestamp: '2026-09-21T12:00:00.000Z',
  resultado: {modo:'READ_ONLY'},
  erro: null
};

assert.deepEqual(validateExecutionContract(contractSuccess), contractSuccess);

assert.throws(
  () => validateExecutionContract({...contractSuccess, requestId:''}),
  /EXECUTION_CONTRACT_INVALID.*requestId/
);

assert.throws(
  () => validateExecutionContract({...contractSuccess, erro:{mensagem:'x',retryable:false}}),
  /EXECUTION_CONTRACT_INVALID.*erro must be null/
);

assert.deepEqual(
  validateExecutionContract({
    sucesso:false,
    requestId:'REQ-1',
    codigo:'RD_PUBLICATION_FAILED',
    etapa:'PUBLICACAO_RD',
    versao:'4.25.7',
    timestamp:'2026-09-21T12:00:00.000Z',
    resultado:null,
    erro:{mensagem:'falha',retryable:true}
  }).erro,
  {mensagem:'falha',retryable:true}
);


const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('./.github/workflows/qa-hitecnet-force-verified.yml', import.meta.url), 'utf8');
const contractHelper = code.match(/function\s+criarRespostaExecucao_\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
const probe = code.match(/function\s+QA_EXECUTION_API_READ_ONLY_PROBE\s*\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';

assert.match(contractHelper, /requestId:/);
assert.match(contractHelper, /codigo:/);
assert.match(contractHelper, /etapa:/);
assert.match(contractHelper, /versao:/);
assert.match(contractHelper, /timestamp:/);
assert.match(contractHelper, /resultado:/);
assert.match(contractHelper, /erro:/);
assert.match(probe, /sucesso:\s*true/);
assert.match(probe, /EXECUTION_API_PROBE_OK/);
assert.match(probe, /PROBE_READ_ONLY/);
assert.doesNotMatch(probe, /SpreadsheetApp|DriveApp|DocumentApp|UrlFetchApp|PropertiesService|Gemini|RD|auditoria|tarefa/i);
assert.match(workflow, /--function QA_EXECUTION_API_READ_ONLY_PROBE/);
assert.match(workflow, /--require-contract/);
assert.doesNotMatch(workflow, /QA_HITECNET_STEC_FORCAR_AUDITORIA/);
assert.doesNotMatch(workflow, /^\s*push:/m);

console.log('Verified Apps Script execution parser validated.');
