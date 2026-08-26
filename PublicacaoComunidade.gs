/**
 * PUBLICAÇÃO DE PLANOS NA COMUNIDADE VOLUM
 * Envio manual, protegido e idempotente a partir de uma auditoria aprovada.
 */

const PUBLICACAO_COMUNIDADE = Object.freeze({
  endpointPadrao: 'https://script.google.com/a/macros/govolum.com/s/AKfycbwf2ktFJdtytbQrMZ7BTmnDPAzX4OK190bFPFOMd7rOzrwNC6oSSBb_3mx4OGnvY9g5/exec',
  spreadsheetId: '1Qkg5lGRGSKjkssNO9kLE0hzzVRyMAzujqR9qeDS-Zk4',
  chaveToken: 'COMUNIDADE_VOLUM_WEBHOOK_TOKEN',
  chaveEndpoint: 'COMUNIDADE_VOLUM_WEBAPP_URL',
  prefixoEspaco: 'COMUNIDADE_ESPACO_'
});

const COMUNIDADE_GRUPO_INGEE = Object.freeze({
  espaco: 'Feed INGEE',
  clientes: ['ingee', 'sinergia', 'semeio cbi', 'semeio']
});

function comunidadeEspacoCompartilhadoCliente_(cliente) {
  const chaves = comunidadeChavesCliente_(cliente || {});
  return chaves.some(function(chave) {
    return COMUNIDADE_GRUPO_INGEE.clientes.indexOf(chave) >= 0;
  }) ? COMUNIDADE_GRUPO_INGEE.espaco : '';
}

function comunidadeLocalizarEspacoCompartilhado_(referencia, espacos) {
  const alvo = comunidadeNormalizarIdentificador_(referencia).replace(/^feed\s+/, '');
  const encontrados = (espacos || []).filter(function(espaco) {
    return comunidadeChavesEspaco_(espaco).indexOf(alvo) >= 0;
  });
  return encontrados.length === 1 ? encontrados[0] : null;
}

function AAA_TESTAR_PREVIEW_HITECNET() {
  formalGarantirEstrutura_();
  const cliente = audV3Ler_('CLIENTES').find(item => comunidadeNormalizarIdentificador_(item.NOME_CLIENTE) === 'hitecnet');
  if (!cliente) throw new Error('O cadastro oficial da Hitecnet não foi encontrado.');
  let corrigidas = 0;
  const formalizacoes = audV3Ler_(FORMALIZACAO_REUNIAO.aba).filter(item => item.ID_FORMALIZACAO);
  formalizacoes.forEach(item => {
    if (String(item.ID_CLIENTE || '').trim()) return;
    let resultado = {};
    try { resultado = JSON.parse(String(item.RESULTADO_JSON || '{}')); } catch (erro) { resultado = {}; }
    const nome = comunidadeNormalizarIdentificador_(((resultado.metadados || {}).cliente || ''));
    const titulo = comunidadeNormalizarIdentificador_(item.TITULO || '');
    if (nome !== 'hitecnet' && titulo.indexOf('hitecnet') < 0) return;
    audV3Atualizar_(FORMALIZACAO_REUNIAO.aba, 'ID_FORMALIZACAO', item.ID_FORMALIZACAO, { ID_CLIENTE: cliente.ID_CLIENTE, ATUALIZADO_EM: new Date() });
    item.ID_CLIENTE = cliente.ID_CLIENTE;
    corrigidas++;
  });
  const aprovada = formalizacoes
    .filter(item => String(item.ID_CLIENTE || '') === String(cliente.ID_CLIENTE) && String(item.STATUS || '').toUpperCase() === 'APROVADA')
    .sort((a, b) => new Date(b.ATUALIZADO_EM || b.SOLICITADO_EM || 0) - new Date(a.ATUALIZADO_EM || a.SOLICITADO_EM || 0))[0];
  if (!aprovada) throw new Error('Nenhuma formalização aprovada da Hitecnet foi encontrada para testar a prévia.');
  const previa = prepararFormalizacaoComunidade(aprovada.ID_FORMALIZACAO);
  const retorno = {
    sucesso: true,
    corrigidas: corrigidas,
    idFormalizacao: aprovada.ID_FORMALIZACAO,
    cliente: previa.clienteNome,
    espaco: previa.espaco,
    espacoSelecionado: previa.espacoSelecionado,
    totalEspacos: (previa.espacos || []).length,
    titulo: previa.titulo
  };
  console.log(JSON.stringify(retorno));
  return retorno;
}

/**
 * Relaciona os clientes ativos do AUDIT aos espaços ativos já existentes na
 * Comunidade VOLUM. A rotina somente grava vínculos inequívocos e preserva
 * toda configuração manual feita anteriormente.
 */
