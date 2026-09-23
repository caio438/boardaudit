/**
 * Camada multi-CRM do Board de Auditorias.
 *
 * Objetivos:
 * - manter o RD Station 100% retrocompativel;
 * - separar o motor de auditoria do provedor de CRM;
 * - armazenar o vinculo como CRM_PROVIDER + CRM_RECORD_ID;
 * - permitir preparar novos adapters sem movimentar leads ou etapas.
 *
 * Este arquivo NAO implementa automacoes do Control Center.
 */

var AUD_CRM_PROVIDERS = Object.freeze({
  RD_STATION: 'RD_STATION',
  PIPEDRIVE: 'PIPEDRIVE',
  LEADS2B: 'LEADS2B'
});

function audCrmNormalizarProvider_(valor) {
  var tipo = String(valor || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!tipo) return '';
  if (tipo === 'RD' || tipo === 'RDCRM' || tipo === 'RD_CRM' || tipo === 'RD_STATION_CRM') return AUD_CRM_PROVIDERS.RD_STATION;
  if (tipo === 'PIPE_DRIVE') return AUD_CRM_PROVIDERS.PIPEDRIVE;
  if (tipo === 'LEADS_2B' || tipo === 'LEADS_2_BE') return AUD_CRM_PROVIDERS.LEADS2B;
  return tipo;
}

function audCrmEhProviderCrm_(valor) {
  var tipo = audCrmNormalizarProvider_(valor);
  return tipo === AUD_CRM_PROVIDERS.RD_STATION ||
    tipo === AUD_CRM_PROVIDERS.PIPEDRIVE ||
    tipo === AUD_CRM_PROVIDERS.LEADS2B;
}

function audCrmNomeProvider_(valor) {
  var tipo = audCrmNormalizarProvider_(valor);
  if (tipo === AUD_CRM_PROVIDERS.RD_STATION) return 'RD Station CRM';
  if (tipo === AUD_CRM_PROVIDERS.PIPEDRIVE) return 'Pipedrive';
  if (tipo === AUD_CRM_PROVIDERS.LEADS2B) return 'Leads2b';
  return tipo || 'CRM';
}

function audCrmConfigIntegracao_(integracao) {
  var bruto = String((integracao || {}).CONFIG_JSON || '').trim();
  if (!bruto) return {};
  try {
    var config = JSON.parse(bruto);
    return config && typeof config === 'object' ? config : {};
  } catch (erro) {
    return {};
  }
}

function audCrmIntegracoesCliente_(idCliente) {
  if (!idCliente || typeof lerObjetos_ !== 'function' || !APP || !APP.sheets) return [];
  return lerObjetos_(APP.sheets.integracoesClientes)
    .filter(function(item) {
      return String(item.ID_CLIENTE || '') === String(idCliente || '') &&
        audCrmEhProviderCrm_(item.TIPO_INTEGRACAO);
    });
}

function audCrmLinkPertenceProvider_(link, provider) {
  var url = String(link || '').toLowerCase();
  var tipo = audCrmNormalizarProvider_(provider);
  if (!url) return false;
  if (tipo === AUD_CRM_PROVIDERS.RD_STATION) return url.indexOf('crm.rdstation.com') >= 0;
  if (tipo === AUD_CRM_PROVIDERS.PIPEDRIVE) return url.indexOf('pipedrive.com') >= 0;
  if (tipo === AUD_CRM_PROVIDERS.LEADS2B) return url.indexOf('leads2b') >= 0;
  return false;
}

function audCrmResolverProvider_(interacao, auditoria) {
  interacao = interacao || {};
  auditoria = auditoria || {};

  var explicito = audCrmNormalizarProvider_(interacao.CRM_PROVIDER || auditoria.CRM_PROVIDER || '');
  if (audCrmEhProviderCrm_(explicito)) return explicito;

  var link = String(interacao.LINK_CRM || '').trim();
  if (/crm\.rdstation\.com/i.test(link)) return AUD_CRM_PROVIDERS.RD_STATION;
  if (/pipedrive\.com/i.test(link)) return AUD_CRM_PROVIDERS.PIPEDRIVE;
  if (/leads2b/i.test(link)) return AUD_CRM_PROVIDERS.LEADS2B;

  var idCliente = String(auditoria.ID_CLIENTE || interacao.ID_CLIENTE || '').trim();
  var integracoes = audCrmIntegracoesCliente_(idCliente).filter(function(item) {
    return String(item.ATIVO || '').toUpperCase() === 'SIM';
  });

  if (integracoes.length === 1) return audCrmNormalizarProvider_(integracoes[0].TIPO_INTEGRACAO);

  // Retrocompatibilidade: clientes antigos podem ter RD ativo sem CRM_PROVIDER gravado.
  var rd = integracoes.find(function(item) {
    return audCrmNormalizarProvider_(item.TIPO_INTEGRACAO) === AUD_CRM_PROVIDERS.RD_STATION;
  });
  if (rd) return AUD_CRM_PROVIDERS.RD_STATION;

  return '';
}

