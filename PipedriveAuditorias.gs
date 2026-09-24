/**
 * Adapter do Pipedrive para o Board de Auditorias.
 *
 * Escopo deliberadamente restrito:
 * - leitura do usuario autorizado, negocio, atividades e notas;
 * - criacao idempotente de uma nota com o resultado da auditoria;
 * - nenhuma alteracao de stage, owner, status ou campos do negocio.
 */

var AUD_PIPE_NOTAS_LIMITE_PAGINAS = 20;
var AUD_PIPE_NOTAS_POR_PAGINA = 100;

function audPipeNormalizarDominio_(valor) {
  var dominio = String(valor || '').trim().toLowerCase();
  if (!dominio) return '';
  dominio = dominio.replace(/^https?:\/\//i, '').split('/')[0].split('.')[0];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(dominio)) {
    throw new Error('O dominio da empresa no Pipedrive e invalido. Informe somente o subdominio da conta.');
  }
  return dominio;
}

function audPipeConfig_(integracao) {
  var config = typeof audCrmConfigIntegracao_ === 'function'
    ? audCrmConfigIntegracao_(integracao)
    : {};
  if (config.companyDomain) config.companyDomain = audPipeNormalizarDominio_(config.companyDomain);
  return config;
}

function audPipeBaseApi_(integracao) {
  var dominio = audPipeConfig_(integracao).companyDomain;
  return dominio
    ? 'https://' + dominio + '.pipedrive.com/api'
    : 'https://api.pipedrive.com';
}

function audPipeUrl_(integracao, caminho, parametros) {
  var pares = [];
  Object.keys(parametros || {}).forEach(function(chave) {
    var valor = parametros[chave];
    if (valor === undefined || valor === null || valor === '') return;
    pares.push(encodeURIComponent(chave) + '=' + encodeURIComponent(String(valor)));
  });
  return audPipeBaseApi_(integracao) + caminho + (pares.length ? '?' + pares.join('&') : '');
}

function audPipeRequisicao_(integracao, token, caminho, opcoes, parametros) {
  var segredo = String(token || '').trim();
  if (!segredo) throw new Error('Token do Pipedrive nao encontrado.');
  var opts = Object.assign({}, opcoes || {});
  opts.headers = Object.assign({}, opts.headers || {}, {
    Accept: 'application/json',
    'x-api-token': segredo
  });
  var resposta = requisicaoJson_(audPipeUrl_(integracao, caminho, parametros), opts);
  if (resposta && resposta.success === false) {
    throw new Error('Pipedrive recusou a requisicao: ' + String(resposta.error || resposta.error_info || 'erro nao informado'));
  }
  return resposta || {};
}

function audPipeTestarConexao_(integracao, token) {
  var resposta = audPipeRequisicao_(integracao, token, '/v1/users/me', { method: 'get' });
  var usuario = resposta.data || {};
  if (!usuario.id) throw new Error('O Pipedrive respondeu sem identificar o usuario autorizado.');
  return usuario;
}

function audPipeTestarIntegracaoCliente_(integracao, token, configEntrada) {
  var atual = audPipeConfig_(integracao);
  var entrada = configEntrada && typeof configEntrada === 'object' ? configEntrada : {};
  var config = Object.assign({}, atual, entrada);
  if (config.companyDomain) config.companyDomain = audPipeNormalizarDominio_(config.companyDomain);
  var temporaria = Object.assign({}, integracao || {}, { CONFIG_JSON: JSON.stringify(config) });
  var usuario = audPipeTestarConexao_(temporaria, token);
  var dominioResposta = audPipeNormalizarDominio_(
    usuario.company_domain || usuario.companyDomain || (usuario.company || {}).domain || ''
  );
  if (dominioResposta) config.companyDomain = dominioResposta;
  if (!config.recordUrlTemplate && config.companyDomain) {
    config.recordUrlTemplate = 'https://' + config.companyDomain + '.pipedrive.com/deal/{id}';
  }
  atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
    CONFIG_JSON: JSON.stringify(config),
    STATUS: 'CONECTADO',
    ULTIMO_ERRO: '',
    ULTIMA_SINCRONIZACAO: new Date(),
    ATUALIZADO_EM: new Date()
  });
  return { usuario: usuario, config: config };
}

