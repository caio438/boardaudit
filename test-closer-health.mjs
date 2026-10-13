import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const codigo = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const inicio = codigo.indexOf('function audV3CategoriaErroDocumentoCloser_(');
const fim = codigo.indexOf('function obterStatusAutomacaoReunioesCloserV3(', inicio);
assert.ok(inicio > 0 && fim > inicio, 'Resumo Closer deve existir antes da rotina de status.');
const contexto = { Object, String, Array, Boolean };
vm.createContext(contexto);
vm.runInContext(codigo.slice(inicio, fim), contexto);

const auditorias = [
  {ID_AUDITORIA:'A1', TIPO_AUDITORIA:'CLOSER', STATUS:'APROVADA', VALIDACAO_STATUS:'VALIDADA',
   LINK_DOCUMENTO:'https://docs.google.com/document/d/doc1/edit', RD_STATUS:'AGUARDANDO_CANONICO', RESULTADO_JSON:'{}'},
  {ID_AUDITORIA:'A2', TIPO_AUDITORIA:'CLOSER', STATUS:'APROVADA', VALIDACAO_STATUS:'VALIDADA',
   LINK_DOCUMENTO:'', AUTOMACAO_STATUS:'CONCLUIDA_AGUARDANDO_CANONICO', RESULTADO_COMPLETO:'ok'},
  {ID_AUDITORIA:'A3', TIPO_AUDITORIA:'CLOSER', STATUS:'EM_REVISAO', VALIDACAO_STATUS:'', RESULTADO_JSON:'{}'},
  {ID_AUDITORIA:'A4', TIPO_AUDITORIA:'CLOSER', STATUS:'ERRO', AUTOMACAO_ERRO:'Falha', RESULTADO_JSON:''},
  {ID_AUDITORIA:'A5', TIPO_AUDITORIA:'SDR', STATUS:'APROVADA', LINK_DOCUMENTO:'https://docs.google.com/document/d/sdr'},
  {ID_AUDITORIA:'', TIPO_AUDITORIA:'CLOSER', STATUS:'APROVADA'}
];
const resumo = JSON.parse(JSON.stringify(contexto.audV3ResumoAuditoriasCloser_(auditorias)));
assert.deepEqual(resumo, {
  registradas:4, aprovadas:2, validadas:2, comLinkDocumento:1,
  concluidasComDocumento:1, aguardandoCanonico:2, emRevisao:1,
  comErro:1, semResultado:1
});
assert.equal(contexto.audV3ResumoAuditoriasCloser_([]).registradas, 0);
assert.equal(contexto.audV3CategoriaErroDocumentoCloser_('A fonte persistida não corresponde ao snapshot.'), 'INTEGRIDADE_DA_FONTE');
assert.equal(contexto.audV3CategoriaErroDocumentoCloser_('A transcrição original desta auditoria não está disponível.'), 'TRANSCRICAO_INDISPONIVEL');
assert.equal(contexto.audV3CategoriaErroDocumentoCloser_('Cliente ou interação da auditoria não encontrados.'), 'CLIENTE_OU_INTERACAO_AUSENTE');
assert.equal(contexto.audV3CategoriaErroDocumentoCloser_('Os critérios da auditoria não são válidos.'), 'VALIDACAO_DO_RESULTADO');
assert.equal(contexto.audV3CategoriaErroDocumentoCloser_('Service invoked too many times: document.'), 'DOCUMENTO_OU_SERVICO_GOOGLE');
const motivos = JSON.parse(JSON.stringify(contexto.audV3CategoriasBloqueioDocumentoCloser_([
  {TIPO_AUDITORIA:'CLOSER', AUTOMACAO_STATUS:'REPARO_DOCUMENTO_CLOSER_BLOQUEADO', AUTOMACAO_ERRO:'A fonte persistida não corresponde ao snapshot.'},
  {TIPO_AUDITORIA:'CLOSER', AUTOMACAO_STATUS:'REPARO_DOCUMENTO_CLOSER_BLOQUEADO', AUTOMACAO_ERRO:'Erro desconhecido: cliente XYZ'},
  {TIPO_AUDITORIA:'SDR', AUTOMACAO_STATUS:'REPARO_DOCUMENTO_CLOSER_BLOQUEADO', AUTOMACAO_ERRO:'Falha'},
  {TIPO_AUDITORIA:'CLOSER', AUTOMACAO_STATUS:'EM_REVISAO', AUTOMACAO_ERRO:'Falha'}
])));
assert.deepEqual(motivos, {INTEGRIDADE_DA_FONTE:1, OUTRO_ERRO:1});
assert.match(codigo, /reparoDocumentosMotivos:\s*audV3CategoriasBloqueioDocumentoCloser_\(auditorias\)/);

assert.match(codigo, /auditoriasResumo:\s*resumoAuditorias/);
assert.match(codigo, /backfillJaAuditadas:\s*resumoAuditorias\.registradas/);
const rd = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');
assert.match(rd, /audRdBloqueioCanonicoCloser_/);
const flow = fs.readFileSync(new URL('./.github/workflows/closer-tldv-health.yml', import.meta.url), 'utf8');
assert.match(flow, /ops_closer_tldv_status=1/);
assert.match(flow, /s\.reparoDocumentosMotivos/);
assert.match(flow, /github\.event\.comment\.body == '\/closer-status'/);
assert.doesNotMatch(flow, /ops_closer_tldv_(?:backfill|repair|sync)=1/);
console.log('OK: health Closer distingue auditorias registradas, aprovadas, Docs, estados de erro e bloqueio RD.');
