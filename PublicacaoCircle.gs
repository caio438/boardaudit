/**
 * PUBLICAÇÃO DE PLANOS NO CIRCLE
 * Envio manual, protegido e idempotente a partir de uma auditoria aprovada.
 * Utiliza a Admin API v2 e mantém o token somente nas Script Properties.
 */

const PUBLICACAO_CIRCLE = Object.freeze({
  endpointPosts: 'https://app.circle.so/api/admin/v2/posts',
  endpointSpaces: 'https://app.circle.so/api/admin/v2/spaces',
  chaveToken: 'CIRCLE_ADMIN_V2_TOKEN',
  chaveAutor: 'CIRCLE_AUTHOR_EMAIL',
  tipoIntegracao: 'CIRCLE'
});

function publicarPlanoCircleV3(idAuditoria) {
  const id = String(idAuditoria || '').trim();
  if (!id) throw new Error('Informe a auditoria que será compartilhada no Circle.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('Outra publicação está sendo processada. Aguarde alguns segundos e tente novamente.');
  }

  try {
    const auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
    if (!auditoria) throw new Error('Auditoria não encontrada.');
    circleValidarTipoAuditoriaPublicavel_(auditoria);
    if (String(auditoria.STATUS || '').toUpperCase() !== 'APROVADA') {
      throw new Error('Aprove a análise antes de compartilhá-la no Circle.');
    }
    if (!String(auditoria.RESULTADO_JSON || '').trim()) {
      throw new Error('A análise não possui um resultado estruturado para publicação.');
    }

    if (auditoria.CIRCLE_POST_ID) {
      return {
        sucesso: true,
        jaPublicado: true,
        mensagem: 'Esta análise já foi compartilhada no Circle.',
        auditoria: audV3AuditoriaFront_(auditoria),
        auditorias: audV3ListarAuditoriasFront_()
      };
    }

    const token = circleToken_();
    const cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', auditoria.ID_CLIENTE);
    const interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO) || {};
    if (!cliente) throw new Error('O cliente desta análise não foi encontrado.');

    const destino = circleDestinoCliente_(auditoria.ID_CLIENTE, token);
    const autorEmail = String(
      destino.config.authorEmail || audV3Configuracao_(PUBLICACAO_CIRCLE.chaveAutor) || ''
    ).trim();
    if (!autorEmail) {
      throw new Error('Informe o e-mail do autor do Circle nas Integrações gerais.');
    }

    const resultado = audV3ParseJson_(
      String(auditoria.RESULTADO_JSON || ''),
      'O resultado da análise não contém um JSON válido.'
    );
    const publicacao = circleMontarPublicacaoAuditoria_(auditoria, cliente, interacao, resultado);
    const payload = {
      space_id: destino.spaceId,
      status: 'published',
      name: publicacao.titulo,
      slug: circleSlugAuditoria_(id),
      tiptap_body: publicacao.tiptapBody,
      is_comments_enabled: true,
      is_liking_enabled: true,
      hide_from_featured_areas: false,
      skip_notifications: false,
      user_email: autorEmail
    };

    audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
      CIRCLE_STATUS: 'PUBLICANDO',
      CIRCLE_ERRO: ''
    });

    const resposta = circleRequisicao_('post', PUBLICACAO_CIRCLE.endpointPosts, token, payload);
    const post = resposta.post || resposta.record || resposta;
    const postId = String(post.id || '');
    const postUrl = String(post.url || '');
    if (!postId) throw new Error('O Circle confirmou o envio, mas não retornou o identificador do post.');

    audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
      CIRCLE_STATUS: 'PUBLICADA',
      CIRCLE_POST_ID: postId,
      CIRCLE_POST_URL: postUrl,
      CIRCLE_PUBLICADO_EM: new Date(),
      CIRCLE_ERRO: ''
    });
    atualizarIntegracaoCliente_(destino.integracao.ID_INTEGRACAO, {
      STATUS: 'CONECTADO',
      ULTIMO_ERRO: '',
      ULTIMA_SINCRONIZACAO: new Date()
    });
    if (typeof limparCachesDados_ === 'function') limparCachesDados_();

    const atualizada = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
    return {
      sucesso: true,
      mensagem: 'Análise compartilhada no Circle.',
      auditoria: audV3AuditoriaFront_(atualizada),
      auditorias: audV3ListarAuditoriasFront_()
    };
  } catch (erro) {
    if (id) {
      try {
        audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
          CIRCLE_STATUS: 'ERRO',
          CIRCLE_ERRO: String(erro && erro.message || erro)
        });
      } catch (ignorado) {}
    }
    throw erro;
  } finally {
    lock.releaseLock();
  }
}

