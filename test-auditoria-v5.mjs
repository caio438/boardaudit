import fs from 'node:fs';
import assert from 'node:assert/strict';

const audit = fs.readFileSync(new URL('./AuditoriaV3.gs', import.meta.url), 'utf8');
const rd = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');

const front = fs.readFileSync(new URL('./Index.html', import.meta.url), 'utf8');

for (const coluna of ['AUTOMACAO_STATUS', 'AUTOMACAO_ERRO', 'AUTOMACAO_ATUALIZADO_EM']) {
  assert.ok(audit.includes("'" + coluna + "'"), 'Coluna de automação ausente: ' + coluna);
}
assert.ok(audit.includes('function audV3FinalizarAutomaticamente_'), 'A auditoria não possui finalização automática.');
assert.ok(audit.includes('const finalizacao = audV3FinalizarAutomaticamente_(idAuditoria);'), 'A geração não chama a finalização automática.');
assert.ok(audit.includes('aprovarAuditoriaV3(id);'), 'A finalização automática não cria/aprova o documento.');
assert.ok(audit.includes("AUTOMACAO_STATUS: 'PROCESSANDO'"), 'O pipeline automático não registra início.');
assert.ok(rd.includes('function audRdPublicarAutomaticamente_'), 'A publicação automática no RD não foi implementada.');
assert.ok(rd.includes("status: 'AGUARDANDO_VINCULO'"), 'Auditoria sem vínculo do RD não fica aguardando o vínculo automaticamente.');
assert.ok(rd.includes("publicacao = audRdPublicarAutomaticamente_(id);"), 'Salvar o vínculo do RD não dispara publicação automática.');
assert.ok(front.includes('Gerar e concluir auditoria'), 'A interface ainda apresenta a auditoria como geração parcial.');
assert.ok(front.includes('A validação, o Google Docs e o envio ao RD elegível serão concluídos automaticamente.'), 'A interface não informa o fluxo automático.');
assert.ok(front.includes('function reprocessarAutomacaoAuditoriaFront'), 'A interface não possui contingência para reprocessar falha do RD.');

for (const bloco of [
  'Cenário da ligação',
  'Execuções aderentes ao processo',
  'Desvios em relação ao pitch/processo',
  'Próximos passos conforme o pitch/processo',
  'Conclusão'
]) {
  assert.ok(front.includes(bloco), 'Bloco executivo SDR ausente: ' + bloco);
}
assert.ok(front.includes('function renderizarResumoExecutivoSdrV3_'), 'Resumo executivo SDR não foi implementado.');
assert.ok(front.includes('function renderizarConclusaoObjetivaSdrFront_'), 'Conclusão objetiva SDR não foi implementada.');
assert.ok(front.includes('Análise detalhada da auditoria SDR'), 'Detalhamento SDR não foi preservado em seção própria.');
assert.ok(front.includes('function renderizarPontuacaoQualidadeSdrFront_'), 'Pontuação de Qualidade SDR não possui visualização legível própria.');
assert.ok(front.includes("['Critério', 'Status', 'Nota']"), 'Pontuação de Qualidade SDR não possui resumo compacto.');
assert.ok(front.includes("['Fala do SDR', item.o_que_foi_dito"), 'Detalhamento da Pontuação SDR perdeu a fala do SDR.');
assert.ok(front.includes("['Regra do pitch', item.regra_pitch"), 'Detalhamento da Pontuação SDR perdeu a regra do pitch.');
assert.ok(front.includes("['Divergência', item.divergencia"), 'Detalhamento da Pontuação SDR perdeu a divergência.');
assert.ok(front.includes("['Justificativa da nota', item.justificativa_nota"), 'Detalhamento da Pontuação SDR perdeu a justificativa.');
assert.ok(!front.includes("['Critério','Status','Nota','Fala do SDR','Regra do pitch','Divergência','Justificativa da nota']"), 'Tabela SDR antiga de sete colunas ainda está presente.');


assert.ok(front.includes('function renderizarResumoExecutivoCloserV3_'), 'Resumo executivo Closer não foi implementado.');
assert.ok(front.includes('function renderizarConclusaoObjetivaCloserFront_'), 'Conclusão objetiva Closer não foi implementada.');
assert.ok(front.includes('Cenário da reunião'), 'Cenário executivo do Closer está ausente.');
assert.ok(front.includes('Análise detalhada da auditoria Closer'), 'Detalhamento Closer não foi preservado em seção própria.');
assert.ok(front.includes('function renderizarPontuacaoQualidadeCloserFront_'), 'Pontuação de Qualidade Closer não possui visualização legível própria.');
assert.ok(front.includes("['Fala do Closer', item.o_que_foi_dito"), 'Detalhamento da Pontuação Closer perdeu a fala do Closer.');
assert.ok(!front.includes("['Critério','Status','Nota','Fala do Closer','Regra do pitch','Divergência','Justificativa da nota']"), 'Tabela Closer antiga de sete colunas ainda está presente.');