function sincronizarEspacosComunidadeClientes_(clientesRecebidos) {
  try {
    const clientes = (clientesRecebidos || lerObjetos_(APP.sheets.clientes))
      .filter(function(item) {
        return item.ID_CLIENTE && String(item.STATUS || 'ATIVO').toUpperCase() === 'ATIVO';
      });
    const planilha = SpreadsheetApp.openById(PUBLICACAO_COMUNIDADE.spreadsheetId);
    const aba = planilha.getSheetByName('ESPACOS');
    if (!aba) throw new Error('A aba ESPACOS não foi encontrada na base da Comunidade.');
    const espacos = lerEspacosComunidade_(aba).filter(function(item) {
      return String(item.STATUS || 'ATIVO').toUpperCase() === 'ATIVO' &&
        (String(item.ID_ESPACO || '').trim() || String(item.NOME || '').trim() || String(item.SLUG || '').trim());
    });
    let vinculados = 0;
    let preservados = 0;
    let naoEncontrados = 0;
    const detalhes = [];
    const alteracoesConfiguracao = {};

    clientes.forEach(function(cliente) {
      const chaveConfig = PUBLICACAO_COMUNIDADE.prefixoEspaco + String(cliente.ID_CLIENTE);
      const configurado = String(audV3Configuracao_(chaveConfig) || '').trim();
      const chavesConfiguradas = configurado ? comunidadeChavesEspaco_({ NOME: configurado }) : [];
      const espacosConfigurados = configurado ? espacos.filter(function(espaco) {
        return comunidadeChavesEspaco_(espaco).some(function(chave) {
          return chavesConfiguradas.indexOf(chave) >= 0;
        });
      }) : [];
      if (espacosConfigurados.length === 1) {
        const espacoValidado = espacosConfigurados[0];
        alteracoesConfiguracao['COMUNIDADE_ESPACO_ID_' + String(cliente.ID_CLIENTE)] = String(espacoValidado.ID_ESPACO || '');
        alteracoesConfiguracao['COMUNIDADE_ESPACO_SLUG_' + String(cliente.ID_CLIENTE)] = String(espacoValidado.SLUG || '');
        preservados++;
        detalhes.push({
          idCliente: String(cliente.ID_CLIENTE),
          status: 'PRESERVADO',
          espaco: configurado,
          idEspaco: String(espacoValidado.ID_ESPACO || ''),
          slug: String(espacoValidado.SLUG || '')
        });
        return;
      }
      const candidatos = comunidadeChavesCliente_(cliente);
      const encontrados = espacos.filter(function(espaco) {
        const chavesEspaco = comunidadeChavesEspaco_(espaco);
        return candidatos.some(function(chave) { return chavesEspaco.indexOf(chave) >= 0; });
      });
      if (encontrados.length !== 1) {
        alteracoesConfiguracao['COMUNIDADE_ESPACO_ID_' + String(cliente.ID_CLIENTE)] = '';
        alteracoesConfiguracao['COMUNIDADE_ESPACO_SLUG_' + String(cliente.ID_CLIENTE)] = '';
        naoEncontrados++;
        detalhes.push({
          idCliente: String(cliente.ID_CLIENTE),
          status: encontrados.length > 1 ? 'AMBIGUO' : 'NAO_ENCONTRADO',
          espaco: ''
        });
        return;
      }
      const espaco = encontrados[0];
      const referencia = String(espaco.NOME || espaco.SLUG || espaco.ID_ESPACO || '').trim();
      alteracoesConfiguracao[chaveConfig] = referencia;
      alteracoesConfiguracao['COMUNIDADE_ESPACO_ID_' + String(cliente.ID_CLIENTE)] = String(espaco.ID_ESPACO || '');
      alteracoesConfiguracao['COMUNIDADE_ESPACO_SLUG_' + String(cliente.ID_CLIENTE)] = String(espaco.SLUG || '');
      vinculados++;
      detalhes.push({
        idCliente: String(cliente.ID_CLIENTE),
        status: 'VINCULADO',
        espaco: referencia,
        idEspaco: String(espaco.ID_ESPACO || ''),
        slug: String(espaco.SLUG || '')
      });
    });

    comunidadeSalvarConfiguracoesLote_(alteracoesConfiguracao);
    return {
      sucesso: true,
      totalEspacos: espacos.length,
      vinculados: vinculados,
      preservados: preservados,
      naoEncontrados: naoEncontrados,
      detalhes: detalhes
    };
  } catch (erro) {
    return {
      sucesso: false,
      totalEspacos: 0,
      vinculados: 0,
      preservados: 0,
      naoEncontrados: 0,
      detalhes: [],
      erro: String(erro && erro.message || erro)
    };
  }
}

function lerEspacosComunidade_(aba) {
  if (!aba || aba.getLastRow() < 2 || aba.getLastColumn() < 1) return [];
  const valores = aba.getDataRange().getValues();
  const cabecalhos = valores.shift().map(function(valor) { return String(valor || '').trim(); });
  return valores.map(function(linha) {
    const item = {};
    cabecalhos.forEach(function(cabecalho, indice) { item[cabecalho] = linha[indice]; });
    return item;
  });
}

function comunidadeListarEspacosAtivos_() {
  try {
    const planilha = SpreadsheetApp.openById(PUBLICACAO_COMUNIDADE.spreadsheetId);
    const aba = planilha.getSheetByName('ESPACOS');
    if (!aba) return [];
    return lerEspacosComunidade_(aba)
      .filter(function(item) {
        return String(item.STATUS || 'ATIVO').toUpperCase() === 'ATIVO' &&
          (String(item.ID_ESPACO || '').trim() || String(item.NOME || '').trim() || String(item.SLUG || '').trim());
      })
      .map(function(item) {
        const id = String(item.ID_ESPACO || '').trim();
        const nome = String(item.NOME || '').trim();
        const slug = String(item.SLUG || '').trim();
        return {
          id: id,
          nome: nome || slug || id,
          slug: slug,
          valor: id || slug || nome
        };
      })
      .sort(function(a, b) {
        return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
      });
  } catch (erro) {
    console.warn('Não foi possível listar os espaços ativos da Comunidade: ' + String(erro && erro.message || erro));
    return [];
  }
}

function comunidadeResolverEspaco_(referencia, espacos) {
  const procurado = comunidadeNormalizarIdentificador_(referencia);
  if (!procurado) return null;
  const encontrados = (espacos || []).filter(function(item) {
    return [item.id, item.nome, item.slug, item.valor].some(function(valor) {
      return comunidadeNormalizarIdentificador_(valor) === procurado;
    });
  });
  return encontrados.length === 1 ? encontrados[0] : null;
}