function prepararPlanoCircleManualV3(idAuditoria) {
  const id = String(idAuditoria || '').trim();
  if (!id) throw new Error('Informe a auditoria que será preparada para o Circle.');

  const auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!auditoria) throw new Error('Auditoria não encontrada.');
  circleValidarTipoAuditoriaPublicavel_(auditoria);
  if (String(auditoria.STATUS || '').toUpperCase() !== 'APROVADA') {
    throw new Error('Aprove a análise antes de prepará-la para o Circle.');
  }

  const cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', auditoria.ID_CLIENTE);
  const interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO) || {};
  if (!cliente) throw new Error('O cliente desta análise não foi encontrado.');
  const resultado = audV3ParseJson_(
    String(auditoria.RESULTADO_JSON || ''),
    'O resultado da análise não contém um JSON válido.'
  );
  const publicacao = comunidadeMontarPublicacaoAuditoria_(auditoria, cliente, interacao, resultado);
  const integracao = obterIntegracaoCliente_(auditoria.ID_CLIENTE, PUBLICACAO_CIRCLE.tipoIntegracao);
  const config = integracao ? circleConfigIntegracao_(integracao) : {};
  const tipoAuditoria = String(auditoria.TIPO_AUDITORIA || 'SDR').trim().toUpperCase();
  const nomeInteracao = String(interacao.TITULO || interacao.OPORTUNIDADE || '').trim();
  const tituloFallback = '[' + String(cliente.NOME_CLIENTE || 'Cliente').trim() + ' + VOLUM] Auditoria ' +
    tipoAuditoria + (nomeInteracao ? ' | ' + nomeInteracao : '');

  return {
    sucesso: true,
    idAuditoria: id,
    idCliente: String(auditoria.ID_CLIENTE || ''),
    cliente: String(cliente.NOME_CLIENTE || ''),
    titulo: String(publicacao.titulo || '').trim() || tituloFallback,
    conteudoHtml: publicacao.conteudo,
    spaceUrl: String(config.spaceUrl || config.space_url || ''),
    postUrl: String(auditoria.CIRCLE_POST_URL || ''),
    status: String(auditoria.CIRCLE_STATUS || 'PENDENTE')
  };
}

function salvarDestinoCircleManualCliente(idCliente, spaceUrl) {
  const id = String(idCliente || '').trim();
  const url = circleValidarUrl_(spaceUrl, 'Informe a URL do espaço do cliente no Circle.');
  if (!id || !audV3Localizar_('CLIENTES', 'ID_CLIENTE', id)) {
    throw new Error('Cliente não encontrado.');
  }

  const integracao = obterOuCriarIntegracaoCliente_(id, PUBLICACAO_CIRCLE.tipoIntegracao, {
    ATIVO: 'SIM',
    STATUS: 'MANUAL_CONFIGURADA',
    ULTIMO_ERRO: '',
    ATUALIZADO_EM: new Date()
  });
  const config = circleConfigIntegracao_(integracao);
  config.spaceUrl = url;
  atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
    ATIVO: 'SIM',
    STATUS: 'MANUAL_CONFIGURADA',
    CONFIG_JSON: JSON.stringify(config),
    ULTIMO_ERRO: ''
  });
  if (typeof limparCachesDados_ === 'function') limparCachesDados_();
  return {
    sucesso: true,
    mensagem: 'Espaço manual do Circle vinculado ao cliente.',
    spaceUrl: url,
    integracoesClientes: listarIntegracoesClientes_()
  };
}

