/**
 * Operacao autenticada para gerar/reparar, aprovar e publicar uma auditoria no RD
 * a partir do ID de uma transcricao ja existente no Board.
 *
 * A operacao e idempotente:
 * - se a auditoria ja estiver PUBLICADA no RD, apenas retorna o estado;
 * - se estiver EM_REVISAO e tiver coaching generico, tenta o reparo seletivo uma vez;
 * - nunca aprova se o gate estiver BLOQUEADO;
 * - exige vinculo de negociacao e integracao RD ativa antes da aprovacao;
 * - usa o fluxo oficial aprovarAuditoriaV3 -> audRdPublicarAutomaticamente_.
 */
function OPS_AUDITAR_PUBLICAR_TRANSCRICAO(idTranscricao) {
  const alvo = String(idTranscricao || '').trim();
  if (!alvo) throw new Error('ID da transcricao nao informado.');

  const resolvido = opsResolverAlvoAuditoria_(alvo);
  const transcricao = resolvido.transcricao;
  const interacao = resolvido.interacao;
  const idTranscricaoReal = String(transcricao.ID_TRANSCRICAO || '');

  if (String(transcricao.STATUS || '').toUpperCase() !== 'CONCLUIDA') {
    throw new Error('A transcricao ainda nao esta concluida.');
  }

  let auditoria = opsAuditoriaAtualInteracao_(interacao.ID_INTERACAO);
  let tipo = String((auditoria || {}).TIPO_AUDITORIA || interacao.FUNCAO || '').trim().toUpperCase();
  if (!['SDR', 'CLOSER'].includes(tipo)) {
    throw new Error('Nao foi possivel determinar SDR ou CLOSER para esta interacao.');
  }

  if (auditoria && String(auditoria.RD_STATUS || '').toUpperCase() === 'PUBLICADA') {
    return opsResumoAuditoriaPublicada_(auditoria, interacao, idTranscricaoReal, true);
  }

  let forcarNovaAnalise = false;
  if (auditoria &&
      ['EM_REVISAO', 'APROVADA'].includes(String(auditoria.STATUS || '').toUpperCase()) &&
      String(auditoria.VALIDACAO_STATUS || '').toUpperCase() === 'VALIDADA') {
    try {
      opsValidarAuditoriaNoEngineAtual_(auditoria, interacao);
    } catch (erroCompatibilidade) {
      console.warn(
        'Auditoria existente incompatível com as travas atuais; será preservada no histórico e uma nova análise será gerada. ' +
        String(erroCompatibilidade && erroCompatibilidade.message ? erroCompatibilidade.message : erroCompatibilidade)
      );
      auditoria = null;
      forcarNovaAnalise = true;
    }
  }

  if (auditoria &&
      String(auditoria.STATUS || '').toUpperCase() === 'EM_REVISAO' &&
      String(auditoria.VALIDACAO_STATUS || '').toUpperCase() === 'VALIDADA') {
    const resultadoExistente = audV3ParseJson_(auditoria.RESULTADO_JSON, 'Resultado estruturado invalido.');
    if (audV3ColetarOrientacoesGenericas_(resultadoExistente, tipo).length) {
      repararCoachingAuditoriaV3(auditoria.ID_AUDITORIA);
      auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', auditoria.ID_AUDITORIA);
    }
  }

  const podeAproveitar = auditoria &&
    ['EM_REVISAO', 'APROVADA'].includes(String(auditoria.STATUS || '').toUpperCase()) &&
    String(auditoria.VALIDACAO_STATUS || '').toUpperCase() === 'VALIDADA' &&
    String(auditoria.HASH_FONTE || '').trim();

  if (!podeAproveitar) {
    const pitchAtual = audV3PitchAtualAutomatico_(interacao.ID_CLIENTE, tipo);
    if (!pitchAtual) {
      throw new Error('Nenhum pitch atual ' + tipo + ' foi definido para o cliente.');
    }
    const pitchConferido = audV3AtualizarPitchDocumentoAutomatico_(pitchAtual).pitch;
    const gerada = executarAuditoriaV3({
      idCliente: interacao.ID_CLIENTE,
      idPitch: pitchConferido.ID_PITCH,
      idInteracao: interacao.ID_INTERACAO,
      tipoAuditoria: tipo,
      nomeSdr: interacao.COLABORADOR || interacao.VENDEDOR || '',
      nomeLead: interacao.LEAD || '',
      evitarDuplicidade: !forcarNovaAnalise
    });
    if (!gerada || !gerada.auditoria || !String(gerada.auditoria.idAuditoria || '').trim()) {
      throw new Error('A auditoria nao foi criada corretamente.');
    }
    auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', gerada.auditoria.idAuditoria);
  }

  if (!auditoria) throw new Error('Auditoria nao encontrada apos processamento.');

  let resultado = audV3ParseJson_(auditoria.RESULTADO_JSON, 'Resultado estruturado invalido.');
  if (audV3ColetarOrientacoesGenericas_(resultado, tipo).length &&
      String(auditoria.STATUS || '').toUpperCase() === 'EM_REVISAO') {
    repararCoachingAuditoriaV3(auditoria.ID_AUDITORIA);
    auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', auditoria.ID_AUDITORIA);
    resultado = audV3ParseJson_(auditoria.RESULTADO_JSON, 'Resultado estruturado invalido apos reparo.');
  }

  const gate = audV3ExigirGatePublicavel_(resultado, tipo);
  opsPreflightRd_(auditoria, interacao, resultado);

  let aprovacao = null;
  if (String(auditoria.STATUS || '').toUpperCase() !== 'APROVADA') {
    aprovacao = aprovarAuditoriaV3(auditoria.ID_AUDITORIA);
  } else {
    aprovacao = {
      sucesso: true,
      mensagem: 'Auditoria ja aprovada; seguindo para conferencia da publicacao no RD.'
    };
  }

  auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', auditoria.ID_AUDITORIA);
  if (String(auditoria.RD_STATUS || '').toUpperCase() !== 'PUBLICADA') {
    reprocessarAutomacaoAuditoriaV3(auditoria.ID_AUDITORIA);
    auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', auditoria.ID_AUDITORIA);
  }

  if (String(auditoria.STATUS || '').toUpperCase() !== 'APROVADA') {
    throw new Error('Auditoria nao terminou APROVADA.');
  }
  if (String(auditoria.VALIDACAO_STATUS || '').toUpperCase() !== 'VALIDADA') {
    throw new Error('Auditoria nao terminou VALIDADA.');
  }
  if (String(auditoria.RD_STATUS || '').toUpperCase() !== 'PUBLICADA') {
    throw new Error('Auditoria aprovada, mas o RD nao confirmou PUBLICADA: ' + String(auditoria.RD_ERRO || auditoria.RD_STATUS || 'sem status'));
  }

  return opsResumoAuditoriaPublicada_(auditoria, interacao, idTranscricaoReal, false, gate, aprovacao);
}