function audCrmNormalizarRecordId_(provider, valor) {
  var tipo = audCrmNormalizarProvider_(provider);
  var texto = String(valor || '').trim();
  if (!texto) return '';

  if (tipo === AUD_CRM_PROVIDERS.RD_STATION) {
    if (typeof audRdNormalizarDeal_ === 'function') return audRdNormalizarDeal_(texto);
    var rd = texto.match(/(?:\/deals\/|^)([0-9a-f]{24})(?:\b|\/|\?|$)/i) || texto.match(/\b([0-9a-f]{24})\b/i);
    if (!rd) throw new Error('Informe o ID de 24 caracteres da negociacao do RD ou o link completo da negociacao.');
    return String(rd[1]).toLowerCase();
  }

  if (tipo === AUD_CRM_PROVIDERS.PIPEDRIVE) {
    var pipe = texto.match(/(?:\/deal\/|\/deals\/)(\d+)(?:\b|\/|\?|#|$)/i) || texto.match(/^\d+$/);
    if (!pipe) throw new Error('Informe o ID numerico do negocio no Pipedrive ou cole o link completo do negocio.');
    return String(pipe[1] || pipe[0]).trim();
  }

  if (tipo === AUD_CRM_PROVIDERS.LEADS2B) {
    if (/^https?:\/\//i.test(texto)) {
      throw new Error('Para Leads2b, informe por enquanto o ID do lead/oportunidade. O link sera tratado pelo adapter quando ativado.');
    }
    if (texto.length > 250) throw new Error('O ID informado para Leads2b e muito longo.');
    return texto;
  }

  throw new Error('CRM nao suportado pelo Board de Auditorias: ' + (tipo || 'NAO_INFORMADO'));
}

function audCrmExtrairRecordId_(interacao, provider) {
  interacao = interacao || {};
  var tipo = audCrmNormalizarProvider_(provider || interacao.CRM_PROVIDER || '');
  var explicito = String(interacao.CRM_RECORD_ID || '').trim();
  if (explicito) {
    try { return audCrmNormalizarRecordId_(tipo, explicito); }
    catch (erro) { return explicito; }
  }

  if (tipo === AUD_CRM_PROVIDERS.RD_STATION && typeof audRdDeal_ === 'function') {
    return String(audRdDeal_(interacao) || '');
  }

  var link = String(interacao.LINK_CRM || '').trim();
  if (!link) return '';
  try { return audCrmNormalizarRecordId_(tipo, link); }
  catch (erro) { return ''; }
}

function audCrmLinkPorTemplate_(template, recordId) {
  var modelo = String(template || '').trim();
  if (!modelo || !recordId) return '';
  return modelo.replace(/\{(?:id|recordId|record_id)\}/gi, encodeURIComponent(String(recordId)));
}

function audCrmMontarLink_(provider, recordId, integracao) {
  var tipo = audCrmNormalizarProvider_(provider);
  var id = String(recordId || '').trim();
  if (!id) return '';

  if (tipo === AUD_CRM_PROVIDERS.RD_STATION && typeof audV3RdLinkNegociacao_ === 'function') {
    return audV3RdLinkNegociacao_(id);
  }

  var config = audCrmConfigIntegracao_(integracao);
  return audCrmLinkPorTemplate_(
    config.recordUrlTemplate || config.dealUrlTemplate || config.opportunityUrlTemplate || '',
    id
  );
}

function audCrmVinculoEntrada_(dados, idCliente) {
  dados = dados || {};
  var bruto = String(dados.crmRecordId || dados.rdDealId || dados.linkCrm || '').trim();
  var provider = audCrmNormalizarProvider_(dados.crmProvider || '');

  if (!provider && dados.rdDealId) provider = AUD_CRM_PROVIDERS.RD_STATION;
  if (!provider && /crm\.rdstation\.com/i.test(bruto)) provider = AUD_CRM_PROVIDERS.RD_STATION;
  if (!provider && /pipedrive\.com/i.test(bruto)) provider = AUD_CRM_PROVIDERS.PIPEDRIVE;
  if (!provider && /leads2b/i.test(bruto)) provider = AUD_CRM_PROVIDERS.LEADS2B;

  if (!bruto) return { provider: provider, recordId: '', link: '' };
  if (!provider) {
    throw new Error('Selecione o CRM antes de informar o ID do lead/negociacao.');
  }

  var recordId = audCrmNormalizarRecordId_(provider, bruto);
  var integracao = typeof obterIntegracaoCliente_ === 'function' && idCliente
    ? obterIntegracaoCliente_(idCliente, provider)
    : null;
  var link = audCrmMontarLink_(provider, recordId, integracao);
  if (!link && /^https?:\/\//i.test(bruto)) link = bruto;

  return { provider: provider, recordId: recordId, link: link };
}

function audCrmEstr_() {
  if (typeof audV3GarantirColunas_ !== 'function' || typeof audV3Planilha_ !== 'function') return;
  var ss = audV3Planilha_();
  audV3GarantirColunas_(ss, 'INTERACOES', ['CRM_PROVIDER', 'CRM_RECORD_ID']);
  audV3GarantirColunas_(ss, 'AUDITORIAS', [
    'CRM_PROVIDER', 'CRM_STATUS', 'CRM_ACTIVITY_ID', 'CRM_PUBLICADO_EM', 'CRM_ERRO'
  ]);
}

function audCrmStatusAuditoria_(auditoria) {
  auditoria = auditoria || {};
  return String(auditoria.CRM_STATUS || auditoria.RD_STATUS || '').toUpperCase();
}

function audCrmAuditoriaPublicada_(auditoria) {
  return audCrmStatusAuditoria_(auditoria) === 'PUBLICADA';
}

function audCrmResultadoAutomacao_(resultado) {
  resultado = resultado || {};
  if (!resultado.aplicavel || resultado.publicada) return 'CONCLUIDA';
  if (resultado.automacaoStatus) return String(resultado.automacaoStatus);
  var provider = audCrmNormalizarProvider_(resultado.provider || '');
  var erro = String(resultado.status || '').toUpperCase() === 'ERRO';
  if (provider === AUD_CRM_PROVIDERS.RD_STATION || !provider) {
    return erro ? 'CONCLUIDA_COM_ERRO_RD' : 'CONCLUIDA_AGUARDANDO_RD';
  }
  return erro ? 'CONCLUIDA_COM_ERRO_CRM' : 'CONCLUIDA_AGUARDANDO_CRM';
}

function audCrmPublicarAutomaticamente_(idAuditoria) {
  audCrmEstr_();
  var id = String(idAuditoria || '').trim();
  var auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!auditoria) throw new Error('Auditoria nao encontrada.');
  var interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO) || {};
  var provider = audCrmResolverProvider_(interacao, auditoria);

  if (!provider) {
    return { aplicavel: false, publicada: false, provider: '', status: 'NAO_APLICAVEL', mensagem: 'Nenhum CRM foi associado a esta auditoria.' };
  }

  if (provider === AUD_CRM_PROVIDERS.RD_STATION) {
    var rd = audRdPublicarAutomaticamente_(id);
    return Object.assign({}, rd || {}, { provider: provider });
  }

  var recordId = audCrmExtrairRecordId_(interacao, provider);
  if (!recordId) {
    audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
      CRM_PROVIDER: provider,
      CRM_STATUS: 'AGUARDANDO_VINCULO',
      CRM_ACTIVITY_ID: '',
      CRM_PUBLICADO_EM: '',
      CRM_ERRO: ''
    });
    return {
      aplicavel: true,
      publicada: false,
      provider: provider,
      status: 'AGUARDANDO_VINCULO',
      mensagem: audCrmNomeProvider_(provider) + ' aguardando o ID do lead/negociacao.'
    };
  }

  var integracao = typeof obterIntegracaoCliente_ === 'function'
    ? obterIntegracaoCliente_(auditoria.ID_CLIENTE, provider)
    : null;
  var token = integracao && typeof obterSegredo_ === 'function'
    ? obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO)
    : '';

  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM' || !token) {
    audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
      CRM_PROVIDER: provider,
      CRM_STATUS: 'AGUARDANDO_INTEGRACAO',
      CRM_ACTIVITY_ID: '',
      CRM_PUBLICADO_EM: '',
      CRM_ERRO: ''
    });
    return {
      aplicavel: true,
      publicada: false,
      provider: provider,
      status: 'AGUARDANDO_INTEGRACAO',
      mensagem: audCrmNomeProvider_(provider) + ' aguardando uma integracao ativa com credencial.'
    };
  }

  // Pipedrive e Leads2b ficam preparados, mas sem escrita remota ate o adapter ser validado.
  audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
    CRM_PROVIDER: provider,
    CRM_STATUS: 'AGUARDANDO_ADAPTADOR',
    CRM_ACTIVITY_ID: '',
    CRM_PUBLICADO_EM: '',
    CRM_ERRO: ''
  });

  return {
    aplicavel: true,
    publicada: false,
    provider: provider,
    status: 'AGUARDANDO_ADAPTADOR',
    automacaoStatus: 'CONCLUIDA_AGUARDANDO_CRM',
    mensagem: 'Vinculo com ' + audCrmNomeProvider_(provider) + ' preparado. O adapter de publicacao ainda nao foi ativado; nenhuma alteracao foi feita no CRM.'
  };
}

