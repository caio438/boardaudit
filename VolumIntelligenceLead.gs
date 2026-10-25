/**
 * VOLUM Intelligence - piloto de leitura sob demanda por negociacao RD.
 * Nao cria tarefas, logs, auditorias ou caches; nao publica no CRM.
 * Uso no editor autenticado do Apps Script:
 * VOLUM_ANALISAR_LEAD('6acc888b98976f0023dc583f')
 * VOLUM_ANALISAR_LEAD('6acc888b98976f0023dc583f', { incluirTextos: true })
 */
var VI_LEAD_PILOTO = Object.freeze({
  limitePaginas: 10,
  limitePaginasAtividadesPorTipo: 5,
  tamanhoPagina: 200,
  limiteTexto: 4000
});

/**
 * Valores documentados em https://developers.rdstation.com/reference/crm-v1-activities
 * O RD v1 aceita o parametro type ao listar atividades por negociacao.
 */
var VI_TIPOS_ATIVIDADE_RD = Object.freeze([
  'note', 'changelog', 'call', 'task', 'email', 'proposal', 'response',
  'messenger', 'whatsapp_audio', 'whatsapp_transcription',
  'child_deal_created', 'resource_log', 'created_from_parent_deal',
  'workflow_recursive_limit'
]);

function viLeadId_(entrada) {
  const texto = String(entrada || '').trim();
  const match = texto.match(/^(?:https:\/\/crm\.rdstation\.com\/app\/deals\/)?([0-9a-f]{24})(?:[/?#].*)?$/i);
  if (!match) throw new Error('Informe um ID de negociacao RD valido (24 caracteres hexadecimais).');
  return match[1].toLowerCase();
}

function viLeadDataMs_(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor.getTime();
  const texto = String(valor || '').trim();
  if (!texto) return null;
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  const data = br
    ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), Number(br[4] || 0), Number(br[5] || 0), Number(br[6] || 0))
    : new Date(texto);
  return isNaN(data.getTime()) ? null : data.getTime();
}

function viLeadDataIso_(valor) {
  const ms = viLeadDataMs_(valor);
  return ms === null ? '' : new Date(ms).toISOString();
}

function viLeadTextoSeguro_(valor, incluir) {
  if (!incluir) return '';
  const bruto = String(valor || '');
  // URLs podem conter tokens de gravacao da API4COM; nao devolve links assinados.
  return bruto.replace(/https?:\/\/[^\s<>"']+/gi, '[LINK_OMITIDO]').slice(0, VI_LEAD_PILOTO.limiteTexto);
}

function viLeadVinculoRd_(linha, dealId) {
  const link = String((linha || {}).LINK_CRM || '');
  return new RegExp('(?:^|/deals/)' + dealId + '(?:$|[/?#])', 'i').test(link);
}

function viLeadIntegracao_(dealId, interacoes) {
  const ids = Array.from(new Set(interacoes.filter(item => viLeadVinculoRd_(item, dealId))
    .map(item => String(item.ID_CLIENTE || '').trim()).filter(Boolean)));
  if (!ids.length) throw new Error('Negociacao ainda sem vinculo de cliente no board. Nao e seguro escolher um token RD automaticamente.');
  if (ids.length !== 1) throw new Error('Negociacao vinculada a mais de um cliente no board; resolver o vinculo antes de consultar.');
  const integracao = obterIntegracaoCliente_(ids[0], 'RD_STATION');
  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM') {
    throw new Error('Integracao RD nao esta ativa para o cliente vinculado.');
  }
  const token = obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO);
  if (!token) throw new Error('Token RD nao configurado nas propriedades protegidas do projeto.');
  return { idCliente: ids[0], token: token };
}

function viLeadRdGet_(token, caminho, filtros) {
  const parametros = Object.assign({ token: token }, filtros || {});
  const query = Object.keys(parametros)
    .filter(chave => parametros[chave] !== null && parametros[chave] !== undefined && parametros[chave] !== '')
    .map(chave => encodeURIComponent(chave) + '=' + encodeURIComponent(parametros[chave])).join('&');
  try {
    return requisicaoJson_(APP.rdBaseUrl + caminho + '?' + query, {
      method: 'get', headers: { Accept: 'application/json' }
    });
  } catch (erro) {
    // Nunca retorna URL completa (que possui token) nem corpo de erro remoto.
    const status = String(erro && erro.message || '').match(/\bHTTP\s+(\d{3})\b/);
    throw new Error('Falha em consulta somente leitura ao RD (' + (status ? 'HTTP ' + status[1] : 'rede/autorizacao') + ').');
  }
}

function viLeadPaginar_(token, caminho, campo, dealId, filtrosExtra, maxPaginas) {
  const itens = [];
  let completo = false;
  let ignoradosSemVinculo = 0;
  let ignoradosOutroLead = 0;
  const limite = Math.min(Number(maxPaginas) || VI_LEAD_PILOTO.limitePaginas, VI_LEAD_PILOTO.limitePaginas);
  for (let pagina = 1; pagina <= limite; pagina++) {
    const parametros = Object.assign({}, filtrosExtra || {}, {
      deal_id: dealId, page: pagina, limit: VI_LEAD_PILOTO.tamanhoPagina
    });
    const resposta = viLeadRdGet_(token, caminho, parametros);
    const parte = Array.isArray(resposta) ? resposta :
      (resposta && Array.isArray(resposta[campo]) ? resposta[campo] :
      (resposta && Array.isArray(resposta.data) ? resposta.data : null));
    if (!parte) throw new Error('Formato inesperado em consulta RD; lista de registros ausente.');
    parte.forEach(item => {
      const associado = String(
        item.deal_id || (item.deal || {}).id || (item.deal || {})._id || ''
      ).toLowerCase();
      if (associado === dealId) itens.push(item);
      else if (!associado) ignoradosSemVinculo++;
      else ignoradosOutroLead++;
    });
    const paginacao = (resposta && (resposta.pagination || resposta.paging || resposta.meta)) || {};
    const totalPaginas = Number(paginacao.total_pages || resposta.total_pages || 0);
    const haMais = resposta.has_more !== undefined ? Boolean(resposta.has_more) :
      (totalPaginas ? pagina < totalPaginas :
      (Boolean(resposta.next_page || paginacao.next_page || paginacao.next) ||
       parte.length >= VI_LEAD_PILOTO.tamanhoPagina));
    if (!haMais) { completo = true; break; }
  }
  return { itens: itens, completo: completo, truncado: !completo,
    ignoradosSemVinculo: ignoradosSemVinculo, ignoradosOutroLead: ignoradosOutroLead };
}

/**
 * A lista /activities da v1 documenta deal_id e text, mas nao garante
 * que o campo type esteja sempre no payload. Por isso consulta cada tipo
 * explicitamente, preserva a origem da classificacao e nao duplica IDs.
 * Maximo teorico: 14 * 5 + 10 paginas para tarefas + 1 negocio = 81 GETs
 * por execucao, abaixo do limite documentado de 120 req/min.
 */
function viLeadColetarAtividades_(token, dealId) {
  const unicas = {};
  const ordem = [];
  const porTipo = {};
  const divergencias = [];
  let completo = true;
  let interrompido = false;
  VI_TIPOS_ATIVIDADE_RD.forEach(tipoSolicitado => {
    if (interrompido) {
      porTipo[tipoSolicitado] = { acessivel: false, completo: false, motivo: 'NAO_CONSULTADO_POR_FALHA_ANTERIOR' };
      completo = false;
      return;
    }
    try {
      const pagina = viLeadPaginar_(token, '/activities', 'activities', dealId,
        { type: tipoSolicitado }, VI_LEAD_PILOTO.limitePaginasAtividadesPorTipo);
      porTipo[tipoSolicitado] = {
        acessivel: true, completo: pagina.completo, registros: pagina.itens.length,
        ignoradosSemVinculo: pagina.ignoradosSemVinculo,
        ignoradosOutroLead: pagina.ignoradosOutroLead
      };
      if (!pagina.completo) completo = false;
      pagina.itens.forEach(item => {
        const tipoDoPayload = String(item.type || '').toLowerCase();
        const declarado = tipoDoPayload || tipoSolicitado;
        const origem = tipoDoPayload ? 'CAMPO_API' : 'FILTRO_API';
        const id = String(item.id || item._id || '');
        const chave = id ? 'id:' + id : 'sem-id:' +
          String(item.date || item.created_at || '') + ':' +
          String(item.user_id || '') + ':' + String(item.text || '').slice(0, 200);
        if (!Object.prototype.hasOwnProperty.call(unicas, chave)) {
          unicas[chave] = Object.assign({}, item, {
            __viTipo: declarado, __viTipoOrigem: origem, __viTipoConsultado: tipoSolicitado
          });
          ordem.push(chave);
        } else {
          const anterior = unicas[chave];
          if (anterior.__viTipo !== declarado) {
            divergencias.push({ id: id, tipos: [anterior.__viTipo, declarado] });
            anterior.__viTipo = 'nao_confirmado';
            anterior.__viTipoOrigem = 'CONFLITO_FILTROS';
            completo = false;
          }
        }
      });
    } catch (erro) {
      completo = false;
      const m = String(erro && erro.message || '').match(/HTTP\s+(\d{3})/);
      const status = m ? m[1] : '';
      porTipo[tipoSolicitado] = {
        acessivel: false, completo: false, motivo: 'FALHA_CONSULTA',
        codigoHttp: status
      };
      if (status === '401' || status === '403' || status === '429') interrompido = true;
    }
  });
  return {
    itens: ordem.map(chave => unicas[chave]),
    completo: completo, porTipo: porTipo, divergencias: divergencias,
    totalRegistrosUnicos: ordem.length
  };
}

function viLeadAtividades_(registros, incluirTextos) {
  return registros.map(item => ({
    id: String(item.id || item._id || ''),
    dealId: String(item.deal_id || (item.deal || {}).id || ''),
    data: viLeadDataIso_(item.date || item.created_at),
    // A classificacao pode vir do campo type ou do filtro enviado ao RD.
    tipo: String(item.__viTipo || item.type || 'nao_informado').toLowerCase(),
    origemClassificacao: String(item.__viTipoOrigem || (item.type ? 'CAMPO_API' : 'NAO_CONFIRMADA')),
    autorId: String(item.user_id || ''),
    etapaId: String(item.deal_stage_id || ''),
    textoDisponivel: Boolean(String(item.text || item.description || item.content || '').trim()),
    texto: viLeadTextoSeguro_(item.text || item.description || item.content || '', incluirTextos)
  }));
}

function viLeadTarefas_(tarefas, incluirTextos) {
  return tarefas.map(item => {
    const notas = String(item.notes || item.description || '');
    const id = String(item.id || item._id || '');
    const concluiu = item.done === true || String(item.done).toLowerCase() === 'true';
    const gravacao = /https:\/\/[^\s<>"']*api4com\.com\/[^\s<>"']+/i.test(notas);
    return {
      id: id,
      tipo: String(item.type || '').toLowerCase(),
      assunto: String(item.subject || '').slice(0, 200),
      criadaEm: viLeadDataIso_(item.created_at),
      previstaPara: viLeadDataIso_(item.date),
      horaPrevista: String(item.hour || ''),
      concluida: concluiu,
      concluidaEm: viLeadDataIso_(item.done_date || item.done_at || item.completed_at),
      temAnotacao: Boolean(notas.trim()),
      temReferenciaGravacao: gravacao,
      anotacao: viLeadTextoSeguro_(notas, incluirTextos)
    };
  });
}

function viLeadLigacoesBoard_(interacoes, dealId) {
  return interacoes.filter(item => viLeadVinculoRd_(item, dealId) &&
    String(item.TIPO_INTERACAO || '').toUpperCase() === 'LIGACAO')
    .map(item => ({
      id: String(item.ID_INTERACAO || ''),
      tarefaId: String(item.ID_EXTERNO || '').replace(/^RD_TASK_/, ''),
      data: viLeadDataIso_(item.DATA_INTERACAO),
      duracaoSegundos: Number(item.DURACAO_SEGUNDOS) || 0,
      temReferenciaGravacao: Boolean(item.URL_GRAVACAO),
      transcricaoStatus: String(item.STATUS_TRANSCRICAO || ''),
      auditoriaStatus: String(item.STATUS_AUDITORIA || '')
    }));
}

function viLeadHistoricoEtapas_(negociacao) {
  return (Array.isArray(negociacao.deal_stage_histories) ? negociacao.deal_stage_histories : [])
    .map(item => {
      const inicio = viLeadDataMs_(item.start_date);
      const fim = viLeadDataMs_(item.end_date);
      return {
        etapaId: String(item.deal_stage_id || ''),
        inicio: inicio === null ? '' : new Date(inicio).toISOString(),
        fim: fim === null ? '' : new Date(fim).toISOString(),
        duracaoMinutos: inicio !== null && fim !== null && fim >= inicio
          ? Math.round((fim - inicio) / 60000) : null
      };
    }).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function viLeadLinhaTempo_(atividades, tarefas, ligacoes, etapas) {
  const eventos = [];
  atividades.forEach(a => {
    if (!a.data) return;
    const tipo = a.tipo === 'note' ? 'ANOTACAO' :
      (a.tipo === 'nao_informado' ? 'ATIVIDADE_SEM_TIPO' : 'ATIVIDADE_' + a.tipo.toUpperCase());
    eventos.push({ data: a.data, fonte: 'RD_ATIVIDADES', tipo: tipo,
      tipoRd: a.tipo, origemClassificacao: a.origemClassificacao, ref: a.id });
  });
  tarefas.forEach(t => {
    if (t.criadaEm) eventos.push({ data: t.criadaEm, fonte: 'RD_TAREFA', tipo: 'CRIACAO_TAREFA', ref: t.id });
    if (t.concluidaEm) eventos.push({ data: t.concluidaEm, fonte: 'RD_TAREFA', tipo: 'CONCLUSAO_TAREFA', ref: t.id });
  });
  ligacoes.forEach(l => { if (l.data) eventos.push({ data: l.data, fonte: 'BOARD_API4COM', tipo: 'LIGACAO_REGISTRADA', ref: l.tarefaId || l.id }); });
  etapas.forEach(e => { if (e.inicio) eventos.push({ data: e.inicio, fonte: 'RD_NEGOCIACAO', tipo: 'ENTRADA_ETAPA', ref: e.etapaId }); });
  return eventos.sort((a, b) => a.data.localeCompare(b.data));
}

function viCerebroLead_(ctx) {
  const primeiro = ctx.timeline.find(e => e.tipo !== 'ENTRADA_ETAPA');
  const criacao = viLeadDataMs_(ctx.criadaEm);
  const primeiraData = primeiro ? viLeadDataMs_(primeiro.data) : null;
  return {
    agente: 'LEAD', estado: criacao !== null && primeiraData !== null ? 'MEDICAO_PARCIAL' : 'DADOS_INSUFICIENTES',
    indicadores: {
      criadaEm: ctx.criadaEm,
      primeiraEvidenciaEm: primeiro ? primeiro.data : '',
      minutosAtePrimeiroRegistro: criacao !== null && primeiraData !== null && primeiraData >= criacao
        ? Math.round((primeiraData - criacao) / 60000) : null
    },
    limite: 'Nao equivale ao tempo ate primeiro contato: inclui anotacoes e criacao de tarefas.'
  };
}

function viCerebroCadencia_(ctx) {
  const idsGravados = new Set(ctx.ligacoes.map(l => l.tarefaId).filter(Boolean));
  const chamadasSemBoard = ctx.tarefas.filter(t => t.tipo === 'call' && t.concluida && !idsGravados.has(t.id));
  const dias = Array.from(new Set(ctx.ligacoes.map(l => l.data.slice(0, 10)).filter(Boolean))).sort();
  return {
    agente: 'CADENCIA', estado: ctx.ligacoes.length || chamadasSemBoard.length ? 'TENTATIVAS_OBSERVAVEIS' : 'DADOS_INSUFICIENTES',
    indicadores: {
      ligacoesNoBoard: ctx.ligacoes.length,
      chamadasConcluidasNoRdSemCorrespondenciaNoBoard: chamadasSemBoard.length,
      tentativasCandidatasSemDuplicacao: ctx.ligacoes.length + chamadasSemBoard.length,
      diasComLigacoesNoBoard: dias,
      ligacoesComReferenciaGravacao: ctx.ligacoes.filter(l => l.temReferenciaGravacao).length
    },
    limite: 'Nao atesta cumprimento da sequencia completa sem cadencia oficial e dados de WhatsApp/email.'
  };
}

function viCerebroConexao_(ctx) {
  return {
    agente: 'CONEXAO', estado: 'REQUER_INTERPRETACAO',
    indicadores: {
      ligacoesComDuracaoInformada: ctx.ligacoes.filter(l => l.duracaoSegundos > 0).length,
      transcricoesMarcadasConcluidas: ctx.ligacoes.filter(l => l.transcricaoStatus === 'CONCLUIDA').length,
      atividadesDoRd: ctx.atividades.length,
      anotacoesComTipoConfirmado: ctx.atividades.filter(a => a.tipo === 'note').length,
      atividadesSemTipoInformado: ctx.atividades.filter(a => a.tipo === 'nao_informado' || a.tipo === 'nao_confirmado').length,
      eventosWhatsApp: ctx.atividades.filter(a => ['messenger', 'whatsapp_audio', 'whatsapp_transcription'].includes(a.tipo)).length,
      eventosComTipoInferidoPorFiltro: ctx.atividades.filter(a => a.origemClassificacao === 'FILTRO_API').length
    },
    limite: 'Duracao ou anotacao nao comprova que houve dialogo, qualificacao ou compromisso.'
  };
}

function viCerebroAgenda_(ctx) {
  const reunioes = ctx.tarefas.filter(t => t.tipo === 'meeting');
  return {
    agente: 'AGENDA', estado: reunioes.length ? 'TAREFAS_OBSERVAVEIS' : 'DADOS_INSUFICIENTES',
    indicadores: {
      tarefasReuniao: reunioes.length,
      tarefasReuniaoConcluidas: reunioes.filter(t => t.concluida).length
    },
    limite: 'Tarefa de reuniao nao comprova convite aceito, realizacao nem passagem de bastao.'
  };
}

function viCerebroReuniao_(ctx) {
  const reunioes = ctx.tarefas.filter(t => t.tipo === 'meeting');
  return {
    agente: 'REUNIAO', estado: reunioes.length ? 'REQUER_TRANSCRICAO_E_PLAYBOOK' : 'DADOS_INSUFICIENTES',
    indicadores: { tarefasReuniao: reunioes.length, atividadesDoRd: ctx.atividades.length },
    limite: 'Nao audita pitch, proposta, fechamento ou follow-up sem documentos e regras do cliente.'
  };
}

/**
 * Diagnostico read-only. A primeira versao mede disponibilidade e confiabilidade
 * de evidencias; nunca atribui score de compliance nem cria jobs.
 * Requer que o deal ja esteja vinculado a um unico cliente nas INTERACOES do board.
 */
function VOLUM_ANALISAR_LEAD(entrada, opcoes) {
  const dealId = viLeadId_(entrada);
  const incluirTextos = Boolean(opcoes && opcoes.incluirTextos === true);
  const interacoes = lerObjetos_(APP.sheets.interacoes);
  const vinculo = viLeadIntegracao_(dealId, interacoes);

  const bruto = viLeadRdGet_(vinculo.token, '/deals/' + dealId, {});
  const negociacao = bruto && bruto.deal ? bruto.deal : bruto;
  if (String((negociacao || {}).id || negociacao._id || '').toLowerCase() !== dealId) {
    throw new Error('RD nao confirmou a identidade da negociacao solicitada.');
  }

  const fontes = {};
  let tarefasBrutas = [], atividadesBrutas = [];
  try {
    const resposta = viLeadPaginar_(vinculo.token, '/tasks', 'tasks', dealId);
    tarefasBrutas = resposta.itens;
    fontes.tarefas = { acessivel: true, completo: resposta.completo, quantidade: tarefasBrutas.length };
  } catch (e) {
    fontes.tarefas = { acessivel: false, completo: false, motivo: 'FALHA_CONSULTA' };
  }
  const atividadesLidas = viLeadColetarAtividades_(vinculo.token, dealId);
  atividadesBrutas = atividadesLidas.itens;
  fontes.atividades = {
    acessivel: Object.values(atividadesLidas.porTipo).some(t => t.acessivel),
    completo: atividadesLidas.completo,
    quantidade: atividadesBrutas.length,
    porTipo: atividadesLidas.porTipo,
    conflitosDeTipo: atividadesLidas.divergencias.length
  };

  const atividades = viLeadAtividades_(atividadesBrutas, incluirTextos);
  const tarefas = viLeadTarefas_(tarefasBrutas, incluirTextos);
  const ligacoes = viLeadLigacoesBoard_(interacoes, dealId);
  const etapas = viLeadHistoricoEtapas_(negociacao || {});
  const timeline = viLeadLinhaTempo_(atividades, tarefas, ligacoes, etapas);
  const ctx = { atividades: atividades, tarefas: tarefas, ligacoes: ligacoes, etapas: etapas, timeline: timeline,
    criadaEm: viLeadDataIso_(negociacao.created_at) };

  return {
    modo: 'SOMENTE_LEITURA', versao: 'PILOTO_V2_TIPOS_ATIVIDADE', dealId: dealId, idCliente: vinculo.idCliente,
    negociacao: {
      nome: String(negociacao.name || ''), criadaEm: ctx.criadaEm,
      etapaAtualId: String((negociacao.deal_stage || {}).id || negociacao.deal_stage_id || ''),
      responsavel: String((negociacao.user || {}).name || ''), historicoEtapas: etapas
    },
    fontes: Object.assign(fontes, { board: { acessivel: true, ligacoesVinculadas: ligacoes.length } }),
    cerebros: [
      viCerebroLead_(ctx), viCerebroCadencia_(ctx), viCerebroConexao_(ctx),
      viCerebroAgenda_(ctx), viCerebroReuniao_(ctx)
    ],
    eventos: timeline,
    tarefas: tarefas,
    atividades: atividades,
    anotacoes: atividades.filter(a => a.tipo === 'note'),
    ligacoesBoard: ligacoes,
    advertencias: [
      'Dados consultados sob demanda, sem persistencia nem alteracao no CRM.',
      'Ausencia de evidencias nao significa que a atividade nao aconteceu.',
      'Nao aplicar compliance de outros clientes: regras Wisetec ainda nao homologadas para este piloto.',
      'Tipos de eventos extraidos por filtro podem nao estar no payload: origemClassificacao indica o nivel de evidencia.',
      'Eventos de atividade e tarefas podem descrever o mesmo fato; nao somar eventos de canais diferentes sem reconciliacao.'
    ]
  };
}

/**
 * Prova de leitura da linha do tempo, restrita ao caso-piloto.
 * Recupera textos somente dentro do Apps Script para identificar evidencias.
 * NENHUMA anotacao, contato, nome, gravação ou token retorna ao runner publico.
 */
function viLeadResumoPrivado_(resultado) {
  const atividades = Array.isArray(resultado.atividades) ? resultado.atividades : [];
  const tarefas = Array.isArray(resultado.tarefas) ? resultado.tarefas : [];
  const chamadas = Array.isArray(resultado.ligacoesBoard) ? resultado.ligacoesBoard : [];
  const eventos = Array.isArray(resultado.eventos) ? resultado.eventos : [];
  const somenteNotas = atividades.filter(a => a.tipo === 'note');
  const tem = (texto, re) => re.test(String(texto || ''));
  const provas = {
    desmarcouOuCancelouReuniao: somenteNotas.filter(a =>
      tem(a.texto, /\b(?:desmarc|cancel|desistiu da reuni[aã]o|n[aã]o poder[aá] participar|reagend)/i)
    ).map(a => ({ data: a.data, origem: a.origemClassificacao })).slice(0, 20),
    anotouNaoAtendeu: somenteNotas.filter(a =>
      tem(a.texto, /\bn[aã]o (?:atendeu|atende)|sem resposta|n[aã]o respondeu/i)
    ).map(a => ({ data: a.data, origem: a.origemClassificacao })).slice(0, 20),
    recoveryDia1Ligacao3: tarefas.filter(t =>
      tem(t.assunto, /recovery\s*dia\s*1\s*liga(?:ç|c)[aã]o\s*3/i)
    ).map(t => ({ data: t.concluidaEm || t.previstaPara, concluida: t.concluida })).slice(0, 20)
  };
  const tipagem = {};
  atividades.forEach(item => { tipagem[item.tipo] = (tipagem[item.tipo] || 0) + 1; });
  const tarefaConclusao = tarefas.filter(t => t.concluida).length;
  const fonteAtividades = resultado.fontes && resultado.fontes.atividades || {};
  const cobertura = {};
  Object.keys(fonteAtividades.porTipo || {}).forEach(tipo => {
    const p = fonteAtividades.porTipo[tipo] || {};
    cobertura[tipo] = {
      acessivel: p.acessivel === true, completo: p.completo === true,
      registros: Number(p.registros || 0), motivo: String(p.motivo || ''),
      codigoHttp: String(p.codigoHttp || ''),
      ignoradosSemVinculo: Number(p.ignoradosSemVinculo || 0)
    };
  });
  return {
    sucesso: true, modo: 'PREVIEW_SEM_PUBLICACAO', somenteLeitura: true,
    versao: String(resultado.versao || ''),
    // O ID/cliente nao precisa sair da aplicacao no comando do GitHub.
    fontes: {
      tarefas: resultado.fontes && resultado.fontes.tarefas || {},
      atividades: {
        acessivel: fonteAtividades.acessivel === true,
        completo: fonteAtividades.completo === true,
        conflitosDeTipo: Number(fonteAtividades.conflitosDeTipo || 0),
        porTipo: cobertura
      },
      board: { ligacoesVinculadas: chamadas.length }
    },
    quantidades: {
      atividades: atividades.length,
      anotacoes: somenteNotas.length,
      tarefas: tarefas.length,
      tarefasConcluidas: tarefaConclusao,
      chamadasNoBoard: chamadas.length,
      eventosLinhaTempo: eventos.length,
      historicoEtapas: (resultado.negociacao && resultado.negociacao.historicoEtapas || []).length
    },
    tiposAtividade: tipagem,
    sinais: {
      anotacaoCancelamentoOuReagendamento: provas.desmarcouOuCancelouReuniao,
      anotacaoNaoAtendeu: provas.anotouNaoAtendeu,
      tarefaRecoveryDia1Ligacao3: provas.recoveryDia1Ligacao3
    },
    // Metadados de eventos e datas, nunca o texto real das anotacoes.
    linhaTempoAmostra: eventos.slice(-25).map(e => ({
      data: e.data, fonte: e.fonte, tipo: e.tipo
    })),
    observacao: 'Conteudo comercial foi analisado apenas em memoria. Nenhuma anotacao foi devolvida ao GitHub.'
  };
}

function VOLUM_PREVIEW_LEAD_PRIVADO(entrada) {
  const id = viLeadId_(entrada);
  if (id !== '6acc888b98976f0023dc583f') {
    throw new Error('Piloto restrito a negociacao Beaga Calçados; ID nao autorizado.');
  }
  const resultado = VOLUM_ANALISAR_LEAD(id, { incluirTextos: true });
  if (resultado.modo !== 'SOMENTE_LEITURA') {
    throw new Error('Modo de coleta invalido: operacao interrompida.');
  }
  return viLeadResumoPrivado_(resultado);
}
