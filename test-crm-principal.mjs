import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cliente = { ID_CLIENTE: 'CLI-1', CRM_PRINCIPAL: 'PIPEDRIVE' };
const interacaoAntiga = {
  ID_INTERACAO: 'INT-OLD', ID_CLIENTE: 'CLI-1', CRM_PROVIDER: 'RD_STATION',
  CRM_RECORD_ID: '0123456789abcdef01234567', LINK_CRM: 'https://crm.rdstation.com/app/deals/0123456789abcdef01234567'
};
const auditorias = [
  { ID_AUDITORIA: 'AUD-OLD', ID_INTERACAO: 'INT-OLD', ID_CLIENTE: 'CLI-1', CRM_PROVIDER: '' },
  { ID_AUDITORIA: 'AUD-SNAPSHOT', ID_INTERACAO: 'INT-OLD', ID_CLIENTE: 'CLI-1', CRM_PROVIDER: 'LEADS2B' }
];
const atualizacoes = [];
const integracoes = [
  { ID_CLIENTE: 'CLI-1', TIPO_INTEGRACAO: 'RD_STATION', ATIVO: 'SIM', CONFIG_JSON: '{}' },
  { ID_CLIENTE: 'CLI-1', TIPO_INTEGRACAO: 'PIPEDRIVE', ATIVO: 'SIM', CONFIG_JSON: '{"recordUrlTemplate":"https://acme.pipedrive.com/deal/{id}"}' }
];

const contexto = vm.createContext({
  console,
  APP: { sheets: { clientes: 'CLIENTES', integracoesClientes: 'INTEGRACOES_CLIENTES', interacoes: 'INTERACOES', auditorias: 'AUDITORIAS' } },
  localizarObjeto_(aba, chave, valor) {
    if (aba === 'CLIENTES' && String(valor) === 'CLI-1') return cliente;
    return null;
  },
  lerObjetos_(aba) {
    if (aba === 'CLIENTES') return [cliente];
    if (aba === 'INTEGRACOES_CLIENTES') return integracoes;
    if (aba === 'INTERACOES') return [interacaoAntiga];
    if (aba === 'AUDITORIAS') return auditorias;
    return [];
  },
  obterIntegracaoCliente_(id, provider) {
    return integracoes.find(item => item.ID_CLIENTE === id && item.TIPO_INTEGRACAO === provider) || null;
  },
  audV3Atualizar_(aba, chave, id, patch) { atualizacoes.push({ aba, id, patch }); },
  audV3GarantirColunas_() {},
  audV3Planilha_() { return {}; }
});

vm.runInContext(fs.readFileSync(new URL('./CrmAuditorias.gs', import.meta.url), 'utf8'), contexto, { filename: 'CrmAuditorias.gs' });

const principal = vm.runInContext('audCrmProviderPrincipalCliente_', contexto);
const resolver = vm.runInContext('audCrmResolverProvider_', contexto);
const vinculo = vm.runInContext('audCrmVinculoEntrada_', contexto);
const congelar = vm.runInContext('audCrmCongelarHistoricoCliente_', contexto);

assert.equal(principal('CLI-1'), 'PIPEDRIVE');
assert.equal(resolver({}, { ID_CLIENTE: 'CLI-1' }), 'PIPEDRIVE', 'Nova auditoria deve herdar o CRM principal.');
assert.equal(
  resolver({ CRM_PROVIDER: 'PIPEDRIVE', ID_CLIENTE: 'CLI-1' }, { CRM_PROVIDER: 'RD_STATION', ID_CLIENTE: 'CLI-1' }),
  'RD_STATION',
  'O snapshot da auditoria deve prevalecer sobre a interacao e a configuracao atual.'
);

const novoVinculo = vinculo({ crmRecordId: '321' }, 'CLI-1');
assert.equal(novoVinculo.provider, 'PIPEDRIVE');
assert.equal(novoVinculo.recordId, '321');
assert.equal(novoVinculo.link, 'https://acme.pipedrive.com/deal/321');

assert.equal(congelar('CLI-1'), 1);
assert.deepEqual(JSON.parse(JSON.stringify(atualizacoes[0])), {
  aba: 'AUDITORIAS', id: 'AUD-OLD', patch: { CRM_PROVIDER: 'RD_STATION' }
});

const auditoriaSource = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const crmSource = fs.readFileSync(new URL('./CrmAuditorias.gs', import.meta.url), 'utf8');
const codeSource = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const htmlSource = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');

assert.match(auditoriaSource, /CRM_PROVIDER:\s*crmProviderSnapshot/);
assert.match(codeSource, /'CRM_PRINCIPAL'/);
assert.match(htmlSource, /id="areaPerfilCrmPrincipal"/);
assert.doesNotMatch(htmlSource, /CRM desta auditoria/i);
assert.doesNotMatch(htmlSource, /manualRdDealId/);
assert.doesNotMatch(crmSource, /dados\.crmProvider\s*\|\|\s*audCrmResolverProvider_/);

console.log('CRM principal validado: heranca, snapshot historico e troca segura por cliente.');