function registrarPublicacaoCircleManualV3(idAuditoria, spaceUrl, postUrl) {
  const id = String(idAuditoria || '').trim();
  if (!id) throw new Error('Informe a auditoria publicada.');
  const auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!auditoria) throw new Error('Auditoria não encontrada.');
  circleValidarTipoAuditoriaPublicavel_(auditoria);
  if (String(auditoria.STATUS || '').toUpperCase() !== 'APROVADA') {
    throw new Error('Somente auditorias aprovadas podem ser registradas no Circle.');
  }

  const urlPost = circleValidarUrl_(postUrl, 'Cole a URL do post publicado no Circle.');
  const urlEspaco = String(spaceUrl || '').trim();
  if (urlEspaco) salvarDestinoCircleManualCliente(auditoria.ID_CLIENTE, urlEspaco);

  audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
    CIRCLE_STATUS: 'PUBLICADA_MANUALMENTE',
    CIRCLE_POST_ID: 'MANUAL_' + id,
    CIRCLE_POST_URL: urlPost,
    CIRCLE_PUBLICADO_EM: new Date(),
    CIRCLE_ERRO: ''
  });
  if (typeof limparCachesDados_ === 'function') limparCachesDados_();

  const atualizada = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  return {
    sucesso: true,
    mensagem: 'Publicação manual registrada no Board.',
    auditoria: audV3AuditoriaFront_(atualizada),
    auditorias: audV3ListarAuditoriasFront_()
  };
}

function circleTestarIntegracaoCliente_(integracao) {
  if (!integracao) throw new Error('Integração Circle não encontrada.');
  const config = circleConfigIntegracao_(integracao);
  const spaceUrl = String(config.spaceUrl || config.space_url || '').trim();
  const tokenDisponivel = String(audV3Segredo_(PUBLICACAO_CIRCLE.chaveToken) || '').trim();
  if (!tokenDisponivel) {
    if (!spaceUrl) {
      throw new Error('Informe a URL do espaço do cliente para usar o modo manual do Circle.');
    }
    circleValidarUrl_(spaceUrl, 'A URL do espaço do Circle é inválida.');
    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      ATIVO: 'SIM',
      STATUS: 'MANUAL_CONFIGURADA',
      ULTIMO_ERRO: ''
    });
    if (typeof limparCachesDados_ === 'function') limparCachesDados_();
    return {
      sucesso: true,
      mensagem: 'Destino manual do Circle configurado. A API poderá ser adicionada depois.',
      integracoesClientes: listarIntegracoesClientes_()
    };
  }
  const token = tokenDisponivel;
  let spaceId = Number(config.spaceId || config.space_id || 0);
  if (!spaceId && spaceUrl) {
    spaceId = circleResolverSpaceId_(spaceUrl, token);
    config.spaceId = spaceId;
    integracao.CONFIG_JSON = JSON.stringify(config);
    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      CONFIG_JSON: integracao.CONFIG_JSON
    });
  }
  if (!spaceId) throw new Error('Informe o spaceId do espaço do cliente na configuração complementar.');

  try {
    const resposta = circleRequisicao_(
      'get',
      PUBLICACAO_CIRCLE.endpointSpaces + '/' + encodeURIComponent(String(spaceId)),
      token
    );
    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      ATIVO: 'SIM',
      STATUS: 'CONECTADO',
      ULTIMO_ERRO: '',
      ULTIMA_SINCRONIZACAO: new Date()
    });
    if (typeof limparCachesDados_ === 'function') limparCachesDados_();
    return {
      sucesso: true,
      mensagem: 'Circle conectado ao espaço ' + String(resposta.name || resposta.space_name || spaceId) + '.',
      integracoesClientes: listarIntegracoesClientes_()
    };
  } catch (erro) {
    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      STATUS: 'ERRO',
      ULTIMO_ERRO: String(erro && erro.message || erro)
    });
    if (typeof limparCachesDados_ === 'function') limparCachesDados_();
    throw erro;
  }
}

function circleValidarUrl_(valor, mensagem) {
  const url = String(valor || '').trim();
  if (!/^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i.test(url)) {
    throw new Error(mensagem || 'Informe uma URL válida do Circle.');
  }
  return url;
}