function opsResolverAlvoAuditoria_(alvo) {
  const chave = String(alvo || '').trim();
  let transcricao = audV3Localizar_('TRANSCRICOES', 'ID_TRANSCRICAO', chave);
  let interacao = null;

  if (transcricao) {
    interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', transcricao.ID_INTERACAO);
  }

  if (!interacao) {
    interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', chave);
  }

  if (!interacao && /^TLDV_/i.test(chave)) {
    const idExternoTldv = chave.replace(/^TLDV_/i, '');
    const candidata = audV3Localizar_('INTERACOES', 'ID_EXTERNO', idExternoTldv);
    if (candidata && String(candidata.FONTE || '').toUpperCase() === 'TLDV') interacao = candidata;
  }

  if (!interacao) {
    const candidataExterna = audV3Localizar_('INTERACOES', 'ID_EXTERNO', chave);
    if (candidataExterna) interacao = candidataExterna;
  }

  if (!transcricao && interacao) {
    transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', interacao.ID_INTERACAO);
  }

  if (!interacao) throw new Error('Interacao nao encontrada para o alvo operacional: ' + chave);
  if (!transcricao) throw new Error('Transcricao nao encontrada para a interacao: ' + String(interacao.ID_INTERACAO || chave));
  return { interacao: interacao, transcricao: transcricao };
}

function opsAuditoriaAtualInteracao_(idInteracao) {
  const todas = audV3Ler_('AUDITORIAS').filter(function(item) {
    return String(item.ID_INTERACAO || '') === String(idInteracao || '') &&
      String(item.STATUS || '').toUpperCase() !== 'DESCARTADA' &&
      ['SDR', 'CLOSER'].includes(String(item.TIPO_AUDITORIA || '').toUpperCase());
  });
  const visiveis = typeof audV3FiltrarAuditoriasVisiveisOperacao_ === 'function'
    ? audV3FiltrarAuditoriasVisiveisOperacao_(todas)
    : todas;
  return visiveis.length ? visiveis[visiveis.length - 1] : null;
}

