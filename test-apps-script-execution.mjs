import assert from 'node:assert/strict';
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

console.log('Verified Apps Script execution parser validated.');
