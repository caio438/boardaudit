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
assert.ok(rd.includes('function audRdUsuarioVolum_'), 'RD não possui resolução configurável do usuário VOLUM por integração.');
assert.ok(rd.includes('rdAuditoriaUsuarioVolumId'), 'RD não permite mapear o usuário VOLUM por ID na integração do cliente.');
assert.ok(rd.includes("publicacao = audRdPublicarAutomaticamente_(id);"), 'Salvar o vínculo do RD não dispara publicação automática.');
assert.ok(rd.includes("if(tipoInteracao==='REUNIAO')return'';"), 'Reuniões não estão protegidas contra inferência automática de negociação pelo texto de origem.');
assert.ok(front.includes('Para reuniões de Closer, este é o vínculo manual padrão.'), 'A interface não informa que reunião de Closer usa vínculo manual no RD.');
assert.ok(front.includes('Em ligações, use somente quando o RD/API4COM não trouxer a negociação automaticamente.'), 'A interface não preserva o fallback manual das ligações sem vínculo automático.');
assert.ok(front.includes('Gerar para revisão'), 'A interface não apresenta o fluxo de revisão antes da publicação.');
assert.ok(front.includes('o resultado será validado e ficará no Board para sua revisão antes de criar o Google Docs ou publicar no RD.'), 'A interface não informa o fluxo de revisão humana.');
assert.ok(front.includes('function reprocessarAutomacaoAuditoriaFront'), 'A interface não possui contingência para reprocessar falha do RD.');
assert.ok(audit.includes('function audV3EstadoCrmGrupoSinergia_'), 'Auditorias do Grupo Sinergia não possuem estado específico para CRM.');
assert.ok(audit.includes('function regenerarAuditoriaGrupoSinergiaParaCrmV3'), 'Auditorias legadas do Grupo Sinergia não podem ser regeneradas com as travas atuais.');
assert.ok(audit.includes("'CLI-20260806105306-25F3490A'"), 'Fluxo do Grupo Sinergia não aponta para o cliente canônico INGEE.');
assert.ok(front.includes('Grupo Sinergia · refazer para CRM'), 'Board não sinaliza auditorias legadas do Grupo Sinergia.');
assert.ok(front.includes('Grupo Sinergia · vincular RD'), 'Board não sinaliza auditorias do Grupo Sinergia prontas para vínculo RD.');
assert.ok(front.includes('function regenerarAuditoriaGrupoSinergiaParaCrmFront'), 'Board não oferece regeneração segura da auditoria legada para CRM.');

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




assert.match(audit, /versao:\s*'6\.0\.0'/, 'Engine de auditoria não foi versionado para v6.');

assert.ok(audit.includes("AUTOMACAO_STATUS: 'AGUARDANDO_REVISAO'"), 'SDR/Closer não param para revisão humana.');
assert.ok(audit.includes('function audV3ValidarQualidadeBoard_'), 'Gate de qualidade do Board não foi implementado.');
assert.ok(audit.includes('contexto_interacao'), 'Resultado estruturado não contém contexto da interação.');
assert.ok(front.includes('JSON estruturado da auditoria'), 'Board não permite inspecionar o JSON antes da publicação.');
assert.ok(front.includes('BLOQUEADA PELO GATE'), 'Board não bloqueia visualmente uma auditoria reprovada pelo gate.');
assert.ok(front.includes('Aprovar e publicar'), 'Board não apresenta aprovação explícita antes da publicação.');
assert.ok(front.includes('O que foi executado corretamente'), 'Resumo SDR não destaca execuções corretas.');
assert.ok(front.includes('Perguntas de qualificação'), 'Resumo SDR não mostra as perguntas de qualificação.');
assert.ok(front.includes('Se eu fosse o SDR, faria assim'), 'Resumo SDR não mostra execução prática recomendada.');
assert.ok(front.includes('Pontuação por critério'), 'Resumo SDR não mostra tabela de notas.');
assert.ok(front.includes('Média dos critérios aplicáveis'), 'Resumo SDR não mostra média contextual dos critérios aplicáveis.');
assert.ok(rd.includes('CONTEXTO DA INTERAÇÃO'), 'RD SDR não publica o contexto da interação.');
assert.ok(rd.includes('PERGUNTAS DE QUALIFICAÇÃO'), 'RD SDR não publica a análise objetiva das perguntas.');
assert.ok(rd.includes('SE EU FOSSE O SDR, FARIA ASSIM'), 'RD SDR não publica orientação executável para a próxima ligação.');
assert.ok(rd.includes('PONTUAÇÃO POR CRITÉRIO'), 'RD SDR não publica a tabela de notas por critério.');
assert.ok(rd.includes('Média dos critérios aplicáveis'), 'RD SDR não apresenta a média dos critérios aplicáveis.');
assert.ok(audit.includes("audV3Titulo_(body, 'Panorama de evolução'"), 'Google Docs não abre com panorama de evolução.');
assert.ok(audit.includes("audV3Titulo_(body, 'Resultados recentes'"), 'Google Docs não mostra resultados históricos recentes.');
assert.ok(audit.includes("audV3Titulo_(body, 'Melhorias já atingidas'"), 'Google Docs não destaca melhorias conquistadas.');
assert.ok(audit.includes("audV3Titulo_(body, 'Pontos que seguem em evolução'"), 'Google Docs não destaca pontos ainda em evolução.');
assert.ok(audit.includes("audV3BlocoEvolucaoDocumento_(body, cliente, interacao, 'SDR', r)"), 'Doc SDR não inclui evolução perto do topo.');
assert.ok(audit.includes("audV3BlocoEvolucaoDocumento_(body, cliente, interacao, 'CLOSER', r)"), 'Doc Closer não inclui evolução perto do topo.');