function comunidadeSugerirEspacoFormalizacao_(contexto, espacos) {
  const idCliente = String(contexto.formalizacao.ID_CLIENTE || '').trim();
  const referencias = [
    audV3Configuracao_('COMUNIDADE_ESPACO_ID_' + idCliente),
    audV3Configuracao_('COMUNIDADE_ESPACO_SLUG_' + idCliente),
    contexto.espaco
  ];
  for (let indice = 0; indice < referencias.length; indice += 1) {
    const encontrado = comunidadeResolverEspaco_(referencias[indice], espacos);
    if (encontrado) return encontrado;
  }
  const espacoCompartilhado = comunidadeEspacoCompartilhadoCliente_(contexto.cliente);
  if (espacoCompartilhado) {
    const sugestaoGrupo = comunidadeResolverEspaco_(espacoCompartilhado, espacos);
    if (sugestaoGrupo) return sugestaoGrupo;
  }
  const chavesCliente = comunidadeChavesCliente_(contexto.cliente);
  const candidatos = (espacos || []).filter(function(item) {
    return comunidadeChavesEspaco_({ NOME: item.nome, SLUG: item.slug, ID_ESPACO: item.id }).some(function(chave) {
      return chavesCliente.indexOf(chave) >= 0;
    });
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

function comunidadeSalvarEspacoSelecionado_(idCliente, espaco) {
  const id = String(idCliente || '').trim();
  if (!id || !espaco) return;
  const nome = String(espaco.nome || espaco.slug || espaco.id || '').trim();
  comunidadeSalvarConfiguracoesLote_({
    [PUBLICACAO_COMUNIDADE.prefixoEspaco + id]: nome,
    ['COMUNIDADE_ESPACO_ID_' + id]: String(espaco.id || ''),
    ['COMUNIDADE_ESPACO_SLUG_' + id]: String(espaco.slug || '')
  });
}

function comunidadeSalvarConfiguracoesLote_(alteracoes) {
  const chaves = Object.keys(alteracoes || {});
  if (!chaves.length) return;
  const planilha = SpreadsheetApp.openById(APP.spreadsheetId);
  const aba = planilha.getSheetByName(APP.sheets.configuracoes);
  if (!aba) throw new Error('A aba de configurações do AUDIT não foi encontrada.');
  const valores = aba.getDataRange().getValues();
  if (!valores.length) throw new Error('A aba de configurações do AUDIT não possui cabeçalhos.');
  const cabecalhos = valores[0].map(function(valor) { return String(valor || '').trim(); });
  const indiceChave = cabecalhos.indexOf('CHAVE');
  const indiceValor = cabecalhos.indexOf('VALOR');
  const indiceAtualizado = cabecalhos.indexOf('ATUALIZADO_EM');
  if (indiceChave < 0 || indiceValor < 0) throw new Error('A estrutura da aba CONFIGURACOES está incompleta.');
  const linhasPorChave = {};
  for (let indice = 1; indice < valores.length; indice += 1) {
    const chave = String(valores[indice][indiceChave] || '');
    if (chave) linhasPorChave[chave] = indice;
  }
  const novas = [];
  const agora = new Date();
  chaves.forEach(function(chave) {
    if (Object.prototype.hasOwnProperty.call(linhasPorChave, chave)) {
      const indice = linhasPorChave[chave];
      valores[indice][indiceValor] = alteracoes[chave];
      if (indiceAtualizado >= 0) valores[indice][indiceAtualizado] = agora;
      return;
    }
    const linha = cabecalhos.map(function(cabecalho) {
      if (cabecalho === 'CHAVE') return chave;
      if (cabecalho === 'VALOR') return alteracoes[chave];
      if (cabecalho === 'ATUALIZADO_EM') return agora;
      return '';
    });
    novas.push(linha);
  });
  if (valores.length > 1) {
    aba.getRange(2, 1, valores.length - 1, cabecalhos.length).setValues(valores.slice(1));
  }
  if (novas.length) {
    aba.getRange(aba.getLastRow() + 1, 1, novas.length, cabecalhos.length).setValues(novas);
  }
}

function comunidadeChavesCliente_(cliente) {
  const valores = [cliente.NOME_CLIENTE, cliente.CHAVE_VOLUMBERG];
  const chaveVolumberg = String(cliente.CHAVE_VOLUMBERG || '').trim();
  const catalogo = typeof CATALOGO_CLIENTES_AUDIT !== 'undefined'
    ? CATALOGO_CLIENTES_AUDIT.find(function(item) { return String(item.chave || '') === chaveVolumberg; })
    : null;
  if (catalogo) valores.push(catalogo.nome, ...(catalogo.aliases || []));
  return Array.from(new Set(valores.map(comunidadeNormalizarIdentificador_).filter(Boolean)));
}

function comunidadeChavesEspaco_(espaco) {
  const valores = [espaco.NOME, espaco.SLUG, espaco.ID_ESPACO];
  const chaves = [];
  valores.forEach(function(valor) {
    const normalizado = comunidadeNormalizarIdentificador_(valor);
    if (!normalizado) return;
    chaves.push(normalizado);
    const semPrefixo = normalizado
      .replace(/^(feed|espaco|comunidade|cliente)\s+/, '')
      .replace(/\s+(feed|volum)$/, '')
      .trim();
    if (semPrefixo) chaves.push(semPrefixo);
  });
  return Array.from(new Set(chaves));
}

function comunidadeNormalizarIdentificador_(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_/\\-]+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function publicarPlanoComunidadeV3(idAuditoria) {
  const id = String(idAuditoria || '').trim();
  if (!id) throw new Error('Informe a auditoria que será compartilhada.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('Outra publicação está sendo processada. Aguarde alguns segundos e tente novamente.');
  }

  try {
    const auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
    if (!auditoria) throw new Error('Auditoria não encontrada.');
    circleValidarTipoAuditoriaPublicavel_(auditoria);
    if (String(auditoria.STATUS || '').toUpperCase() !== 'APROVADA') {
      throw new Error('Aprove a análise antes de compartilhá-la.');
    }
    if (!String(auditoria.RESULTADO_JSON || '').trim()) {
      throw new Error('A análise não possui um resultado estruturado para publicação.');
    }

    if (auditoria.COMUNIDADE_POST_ID) {
      return {
        sucesso: true,
        jaPublicado: true,
        mensagem: 'Esta análise já foi compartilhada na Comunidade VOLUM.',
        auditoria: audV3AuditoriaFront_(auditoria),
        auditorias: audV3ListarAuditoriasFront_()
      };
    }

    const token = String(audV3Segredo_(PUBLICACAO_COMUNIDADE.chaveToken) || '').trim();
    if (!token) {
      throw new Error('A integração com a Comunidade VOLUM ainda não foi configurada.');
    }

    const cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', auditoria.ID_CLIENTE);
    const interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO) || {};
    if (!cliente) throw new Error('O cliente desta análise não foi encontrado.');

    const resultado = audV3ParseJson_(
      String(auditoria.RESULTADO_JSON || ''),
      'O resultado da análise não contém um JSON válido.'
    );
    const publicacao = comunidadeMontarPublicacaoAuditoria_(auditoria, cliente, interacao, resultado);
    const tipoAuditoria = String(auditoria.TIPO_AUDITORIA || 'SDR').toUpperCase();
    const espacoConfigurado = String(
      audV3Configuracao_(PUBLICACAO_COMUNIDADE.prefixoEspaco + auditoria.ID_CLIENTE) || ''
    ).trim();

    const payload = {
      acao: 'PUBLICAR_AUDITORIA',
      token: token,
      dados: {
        idOrigem: id,
        idClienteOrigem: String(auditoria.ID_CLIENTE || ''),
        clienteNome: String(cliente.NOME_CLIENTE || ''),
        espaco: espacoConfigurado || ('Feed ' + String(cliente.NOME_CLIENTE || '').trim()),
        titulo: publicacao.titulo,
        resumo: publicacao.resumo,
        conteudo: publicacao.conteudo,
        tipo: 'AUDITORIA',
        topicos: tipoAuditoria === 'PLANO'
          ? 'Plano de Otimização,Sales Ops'
          : 'Auditoria ' + tipoAuditoria + ',Feedback Comercial,Sales Ops',
        permiteComentarios: true
      }
    };

    const endpoint = String(
      audV3Configuracao_(PUBLICACAO_COMUNIDADE.chaveEndpoint) || PUBLICACAO_COMUNIDADE.endpointPadrao
    ).trim();

    audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
      COMUNIDADE_STATUS: 'PUBLICANDO',
      COMUNIDADE_ERRO: ''
    });

    const respostaHttp = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify(payload),
      followRedirects: true,
      muteHttpExceptions: true
    });
    const statusHttp = Number(respostaHttp.getResponseCode() || 0);
    const corpo = String(respostaHttp.getContentText() || '').trim();
    let resposta;
    try {
      resposta = JSON.parse(corpo);
    } catch (erroJson) {
      throw new Error(statusHttp === 200
        ? 'A Comunidade VOLUM não retornou uma resposta válida.'
        : 'A Comunidade VOLUM recusou o envio (HTTP ' + statusHttp + ').');
    }
    if (statusHttp < 200 || statusHttp >= 300 || !resposta.sucesso) {
      throw new Error(String(resposta && resposta.mensagem || ('Falha HTTP ' + statusHttp)));
    }

    audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
      COMUNIDADE_STATUS: 'PUBLICADA',
      COMUNIDADE_POST_ID: String(resposta.postId || ''),
      COMUNIDADE_POST_URL: String(resposta.postUrl || endpoint),
      COMUNIDADE_PUBLICADO_EM: new Date(),
      COMUNIDADE_ERRO: ''
    });
    if (typeof limparCachesDados_ === 'function') limparCachesDados_();

    const atualizada = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
    return {
      sucesso: true,
      mensagem: resposta.jaPublicado
        ? 'A publicação já existia e foi vinculada ao Board.'
        : 'Análise compartilhada na Comunidade VOLUM.',
      auditoria: audV3AuditoriaFront_(atualizada),
      auditorias: audV3ListarAuditoriasFront_()
    };
  } catch (erro) {
    audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
      COMUNIDADE_STATUS: 'ERRO',
      COMUNIDADE_ERRO: String(erro && erro.message || erro)
    });
    throw erro;
  } finally {
    lock.releaseLock();
  }
}

