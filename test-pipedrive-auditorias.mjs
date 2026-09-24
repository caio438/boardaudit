import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const chamadas = [];
const atualizacoes = [];
let notasRemotas = [];
let noteSequence = 900;

const auditoria = {
  ID_AUDITORIA: 'AUD-PIPE-1', ID_INTERACAO: 'INT-1', ID_CLIENTE: 'CLI-1',
  ID_PITCH: 'P-1', ID_MODELO: 'M-1', TIPO_AUDITORIA: 'SDR',
  STATUS: 'APROVADA', VALIDACAO_STATUS: 'VALIDADA', HASH_FONTE: 'HASH-OK',
  RESULTADO_JSON: '{"ok":true}', CRITERIOS_SNAPSHOT_JSON: '{}'
};
const interacao = {
  ID_INTERACAO: 'INT-1', CRM_PROVIDER: 'PIPEDRIVE', CRM_RECORD_ID: '321',
  TITULO: 'Negócio de teste', COLABORADOR: 'Ana'
};
const integracao = {
  ID_INTEGRACAO: 'IT-1', ID_CLIENTE: 'CLI-1', TIPO_INTEGRACAO: 'PIPEDRIVE',
  ATIVO: 'SIM', CONFIG_JSON: '{"companyDomain":"acme"}'
};

const contexto = vm.createContext({
  console,
  isFinite,
  APP: { sheets: {} },
  LockService: {
    getScriptLock() {
      return { waitLock() {}, releaseLock() {} };
    }
  },
  requisicaoJson_(url, opcoes = {}) {
    chamadas.push({ url, opcoes });
    if (url.includes('/v1/users/me')) {
      return { success: true, data: { id: 7, name: 'Usuário API', company_domain: 'acme' } };
    }
    if (url.includes('/v2/deals/321')) {
      return { success: true, data: { id: 321, title: 'Negócio de teste' } };
    }
    if (url.includes('/v2/activities')) {
      return { success: true, data: [{ id: 11, deal_id: 321 }] };
    }
    if (url.includes('/v1/notes') && String(opcoes.method).toLowerCase() === 'get') {
      return { success: true, data: notasRemotas, additional_data: { pagination: { more_items_in_collection: false } } };
    }
    if (url.includes('/v1/notes') && String(opcoes.method).toLowerCase() === 'post') {
      const payload = JSON.parse(opcoes.payload);
      assert.deepEqual(Object.keys(payload).sort(), ['content', 'deal_id']);
      assert.equal(payload.deal_id, 321);
      assert.match(payload.content, /\[BOARDAUDIT:AUD-PIPE-1\]/);
      assert.doesNotMatch(payload.content, /stage|owner|status/i);
      const criada = { id: ++noteSequence, deal_id: 321, content: payload.content };
      notasRemotas.push(criada);
      return { success: true, data: criada };
    }
    throw new Error('Chamada inesperada: ' + url);
  },
  audV3Localizar_(aba, chave, valor) {
    if (aba === 'AUDITORIAS') return auditoria;
    if (aba === 'INTERACOES') return interacao;
    if (aba === 'TRANSCRICOES') return { ID_INTERACAO: 'INT-1', CONTEUDO: 'transcrição' };
    if (aba === 'CLIENTES') return { ID_CLIENTE: 'CLI-1' };
    return null;
  },
  audV3Atualizar_(aba, chave, id, patch) {
    atualizacoes.push({ aba, id, patch });
    if (aba === 'AUDITORIAS') Object.assign(auditoria, patch);
  },
  audV3ConteudoCompletoTranscricao_(t) { return t.CONTEUDO; },
  audV3NormalizarTranscricaoTexto_(texto) { return { texto }; },
  audV3HashFonte_() { return 'HASH-OK'; },
  audV3ParseJson_(texto) { return JSON.parse(texto); },
  audV3ValidarResultadoOficial_() {},
  audV3ExigirGatePublicavel_() {},
  obterIntegracaoCliente_() { return integracao; },
  obterSegredo_() { return 'TOKEN-SECRETO'; },
  audRdTexto_() { return 'AUDITORIA SDR\nResultado seguro'; },
  audV3AuditoriaFront_() { return {}; },
  audV3ListarAuditoriasFront_() { return []; },
  audCrmEstr_() {},
  limparCachesDados_() {},
  atualizarIntegracaoCliente_(id, patch) { atualizacoes.push({ id, patch }); }
});

for (const arquivo of ['CrmAuditorias.gs', 'PipedriveAuditorias.gs']) {
  vm.runInContext(fs.readFileSync(new URL(arquivo, import.meta.url), 'utf8'), contexto, { filename: arquivo });
}

const testar = vm.runInContext('audPipeTestarIntegracaoCliente_', contexto);
const teste = testar(integracao, 'TOKEN-SECRETO', {});
assert.equal(teste.usuario.id, 7);
assert.equal(teste.config.companyDomain, 'acme');
assert.equal(teste.config.recordUrlTemplate, 'https://acme.pipedrive.com/deal/{id}');

const preparar = vm.runInContext('prepararEnvioAuditoriaPipedrive', contexto);
const previa = preparar('AUD-PIPE-1');
assert.equal(previa.dealId, '321');
assert.equal(previa.atividadesLidas, 1);
assert.equal(previa.notasLidas, 0);
assert.match(previa.aviso, /nao serao alterados/);

const enviar = vm.runInContext('enviarAuditoriaParaPipedrive', contexto);
const primeira = enviar({ idAuditoria: 'AUD-PIPE-1' });
assert.equal(primeira.duplicada, false);
const postsAposPrimeira = chamadas.filter(c => c.url.includes('/v1/notes') && c.opcoes.method === 'post').length;
assert.equal(postsAposPrimeira, 1);

const segunda = enviar({ idAuditoria: 'AUD-PIPE-1' });
assert.equal(segunda.duplicada, true);
const postsAposSegunda = chamadas.filter(c => c.url.includes('/v1/notes') && c.opcoes.method === 'post').length;
assert.equal(postsAposSegunda, 1, 'Uma segunda execucao nao pode duplicar a nota.');

for (const chamada of chamadas) {
  assert.equal(chamada.opcoes.headers['x-api-token'], 'TOKEN-SECRETO');
  assert.doesNotMatch(chamada.url, /TOKEN-SECRETO/);
  assert.doesNotMatch(String(chamada.opcoes.method), /put|patch|delete/i);
}
assert.ok(chamadas.some(c => c.url.includes('/v2/deals/321')));
assert.ok(chamadas.some(c => c.url.includes('/v2/activities?')));
assert.ok(chamadas.some(c => c.url.includes('/v1/notes?')));
assert.ok(atualizacoes.some(item => item.patch && item.patch.CRM_STATUS === 'PUBLICADA'));

console.log('Adapter Pipedrive validado: leitura, nota idempotente e nenhuma mutacao do negocio.');