function audPipeMontarLinkNegocio_(recordId, integracao) {
  var id = audCrmNormalizarRecordId_('PIPEDRIVE', recordId);
  var config = audPipeConfig_(integracao);
  if (config.recordUrlTemplate && typeof audCrmLinkPorTemplate_ === 'function') {
    return audCrmLinkPorTemplate_(config.recordUrlTemplate, id);
  }
  return config.companyDomain
    ? 'https://' + config.companyDomain + '.pipedrive.com/deal/' + encodeURIComponent(id)
    : '';
}

function audPipeBuscarNegocio_(integracao, token, dealId) {
  var id = audCrmNormalizarRecordId_('PIPEDRIVE', dealId);
  var resposta = audPipeRequisicao_(
    integracao,
    token,
    '/v2/deals/' + encodeURIComponent(id),
    { method: 'get' },
    { include_fields: 'activities_count,notes_count' }
  );
  var negocio = resposta.data || null;
  if (!negocio || !negocio.id) throw new Error('Negocio nao encontrado ou sem acesso no Pipedrive.');
  return negocio;
}

function audPipeListarAtividades_(integracao, token, dealId) {
  var resposta = audPipeRequisicao_(integracao, token, '/v2/activities', { method: 'get' }, {
    deal_id: audCrmNormalizarRecordId_('PIPEDRIVE', dealId),
    limit: 100,
    sort_by: 'update_time',
    sort_direction: 'desc'
  });
  return Array.isArray(resposta.data) ? resposta.data : [];
}

function audPipeListarNotas_(integracao, token, dealId) {
  var id = audCrmNormalizarRecordId_('PIPEDRIVE', dealId);
  var notas = [];
  var inicio = 0;
  for (var pagina = 0; pagina < AUD_PIPE_NOTAS_LIMITE_PAGINAS; pagina += 1) {
    var resposta = audPipeRequisicao_(integracao, token, '/v1/notes', { method: 'get' }, {
      deal_id: id,
      start: inicio,
      limit: AUD_PIPE_NOTAS_POR_PAGINA,
      sort: 'update_time DESC'
    });
    var lote = Array.isArray(resposta.data) ? resposta.data : [];
    notas = notas.concat(lote);
    var paginacao = ((resposta.additional_data || {}).pagination || {});
    if (!paginacao.more_items_in_collection) return notas;
    var proximo = Number(paginacao.next_start);
    if (!isFinite(proximo) || proximo <= inicio) {
      throw new Error('O Pipedrive devolveu uma paginacao de notas invalida; a publicacao foi interrompida por seguranca.');
    }
    inicio = proximo;
  }
  throw new Error('O negocio possui notas demais para confirmar a idempotencia com seguranca. Nenhuma nota foi criada.');
}

function audPipeMarcador_(idAuditoria) {
  return '[BOARDAUDIT:' + String(idAuditoria || '').trim() + ']';
}

function audPipeTextoNota_(nota) {
  return String((nota || {}).content || (nota || {}).text || '');
}

function audPipeEscaparHtml_(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function audPipeNotaHtml_(idAuditoria, texto) {
  var marcador = audPipeMarcador_(idAuditoria);
  var linhas = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
  var corpo = linhas.map(function(linha) {
    return linha ? audPipeEscaparHtml_(linha) : '&nbsp;';
  }).join('<br>');
  var html = '<p><strong>' + audPipeEscaparHtml_(marcador) + '</strong></p><p>' + corpo + '</p>';
  if (html.length > 95000) {
    throw new Error('A auditoria excede o limite seguro de tamanho para uma nota do Pipedrive. Nenhuma nota foi criada.');
  }
  return html;
}

function audPipeStatus_(idAuditoria, status, noteId, erro) {
  audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', idAuditoria, {
    CRM_PROVIDER: 'PIPEDRIVE',
    CRM_STATUS: status,
    CRM_ACTIVITY_ID: noteId || '',
    CRM_PUBLICADO_EM: status === 'PUBLICADA' ? new Date() : '',
    CRM_ERRO: erro || ''
  });
}

