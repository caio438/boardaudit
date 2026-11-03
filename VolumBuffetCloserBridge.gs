/**
 * Ponte privada de evidencias RD -> Board VOLUM para o plano Closer Buffet Mais.
 * Somente leitura no RD. Nunca publica auditorias nem edita negociacoes.
 * Sem doGet/doPost publico: acesso apenas pela execucao autenticada do Apps Script.
 *
 * Entrada individual: VOLUM_RD_BUFFET_CLOSER_CONSULTAR('dealId')
 * Lote incremental: VOLUM_RD_BUFFET_CLOSER_EXPORTAR_LOTE() (repetir ate concluido)
 * Reiniciar busca: VOLUM_RD_BUFFET_CLOSER_REINICIAR()
 *
 * Saida no Board: aba VOLUM_CLOSER_RD_SNAPSHOT. Nao retornar token ou URL assinada.
 */
var VM_BM_CLOSER = Object.freeze({
  clienteId: 'CLI-20260803141041-D761F4A6',
  pipelineId: '5f0f9bb808c0c723ae8d12a6',
  etapaId: '5d3f5e31019fdc000f24043a',
  closerId: '69eead1427862e0018e09a24',
  aba: 'VOLUM_CLOSER_RD_SNAPSHOT',
  maxPaginasDeals: 10,
  porLote: 4,
  tipos: ['note', 'email', 'proposal', 'response', 'call', 'messenger'],
  cabecalho: ['CICLO_ID', 'DEAL_ID', 'NEGOCIACAO', 'STATUS_RD', 'ETAPA_RD',
    'RESPONSAVEL_RD', 'ATUALIZADO_RD', 'VALOR_TOTAL', 'PREVISAO_FECHAMENTO',
    'TAREFAS', 'NOTAS', 'EMAILS', 'PROPOSTAS', 'ARQUIVOS', 'EVIDENCIAS_JSON',
    'CONSULTADO_EM', 'STATUS_COLETA']
});

function vmBmCloserAutorizar_() {
  // No editor autenticado, so contas autorizadas da VOLUM podem ler os dados.
  viWidgetExigirEmail_(viWidgetEmailSessao_());
}

function vmBmCloserToken_() {
  var integracao = obterIntegracaoCliente_(VM_BM_CLOSER.clienteId, 'RD_STATION');
  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM') {
    throw new Error('Integracao RD Buffet Mais nao esta ativa.');
  }
  var token = obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO);
  if (!token) throw new Error('Credencial RD Buffet Mais nao encontrada no cofre do Script.');
  return { token: token, integracaoId: String(integracao.ID_INTEGRACAO) };
}

function vmBmCloserId_(valor) {
  var id = String(valor || '').trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('ID RD invalido.');
  return id;
}

function vmBmCloserDeal_(obj) {
  return obj && obj.deal ? obj.deal : obj || {};
}

function vmBmCloserElegivel_(deal) {
  var d = vmBmCloserDeal_(deal);
  var id = String(d.id || d._id || '').toLowerCase();
  var usuario = String((d.user || {}).id || (d.user || {})._id || d.user_id || '');
  var funil = String((d.deal_pipeline || {}).id || (d.deal_pipeline || {})._id ||
    (d.deal_stage || {}).deal_pipeline_id || d.deal_pipeline_id || '');
  var etapa = String((d.deal_stage || {}).id || (d.deal_stage || {})._id || d.deal_stage_id || '');
  // O estado atual da API e soberano: uma etapa nao comprova reuniao realizada.
  return /^[a-f0-9]{24}$/.test(id) &&
    usuario === VM_BM_CLOSER.closerId &&
    funil === VM_BM_CLOSER.pipelineId &&
    etapa === VM_BM_CLOSER.etapaId &&
    d.win == null && d.hold !== true && !d.closed_at;
}

