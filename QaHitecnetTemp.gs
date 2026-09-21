/**
 * QA temporario: reprocessamento controlado das quatro auditorias Closer
 * do Grupo Sinergia/INGEE para o fluxo atual de CRM.
 * Restaurar para o runner Hitecnet/STEC apos a execucao.
 */
function QA_HITECNET_STEC_FORCAR_AUDITORIA() {
  const ids = [
    'AUD-20260806134800-83C708AF',
    'AUD-20260813175829-FAB9BCCE',
    'AUD-20260813180755-A9D4A165',
    'AUD-20260911153743-09EE7CE8'
  ];
  const resultados = [];
  const falhas = [];

  ids.forEach(function(id) {
    try {
      const resposta = regenerarAuditoriaGrupoSinergiaParaCrmV3(id) || {};
      const auditoria = resposta.auditoria || {};
      resultados.push({
        idAuditoriaLegada: id,
        sucesso: Boolean(resposta.sucesso),
        reutilizada: Boolean(resposta.reutilizada),
        mensagem: String(resposta.mensagem || ''),
        idAuditoriaNova: String(auditoria.idAuditoria || ''),
        status: String(auditoria.status || ''),
        validacaoStatus: String(auditoria.validacaoStatus || ''),
        rdStatus: String(auditoria.rdStatus || ''),
        linkDocumento: String(auditoria.linkDocumento || '')
      });
    } catch (erro) {
      const mensagem = String(erro && erro.message ? erro.message : erro);
      falhas.push({ idAuditoriaLegada: id, erro: mensagem });
      resultados.push({ idAuditoriaLegada: id, sucesso: false, erro: mensagem });
    }
  });

  try {
    registrarLog_(
      'QA',
      'SINERGIA_REPROCESS_CRM',
      JSON.stringify({ resultados: resultados, falhas: falhas })
    );
  } catch (erroLog) {}

  if (falhas.length) {
    throw new Error('Falha ao reprocessar ' + falhas.length + ' auditoria(s) do Grupo Sinergia: ' + JSON.stringify(falhas));
  }

  return {
    sucesso: true,
    total: resultados.length,
    resultados: resultados
  };
}