function circleDestinoCliente_(idCliente, token) {
  const integracao = obterIntegracaoCliente_(idCliente, PUBLICACAO_CIRCLE.tipoIntegracao);
  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM') {
    throw new Error('Configure e ative a integração Circle para este cliente.');
  }
  const config = circleConfigIntegracao_(integracao);
  let spaceId = Number(config.spaceId || config.space_id || 0);
  const spaceUrl = String(config.spaceUrl || config.space_url || '').trim();
  if (!spaceId && spaceUrl && token) {
    spaceId = circleResolverSpaceId_(spaceUrl, token);
    config.spaceId = spaceId;
    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      CONFIG_JSON: JSON.stringify(config),
      ULTIMO_ERRO: ''
    });
  }
  if (!spaceId) {
    throw new Error('Informe a URL do espaço do Circle para este cliente ou configure o spaceId.');
  }
  return { integracao: integracao, config: config, spaceId: spaceId };
}

function circleResolverSpaceId_(spaceUrl, token) {
  const slug = circleExtrairSlugEspaco_(spaceUrl);
  if (!slug) throw new Error('Não foi possível identificar o espaço pela URL informada.');

  for (let pagina = 1; pagina <= 20; pagina++) {
    const resposta = circleRequisicao_(
      'get',
      PUBLICACAO_CIRCLE.endpointSpaces + '?page=' + pagina + '&per_page=100',
      token
    );
    const registros = Array.isArray(resposta)
      ? resposta
      : (resposta.records || resposta.spaces || []);
    const encontrado = registros.find(function(espaco) {
      return String(espaco.slug || '').toLowerCase() === slug.toLowerCase();
    });
    if (encontrado && Number(encontrado.id || 0)) return Number(encontrado.id);
    if (!resposta.has_next_page || !registros.length) break;
  }
  throw new Error('O espaço da URL informada não foi encontrado na conta do Circle.');
}