function vmBmCloserListarIds_(token) {
  var ids = {}, completo = false, proxima = '';
  for (var pagina = 1; pagina <= VM_BM_CLOSER.maxPaginasDeals; pagina++) {
    var parametros = {
      deal_pipeline_id: VM_BM_CLOSER.pipelineId,
      deal_stage_id: VM_BM_CLOSER.etapaId,
      user_id: VM_BM_CLOSER.closerId,
      closed_at: 'false',
      limit: 200,
      page: pagina
    };
    if (proxima) parametros.next_page = proxima;
    var resposta = viLeadRdGet_(token, '/deals', parametros);
    var itens = Array.isArray(resposta) ? resposta :
      Array.isArray(resposta.deals) ? resposta.deals : resposta.data;
    if (!Array.isArray(itens)) throw new Error('RD nao devolveu uma lista verificavel de negociacoes.');
    itens.forEach(function(x) {
      var id = String(x.id || x._id || '').toLowerCase();
      if (/^[a-f0-9]{24}$/.test(id)) ids[id] = true;
    });
    if (resposta.has_more === false ||
        (!resposta.has_more && !resposta.next_page && itens.length < 200)) {
      completo = true;
      break;
    }
    proxima = String(resposta.next_page || '');
  }
  if (!completo) throw new Error('Lista de negociacoes RD excedeu o limite de paginacao. Nenhum ciclo iniciado.');
  return Object.keys(ids).sort();
}

