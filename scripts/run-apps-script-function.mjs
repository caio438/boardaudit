import fs from 'node:fs';

function fail(message, details) {
  const suffix = details ? ' | ' + details : '';
  throw new Error(message + suffix);
}

export function loadStoredCredential(raw) {
  const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (j?.tokens?.default) return j.tokens.default;
  if (j?.token && j?.oauth2ClientSettings) {
    return {
      ...j.token,
      client_id: j.oauth2ClientSettings.clientId,
      client_secret: j.oauth2ClientSettings.clientSecret
    };
  }
  if (j?.access_token || j?.refresh_token) {
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      client_id: j.client_id,
      client_secret: j.client_secret
    };
  }
  fail('AUTH_FORMAT_UNSUPPORTED');
}

export async function refreshAccessToken(credential, fetchImpl = fetch) {
  const refreshToken = credential?.refresh_token;
  const clientId = credential?.client_id;
  const clientSecret = credential?.client_secret;

  if (!refreshToken) {
    if (credential?.access_token) return credential.access_token;
    fail('AUTH_REFRESH_TOKEN_MISSING');
  }
  if (!clientId || !clientSecret) fail('AUTH_OAUTH_CLIENT_MISSING');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body
  });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}

  if (!response.ok || !json.access_token) {
    const code = json.error || response.status;
    const description = json.error_description || 'OAuth token refresh failed';
    fail('AUTH_REFRESH_FAILED', String(code) + ': ' + description);
  }
  return json.access_token;
}

export function validateExecutionResponse(httpStatus, payload, expectedSuccessField = '') {
  if (httpStatus < 200 || httpStatus >= 300) {
    const status = payload?.error?.status || payload?.error?.code || httpStatus;
    const message = payload?.error?.message || 'Apps Script API request failed';
    if (httpStatus === 401) fail('EXECUTION_AUTHENTICATION_FAILED', String(status) + ': ' + message);
    if (httpStatus === 403) {
      fail(
        'EXECUTION_PERMISSION_DENIED',
        String(status) + ': ' + message +
        '. Confirm that the OAuth client and Apps Script project use the same standard Google Cloud project and that Apps Script API is enabled.'
      );
    }
    fail('EXECUTION_HTTP_FAILED', String(status) + ': ' + message);
  }

  if (payload?.error) {
    const detail = payload.error?.details?.[0];
    fail('EXECUTION_SCRIPT_FAILED', detail?.errorMessage || payload.error.message || 'Script execution failed');
  }

  if (!payload || !payload.response || !Object.prototype.hasOwnProperty.call(payload.response, 'result')) {
    fail('EXECUTION_RESULT_MISSING');
  }

  const result = payload.response.result;
  if (expectedSuccessField) {
    const value = result && typeof result === 'object' ? result[expectedSuccessField] : undefined;
    if (value !== true) fail('EXECUTION_SUCCESS_MARKER_MISSING', expectedSuccessField + '=true');
  }
  return result;
}

export async function runAppsScript({
  scriptId,
  functionName,
  parameters = [],
  devMode = true,
  accessToken,
  expectedSuccessField = '',
  fetchImpl = fetch
}) {
  if (!scriptId) fail('SCRIPT_ID_MISSING');
  if (!functionName) fail('FUNCTION_NAME_MISSING');
  if (!accessToken) fail('ACCESS_TOKEN_MISSING');

  const response = await fetchImpl(
    'https://script.googleapis.com/v1/scripts/' + encodeURIComponent(scriptId) + ':run',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + accessToken,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        function: functionName,
        parameters,
        devMode: Boolean(devMode)
      })
    }
  );

  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch {
    fail('EXECUTION_RESPONSE_NOT_JSON', 'HTTP ' + response.status);
  }
  return validateExecutionResponse(response.status, payload, expectedSuccessField);
}

async function main() {
  const args = process.argv.slice(2);
  const get = flag => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : '';
  };

  const authFile = get('--auth') || process.env.HOME + '/.clasprc.json';
  const scriptId = get('--script-id') || process.env.APPS_SCRIPT_ID;
  const functionName = get('--function');
  const expectedSuccessField = get('--expect-true');
  const paramsRaw = get('--params') || '[]';
  const devMode = !args.includes('--no-dev-mode');

  let parameters;
  try { parameters = JSON.parse(paramsRaw); } catch { fail('PARAMS_INVALID_JSON'); }
  if (!Array.isArray(parameters)) fail('PARAMS_MUST_BE_ARRAY');

  const credential = loadStoredCredential(fs.readFileSync(authFile, 'utf8'));
  const accessToken = await refreshAccessToken(credential);
  const result = await runAppsScript({
    scriptId,
    functionName,
    parameters,
    devMode,
    accessToken,
    expectedSuccessField
  });

  const summary = {
    sucesso: true,
    function: functionName,
    verifiedResult: true
  };
  if (result && typeof result === 'object') {
    for (const key of ['sucesso', 'status', 'validacaoStatus', 'automacaoStatus', 'rdStatus', 'score']) {
      if (Object.prototype.hasOwnProperty.call(result, key)) summary[key] = result[key];
    }
  }
  process.stdout.write(JSON.stringify(summary) + '\n');
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    process.stderr.write(String(error?.message || error) + '\n');
    process.exit(1);
  });
}