function audPipeContextoAuditoria_(idAuditoria) {
  audCrmEstr_();
  var id = String(idAuditoria || '').trim();
  var auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!auditoria) throw new Error('Auditoria nao encontrada.');
  var tipo = String(auditoria.TIPO_AUDITORIA || '').toUpperCase();
  if (['SDR', 'CLOSER'].indexOf(tipo) < 0) {
    throw new Error('Somente auditorias de SDR ou Closer podem ser enviadas ao Pipedrive.');
  }
  if (String(auditoria.STATUS || '').toUpperCase() !== 'APROVADA') {
    throw new Error('Somente auditorias aprovadas podem ser enviadas ao Pipedrive.');
  }
  if (String(auditoria.VALIDACAO_STATUS || '').toUpperCase() !== 'VALIDADA' || !String(auditoria.HASH_FONTE || '').trim()) {
    throw new Error('A auditoria ainda nao possui validacao de integridade para envio ao Pipedrive.');
  }

  var interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO) || {};
  var transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', auditoria.ID_INTERACAO);
  if (!transcricao) throw new Error('A transcricao original da auditoria nao foi encontrada.');
  var conteudoOriginal = audV3ConteudoCompletoTranscricao_(transcricao, interacao);
  var normalizacaoFonte = audV3NormalizarTranscricaoTexto_(conteudoOriginal, interacao || {});
  transcricao.CONTEUDO = String(normalizacaoFonte.texto || conteudoOriginal || '').trim();

  var pitch = {
    ID_PITCH: auditoria.ID_PITCH || '',
    ID_CLIENTE: auditoria.ID_CLIENTE || '',
    TIPO_PITCH: auditoria.TIPO_AUDITORIA || '',
    NOME_VERSAO: auditoria.NOME_PITCH_SNAPSHOT || '',
    NUMERO_VERSAO: auditoria.VERSAO_PITCH_SNAPSHOT || '',
    CONTEUDO_PITCH: auditoria.CONTEUDO_PITCH_SNAPSHOT || ''
  };
  var modelo = {
    ID_MODELO: auditoria.ID_MODELO || '',
    NOME_MODELO: auditoria.NOME_MODELO_SNAPSHOT || '',
    VERSAO_MODELO: auditoria.VERSAO_MODELO_SNAPSHOT || '',
    TIPO_AUDITORIA: auditoria.TIPO_AUDITORIA || '',
    PROMPT_AUDITORIA: auditoria.PROMPT_SNAPSHOT || '',
    CRITERIOS_JSON: auditoria.CRITERIOS_SNAPSHOT_JSON || ''
  };
  var cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', auditoria.ID_CLIENTE);
  if (!cliente) throw new Error('Cliente da auditoria nao encontrado.');
  var hashAtual = audV3HashFonte_(cliente, pitch, modelo, transcricao, auditoria.TIPO_AUDITORIA);
  if (String(auditoria.HASH_FONTE || '') !== hashAtual) {
    throw new Error('A fonte da auditoria mudou apos a aprovacao. Gere uma nova auditoria antes de enviar ao Pipedrive.');
  }

  var resultado = audV3ParseJson_(auditoria.RESULTADO_JSON, 'Resultado JSON invalido.');
  var criterios = audV3ParseJson_(String(auditoria.CRITERIOS_SNAPSHOT_JSON || '{}'), 'Criterios da auditoria invalidos.');
  audV3ValidarResultadoOficial_(resultado, auditoria.TIPO_AUDITORIA, criterios, transcricao.CONTEUDO, auditoria.CONTEUDO_PITCH_SNAPSHOT || '');
  audV3ExigirGatePublicavel_(resultado, auditoria.TIPO_AUDITORIA);

  var dealId = audCrmExtrairRecordId_(interacao, 'PIPEDRIVE');
  if (!dealId) throw new Error('A interacao nao possui negocio do Pipedrive vinculado.');
  var integracao = obterIntegracaoCliente_(auditoria.ID_CLIENTE, 'PIPEDRIVE');
  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM') {
    throw new Error('A integracao Pipedrive deste cliente nao esta ativa.');
  }
  var token = obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO);
  if (!token) throw new Error('Token do Pipedrive nao encontrado.');

  var negocio = audPipeBuscarNegocio_(integracao, token, dealId);
  var atividades = audPipeListarAtividades_(integracao, token, dealId);
  var notas = audPipeListarNotas_(integracao, token, dealId);
  return {
    a: auditoria,
    i: interacao,
    r: resultado,
    dealId: dealId,
    integracao: integracao,
    token: token,
    negocio: negocio,
    atividades: atividades,
    notas: notas,
    sdr: { nome: String(interacao.COLABORADOR || interacao.VENDEDOR || '') }
  };
}