function vmBmCloserTexto_(valor, limite) {
  return String(valor || '').replace(/https?:\/\/[^\s<>"']+/gi, '[LINK_OMITIDO]')
    .replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ')
    .slice(0, limite || 600);
}

function vmBmCloserAtividades_(token, dealId) {
  var r = {}, dados = {};
  VM_BM_CLOSER.tipos.forEach(function(tipo) {
    try {
      var pagina = viLeadPaginar_(token, '/activities', 'activities', dealId,
        { type: tipo }, 2);
      r[tipo] = { acessivel: true, completo: pagina.completo,
        totalLido: pagina.itens.length,
        classificacao: 'CAMPO_API_OU_FILTRO_API',
        ignoradosOutroLead: pagina.ignoradosOutroLead };
      dados[tipo] = pagina.itens.slice(-30).map(function(x) {
        return {
          id: String(x.id || x._id || ''),
          data: viLeadDataIso_(x.date || x.created_at),
          tipoPayload: String(x.type || ''),
          tipoConsultado: tipo,
          classificacaoConfirmada: !!x.type && String(x.type).toLowerCase() === tipo,
          texto: vmBmCloserTexto_(x.text || x.description || x.content, 900),
          referenciaGravacao: viLeadReferenciaGravacao_(x.text || x.description || x.content || '')
        };
      });
    } catch (erro) {
      r[tipo] = { acessivel: false, completo: false, motivo: 'FALHA_CONSULTA_RD' };
      dados[tipo] = [];
    }
  });
  return { cobertura: r, itens: dados };
}

function vmBmCloserConsulta_(dealId, integracao, board) {
  var id = vmBmCloserId_(dealId);
  var resp = viLeadRdGet_(integracao.token, '/deals/' + id, {});
  var d = vmBmCloserDeal_(resp);
  if (String(d.id || d._id || '').toLowerCase() !== id) {
    throw new Error('RD nao confirmou o ID da negociacao.');
  }
  if (!vmBmCloserElegivel_(d)) {
    return { elegivel: false, dealId: id, motivo: 'FORA_DO_FILTRO_ATUAL_RD' };
  }
  var tarefas, tarefasInfo;
  try {
    var pagina = viLeadPaginar_(integracao.token, '/tasks', 'tasks', id, {}, 3);
    tarefasInfo = { acessivel: true, completo: pagina.completo, totalLido: pagina.itens.length };
    tarefas = viLeadTarefas_(pagina.itens, true).slice(-80).map(function(t) {
      return { id: t.id, assunto: vmBmCloserTexto_(t.assunto, 180),
        criadaEm: t.criadaEm, previstaPara: t.previstaPara,
        concluida: t.concluida, concluidaEm: t.concluidaEm,
        responsaveis: t.responsaveis,
        anotacao: vmBmCloserTexto_(t.anotacao, 650),
        temReferenciaGravacao: t.temReferenciaGravacao };
    });
  } catch (e) {
    tarefasInfo = { acessivel: false, completo: false, motivo: 'FALHA_CONSULTA_RD' };
    tarefas = [];
  }
  var atividades = vmBmCloserAtividades_(integracao.token, id);
  var arquivos = { itens: [], fonte: { acessivel: false, completo: false,
    motivo: 'OAUTH_RD_V2_NAO_CONFIGURADO' } };
  var oauth = '';
  try { oauth = String(obterSegredo_('INTEGRACAO_OAUTH_V2_ACCESS_' +
    integracao.integracaoId) || ''); } catch (e) {}
  if (oauth) arquivos = viLeadArquivosRd_(oauth, id);
  var vinculadas = viLeadInteracoesBoard_(board || [], id, VM_BM_CLOSER.clienteId)
    .filter(function(x) { return x.funcaoDeclarada === 'CLOSER'; })
    .slice(-25).map(function(x) {
      return { id: x.id, fonte: x.fonte, tipo: x.tipo, data: x.data,
        temReferenciaGravacao: x.temReferenciaGravacao,
        transcricaoStatus: x.transcricaoStatus, auditoriaStatus: x.auditoriaStatus };
    });
  return {
    elegivel: true, modo: 'SOMENTE_LEITURA_RD', dealId: id, cliente: 'Buffet Mais',
    papel: 'CLOSER', coletadoEm: new Date().toISOString(),
    negociacao: {
      nome: vmBmCloserTexto_(d.name, 220),
      etapa: vmBmCloserTexto_((d.deal_stage || {}).name, 120),
      responsavel: vmBmCloserTexto_((d.user || {}).name, 120),
      atualizadoEm: viLeadDataIso_(d.updated_at),
      criadoEm: viLeadDataIso_(d.created_at),
      valorTotal: d.amount_total == null ? null : Number(d.amount_total),
      previsaoFechamento: String(d.prediction_date || ''),
      ultimaAtividade: viLeadDataIso_(d.last_activity_at),
      win: d.win, hold: d.hold
    },
    cobertura: { tarefas: tarefasInfo, atividades: atividades.cobertura,
      arquivos: arquivos.fonte, reunioesBoard: {
        acessivel: true, associadas: vinculadas.length } },
    tarefas: tarefas, atividades: atividades.itens,
    arquivos: (arquivos.itens || []).slice(-60),
    reunioesBoard: vinculadas,
    politica: 'Ausencia de registro em fonte incompleta nao comprova falha. PDF exige OAuth v2; etapa REUNIAO nao prova encontro. Sem classificacao automatica.'
  };
}

function VOLUM_RD_BUFFET_CLOSER_CONSULTAR(dealId) {
  vmBmCloserAutorizar_();
  var token = vmBmCloserToken_();
  return vmBmCloserConsulta_(dealId, token,
    lerObjetos_(APP.sheets.interacoes));
}

function vmBmCloserAba_() {
  var planilha = SpreadsheetApp.openById(APP.spreadsheetId);
  var aba = planilha.getSheetByName(VM_BM_CLOSER.aba);
  if (!aba) aba = planilha.insertSheet(VM_BM_CLOSER.aba);
  var headers = VM_BM_CLOSER.cabecalho;
  if (aba.getLastRow() < 1) {
    aba.getRange(1, 1, 1, headers.length).setValues([headers]);
    aba.setFrozenRows(1);
  } else {
    var atuais = aba.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    if (headers.some(function(nome, i) { return atuais[i] !== nome; })) {
      throw new Error('Cabecalho do snapshot diferente do contrato; nenhuma linha alterada.');
    }
  }
  return aba;
}

function vmBmCloserGravar_(aba, ciclo, result, status) {
  var d = result.negociacao || {};
  var cobertura = result.cobertura || {};
  var act = cobertura.atividades || {};
  var json = JSON.stringify(result);
  if (json.length > 44000) {
    // O campo parcial nao pode parecer evidencia completa.
    result = { elegivel: result.elegivel, dealId: result.dealId, negociacao: d,
      cobertura: cobertura, motivo: 'DADOS_SUPERAM_LIMITE_CELULA',
      evidenciasTruncadas: true };
    json = JSON.stringify(result);
    status = 'PARCIAL';
  }
  var row = [ciclo, result.dealId || '', d.nome || '', result.elegivel ? 'ONGOING' : 'FORA_DO_ESCOPO',
    d.etapa || '', d.responsavel || '', d.atualizadoEm || '', d.valorTotal == null ? '' : d.valorTotal,
    d.previsaoFechamento || '', cobertura.tarefas && cobertura.tarefas.totalLido || 0,
    act.note && act.note.totalLido || 0, act.email && act.email.totalLido || 0,
    act.proposal && act.proposal.totalLido || 0, cobertura.arquivos && cobertura.arquivos.quantidade || 0,
    json, new Date().toISOString(), status];
  var last = aba.getLastRow();
  var ids = last > 1 ? aba.getRange(2, 2, last - 1, 1).getDisplayValues() : [];
  var rowIndex = ids.findIndex(function(x) { return x[0] === row[1]; });
  if (rowIndex < 0) aba.appendRow(row);
  else aba.getRange(rowIndex + 2, 1, 1, row.length).setValues([row]);
}

/**
 * Chamar repetidamente no editor Apps Script. Cada chamada processa ate 4 IDs
 * e conserva o progresso entre chamadas, sem acionar automacoes operacionais.
 */
function VOLUM_RD_BUFFET_CLOSER_EXPORTAR_LOTE() {
  vmBmCloserAutorizar_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Outra leitura Buffet Mais esta em execucao.');
  try {
    var credencial = vmBmCloserToken_();
    var props = PropertiesService.getScriptProperties();
    var chaveIds = 'VM_BM_CLOSER_IDS', chaveCursor = 'VM_BM_CLOSER_CURSOR';
    var chaveCiclo = 'VM_BM_CLOSER_CICLO';
    var idsJson = props.getProperty(chaveIds);
    if (!idsJson) {
      var encontrados = vmBmCloserListarIds_(credencial.token);
      idsJson = JSON.stringify(encontrados);
      props.setProperties((function() {
        var s = {}; s[chaveIds] = idsJson; s[chaveCursor] = '0';
        s[chaveCiclo] = new Date().toISOString(); return s;
      })(), false);
    }
    var ids = JSON.parse(idsJson);
    var cursor = Math.max(0, Number(props.getProperty(chaveCursor)) || 0);
    var ciclo = String(props.getProperty(chaveCiclo) || '');
    var aba = vmBmCloserAba_();
    var board = lerObjetos_(APP.sheets.interacoes);
    var contagem = { ok: 0, foraDoEscopo: 0, falhas: 0 };
    var processados = [];
    for (var i = cursor; i < Math.min(cursor + VM_BM_CLOSER.porLote, ids.length); i++) {
      var id = ids[i];
      try {
        var result = vmBmCloserConsulta_(id, credencial, board);
        vmBmCloserGravar_(aba, ciclo, result, result.elegivel ? 'COLETADO' : 'FORA_ESCOPO');
        if (result.elegivel) contagem.ok++;
        else contagem.foraDoEscopo++;
      } catch (erro) {
        contagem.falhas++;
        vmBmCloserGravar_(aba, ciclo,
          { dealId: id, elegivel: false, motivo: 'FALHA_COLETA_RD' }, 'ERRO_COLETA');
      }
      processados.push(id);
      props.setProperty(chaveCursor, String(i + 1));
    }
    var novoCursor = Math.min(cursor + VM_BM_CLOSER.porLote, ids.length);
    var concluido = novoCursor >= ids.length;
    if (concluido) {
      props.setProperty('VM_BM_CLOSER_ULTIMO_CICLO_COMPLETO', ciclo);
      props.deleteProperty(chaveIds);
      props.deleteProperty(chaveCursor);
      props.deleteProperty(chaveCiclo);
    }
    return { sucesso: true, modo: 'SOMENTE_LEITURA_RD',
      cliente: 'Buffet Mais', closer: 'Vinicius Cordeiro',
      totalCandidatosRD: ids.length, processadosNestaChamada: processados.length,
      indiceProximo: novoCursor, concluido: concluido, cicloId: ciclo,
      contagem: contagem, aba: VM_BM_CLOSER.aba,
      urlPlanilha: planilhaUrlBmCloser_() };
  } finally { lock.releaseLock(); }
}

function planilhaUrlBmCloser_() {
  return 'https://docs.google.com/spreadsheets/d/' + APP.spreadsheetId + '/edit';
}

function VOLUM_RD_BUFFET_CLOSER_REINICIAR() {
  vmBmCloserAutorizar_();
  var props = PropertiesService.getScriptProperties();
  ['VM_BM_CLOSER_IDS', 'VM_BM_CLOSER_CURSOR', 'VM_BM_CLOSER_CICLO'].forEach(function(k) {
    props.deleteProperty(k);
  });
  return { sucesso: true, proximaAcao: 'VOLUM_RD_BUFFET_CLOSER_EXPORTAR_LOTE' };
}