const sdrNota = rd.indexOf("'Nota geral: '", rd.indexOf('function audRdTextoSdr_'));
const sdrTabela = rd.indexOf("'PONTUAÇÃO POR CRITÉRIO'", rd.indexOf('function audRdTextoSdr_'));
const sdrContexto = rd.indexOf("'CONTEXTO DA INTERAÇÃO'", rd.indexOf('function audRdTextoSdr_'));
assert.ok(sdrNota >= 0 && sdrTabela > sdrNota && sdrContexto > sdrTabela, 'Tabela de notas SDR precisa ficar logo abaixo da nota geral.');

const closerNota = rd.indexOf("'Nota geral: '", rd.indexOf('function audRdTextoCloser_'));
const closerTabela = rd.indexOf("'PONTUAÇÃO DE QUALIDADE'", rd.indexOf('function audRdTextoCloser_'));
const closerCenario = rd.indexOf("'CENÁRIO DA REUNIÃO'", rd.indexOf('function audRdTextoCloser_'));
assert.ok(closerNota >= 0 && closerTabela > closerNota && closerCenario > closerTabela, 'Tabela de notas Closer precisa ficar logo abaixo da nota geral.');

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
assert.ok(rd.includes("if(tipo==='SDR')return audRdTextoSdr_(c);"), 'SDR não usa exclusivamente o modelo objetivo de anotação.');
assert.ok(rd.includes("Tipo de auditoria não suportado para publicação no RD"), 'Dispatcher do RD não bloqueia tipos fora de SDR/Closer.');
assert.ok(!rd.includes('TESTAR_PREVIA_RD_STEC'), 'Função temporária de prévia STEC ainda está em produção.');
assert.ok(!rd.includes('APLICAR_FLUXO_RD_STEC'), 'Função temporária de publicação STEC ainda está em produção.');
assert.ok(!rd.includes('audRdCategoriaSpin_'), 'Fallback legado do texto RD ainda deixou helper sem uso.');

assert.ok(rd.includes('CENÁRIO DA REUNIÃO'), 'Anotação do Closer não possui cenário objetivo.');

assert.ok(rd.includes('Necessidade principal: '), 'Resumo SDR no RD não inclui a necessidade principal.');
assert.ok(rd.includes('Impacto principal: '), 'Resumo Closer no RD não inclui o impacto principal.');
const inicioCloserRd = rd.indexOf('function audRdTextoCloser_');
const fimCloserRd = rd.indexOf('function audRdTextoSdr_', inicioCloserRd);
const closerRd = rd.slice(inicioCloserRd, fimCloserRd);
assert.ok(inicioCloserRd >= 0 && fimCloserRd > inicioCloserRd, 'Formatter do Closer no RD não foi localizado.');
assert.ok(!closerRd.includes('DESVIOS EM RELAÇÃO AO PITCH/PROCESSO'), 'Closer ainda publica o bloco antigo de desvios no RD.');
for (const titulo of [
  'CENÁRIO DA REUNIÃO',
  'EXECUÇÕES ADERENTES AO PROCESSO',
  'PERGUNTAS REALIZADAS PELO CLOSER',
  'PERGUNTAS DO PITCH QUE DEVERIAM TER SIDO FEITAS',
  'IMPLICAÇÃO E NECESSIDADE — O QUE DEVERIA TER SIDO EXPLORADO',
  'ACORDO DE PRÓXIMO PASSO',
  'AJUSTES OBJETIVOS PARA A PRÓXIMA REUNIÃO',
  'CONCLUSÃO',
  'PONTUAÇÃO DE QUALIDADE'
]) {
  assert.ok(closerRd.includes(titulo), 'Bloco da anotação Closer no CRM ausente: ' + titulo);
}
for (const titulo of ['CENÁRIO DA LIGAÇÃO', 'O QUE FOI EXECUTADO CORRETAMENTE', 'PERGUNTAS DE QUALIFICAÇÃO', 'DESVIOS EM RELAÇÃO AO PITCH/PROCESSO', 'SE EU FOSSE O SDR, FARIA ASSIM', 'CONCLUSÃO']) {
  assert.ok(rd.includes(titulo), 'Bloco da anotação SDR no CRM ausente: ' + titulo);
}

console.log('Auditoria v5 validada: integridade, documento e gate do RD CRM.');