function salvarEspacoComunidadeCliente(idCliente, espaco) {
  const id = String(idCliente || '').trim();
  const cliente = lerObjetos_(APP.sheets.clientes).find(function(item) {
    return String(item.ID_CLIENTE || '') === id;
  });
  const nomeEspaco = String(espaco || '').trim();
  if (!id || !nomeEspaco) throw new Error('Informe o cliente e o espaço da Comunidade VOLUM.');
  const espacos = comunidadeListarEspacosAtivos_();
  const encontrado = comunidadeResolverEspaco_(nomeEspaco, espacos);
  audV3SalvarConfiguracao_(PUBLICACAO_COMUNIDADE.prefixoEspaco + id, encontrado ? encontrado.nome : nomeEspaco);
  if (encontrado) {
    audV3SalvarConfiguracao_('COMUNIDADE_ESPACO_ID_' + id, encontrado.id || '');
    audV3SalvarConfiguracao_('COMUNIDADE_ESPACO_SLUG_' + id, encontrado.slug || '');
  }
  return {
    sucesso: true,
    validado: Boolean(encontrado),
    mensagem: encontrado
      ? 'Espaço da Comunidade VOLUM localizado e vinculado ao cliente.'
      : 'Nome salvo, mas o espaço ainda não foi localizado na base ativa da Comunidade.'
  };
}