function circleExtrairSlugEspaco_(spaceUrl) {
  const url = String(spaceUrl || '').trim();
  const match = url.match(/\/c\/([^\/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : '';
}

function circleConfigIntegracao_(integracao) {
  const texto = String(integracao && integracao.CONFIG_JSON || '{}').trim() || '{}';
  try {
    const config = JSON.parse(texto);
    return config && typeof config === 'object' ? config : {};
  } catch (erro) {
    throw new Error('A configuração Circle deste cliente não contém um JSON válido.');
  }
}

function circleToken_() {
  const token = String(audV3Segredo_(PUBLICACAO_CIRCLE.chaveToken) || '').trim();
  if (!token) throw new Error('Informe o token Admin API v2 do Circle nas Integrações gerais.');
  return token;
}

function circleRequisicao_(metodo, url, token, payload) {
  const opcoes = {
    method: metodo,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json'
    },
    muteHttpExceptions: true,
    followRedirects: true
  };
  if (payload !== undefined) {
    opcoes.contentType = 'application/json; charset=utf-8';
    opcoes.payload = JSON.stringify(payload);
  }
  const respostaHttp = UrlFetchApp.fetch(url, opcoes);
  const status = Number(respostaHttp.getResponseCode() || 0);
  const corpo = String(respostaHttp.getContentText() || '').trim();
  let resposta = {};
  if (corpo) {
    try { resposta = JSON.parse(corpo); }
    catch (erroJson) {
      throw new Error('O Circle retornou uma resposta que não pôde ser interpretada (HTTP ' + status + ').');
    }
  }
  if (status < 200 || status >= 300) {
    let mensagem = String(
      resposta.message || resposta.error ||
      (resposta.error_details && resposta.error_details.message) ||
      ('Falha HTTP ' + status)
    );
    if (status === 401 || status === 403) mensagem = 'O Circle recusou a credencial ou o plano não possui acesso à Admin API v2.';
    if (status === 404) mensagem = 'O espaço ou o autor configurado não foi encontrado no Circle.';
    if (status === 429) mensagem = 'O Circle limitou temporariamente as requisições. Aguarde e tente novamente.';
    throw new Error(mensagem);
  }
  return resposta;
}

function circleValidarTipoAuditoriaPublicavel_(auditoria) {
  const tipo = String(auditoria && auditoria.TIPO_AUDITORIA || '').trim().toUpperCase();
  if (['SDR', 'CLOSER', 'PLANO'].indexOf(tipo) < 0) {
    throw new Error('Esta auditoria não possui um tipo compatível com a publicação no Circle.');
  }
  return tipo;
}

function comunidadeMontarPublicacaoAuditoria_(auditoria, cliente, interacao, resultado) {
  const tipo = circleValidarTipoAuditoriaPublicavel_(auditoria);
  if (tipo === 'PLANO') return comunidadeMontarPublicacaoPlano_(auditoria, cliente, interacao, resultado);

  const dados = circleDadosPublicacaoAuditoria_(auditoria, cliente, interacao, resultado);
  const linhas = [
    'Boa tarde pessoal, espero que estejam bem.',
    '',
    '**Resultado da auditoria**',
    dados.resumo,
    dados.score ? 'Aderência geral: ' + dados.score : ''
  ].filter(function(item, indice) { return item || indice === 1; });

  circleAdicionarSecaoTexto_(linhas, '**Contexto do contato**', dados.contexto);
  circleAdicionarSecaoTexto_(linhas, '**Principais achados**', dados.achados);
  circleAdicionarSecaoTexto_(linhas, '**Desvios identificados**', dados.desvios);
  circleAdicionarSecaoTexto_(linhas, '**O que deve melhorar**', dados.melhorias);
  circleAdicionarSecaoTexto_(linhas, '**Por que isso importa**', dados.impactos);
  circleAdicionarSecaoTexto_(linhas, '**Próximos passos**', dados.proximosPassos);

  if (dados.audioUrl) {
    linhas.push('', '**Áudio auditado**', '[Ouvir gravação](' + dados.audioUrl + ')');
  }
  linhas.push('', 'Esta análise foi gerada a partir da transcrição da ligação e deve ser usada como direcionamento prático de melhoria.');

  return {
    titulo: dados.titulo,
    resumo: dados.resumo,
    conteudo: linhas.map(function(linha) {
      return circleNormalizarTextoPublicacao_(linha);
    }).join('\n')
  };
}

function circleMontarPublicacaoAuditoria_(auditoria, cliente, interacao, resultado) {
  const tipo = circleValidarTipoAuditoriaPublicavel_(auditoria);
  if (tipo === 'PLANO') return circleMontarPublicacaoPlano_(auditoria, cliente, interacao, resultado);

  const dados = circleDadosPublicacaoAuditoria_(auditoria, cliente, interacao, resultado);
  const nodes = [];
  circleParagrafo_(nodes, [{ text: 'Boa tarde pessoal, espero que estejam bem.' }]);
  circleTitulo_(nodes, 'Resultado da auditoria', 3);
  circleParagrafo_(nodes, [{ text: dados.resumo }]);
  if (dados.score) circleParagrafo_(nodes, [{ text: 'Aderência geral: ' + dados.score, bold: true }]);
  circleAdicionarSecaoNodes_(nodes, 'Contexto do contato', dados.contexto);
  circleAdicionarSecaoNodes_(nodes, 'Principais achados', dados.achados);
  circleAdicionarSecaoNodes_(nodes, 'Desvios identificados', dados.desvios);
  circleAdicionarSecaoNodes_(nodes, 'O que deve melhorar', dados.melhorias);
  circleAdicionarSecaoNodes_(nodes, 'Por que isso importa', dados.impactos);
  circleAdicionarSecaoNodes_(nodes, 'Próximos passos', dados.proximosPassos);
  if (dados.audioUrl) {
    circleTitulo_(nodes, 'Áudio auditado', 3);
    circleParagrafo_(nodes, [{ text: 'Ouvir gravação', link: dados.audioUrl }]);
  }
  circleParagrafo_(nodes, [{
    text: 'Esta análise foi gerada a partir da transcrição da ligação e deve ser usada como direcionamento prático de melhoria.'
  }]);
  return { titulo: dados.titulo, tiptapBody: { body: { type: 'doc', content: nodes } } };
}

function circleDadosPublicacaoAuditoria_(auditoria, cliente, interacao, resultado) {
  const tipo = String(auditoria.TIPO_AUDITORIA || 'SDR').trim().toUpperCase();
  const publicacao = resultado.resumo_publicacao || {};
  const meta = resultado.metadados || {};
  const nomeCliente = String(cliente.NOME_CLIENTE || meta.empresa || 'Cliente').trim();
  const negociacao = String(
    interacao.TITULO || interacao.OPORTUNIDADE || meta.lead || meta.empresa || ''
  ).trim();
  const tituloPadrao = '[' + nomeCliente + ' + VOLUM] Auditoria ' + tipo +
    (negociacao ? ' | ' + negociacao : '');
  const resumoContato = resultado.resumo_contato || resultado.resumo_reuniao || {};
  const resumoExecutivo = resultado.resumo_executivo || {};
  const resumo = circlePrimeiroTexto_([
    publicacao.resumo,
    resumoContato.resumo_conversa,
    resumoExecutivo.visao_geral,
    'Análise da aderência ao pitch e dos principais pontos de melhoria.'
  ]);
  const contexto = circleUnicos_([
    resumoContato.motivacao_contato ? 'Motivação do contato: ' + resumoContato.motivacao_contato : '',
    resumoContato.necessidade_principal ? 'Necessidade principal: ' + resumoContato.necessidade_principal : '',
    resumoContato.dor_principal ? 'Dor principal: ' + resumoContato.dor_principal : '',
    resumoContato.resultado_contato ? 'Resultado do contato: ' + resumoContato.resultado_contato : '',
    resumoContato.resultado_reuniao ? 'Resultado da reunião: ' + resumoContato.resultado_reuniao : ''
  ], 4);
  const achados = circleUnicos_((Array.isArray(publicacao.highlights) ? publicacao.highlights : []).map(function(item) {
    if (typeof item === 'string') return item;
    return circleJuntarPartes_([
      item.ponto,
      item.evidencia ? 'Evidência: ' + item.evidencia : '',
      item.impacto ? 'Impacto: ' + item.impacto : ''
    ]);
  }).concat((resultado.feedback && resultado.feedback.pontos_fortes) || []), 5);
  const impactosBase = Array.isArray(resultado.impactos_nao_conformidades)
    ? resultado.impactos_nao_conformidades : [];
  let desvios = impactosBase.map(function(item) {
    return circleJuntarPartes_([
      item.criterio,
      item.evidencia ? 'Evidência: ' + item.evidencia : ''
    ]);
  });
  if (!desvios.length && tipo === 'SDR') {
    desvios = (resultado.etapas_pitch || []).filter(function(item) {
      return !circleStatusPositivo_(item.status);
    }).map(function(item) {
      return circleJuntarPartes_([item.etapa, item.desvio, item.fato_transcricao ? 'Evidência: ' + item.fato_transcricao : '']);
    });
  }
  if (!desvios.length && tipo === 'CLOSER') {
    desvios = (resultado.momentos || []).filter(function(item) {
      return item.gatilho_alcancado === false || !circleStatusPositivo_(item.status);
    }).map(function(item) {
      const pontosMelhorar = Array.isArray(item.pontos_melhorar)
        ? item.pontos_melhorar.join('. ')
        : String(item.pontos_melhorar || '');
      return circleJuntarPartes_([item.nome || item.id, pontosMelhorar, item.o_que_foi_dito ? 'Evidência: ' + item.o_que_foi_dito : '']);
    });
  }
  const melhorias = circleUnicos_((publicacao.correcoes_prioritarias || []).map(function(item) {
    return typeof item === 'string' ? item : circleJuntarPartes_([
      item.acao,
      item.criterio_conclusao ? 'Critério de conclusão: ' + item.criterio_conclusao : ''
    ]);
  }).concat((resultado.feedback && resultado.feedback.areas_melhoria) || []), 5);
  const impactos = circleUnicos_(impactosBase.map(function(item) {
    return circleJuntarPartes_([
      item.criterio,
      item.impacto_de_nao_executar ? 'Impacto de não corrigir: ' + item.impacto_de_nao_executar : '',
      item.beneficio_de_corrigir ? 'Benefício da correção: ' + item.beneficio_de_corrigir : ''
    ]);
  }), 5);
  const proximosPassos = circleUnicos_((resultado.proximos_passos || []).map(function(item) {
    if (typeof item === 'string') return item;
    return circleJuntarPartes_([
      item.acao,
      item.responsavel ? 'Responsável: ' + item.responsavel : '',
      item.prazo_dias !== undefined && item.prazo_dias !== null ? 'Prazo: ' + item.prazo_dias + ' dia(s)' : '',
      item.criterio_conclusao ? 'Concluído quando: ' + item.criterio_conclusao : ''
    ]);
  }).concat(publicacao.proximos_passos || []), 5);
  const scoreValor = auditoria.SCORE_GLOBAL !== undefined && auditoria.SCORE_GLOBAL !== ''
    ? auditoria.SCORE_GLOBAL : auditoria.SCORE;
  const score = scoreValor === undefined || scoreValor === null || scoreValor === ''
    ? '' : String(scoreValor).replace('.', ',') + ' de 5';

  return {
    titulo: circleNormalizarTextoPublicacao_(circlePrimeiroTexto_([publicacao.titulo, tituloPadrao])),
    resumo: circleNormalizarTextoPublicacao_(resumo),
    score: score,
    contexto: contexto,
    achados: achados,
    desvios: circleUnicos_(desvios, 5),
    melhorias: melhorias,
    impactos: impactos,
    proximosPassos: proximosPassos,
    audioUrl: String(interacao.URL_GRAVACAO || interacao.LINK_ORIGINAL || '').trim()
  };
}

function circleAdicionarSecaoTexto_(linhas, titulo, itens) {
  if (!Array.isArray(itens) || !itens.length) return;
  linhas.push('', titulo);
  itens.forEach(function(item) { linhas.push('• ' + item); });
}

function circleAdicionarSecaoNodes_(nodes, titulo, itens) {
  if (!Array.isArray(itens) || !itens.length) return;
  circleTitulo_(nodes, titulo, 3);
  nodes.push({
    type: 'bulletList',
    content: itens.map(function(item) {
      return { type: 'listItem', content: [{ type: 'paragraph', content: [circleTexto_(item)] }] };
    })
  });
}

function circleStatusPositivo_(statusOriginal) {
  const status = String(statusOriginal || '').trim().toUpperCase();
  return ['CONFORME', 'COMPLETO', 'CORRETO', 'ATINGIDO', 'VERDE', 'OK', 'NAO_APLICAVEL', 'NÃO_APLICÁVEL'].indexOf(status) >= 0;
}

function circleJuntarPartes_(partes) {
  return circleNormalizarTextoPublicacao_((partes || []).filter(Boolean).join('. '));
}

function circlePrimeiroTexto_(valores) {
  const encontrado = (valores || []).find(function(valor) { return String(valor || '').trim(); });
  return String(encontrado || '').trim();
}

function circleUnicos_(valores, limite) {
  const vistos = {};
  return (valores || []).map(circleNormalizarTextoPublicacao_).filter(function(valor) {
    const chave = valor.toLowerCase();
    if (!valor || vistos[chave]) return false;
    vistos[chave] = true;
    return true;
  }).slice(0, Number(limite || 5));
}

function circleNormalizarTextoPublicacao_(texto) {
  let valor = String(texto || '').replace(/\s+/g, ' ').trim();
  if (typeof comunidadeRemoverTravoes_ === 'function') valor = comunidadeRemoverTravoes_(valor);
  if (typeof comunidadeRestaurarAcentosPtBr_ === 'function') valor = comunidadeRestaurarAcentosPtBr_(valor);
  return valor;
}

function circleMontarPublicacaoPlano_(auditoria, cliente, interacao, resultado) {
  const base = comunidadeMontarPublicacaoPlano_(auditoria, cliente, interacao, resultado);
  const metadados = resultado.metadados || {};
  const funcao = String(
    metadados.funcao_auditada || metadados.funcao || metadados.papel || 'SDR'
  ).trim().toUpperCase();
  const colaborador = String(
    metadados.colaborador || metadados.closer || metadados.sdr || interacao.COLABORADOR || 'Não identificado'
  ).trim();
  const criterios = Array.isArray(resultado.criterios) ? resultado.criterios : [];
  const acoes = Array.isArray(resultado.acoes) ? resultado.acoes : [];
  const nodes = [];

  circleParagrafo_(nodes, [{ text: 'Bom dia Pessoal! Como vai?' }]);
  circleTitulo_(nodes, 'Objetivo', 3);
  circleParagrafo_(nodes, [{
    text: 'Este documento formaliza os resultados da Análise do Plano de Otimização da atuação do ' +
      funcao + ', com foco em identificar onde e como as melhorias devem ser aplicadas. O objetivo central não é apontar falhas, mas fornecer direcionamentos práticos para o aprimoramento contínuo da operação comercial.'
  }]);
  circleTitulo_(nodes, 'Importante', 3);
  circleParagrafo_(nodes, [{ text: 'Mostre esta análise para seu ' + funcao + '.' }]);
  circleParagrafo_(nodes, [{ text: 'Os parâmetros desta análise foram retirados do Plano de Otimização.' }]);
  circleTitulo_(nodes, 'Parâmetros analisados', 3);
  circleParagrafo_(nodes, [{ text: 'Equipe analisada: ' + funcao + ' → ' + colaborador, bold: true }]);

  criterios.forEach(function(criterio) {
    const avaliacao = comunidadeAvaliacaoCriterio_(criterio.status);
    circleTitulo_(nodes, String(criterio.nome || criterio.id || 'Critério'), 3);
    circleParagrafo_(nodes, [
      { text: String(criterio.comentario || 'Sem comentário registrado.') }
    ]);
    circleParagrafo_(nodes, [
      { text: 'Resultado: ' + avaliacao.resultado + ' | Nota: ' + avaliacao.nota, bold: true }
    ]);
    nodes.push({ type: 'horizontalRule' });
  });

  circleTitulo_(nodes, 'Ações necessárias', 3);
  if (acoes.length) {
    nodes.push({
      type: 'bulletList',
      content: acoes.map(function(acao) {
        const texto = typeof acao === 'string' ? acao : (acao.acao || acao.descricao || JSON.stringify(acao));
        return { type: 'listItem', content: [{ type: 'paragraph', content: [circleTexto_(texto)] }] };
      })
    });
  } else {
    circleParagrafo_(nodes, [{ text: 'Nenhuma ação registrada.' }]);
  }
  circleParagrafo_(nodes, [{ text: 'As aplicações dessas ações serão acompanhadas no Plano de Otimização do próximo mês.' }]);

  const links = comunidadeExtrairLinks_(resultado, metadados, interacao);
  if (links.length) {
    circleTitulo_(nodes, 'Leads analisados', 3);
    links.forEach(function(link) {
      circleParagrafo_(nodes, [{ text: link, link: link }]);
    });
  }
  circleTitulo_(nodes, 'Encerramento', 3);
  circleParagrafo_(nodes, [{ text: 'A análise foi conduzida para apoiar a Operação de Vendas na implementação de melhorias que acelerem o desempenho comercial de forma escalável, fortalecendo a aderência às melhores práticas do funil de vendas.' }]);
  circleParagrafo_(nodes, [{ text: 'FYI — No que precisarem, estou à disposição 🧑‍💻' }]);

  return {
    titulo: base.titulo,
    tiptapBody: { body: { type: 'doc', content: nodes } }
  };
}

function circleTitulo_(nodes, texto, nivel) {
  nodes.push({
    type: 'heading',
    attrs: { level: Number(nivel || 3) },
    content: [circleTexto_(texto)]
  });
}

function circleParagrafo_(nodes, partes) {
  nodes.push({
    type: 'paragraph',
    content: (partes || []).map(function(parte) {
      return circleTexto_(parte.text, parte.bold, parte.link);
    })
  });
}

function circleTexto_(texto, negrito, link) {
  const node = { type: 'text', text: comunidadeRestaurarAcentosPtBr_(String(texto || '')) };
  const marks = [];
  if (negrito) marks.push({ type: 'bold' });
  if (link) marks.push({ type: 'link', attrs: { href: String(link), target: '_blank' } });
  if (marks.length) node.marks = marks;
  return node;
}

function circleSlugAuditoria_(idAuditoria) {
  return ('volum-auditoria-' + String(idAuditoria || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