function audPipeTextoAuditoria_(contexto) {
  if (typeof audRdTexto_ === 'function') return audRdTexto_(contexto);
  if (typeof audV3ResultadoTexto_ === 'function') {
    return audV3ResultadoTexto_(contexto.r, contexto.a.TIPO_AUDITORIA);
  }
  return String(contexto.a.RESULTADO_COMPLETO || 'Auditoria concluida.');
}

function prepararEnvioAuditoriaPipedrive(idAuditoria) {
  var contexto = audPipeContextoAuditoria_(idAuditoria);
  return {
    idAuditoria: contexto.a.ID_AUDITORIA,
    dealId: contexto.dealId,
    oportunidade: contexto.negocio.title || contexto.i.OPORTUNIDADE || contexto.i.TITULO || '',
    responsavel: contexto.i.COLABORADOR || contexto.i.VENDEDOR || '',
    texto: audPipeTextoAuditoria_(contexto),
    atividadesLidas: contexto.atividades.length,
    notasLidas: contexto.notas.length,
    aviso: 'A auditoria sera criada como nota. Stage, owner, status e demais propriedades do negocio nao serao alterados.'
  };
}

function enviarAuditoriaParaPipedrive(dados) {
  dados = dados || {};
  var lock = typeof LockService !== 'undefined' && LockService.getScriptLock
    ? LockService.getScriptLock()
    : null;
  if (lock) lock.waitLock(30000);
  try {
    var contexto = audPipeContextoAuditoria_(dados.idAuditoria);
    var marcador = audPipeMarcador_(contexto.a.ID_AUDITORIA);
    var existente = contexto.notas.find(function(nota) {
      return audPipeTextoNota_(nota).indexOf(marcador) >= 0;
    });
    var noteId = existente ? String(existente.id || '') : '';
    var duplicada = Boolean(existente);

    if (!existente) {
      var texto = String(dados.texto || audPipeTextoAuditoria_(contexto)).trim();
      if (!texto) throw new Error('A nota da auditoria ficou vazia.');
      var resposta = audPipeRequisicao_(contexto.integracao, contexto.token, '/v1/notes', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          deal_id: Number(contexto.dealId),
          content: audPipeNotaHtml_(contexto.a.ID_AUDITORIA, texto)
        })
      });
      var notaCriada = resposta.data || {};
      noteId = String(notaCriada.id || '');
      if (!noteId) throw new Error('O Pipedrive criou a nota, mas nao devolveu o ID.');
    }

    audPipeStatus_(contexto.a.ID_AUDITORIA, 'PUBLICADA', noteId, '');
    if (typeof limparCachesDados_ === 'function') limparCachesDados_();
    return {
      sucesso: true,
      duplicada: duplicada,
      mensagem: duplicada
        ? 'A auditoria ja estava registrada como nota no Pipedrive.'
        : 'Auditoria registrada como nota no Pipedrive.',
      auditoria: audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', contexto.a.ID_AUDITORIA)),
      auditorias: audV3ListarAuditoriasFront_()
    };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function audPipePublicarAutomaticamente_(idAuditoria) {
  try {
    var resposta = enviarAuditoriaParaPipedrive({ idAuditoria: idAuditoria });
    return {
      aplicavel: true,
      publicada: true,
      provider: 'PIPEDRIVE',
      status: 'PUBLICADA',
      mensagem: resposta.mensagem,
      duplicada: Boolean(resposta.duplicada)
    };
  } catch (erro) {
    var mensagem = String(erro && erro.message ? erro.message : erro);
    audPipeStatus_(String(idAuditoria || '').trim(), 'ERRO', '', mensagem);
    return {
      aplicavel: true,
      publicada: false,
      provider: 'PIPEDRIVE',
      status: 'ERRO',
      mensagem: 'Falha na publicacao automatica no Pipedrive.',
      erro: mensagem
    };
  }
}