function comunidadeMontarPublicacaoPlano_(auditoria, cliente, interacao, resultado) {
  const metadados = resultado.metadados || {};
  const funcao = String(
    metadados.funcao_auditada || metadados.funcao || metadados.papel || 'SDR'
  ).trim().toUpperCase();
  const colaborador = String(
    metadados.colaborador || metadados.closer || metadados.sdr || interacao.COLABORADOR || 'Não identificado'
  ).trim();
  const nomeCliente = String(cliente.NOME_CLIENTE || 'Cliente').trim();
  const dataBase = interacao.DATA_INTERACAO ? new Date(interacao.DATA_INTERACAO) : new Date();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const titulo = '[' + nomeCliente + ' + VOLUM] Operacional ' + funcao + ' - ' +
    meses[dataBase.getMonth()] + ' ' + dataBase.getFullYear();
  const resumo = 'Relatório Operacional ' + funcao + ' a partir do Plano de Otimização VOLUM';
  const criterios = Array.isArray(resultado.criterios) ? resultado.criterios : [];
  const acoes = Array.isArray(resultado.acoes) ? resultado.acoes : [];

  const linhas = [
    'Bom dia Pessoal! Como vai?',
    '',
    '**Objetivo**',
    'Este documento formaliza os resultados da Análise do Plano de Otimização da atuação do ' +
      funcao + ', com foco em identificar onde e como as melhorias devem ser aplicadas. ' +
      'O objetivo central não é apontar falhas, mas fornecer direcionamentos práticos para o aprimoramento contínuo da operação comercial.',
    '',
    '**Importante**',
    'Mostre esta análise para seu ' + funcao + '.',
    '',
    'Os parâmetros desta análise foram retirados do Plano de Otimização.',
    '',
    '**Parâmetros analisados**',
    'Equipe analisada: ' + funcao + ' → ' + colaborador
  ];

  criterios.forEach(function(criterio) {
    const avaliacao = comunidadeAvaliacaoCriterio_(criterio.status);
    linhas.push('');
    linhas.push('**' + String(criterio.nome || criterio.id || 'Critério') + '**');
    linhas.push(String(criterio.comentario || 'Sem comentário registrado.'));
    linhas.push('**Resultado: ' + avaliacao.resultado + ' | Nota: ' + avaliacao.nota + '**');
  });

  linhas.push('');
  linhas.push('**Ações necessárias**');
  if (acoes.length) {
    acoes.forEach(function(acao) {
      const texto = typeof acao === 'string' ? acao : (acao.acao || acao.descricao || JSON.stringify(acao));
      linhas.push('• ' + String(texto));
    });
  } else {
    linhas.push('Nenhuma ação registrada.');
  }
  linhas.push('');
  linhas.push('As aplicações dessas ações serão acompanhadas no Plano de Otimização do próximo mês.');

  const links = comunidadeExtrairLinks_(resultado, metadados, interacao);
  if (links.length) {
    linhas.push('');
    linhas.push('**Leads analisados**');
    links.forEach(function(link) {
      linhas.push(String(link));
    });
  }
  linhas.push('');
  linhas.push('**Encerramento**');
  linhas.push('A análise foi conduzida para apoiar a Operação de Vendas na implementação de melhorias que acelerem o desempenho comercial de forma escalável, fortalecendo a aderência às melhores práticas do funil de vendas.');
  linhas.push('');
  linhas.push('FYI');
  linhas.push('No que precisarem, estou à disposição 🧑‍💻');

  return {
    titulo: comunidadeRestaurarAcentosPtBr_(titulo),
    resumo: comunidadeRestaurarAcentosPtBr_(resumo),
    conteudo: comunidadeRestaurarAcentosPtBr_(linhas.join('\n'))
  };
}

function comunidadeAvaliacaoCriterio_(statusOriginal) {
  const status = String(statusOriginal || '').toLowerCase();
  if (status.indexOf('não aplic') >= 0 || status.indexOf('nao aplic') >= 0 || status === 'n/a') {
    return { resultado: 'Não aplicável', nota: 'N/A' };
  }
  if ((status.indexOf('completo') >= 0 && status.indexOf('incompleto') < 0) ||
      (status.indexOf('correto') >= 0 && status.indexOf('incorreto') < 0)) {
    return { resultado: 'Completo', nota: '1,0' };
  }
  if (status.indexOf('parcial') >= 0) return { resultado: 'Parcial', nota: '0,5' };
  return { resultado: 'Incompleto', nota: '0,0' };
}