function opsValidarAuditoriaNoEngineAtual_(auditoria, interacao) {
  const tipo = String(auditoria.TIPO_AUDITORIA || '').toUpperCase();
  if (!['SDR', 'CLOSER'].includes(tipo)) throw new Error('Tipo de auditoria existente inválido.');

  const resultado = audV3ParseJson_(auditoria.RESULTADO_JSON, 'Resultado estruturado inválido.');
  const transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', auditoria.ID_INTERACAO);
  if (!transcricao) throw new Error('Transcrição original da auditoria existente não encontrada.');

  const cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', auditoria.ID_CLIENTE);
  if (!cliente) throw new Error('Cliente original da auditoria existente não encontrado.');

  const conteudoOriginal = audV3ConteudoCompletoTranscricao_(transcricao, interacao);
  const normalizacao = audV3NormalizarTranscricaoTexto_(conteudoOriginal, interacao || {});
  const conteudo = String(normalizacao.texto || conteudoOriginal || '').trim();

  const pitch = {
    ID_PITCH: auditoria.ID_PITCH,
    ID_CLIENTE: auditoria.ID_CLIENTE,
    TIPO_PITCH: tipo,
    NOME_VERSAO: auditoria.NOME_PITCH_SNAPSHOT,
    NUMERO_VERSAO: auditoria.VERSAO_PITCH_SNAPSHOT,
    CONTEUDO_PITCH: auditoria.CONTEUDO_PITCH_SNAPSHOT,
    STATUS: 'ATIVO'
  };
  const modelo = {
    ID_MODELO: auditoria.ID_MODELO,
    ID_CLIENTE: auditoria.ID_CLIENTE,
    TIPO_AUDITORIA: tipo,
    NOME_MODELO: auditoria.NOME_MODELO_SNAPSHOT,
    VERSAO_MODELO: auditoria.VERSAO_MODELO_SNAPSHOT,
    PROMPT_AUDITORIA: auditoria.PROMPT_SNAPSHOT,
    CRITERIOS_JSON: auditoria.CRITERIOS_SNAPSHOT_JSON,
    STATUS: 'ATIVO'
  };
  const hashAtual = audV3HashFonte_(
    cliente,
    pitch,
    modelo,
    Object.assign({}, transcricao, { CONTEUDO: conteudo }),
    tipo
  );
  if (!String(auditoria.HASH_FONTE || '').trim() || String(auditoria.HASH_FONTE) !== String(hashAtual)) {
    throw new Error('A fonte atual difere da auditoria existente; preserve o histórico e gere uma nova análise.');
  }

  const criterios = audV3ParseJson_(auditoria.CRITERIOS_SNAPSHOT_JSON, 'Critérios originais inválidos.');
  audV3ValidarResultadoOficial_(
    resultado,
    tipo,
    criterios,
    conteudo,
    auditoria.CONTEUDO_PITCH_SNAPSHOT || ''
  );
  return resultado;
}

function opsPreflightRd_(auditoria, interacao, resultado) {
  const dealId = audRdDeal_(interacao);
  if (!dealId) {
    throw new Error('A interacao nao possui negociacao do RD vinculada. Nenhuma aprovacao/publicacao foi feita.');
  }

  const integracao = typeof obterIntegracaoCliente_ === 'function'
    ? obterIntegracaoCliente_(auditoria.ID_CLIENTE, 'RD_STATION')
    : null;
  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM') {
    throw new Error('A integracao RD deste cliente nao esta ativa. Nenhuma aprovacao/publicacao foi feita.');
  }

  const token = obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO);
  if (!token) throw new Error('Token do RD nao encontrado. Nenhuma aprovacao/publicacao foi feita.');

  const responsavel = audRdResponsavel_(token, interacao, resultado, auditoria);
  if (!responsavel || !responsavel.id || responsavel.id === 'SEM_ID') {
    throw new Error('Responsavel da auditoria nao identificado no RD. Nenhuma aprovacao/publicacao foi feita.');
  }

  const volum = audRdUsuarioVolum_(token, integracao);
  if (!volum || !volum.id) {
    throw new Error('Usuario VOLUM de publicacao nao identificado no RD. Nenhuma aprovacao/publicacao foi feita.');
  }

  return {
    dealId: dealId,
    responsavelId: responsavel.id,
    usuarioVolumId: volum.id
  };
}

function opsResumoAuditoriaPublicada_(auditoria, interacao, idTranscricao, jaPublicada, gate, aprovacao) {
  return {
    sucesso: true,
    idTranscricao: String(idTranscricao || ''),
    idInteracao: String(auditoria.ID_INTERACAO || interacao.ID_INTERACAO || ''),
    idAuditoria: String(auditoria.ID_AUDITORIA || ''),
    tipoAuditoria: String(auditoria.TIPO_AUDITORIA || ''),
    status: String(auditoria.STATUS || ''),
    validacaoStatus: String(auditoria.VALIDACAO_STATUS || ''),
    automacaoStatus: String(auditoria.AUTOMACAO_STATUS || ''),
    gateStatus: String((gate || {}).status || 'LIBERADO'),
    rdStatus: String(auditoria.RD_STATUS || ''),
    rdActivityId: String(auditoria.RD_ACTIVITY_ID || ''),
    linkDocumento: String(auditoria.LINK_DOCUMENTO || ''),
    linkCrm: String(interacao.LINK_CRM || ''),
    jaPublicada: Boolean(jaPublicada),
    aprovacaoMensagem: String((aprovacao || {}).mensagem || '')
  };
}
