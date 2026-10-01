/**
 * Operacao autenticada para gerar/reparar, aprovar e publicar uma auditoria no RD
 * a partir do ID de uma transcricao ja existente no Board.
 *
 * A operacao e idempotente:
 * - se a auditoria ja estiver PUBLICADA no RD, apenas retorna o estado;
 * - se estiver EM_REVISAO e tiver coaching generico, tenta o reparo seletivo uma vez;
 * - nunca aprova se o gate estiver BLOQUEADO;
 * - exige vinculo de negociacao e integracao RD ativa antes da aprovacao;
 * - usa o fluxo oficial aprovarAuditoriaV3 -> audRdPublicarAutomaticamente_;
 * - se a auditoria já estiver aprovada com falha de RD, reprocessa somente a publicação de forma idempotente.
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
    const orientacoesGenericas = audV3ColetarOrientacoesGenericas_(resultadoExistente, tipo);
    const reparoAnterior = ((resultadoExistente.validacao_board || {}).reparo_coaching || {});
    const falhaCriterioLegada =
      String(reparoAnterior.status || '').toUpperCase() === 'FALHOU' &&
      Number(reparoAnterior.tentativa || 0) >= 1 &&
      /Critério de conclusão não verificável no reparo/i.test(String(reparoAnterior.erro || ''));
    if (orientacoesGenericas.length && falhaCriterioLegada) {
      console.warn('Auditoria preservada no histórico: o reparo anterior falhou apenas no validador legado de critério verificável. Gerando nova análise com a regra corrigida.');
      auditoria = null;
      forcarNovaAnalise = true;
    } else if (orientacoesGenericas.length) {
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

function OPS_AUDITAR_PREVIEW_TRANSCRICAO(idTranscricao) {
  const alvo = String(idTranscricao || '').trim();
  if (!alvo) throw new Error('ID da transcricao nao informado.');

  const resolvido = opsResolverAlvoAuditoria_(alvo);
  const transcricao = resolvido.transcricao;
  const interacao = resolvido.interacao;
  if (String(transcricao.STATUS || '').toUpperCase() !== 'CONCLUIDA') {
    throw new Error('A transcricao ainda nao esta concluida.');
  }

  const tipo = String(interacao.FUNCAO || '').trim().toUpperCase();
  if (!['SDR', 'CLOSER'].includes(tipo)) {
    throw new Error('Nao foi possivel determinar SDR ou CLOSER para esta interacao.');
  }

  const pitchAtual = audV3PitchAtualAutomatico_(interacao.ID_CLIENTE, tipo);
  if (!pitchAtual) throw new Error('Nenhum pitch atual ' + tipo + ' foi definido para o cliente.');
  const pitchConferido = audV3AtualizarPitchDocumentoAutomatico_(pitchAtual).pitch;

  let gerada = null;
  try {
    gerada = executarAuditoriaV3({
      idCliente: interacao.ID_CLIENTE,
      idPitch: pitchConferido.ID_PITCH,
      idInteracao: interacao.ID_INTERACAO,
      tipoAuditoria: tipo,
      nomeSdr: interacao.COLABORADOR || interacao.VENDEDOR || '',
      nomeLead: interacao.LEAD || '',
      evitarDuplicidade: false
    });
  } catch (erroExecucao) {
    const transcricaoAtual = audV3Localizar_('TRANSCRICOES', 'ID_TRANSCRICAO', transcricao.ID_TRANSCRICAO) || transcricao;
    let qualidadeTranscricao = {};
    try { qualidadeTranscricao = JSON.parse(String(transcricaoAtual.QUALIDADE_JSON || '{}')); } catch (erroJson) {}
    return {
      sucesso: false,
      modo: 'PREVIEW_SEM_PUBLICACAO',
      idTranscricao: String(transcricao.ID_TRANSCRICAO || ''),
      idInteracao: String(interacao.ID_INTERACAO || ''),
      tipoAuditoria: tipo,
      erro: String(erroExecucao && erroExecucao.message ? erroExecucao.message : erroExecucao),
      qualidadeTranscricao: qualidadeTranscricao,
      rdPublicada: false,
      aprovada: false
    };
  }

  if (!gerada || !gerada.auditoria || !String(gerada.auditoria.idAuditoria || '').trim()) {
    throw new Error('A auditoria de preview nao foi criada corretamente.');
  }

  const auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', gerada.auditoria.idAuditoria);
  if (!auditoria) throw new Error('Auditoria de preview nao encontrada apos processamento.');

  const resultado = audV3ParseJson_(auditoria.RESULTADO_JSON, 'Resultado estruturado invalido.');

  let gatePublicavel = true;
  let gateErro = '';
  let gate = (resultado || {}).validacao_board || {};
  try {
    gate = audV3ExigirGatePublicavel_(resultado, tipo) || gate;
  } catch (erroGate) {
    gatePublicavel = false;
    gateErro = String(erroGate && erroGate.message ? erroGate.message : erroGate);
  }

  const contextoRd = {
    a: auditoria,
    i: interacao,
    r: resultado,
    dealId: audRdDeal_(interacao),
    token: '',
    sdr: {
      id: '',
      nome: String(interacao.COLABORADOR || interacao.VENDEDOR || ((resultado.metadados || {}).closer) || ''),
      email: ''
    },
    volum: { id: '', nome: 'VOLUM', email: '' }
  };
  const rdPreview = audRdTexto_(contextoRd);

  return {
    sucesso: true,
    modo: 'PREVIEW_SEM_PUBLICACAO',
    reutilizada: false,
    idTranscricao: String(transcricao.ID_TRANSCRICAO || ''),
    idInteracao: String(interacao.ID_INTERACAO || ''),
    idAuditoria: String(auditoria.ID_AUDITORIA || ''),
    tipoAuditoria: String(auditoria.TIPO_AUDITORIA || ''),
    engineVersao: String(auditoria.ENGINE_VERSAO || ''),
    modeloIa: String(auditoria.MODELO_IA || ''),
    status: String(auditoria.STATUS || ''),
    validacaoStatus: String(auditoria.VALIDACAO_STATUS || ''),
    automacaoStatus: String(auditoria.AUTOMACAO_STATUS || ''),
    gateStatus: String((gate || {}).status || ''),
    gatePublicavel: gatePublicavel,
    gateErro: gateErro,
    score: auditoria.SCORE,
    scorePercentual: auditoria.SCORE_PERCENTUAL,
    semaforo: auditoria.SEMAFORO,
    resumoReuniao: resultado.resumo_reuniao || {},
    criteriosAvaliados: resultado.criterios_avaliados || [],
    momentos: resultado.momentos || [],
    perguntasDiagnostico: resultado.perguntas_diagnostico || {},
    analiseImpactoImplicacao: resultado.analise_impacto_implicacao || {},
    proximosPassos: resultado.proximos_passos || [],
    validacaoBoard: resultado.validacao_board || {},
    rdPreview: rdPreview,
    rdPublicada: false,
    aprovada: false
  };
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

  if (!interacao && /^[0-9a-f]{24}$/i.test(chave)) {
    const candidatas = audV3Ler_('INTERACOES').filter(function(item) {
      const linkCrm = String(item.LINK_CRM || '');
      const match = linkCrm.match(/(?:\/deals\/|^)([0-9a-f]{24})(?:\b|\/|\?|$)/i);
      return match && String(match[1]).toLowerCase() === chave.toLowerCase();
    }).map(function(item) {
      return {
        interacao: item,
        transcricao: audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', item.ID_INTERACAO)
      };
    }).filter(function(item) {
      return item.transcricao && String(item.transcricao.STATUS || '').toUpperCase() === 'CONCLUIDA';
    });

    if (candidatas.length > 1) {
      const ids = candidatas.map(function(item) {
        return String(item.interacao.ID_INTERACAO || '');
      }).filter(Boolean);
      throw new Error(
        'Mais de uma transcricao concluida esta vinculada ao deal ' + chave +
        '. Informe o ID exato da interacao: ' + ids.join(', ')
      );
    }
    if (candidatas.length === 1) {
      interacao = candidatas[0].interacao;
      transcricao = candidatas[0].transcricao;
    }
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

function opsUltimaFalhaModeloInteracao_(idInteracao, tipo) {
  const falhas = audV3Ler_('AUDITORIAS').filter(function(item) {
    return String(item.ID_INTERACAO || '') === String(idInteracao || '') &&
      String(item.TIPO_AUDITORIA || '').toUpperCase() === String(tipo || '').toUpperCase() &&
      String(item.STATUS || '').toUpperCase() === 'ERRO' &&
      /MODELO_INDISPONIVEL|temporariamente ocupad|high demand|quota/i.test(String(item.ERRO || item.AUTOMACAO_ERRO || ''));
  });
  return falhas.length ? falhas[falhas.length - 1] : null;
}

function opsAuditoriaValidadaAnteriorInteracao_(idInteracao, tipo) {
  const todas = audV3Ler_('AUDITORIAS').filter(function(item) {
    return String(item.ID_INTERACAO || '') === String(idInteracao || '') &&
      String(item.TIPO_AUDITORIA || '').toUpperCase() === String(tipo || '').toUpperCase() &&
      ['EM_REVISAO', 'APROVADA'].includes(String(item.STATUS || '').toUpperCase()) &&
      String(item.VALIDACAO_STATUS || '').toUpperCase() === 'VALIDADA' &&
      String(item.RESULTADO_JSON || '').trim();
  });
  return todas.length ? todas[todas.length - 1] : null;
}

function opsPrepararTranscricaoPersistidaValidadaParaReparo_(transcricao, interacao) {
  return audV3PrepararTranscricaoPersistidaValidada_(transcricao, interacao);
}

function opsCriarReparoDeterministico_(base, interacao) {
  if (!base) throw new Error('Nenhuma auditoria validada anterior disponível para reparo determinístico.');
  const tipo = String(base.TIPO_AUDITORIA || '').toUpperCase();
  const transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', base.ID_INTERACAO);
  const cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', base.ID_CLIENTE);
  if (!transcricao || !cliente) throw new Error('Fonte da auditoria anterior não encontrada.');

  const pitchAtual = audV3PitchAtualAutomatico_(base.ID_CLIENTE, tipo);
  if (!pitchAtual) throw new Error('Pitch atual não encontrado para o reparo determinístico.');
  const pitch = audV3AtualizarPitchDocumentoAutomatico_(pitchAtual).pitch;
  const modelo = audV3SelecionarModelo_(base.ID_MODELO || '', base.ID_CLIENTE, tipo);
  const criterios = audV3ParseJson_(modelo.CRITERIOS_JSON, 'Critérios atuais inválidos.');
  const preparada = opsPrepararTranscricaoPersistidaValidadaParaReparo_(transcricao, interacao);

  let resultado = JSON.parse(JSON.stringify(audV3ParseJson_(base.RESULTADO_JSON, 'Resultado anterior inválido.')));
  audV3RepararEvidenciasRastreaveis_(resultado, tipo, criterios, preparada.conteudo, pitch.CONTEUDO_PITCH, interacao);

  const identidade = audV3Identidade_({
    nomeSdr: interacao.COLABORADOR || interacao.VENDEDOR || '',
    nomeLead: interacao.LEAD || ''
  }, cliente, interacao);
  resultado = audV3NormalizarResultado_(resultado, criterios, identidade, interacao, pitch, tipo);

  if (tipo === 'CLOSER') {
    audV3ReconciliarContextoCloserComFonte_(resultado, preparada.conteudo, audV3ContextoHistoricoOportunidade_(interacao, tipo) || {});
    audV3AplicarRegrasDeterministicasCloser_(resultado, criterios, preparada.conteudo, pitch.CONTEUDO_PITCH);
    audV3ReconciliarChecklistCloser_(resultado, criterios);
    audV3DerivarSuperficiesExecutivasCloser_(resultado);
  }

  audV3ValidarResultadoOficial_(resultado, tipo, criterios, preparada.conteudo, pitch.CONTEUDO_PITCH);
  resultado.validacao_board = audV3ValidarQualidadeBoard_(resultado, tipo);
  const gate = resultado.validacao_board || {};

  const hashFonte = audV3HashFonte_(
    cliente,
    pitch,
    modelo,
    Object.assign({}, transcricao, {
      CONTEUDO: preparada.conteudo,
      NORMALIZACAO_VERSAO: preparada.normalizacaoVersao
    }),
    tipo
  );
  const idAuditoria = audV3Id_('AUD');
  const agora = new Date();
  const pc = resultado.pontuacao_calculada || {};
  const semaforo = String(((resultado || {}).semaforo_geral || {}).cor || resultado.semaforo || '');

  audV3Adicionar_('AUDITORIAS', {
    ID_AUDITORIA: idAuditoria,
    ID_INTERACAO: base.ID_INTERACAO,
    ID_TRANSCRICAO: transcricao.ID_TRANSCRICAO,
    ID_CLIENTE: base.ID_CLIENTE,
    ID_PITCH: pitch.ID_PITCH,
    TIPO_AUDITORIA: tipo,
    NOME_PITCH_SNAPSHOT: pitch.NOME_VERSAO,
    VERSAO_PITCH_SNAPSHOT: pitch.NUMERO_VERSAO,
    CONTEUDO_PITCH_SNAPSHOT: pitch.CONTEUDO_PITCH,
    PROMPT_SNAPSHOT: audV3PromptOficial_(modelo, tipo),
    STATUS: 'EM_REVISAO',
    RESULTADO_COMPLETO: audV3ResultadoTexto_(resultado, tipo),
    SCORE: pc.score_5 === null || pc.score_5 === undefined ? '' : pc.score_5,
    SCORE_PERCENTUAL: pc.score_percentual === null || pc.score_percentual === undefined ? '' : pc.score_percentual,
    SEMAFORO: semaforo,
    ERRO: '',
    SOLICITADO_EM: agora,
    CONCLUIDO_EM: agora,
    ID_MODELO: modelo.ID_MODELO,
    NOME_MODELO_SNAPSHOT: modelo.NOME_MODELO,
    VERSAO_MODELO_SNAPSHOT: modelo.VERSAO_MODELO,
    CRITERIOS_SNAPSHOT_JSON: modelo.CRITERIOS_JSON,
    RESULTADO_JSON: JSON.stringify(resultado),
    ITENS_AVALIADOS: Number(pc.itens_avaliados || 0),
    ITENS_NA: Number(pc.itens_na || 0),
    DURACAO_PROCESSAMENTO_MS: 0,
    HASH_FONTE: hashFonte,
    MODELO_IA: 'REPARO_DETERMINISTICO_SEM_IA',
    ENGINE_VERSAO: audV3VersaoPersistida_(),
    VALIDACAO_STATUS: String((gate || {}).status || '').toUpperCase() === 'BLOQUEADO' ? 'BLOQUEADA' : 'VALIDADA',
    VALIDADA_EM: agora,
    AUTOMACAO_STATUS: 'AGUARDANDO_REVISAO',
    AUTOMACAO_ERRO: '',
    AUTOMACAO_ATUALIZADO_EM: agora,
    RD_STATUS: ''
  });
  return {
    auditoria: audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', idAuditoria),
    resultado: resultado,
    gate: gate,
    baseId: String(base.ID_AUDITORIA || '')
  };
}

function opsValidarAuditoriaNoEngineAtual_(auditoria, interacao) {
  const tipo = String(auditoria.TIPO_AUDITORIA || '').toUpperCase();
  if (!['SDR', 'CLOSER'].includes(tipo)) throw new Error('Tipo de auditoria existente inválido.');

  const resultado = audV3ParseJson_(auditoria.RESULTADO_JSON, 'Resultado estruturado inválido.');
  const transcricao = audV3TranscricaoExataAuditoria_(auditoria);
  if (!transcricao) throw new Error('Transcrição original da auditoria existente não encontrada.');

  const cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', auditoria.ID_CLIENTE);
  if (!cliente) throw new Error('Cliente original da auditoria existente não encontrado.');

  const fontePreparada = audV3PrepararTranscricaoParaIntegridade_(transcricao, interacao, auditoria.ENGINE_VERSAO);
  const conteudo = String(fontePreparada.conteudo || '').trim();

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
    Object.assign({}, transcricao, {
      CONTEUDO: conteudo,
      NORMALIZACAO_VERSAO: fontePreparada.normalizacaoVersao
    }),
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