function comunidadeExtrairLinks_(resultado, metadados, interacao) {
  const fontes = [
    metadados.lead, metadados.links, metadados.leads_analisados,
    resultado.leads_analisados, resultado.links_analisados,
    interacao.LINK_CRM, interacao.OPORTUNIDADE
  ];
  const encontrados = [];
  fontes.forEach(function(fonte) {
    const texto = typeof fonte === 'string' ? fonte : JSON.stringify(fonte || '');
    const links = texto.match(/https?:\/\/[^\s"'<>]+/g) || [];
    links.forEach(function(link) {
      const limpo = link.replace(/[),.;]+$/, '');
      if (encontrados.indexOf(limpo) < 0) encontrados.push(limpo);
    });
  });
  return encontrados;
}

function comunidadeEscaparHtml_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function prepararFormalizacaoComunidade(idFormalizacao) {
  const contexto = comunidadeContextoFormalizacao_(idFormalizacao);
  const espacos = comunidadeListarEspacosAtivos_();
  const espacoSugerido = comunidadeSugerirEspacoFormalizacao_(contexto, espacos);
  const publicacao = comunidadeMontarPublicacaoFormalizacao_(
    contexto.formalizacao,
    contexto.cliente,
    contexto.resultado,
    contexto.interacao
  );
  return {
    sucesso: true,
    idFormalizacao: contexto.formalizacao.ID_FORMALIZACAO,
    idCliente: contexto.formalizacao.ID_CLIENTE,
    clienteNome: contexto.cliente.NOME_CLIENTE,
    espaco: espacoSugerido ? espacoSugerido.nome : '',
    espacoSelecionado: espacoSugerido ? espacoSugerido.valor : '',
    espacoObrigatorio: false,
    nomeEspacoObrigatorio: '',
    espacos: espacos,
    titulo: publicacao.titulo,
    resumo: publicacao.resumo,
    conteudo: publicacao.conteudo,
    tipoReuniao: String(contexto.resultado.tipo_reuniao || contexto.formalizacao.TIPO_REUNIAO || 'OUTRA').toUpperCase(),
    jaPublicado: Boolean(contexto.formalizacao.COMUNIDADE_POST_ID),
    postUrl: contexto.formalizacao.COMUNIDADE_POST_URL || ''
  };
}

function publicarFormalizacaoComunidade(idFormalizacao, capa, destinoEspaco) {
  const id = String(idFormalizacao || '').trim();
  capa = capa || null;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Outra publicação está sendo processada. Aguarde alguns segundos.');
  try {
    const contexto = comunidadeContextoFormalizacao_(id);
    const formalizacao = contexto.formalizacao;
    if (formalizacao.COMUNIDADE_POST_ID) {
      return {
        sucesso: true,
        jaPublicado: true,
        mensagem: 'Esta formalização já foi compartilhada na Comunidade VOLUM.',
        formalizacao: formalSerializar_(formalizacao),
        formalizacoes: formalListarFront_()
      };
    }
    const token = String(audV3Segredo_(PUBLICACAO_COMUNIDADE.chaveToken) || '').trim();
    if (!token) throw new Error('A integração com a Comunidade VOLUM ainda não foi configurada.');
    const espacos = comunidadeListarEspacosAtivos_();
    if (!espacos.length) throw new Error('Não foi possível carregar os espaços ativos da Comunidade VOLUM.');
    const espacoSelecionado = comunidadeResolverEspaco_(destinoEspaco, espacos);
    if (!espacoSelecionado) throw new Error('Selecione um espaço válido da Comunidade VOLUM antes de publicar.');
    comunidadeSalvarEspacoSelecionado_(formalizacao.ID_CLIENTE, espacoSelecionado);
    const publicacao = comunidadeMontarPublicacaoFormalizacao_(formalizacao, contexto.cliente, contexto.resultado, contexto.interacao);
    const payload = {
      acao: 'PUBLICAR_AUDITORIA',
      token: token,
      dados: {
        idOrigem: id,
        idClienteOrigem: String(formalizacao.ID_CLIENTE || ''),
        clienteNome: String(contexto.cliente.NOME_CLIENTE || ''),
        espaco: espacoSelecionado.nome,
        titulo: publicacao.titulo,
        resumo: publicacao.resumo,
        conteudo: publicacao.conteudo,
        tipo: 'FORMALIZACAO_REUNIAO',
        topicos: 'Formalização de Reunião,Próximos Passos',
        permiteComentarios: true,
        capa: capa && capa.base64 ? {
          nome: String(capa.nome || 'capa-publicacao'),
          mimeType: String(capa.mimeType || ''),
          base64: String(capa.base64 || '')
        } : null
      }
    };
    const endpoint = String(audV3Configuracao_(PUBLICACAO_COMUNIDADE.chaveEndpoint) || PUBLICACAO_COMUNIDADE.endpointPadrao).trim();
    audV3Atualizar_(FORMALIZACAO_REUNIAO.aba, 'ID_FORMALIZACAO', id, { COMUNIDADE_STATUS: 'PUBLICANDO', COMUNIDADE_ERRO: '' });
    const respostaHttp = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify(payload),
      followRedirects: true,
      muteHttpExceptions: true
    });
    const statusHttp = Number(respostaHttp.getResponseCode() || 0);
    const corpo = String(respostaHttp.getContentText() || '').trim();
    let resposta;
    try { resposta = JSON.parse(corpo); }
    catch (erroJson) { throw new Error(statusHttp === 200 ? 'A Comunidade VOLUM não retornou uma resposta válida.' : 'A Comunidade VOLUM recusou o envio (HTTP ' + statusHttp + ').'); }
    if (statusHttp < 200 || statusHttp >= 300 || !resposta.sucesso) {
      throw new Error(String(resposta && resposta.mensagem || ('Falha HTTP ' + statusHttp)));
    }
    audV3Atualizar_(FORMALIZACAO_REUNIAO.aba, 'ID_FORMALIZACAO', id, {
      COMUNIDADE_STATUS: 'PUBLICADA',
      COMUNIDADE_POST_ID: String(resposta.postId || ''),
      COMUNIDADE_POST_URL: String(resposta.postUrl || endpoint),
      COMUNIDADE_PUBLICADO_EM: new Date(),
      COMUNIDADE_ERRO: ''
    });
    const atualizada = audV3Localizar_(FORMALIZACAO_REUNIAO.aba, 'ID_FORMALIZACAO', id);
    return {
      sucesso: true,
      mensagem: resposta.jaPublicado ? 'A publicação já existia e foi vinculada ao Board.' : 'Formalização compartilhada na Comunidade VOLUM.',
      formalizacao: formalSerializar_(atualizada),
      formalizacoes: formalListarFront_()
    };
  } catch (erro) {
    if (id) audV3Atualizar_(FORMALIZACAO_REUNIAO.aba, 'ID_FORMALIZACAO', id, {
      COMUNIDADE_STATUS: 'ERRO', COMUNIDADE_ERRO: String(erro && erro.message || erro)
    });
    throw erro;
  } finally {
    lock.releaseLock();
  }
}