function salvarIdCrmAuditoriaV3(dados) {
  audCrmEstr_();
  dados = dados || {};
  var id = String(dados.idAuditoria || '').trim();
  var auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!auditoria) throw new Error('Auditoria nao encontrada.');
  var interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO);
  if (!interacao) throw new Error('Interacao da auditoria nao encontrada.');

  if (audCrmAuditoriaPublicada_(auditoria)) {
    throw new Error('Esta auditoria ja foi publicada no CRM e o vinculo nao pode ser alterado por aqui.');
  }

  var provider = audCrmNormalizarProvider_(
    dados.crmProvider || audCrmResolverProvider_(interacao, auditoria)
  );
  var bruto = String(dados.crmRecordId || dados.rdDealId || dados.linkCrm || '').trim();

  if (!provider && bruto) throw new Error('Selecione o CRM antes de informar o ID do registro.');

  if (provider === AUD_CRM_PROVIDERS.RD_STATION) {
    var respostaRd = salvarIdRdAuditoriaV3({ idAuditoria: id, rdDealId: bruto });
    return Object.assign({}, respostaRd || {}, { crmProvider: provider });
  }

  var recordId = bruto ? audCrmNormalizarRecordId_(provider, bruto) : '';
  var integracao = provider && typeof obterIntegracaoCliente_ === 'function'
    ? obterIntegracaoCliente_(auditoria.ID_CLIENTE, provider)
    : null;
  var link = recordId ? audCrmMontarLink_(provider, recordId, integracao) : '';
  if (!link && recordId && /^https?:\/\//i.test(bruto)) link = bruto;

  audV3Atualizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO, {
    CRM_PROVIDER: provider,
    CRM_RECORD_ID: recordId,
    LINK_CRM: link,
    ATUALIZADO_EM: new Date()
  });
  audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
    CRM_PROVIDER: provider,
    CRM_STATUS: recordId ? 'AGUARDANDO_PUBLICACAO' : 'AGUARDANDO_VINCULO',
    CRM_ACTIVITY_ID: '',
    CRM_PUBLICADO_EM: '',
    CRM_ERRO: ''
  });

  var publicacao = null;
  if (recordId &&
      String(auditoria.STATUS || '').toUpperCase() === 'APROVADA' &&
      String(auditoria.VALIDACAO_STATUS || '').toUpperCase() === 'VALIDADA') {
    publicacao = audCrmPublicarAutomaticamente_(id);
  }

  if (typeof limparCachesDados_ === 'function') limparCachesDados_();
  return {
    sucesso: true,
    mensagem: recordId
      ? ('Vinculo com ' + audCrmNomeProvider_(provider) + ' salvo. ' + (publicacao && publicacao.mensagem ? publicacao.mensagem : ''))
      : 'Vinculo com o CRM removido.',
    publicacaoCrm: publicacao,
    auditoria: audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id)),
    auditorias: audV3ListarAuditoriasFront_()
  };
}

function prepararEnvioAuditoriaCrm(idAuditoria) {
  var auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', String(idAuditoria || '').trim());
  if (!auditoria) throw new Error('Auditoria nao encontrada.');
  var interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO) || {};
  var provider = audCrmResolverProvider_(interacao, auditoria);
  if (provider === AUD_CRM_PROVIDERS.RD_STATION) return prepararEnvioAuditoriaRd(idAuditoria);
  throw new Error('Envio manual para ' + audCrmNomeProvider_(provider) + ' ainda nao foi ativado.');
}

function enviarAuditoriaParaCrm(dados) {
  dados = dados || {};
  var auditoria = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', String(dados.idAuditoria || '').trim());
  if (!auditoria) throw new Error('Auditoria nao encontrada.');
  var interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', auditoria.ID_INTERACAO) || {};
  var provider = audCrmResolverProvider_(interacao, auditoria);
  if (provider === AUD_CRM_PROVIDERS.RD_STATION) return enviarAuditoriaParaRd(dados);
  throw new Error('Envio manual para ' + audCrmNomeProvider_(provider) + ' ainda nao foi ativado.');
}
