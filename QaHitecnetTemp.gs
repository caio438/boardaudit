/**
 * QA temporario Hitecnet/STEC.
 * Forca nova geracao sem deduplicacao para validar o motor atual.
 */
function QA_HITECNET_STEC_FORCAR_AUDITORIA() {
  return executarAuditoriaV3({
    idCliente: 'CLI-20260731173924-D5F54D50',
    tipoAuditoria: 'SDR',
    idPitch: 'PIT-20260801182901-103A4B69',
    idModelo: 'MOD-SDR-VOLUM-V1',
    idInteracao: 'INT-20260911112552-188297C8',
    nomeSdr: 'Elaine',
    evitarDuplicidade: false
  });
}