function comunidadeContextoFormalizacao_(idFormalizacao) {
  formalGarantirEstrutura_();
  const id = String(idFormalizacao || '').trim();
  if (!id) throw new Error('Informe a formalização que será compartilhada.');
  const formalizacao = audV3Localizar_(FORMALIZACAO_REUNIAO.aba, 'ID_FORMALIZACAO', id);
  if (!formalizacao) throw new Error('Formalização não encontrada.');
  if (String(formalizacao.STATUS || '').toUpperCase() !== 'APROVADA') throw new Error('Aprove a formalização antes de compartilhá-la.');
  if (!String(formalizacao.RESULTADO_JSON || '').trim()) throw new Error('A formalização não possui conteúdo estruturado.');
  if (!String(formalizacao.ID_CLIENTE || '').trim()) {
    const resultadoTemporario = audV3ParseJson_(String(formalizacao.RESULTADO_JSON), 'O conteúdo da formalização não contém um JSON válido.');
    const nomeCliente = comunidadeNormalizarIdentificador_(((resultadoTemporario.metadados || {}).cliente || ''));
    const candidatos = nomeCliente ? audV3Ler_('CLIENTES').filter(item => comunidadeNormalizarIdentificador_(item.NOME_CLIENTE) === nomeCliente) : [];
    if (candidatos.length === 1) {
      formalizacao.ID_CLIENTE = candidatos[0].ID_CLIENTE;
      audV3Atualizar_(FORMALIZACAO_REUNIAO.aba, 'ID_FORMALIZACAO', id, { ID_CLIENTE: formalizacao.ID_CLIENTE, ATUALIZADO_EM: new Date() });
    }
  }
  if (!String(formalizacao.ID_CLIENTE || '').trim()) throw new Error('Selecione o cliente na formalização, salve novamente e tente compartilhar.');
  const cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', formalizacao.ID_CLIENTE);
  if (!cliente) throw new Error('O cliente desta formalização não foi encontrado.');
  const resultado = audV3ParseJson_(String(formalizacao.RESULTADO_JSON), 'O conteúdo da formalização não contém um JSON válido.');
  const interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', formalizacao.ID_INTERACAO) || {};
  const espaco = String(audV3Configuracao_(PUBLICACAO_COMUNIDADE.prefixoEspaco + formalizacao.ID_CLIENTE) || '').trim() || ('Feed ' + String(cliente.NOME_CLIENTE || '').trim());
  return { formalizacao: formalizacao, cliente: cliente, resultado: resultado, interacao: interacao, espaco: espaco };
}

function comunidadeMontarPublicacaoFormalizacao_(formalizacao, cliente, resultado, interacao) {
  const meta = resultado.metadados || {};
  const tituloBase = String((resultado.publicacao_circle || {}).titulo || meta.titulo || formalizacao.TITULO || 'Formalização de reunião').trim();
  const nomeCliente = String(cliente.NOME_CLIENTE || meta.cliente || 'Cliente').trim();
  const titulo = '[' + nomeCliente + ' + VOLUM] ' + tituloBase;
  const resumoBase = String((resultado.publicacao_circle || {}).resumo || resultado.resumo_reuniao || 'Resumo e próximos passos da reunião.').trim();
  const resumo = typeof formalMontarResumoCircleComPontos_ === 'function'
    ? formalMontarResumoCircleComPontos_(resumoBase, resultado.resumo_reuniao, resultado.assuntos_discutidos)
    : resumoBase;
  const dataReuniao = comunidadeFormatarDataFormalizacao_(meta.data || formalizacao.DATA_REUNIAO);
  const rotuloReuniao = comunidadeRotuloReuniao_(formalizacao, resultado);
  const linkGravacao = String((interacao || {}).URL_GRAVACAO || (interacao || {}).LINK_ORIGINAL || '').trim();
  const linhas = [];
  linhas.push('Boa tarde pessoal, espero que estejam bem.');
  linhas.push('');
  linhas.push('No dia ' + (dataReuniao || 'informado na agenda') + ', tivemos nossa reunião ' + rotuloReuniao + '.');
  linhas.push('');
  linhas.push(linkGravacao
    ? 'Aqui está a gravação da reunião: »[AQUI](' + linkGravacao + ')«'
    : 'A gravação desta reunião ainda não está disponível no Board.');
  linhas.push('');
  linhas.push('**Resumo**');
  linhas.push(String(resultado.resumo_reuniao || 'Não informado.'));
  comunidadeAdicionarListaFormal_(linhas, '**Assuntos discutidos**', resultado.assuntos_discutidos, function(item) {
    return String(item.assunto || 'Assunto') + ': ' + String(item.detalhamento || '');
  });
  comunidadeAdicionarListaFormal_(linhas, '**Highlights**', resultado.highlights);
  comunidadeAdicionarListaFormal_(linhas, '**Necessidades identificadas**', resultado.necessidades_identificadas, function(item) {
    return String(item.necessidade || '') + (item.contexto ? '. ' + String(item.contexto) : '') + (item.prioridade ? ' [' + String(item.prioridade) + ']' : '');
  });
  comunidadeAdicionarListaFormal_(linhas, '**Decisões tomadas**', resultado.decisoes_tomadas);
  comunidadeAdicionarListaFormal_(linhas, '**Ajustes operacionais**', resultado.ajustes_operacionais, function(item) {
    return String(item.o_que_fazer || item.comportamento || '') +
      (item.como_executar ? '. Como executar: ' + String(item.como_executar) : '') +
      (item.frequencia ? '. Frequência: ' + String(item.frequencia) : '') +
      (item.indicador ? '. Indicador: ' + String(item.indicador) : '');
  });
  comunidadeAdicionarListaFormal_(linhas, '**Próximos passos**', resultado.proximos_passos, function(item) {
    return String(item.acao || '') + ' | Responsável: ' + String(item.responsavel || 'Não definido na reunião') + ' | Prazo: ' + String(item.prazo || 'Não definido na reunião');
  });
  comunidadeAdicionarListaFormal_(linhas, '**Pendências**', resultado.pendencias);
  const intervencao = resultado.proxima_intervencao || {};
  if (intervencao.foco) {
    linhas.push('');
    linhas.push('**Próxima intervenção**');
    linhas.push('• ' + String(intervencao.foco) + (intervencao.motivo ? '. ' + String(intervencao.motivo) : '') + (intervencao.quando_revisar ? '. Revisar: ' + String(intervencao.quando_revisar) : ''));
  }
  linhas.push('');
  linhas.push('Esta formalização foi gerada a partir da transcrição e revisada antes da publicação.');
  return {
    titulo: comunidadeRestaurarAcentosPtBr_(comunidadeRemoverTravoes_(titulo)),
    resumo: comunidadeRestaurarAcentosPtBr_(comunidadeRemoverTravoes_(resumo)),
    conteudo: comunidadeRestaurarAcentosPtBr_(comunidadeRemoverTravoes_(linhas.join('\n')))
  };
}

