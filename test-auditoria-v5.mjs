import fs from 'node:fs';
import assert from 'node:assert/strict';

const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const rd = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');

assert.match(audit, /versao:\s*'5\.0\.0'/, 'Engine de auditoria não foi versionado para v5.');
for (const coluna of ['HASH_FONTE', 'MODELO_IA', 'ENGINE_VERSAO', 'VALIDACAO_STATUS', 'VALIDADA_EM']) {
  assert.ok(audit.includes("'" + coluna + "'"), 'Coluna de integridade ausente: ' + coluna);
}
assert.ok(audit.includes('function audV3HashFonte_'), 'Hash de fonte não foi implementado.');
assert.ok(audit.includes('promptOficial: audV3PromptOficial_'), 'O hash não inclui o prompt oficial.');
assert.ok(audit.includes("String(item.HASH_FONTE || '') === hashFonte"), 'Deduplicação não usa o hash da fonte.');
assert.ok(audit.includes("temperature: 0"), 'Gemini não está configurado de forma determinística.');
assert.ok(audit.includes("resultadoParseado.__modelo_ia = modeloApi"), 'Modelo de IA efetivamente usado não está sendo registrado.');
assert.ok(audit.includes("VALIDACAO_STATUS: 'VALIDADA'"), 'Resultado validado não recebe status de validação.');
assert.ok(audit.includes("Esta auditoria foi gerada antes das travas de integridade"), 'Aprovação de auditoria legada não está bloqueada.');
assert.ok(audit.includes("A fonte desta auditoria mudou após a geração"), 'Mudança de fonte não bloqueia aprovação.');

assert.ok(audit.includes('function audV3TabelaResultadoInicial_'), 'Documento não possui tabela de resultado no início.');
assert.ok(audit.includes('function audV3ChecklistInicial_'), 'Documento não possui checklist no início.');
assert.ok(audit.includes('function audV3ConclusaoDocumento_'), 'Documento não possui conclusão padronizada.');
assert.ok(audit.includes("audV3AdicionarLinkGravacao_(body, interacao);"), 'Documento não inclui link da gravação.');
assert.ok(audit.includes("p2 = 'O principal ajuste está em '"), 'Conclusão não segue o padrão objetivo aprovado.');
assert.ok(audit.includes("p3 = 'Na prática, '"), 'Conclusão não contém aplicação prática separada.');

assert.match(rd, /String\(a\.STATUS \|\| ''\)\.toUpperCase\(\) !== 'APROVADA'/, 'RD ainda aceita auditoria em revisão.');
assert.match(rd, /String\(a\.VALIDACAO_STATUS \|\| ''\)\.toUpperCase\(\) !== 'VALIDADA'/, 'RD não exige auditoria validada.');
assert.ok(rd.includes('audV3HashFonte_'), 'RD não reconfirma a integridade da fonte.');
for (const titulo of ['CENÁRIO DA LIGAÇÃO', 'EXECUÇÕES ADERENTES AO PROCESSO', 'DESVIOS EM RELAÇÃO AO PITCH/PROCESSO', 'PRÓXIMOS PASSOS CONFORME O PITCH/PROCESSO', 'CONCLUSÃO']) {
  assert.ok(rd.includes(titulo), 'Bloco da anotação CRM ausente: ' + titulo);
}

console.log('Auditoria v5 validada: integridade, documento e gate do RD CRM.');
