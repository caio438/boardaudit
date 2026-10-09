import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync('Code.gs', 'utf8');
const audit = fs.readFileSync('AuditoriaV3.gs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/board-full-automation.yml', 'utf8');

assert.match(code, /function identificarClienteReuniaoTldv_\(reuniao, regras, clientes\)/);
assert.match(code, /jornadaIdentificarClienteEvento_\(evento, regras\)/);
assert.match(code, /Number\(candidato\.pontos \|\| 0\) >= 50/);
assert.match(code, /ID_CLIENTE: idCliente/);
assert.match(code, /clientesIdentificados: clientesIdentificados/);
assert.match(code, /agendarPipelineCloserTldv_\(\)/);
assert.match(code, /ops_closer_tldv_status/);
assert.match(code, /ops_closer_tldv_sync/);

assert.match(audit, /const AUTOMACAO_REUNIOES_CLOSER_V3 = Object\.freeze/);
assert.match(audit, /chaveCutoff: 'AUDITORIA_AUTO_REUNIOES_CLOSER_CUTOFF_ISO'/);
assert.match(audit, /function audV3FilaAutomacaoReunioesCloser_/);
assert.match(audit, /String\(item\.FONTE \|\| ''\)\.toUpperCase\(\) === 'TLDV'/);
assert.match(audit, /audV3PitchAtualAutomatico_\(String\(item\.ID_CLIENTE \|\| ''\), 'CLOSER', pitches\)/);
assert.match(audit, /Boolean\(transcricoes\[id\]\)/);
assert.match(audit, /!auditoriasAprovadas\[id\]/);
assert.match(audit, /function PROCESSAR_PIPELINE_CLOSER_TLDV\(\)/);
assert.match(audit, /tipoAuditoria: 'CLOSER'/);
assert.match(audit, /fonte: 'TLDV'/);
assert.match(audit, /evitarDuplicidade: true/);
assert.match(audit, /audV3FinalizarAutomaticamente_\(idAuditoria\)/);
assert.match(audit, /maxPorExecucao: 1/);
assert.match(audit, /backlogAnteriorAoCutoffIgnorado: true/);

assert.match(code, /salvarConfiguracao_\('AUDITORIA_AUTO_REUNIOES_CLOSER_ATIVA', 'SIM'\)/);
assert.match(code, /salvarConfiguracao_\('AUDITORIA_AUTO_REUNIOES_CLOSER_CUTOFF_ISO', new Date\(\)\.toISOString\(\)\)/);
assert.match(code, /backlogCloserAnteriorAoCutoffIgnorado: true/);
assert.match(workflow, /r\.auditoriaReunioesCloserAtiva === true/);
assert.match(workflow, /ops_closer_tldv_sync=1/);
assert.match(workflow, /Sem pitch Closer atual \(ignoradas\)/);

const trechoIdentificacao = code.slice(
  code.indexOf('function identificarClienteReuniaoTldv_'),
  code.indexOf('function importarTranscricoesTldv')
);
let emailsRecebidos = [];
const identificar = new Function('jornadaIdentificarClienteEvento_', trechoIdentificacao + '\nreturn identificarClienteReuniaoTldv_;')(
  evento => {
    emailsRecebidos = evento.getGuestList(true).map(item => item.getEmail());
    return { idCliente: 'CLI-1', pontos: 85, motivo: 'domínio do participante' };
  }
);
const candidato = identificar({
  name: 'Diagnóstico comercial',
  organizer: { email: 'closer@empresa.com' },
  invitees: [{ email: 'lead@cliente.com' }]
}, []);
assert.equal(candidato.idCliente, 'CLI-1');
assert.deepEqual(emailsRecebidos.sort(), ['closer@empresa.com', 'lead@cliente.com']);

const rejeitarBaixaConfianca = new Function('jornadaIdentificarClienteEvento_', trechoIdentificacao + '\nreturn identificarClienteReuniaoTldv_;')(
  () => ({ idCliente: 'CLI-2', pontos: 49, motivo: 'fraco' })
);
assert.equal(rejeitarBaixaConfianca({ name: 'Reunião', invitees: [] }, []), null);

console.log('OK: automacao Closer via tl;dv validada.');