function comunidadeRestaurarAcentosPtBr_(texto) {
  const mapa = {
    'analise': 'análise', 'analises': 'análises', 'otimizacao': 'otimização',
    'operacao': 'operação', 'operacoes': 'operações', 'reuniao': 'reunião',
    'reunioes': 'reuniões', 'proximo': 'próximo', 'proximos': 'próximos',
    'proxima': 'próxima', 'proximas': 'próximas', 'acao': 'ação', 'acoes': 'ações',
    'parametro': 'parâmetro', 'parametros': 'parâmetros', 'necessario': 'necessário',
    'necessaria': 'necessária', 'necessarios': 'necessários', 'necessarias': 'necessárias',
    'diagnostico': 'diagnóstico', 'apresentacao': 'apresentação', 'solucao': 'solução',
    'solucoes': 'soluções', 'aderencia': 'aderência', 'objecao': 'objeção',
    'objecoes': 'objeções', 'conversao': 'conversão', 'qualificacao': 'qualificação',
    'decisao': 'decisão', 'decisoes': 'decisões', 'responsavel': 'responsável',
    'responsaveis': 'responsáveis', 'frequencia': 'frequência', 'recomendacao': 'recomendação',
    'recomendacoes': 'recomendações', 'evidencia': 'evidência', 'evidencias': 'evidências',
    'correcao': 'correção', 'correcoes': 'correções', 'publicacao': 'publicação',
    'execucao': 'execução', 'implicacao': 'implicação', 'conclusao': 'conclusão',
    'validacao': 'validação', 'motivacao': 'motivação', 'informacao': 'informação',
    'informacoes': 'informações', 'metrica': 'métrica', 'metricas': 'métricas'
  };
  const restaurarTrecho = function(trecho) {
    return String(trecho || '').replace(/\b[A-Za-z]+\b/g, function(palavra) {
      const corrigida = mapa[palavra.toLowerCase()];
      if (!corrigida) return palavra;
      if (palavra === palavra.toUpperCase()) return corrigida.toUpperCase();
      if (palavra.charAt(0) === palavra.charAt(0).toUpperCase()) {
        return corrigida.charAt(0).toUpperCase() + corrigida.slice(1);
      }
      return corrigida;
    });
  };
  return String(texto || '').split(/(https?:\/\/[^\s)]+)/g).map(function(parte) {
    return /^https?:\/\//i.test(parte) ? parte : restaurarTrecho(parte);
  }).join('');
}

function comunidadeFormatarDataFormalizacao_(valor) {
  if (!valor) return '';
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, APP.timezone, 'dd/MM/yyyy');
  }
  const texto = String(valor || '').trim();
  const brasileira = texto.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (brasileira) return brasileira[1];
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  const data = new Date(texto);
  return isNaN(data.getTime()) ? texto : Utilities.formatDate(data, APP.timezone, 'dd/MM/yyyy');
}

function comunidadeRotuloReuniao_(formalizacao, resultado) {
  const meta = (resultado || {}).metadados || {};
  const tipo = String((resultado || {}).tipo_reuniao || formalizacao.TIPO_REUNIAO || 'Operacional').trim();
  const contexto = comunidadeNormalizarIdentificador_([
    formalizacao.TITULO,
    tipo,
    meta.funcao,
    meta.funcao_auditada,
    meta.area,
    meta.equipe
  ].filter(Boolean).join(' '));
  const tipoFormatado = tipo.toLowerCase() === 'executiva'
    ? 'Executiva'
    : (tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase());
  if (tipoFormatado === 'Operacional' && /(^|\s)closer(\s|$)/.test(contexto)) return 'Operacional Closer';
  if (tipoFormatado === 'Operacional' && /(^|\s)sdr(\s|$)/.test(contexto)) return 'Operacional SDR';
  return tipoFormatado;
}

function comunidadeRemoverTravoes_(texto) {
  return String(texto || '')
    .replace(/\s*[—–]\s*/g, '. ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/[ \t]+\n/g, '\n');
}

function comunidadeAdicionarListaFormal_(linhas, titulo, itens, formatador) {
  if (!Array.isArray(itens) || !itens.length) return;
  linhas.push('');
  linhas.push(titulo);
  itens.forEach(function(item) {
    const texto = formatador ? formatador(item || {}) : String(item || '');
    if (String(texto).trim()) linhas.push('• ' + String(texto).trim());
  });
}
