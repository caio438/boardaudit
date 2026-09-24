import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let integracoes = [];

const contexto = vm.createContext({
  console,
  APP: { sheets: { integracoesClientes: 'INTEGRACOES_CLIENTES' } },
  lerObjetos_() { return integracoes; }
});

vm.runInContext(
  fs.readFileSync(new URL('CrmAuditorias.gs', import.meta.url), 'utf8'),
  contexto,
  { filename: 'CrmAuditorias.gs' }
);

const resolver = vm.runInContext('audCrmResolverProvider_', contexto);
const capacidades = vm.runInContext('audCrmCapacidadesProvider_', contexto);

integracoes = [
  { ID_CLIENTE: 'CLI-1', TIPO_INTEGRACAO: 'RD_STATION', ATIVO: 'SIM' }
];
assert.equal(resolver({ ID_CLIENTE: 'CLI-1' }, {}), 'RD_STATION');

integracoes = [
  { ID_CLIENTE: 'CLI-1', TIPO_INTEGRACAO: 'PIPEDRIVE', ATIVO: 'SIM' }
];
assert.equal(resolver({ ID_CLIENTE: 'CLI-1' }, {}), 'PIPEDRIVE');

integracoes = [
  { ID_CLIENTE: 'CLI-1', TIPO_INTEGRACAO: 'RD_STATION', ATIVO: 'SIM' },
  { ID_CLIENTE: 'CLI-1', TIPO_INTEGRACAO: 'PIPEDRIVE', ATIVO: 'SIM' }
];
assert.equal(
  resolver({ ID_CLIENTE: 'CLI-1', CRM_PROVIDER: 'PIPEDRIVE' }, {}),
  'PIPEDRIVE',
  'Provider explícito deve vencer qualquer fallback.'
);
assert.equal(
  resolver({ ID_CLIENTE: 'CLI-1', LINK_CRM: 'https://acme.pipedrive.com/deal/321' }, {}),
  'PIPEDRIVE',
  'Link do CRM deve identificar o provider.'
);
assert.equal(
  resolver({ ID_CLIENTE: 'CLI-1', FONTE: 'MANUAL' }, {}),
  '',
  'Com múltiplos CRMs ativos, o Board não pode escolher um provider por preferência.'
);
assert.equal(
  resolver({ ID_CLIENTE: 'CLI-1', FONTE: 'API4COM' }, {}),
  'RD_STATION',
  'Fluxo legado API4COM continua identificado como RD.'
);
assert.equal(
  resolver({ ID_CLIENTE: 'CLI-1', ID_EXTERNO: 'RD_TASK_999' }, {}),
  'RD_STATION',
  'Interações legadas RD_TASK continuam identificadas como RD.'
);

const pipe = capacidades('PIPEDRIVE');
assert.equal(pipe.testarConexao, true);
assert.equal(pipe.lerRegistro, true);
assert.equal(pipe.lerAtividades, true);
assert.equal(pipe.lerNotas, true);
assert.equal(pipe.publicarAuditoria, true);

const leads2b = capacidades('LEADS2B');
assert.equal(leads2b.testarConexao, false);
assert.equal(leads2b.publicarAuditoria, false);
assert.match(leads2b.motivo, /API publica V2/i);

console.log('Resolver multi-CRM validado: ambiguidade segura, legado RD preservado e capacidades explícitas.');