for (const tipo of ['SDR', 'CLOSER', 'PLANO']) {
  assert.ok(front.includes('data-audit-space="' + tipo + '"'), 'Espaço visual ausente para ' + tipo + '.');
}
assert.ok(front.includes("auditoriaEspaco: 'SDR'"), 'Espaço padrão de auditoria não foi definido.');
assert.ok(front.includes('function selecionarEspacoAuditoriaFront_'), 'Navegação simples entre SDR, Closer e Plano não foi implementada.');
assert.ok(front.includes("String(item.tipoAuditoria || 'SDR').toUpperCase() === espaco"), 'Histórico não é filtrado pelo espaço de auditoria selecionado.');
assert.ok(front.includes("selecionarEspacoAuditoriaFront_(tipo, true);"), 'Aberturas pela Jornada não sincronizam a aba visual com o tipo da auditoria.');
assert.ok(front.includes("['SDR', 'CLOSER', 'PLANO'].includes(tipo)"), 'Jornada não reconhece Plano de Otimização como espaço de auditoria.');

assert.ok(front.includes("const auditoria = (estado.auditorias || []).find(item => String(item.idAuditoria) === idAuditoria) || null;"), 'Auditoria existente não resolve o tipo antes de abrir pela Jornada.');




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

assert.ok(audit.includes('function audV3PontuacaoQualidade_'), 'Documento não possui layout legível para a Pontuação de Qualidade.');
assert.ok(audit.includes("[['Critério', 'Status', 'Nota']].concat"), 'Pontuação de Qualidade não possui tabela-resumo de três colunas.');
for (const campo of ['Fala do ', 'Regra do pitch', 'Divergência', 'Justificativa da nota']) {
  assert.ok(audit.includes(campo), 'Campo detalhado da Pontuação de Qualidade ausente: ' + campo);
}
assert.ok(audit.includes("audV3PontuacaoQualidade_(body, r.criterios_avaliados || [], 'SDR')"), 'SDR não usa o novo layout da Pontuação de Qualidade.');
assert.ok(audit.includes("audV3PontuacaoQualidade_(body, r.criterios_avaliados || [], 'Closer')"), 'Closer não usa o novo layout da Pontuação de Qualidade.');
assert.ok(!audit.includes("['Critério', 'Status', 'Nota', 'Evidências e comparação']"), 'Tabela larga antiga da Pontuação de Qualidade ainda existe.');


assert.match(rd, /String\(a\.STATUS \|\| ''\)\.toUpperCase\(\) !== 'APROVADA'/, 'RD ainda aceita auditoria em revisão.');
assert.match(rd, /String\(a\.VALIDACAO_STATUS \|\| ''\)\.toUpperCase\(\) !== 'VALIDADA'/, 'RD não exige auditoria validada.');
assert.ok(rd.includes('audV3HashFonte_'), 'RD não reconfirma a integridade da fonte.');
assert.ok(rd.includes("['SDR', 'CLOSER'].indexOf(tipoAuditoria) < 0"), 'Plano de Otimização ainda pode ser enviado ao RD CRM.');
assert.ok(rd.includes("if(tipo==='CLOSER')return audRdTextoCloser_(c);"), 'Closer não usa o modelo objetivo de anotação.');
assert.ok(rd.includes('CENÁRIO DA REUNIÃO'), 'Anotação do Closer não possui cenário objetivo.');

assert.ok(rd.includes('Necessidade principal: '), 'Resumo SDR no RD não inclui a necessidade principal.');
assert.ok(rd.includes('Impacto principal: '), 'Resumo Closer no RD não inclui o impacto principal.');
assert.ok(rd.includes('function naoAplicavelCloser'), 'Closer não protege itens não aplicáveis de serem tratados como desvio no RD.');
assert.ok(rd.includes("!conforme(x) && !naoAplicavelCloser(x)"), 'Filtro de desvios do Closer no RD não exclui itens não aplicáveis.');

for (const titulo of ['CENÁRIO DA LIGAÇÃO', 'EXECUÇÕES ADERENTES AO PROCESSO', 'DESVIOS EM RELAÇÃO AO PITCH/PROCESSO', 'PRÓXIMOS PASSOS CONFORME O PITCH/PROCESSO', 'CONCLUSÃO']) {
  assert.ok(rd.includes(titulo), 'Bloco da anotação CRM ausente: ' + titulo);
}

console.log('Auditoria v5 validada: integridade, documento e gate do RD CRM.');
