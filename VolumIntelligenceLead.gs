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

// O texto exibido oculta URLs, mas a classificacao preserva a existencia do link
// de gravacao (nunca seu endereco ou token assinado).
function viLeadReferenciaGravacao_(valor) {
  const texto=String(valor||'');
  const urls=texto.match(/https?:\/\/[^\s<>"']+/gi)||[];
  const contexto=/(?:gravac[aã]o|reuni[aã]o\s+gravada|recording|recap\s+da\s+reuni[aã]o|video\s+da\s+reuni[aã]o)/i.test(texto);
  const plataforma=/(?:tldv\.io|tldv\.com|grain\.com|fathom\.video|fireflies\.ai|loom\.com|zoom\.us\/rec\/|drive\.google\.com\/file\/)/i;
  return urls.some(link=>plataforma.test(link)||(contexto&&/https?:\/\//i.test(link)));
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
  return { idCliente: ids[0], idIntegracao: String(integracao.ID_INTEGRACAO), token: token };
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


/**
 * Anexos são consultados na API v2, que exige Bearer. Retornamos apenas
 * metadados necessários à auditoria; URL temporária e conteúdo ficam fora.
 */
function viLeadArquivosRd_(tokenOAuthV2, dealId) {
  const vazio={itens:[],fonte:{acessivel:false,completo:false,quantidade:0,motivo:'OAUTH_V2_NAO_CONFIGURADO'}};
  // O token de integracao legado (v1) NAO serve como OAuth2 Bearer da API v2.
  if (!tokenOAuthV2) return vazio;
  const itens=[];
  const limitePaginas=5;
  try {
    for (let pagina=1;pagina<=limitePaginas;pagina++) {
      const query='?page%5Bnumber%5D='+pagina+'&page%5Bsize%5D=100';
      const resposta=requisicaoJson_('https://api.rd.services/crm/v2/deals/'+encodeURIComponent(dealId)+'/files'+query, {
        method:'get',headers:{Accept:'application/json',Authorization:'Bearer '+tokenOAuthV2}
      });
      if (!resposta || !Array.isArray(resposta.data)) throw new Error('FORMATO_RD_V2');
      resposta.data.forEach(function(item) {
        const nome=String(item.name||'').trim().slice(0,240);
        itens.push({id:String(item.id||''),nome:nome,
          extensao:(nome.match(/\.([a-z0-9]{1,8})$/i)||[])[1]||'',
          tamanhoBytes:Math.max(0,Number(item.size)||0),data:viLeadDataIso_(item.created_at)});
      });
      const next=String((resposta.links||{}).next||'').trim();
      if (!next) return {itens:itens,fonte:{acessivel:true,completo:true,quantidade:itens.length,origem:'RD_V2_DEAL_FILES'}};
    }
    return {itens:itens,fonte:{acessivel:true,completo:false,quantidade:itens.length,motivo:'LIMITE_PAGINAS_RD_V2',origem:'RD_V2_DEAL_FILES'}};
  } catch (erro) {
    const status=String(erro&&erro.message||'').match(/\b(?:HTTP\s*)?(401|403|429)\b/);
    return {itens:itens,fonte:{acessivel:false,completo:false,quantidade:itens.length,
      motivo:status?'HTTP_'+status[1]+'_RD_V2':'FALHA_CONSULTA_RD_V2'}};
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
    temLinkGravacao: viLeadReferenciaGravacao_(item.text || item.description || item.content || ''),
    textoTruncado: String(item.text || item.description || item.content || '').length > VI_LEAD_PILOTO.limiteTexto,
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
      anotacao: viLeadTextoSeguro_(notas, incluirTextos),
      // O RD pode devolver IDs de usuario sem indicar papel comercial.
      // Preservamos apenas atribuicao explicita e NUNCA inferimos SDR/Closer do assunto.
      responsaveis: [item.user && item.user.name, item.assigned_to && item.assigned_to.name,
        item.responsible && item.responsible.name].concat(
          Array.isArray(item.users)?item.users.map(u=>u&&u.name):[]).filter(Boolean)
        .map(nome=>String(nome).slice(0,80)).filter((nome,i,arr)=>arr.indexOf(nome)===i),
      dataOriginal: String(item.date || '').trim().slice(0,10)
    };
  });
}

function viLeadInteracoesBoard_(interacoes, dealId, idCliente) {
  return (Array.isArray(interacoes) ? interacoes : []).filter(function(item) {
    return viLeadVinculoRd_(item, dealId) &&
      (!idCliente || String(item.ID_CLIENTE || '') === String(idCliente));
  }).map(function(item) {
    const funcao = String(item.FUNCAO || '').trim().toUpperCase();
    const papel = ['SDR','CLOSER'].indexOf(funcao) >= 0 ? funcao : 'NAO_COMPROVADO';
    const tipo = String(item.TIPO_INTERACAO || '').trim().toUpperCase();
    const fonte = String(item.FONTE || '').trim().toUpperCase();
    return {
      id: String(item.ID_INTERACAO || ''),
      idCliente: String(item.ID_CLIENTE || ''),
      tipo: tipo,
      fonte: fonte,
      tarefaId: String(item.ID_EXTERNO || '').replace(/^RD_TASK_/i, ''),
      data: viLeadDataIso_(item.DATA_INTERACAO),
      duracaoSegundos: Math.max(0, Number(item.DURACAO_SEGUNDOS) || 0),
      temReferenciaGravacao: Boolean(String(item.URL_GRAVACAO || '').trim()),
      funcaoDeclarada: papel,
      origemFuncao: papel === 'NAO_COMPROVADO' ? 'NAO_INFORMADA' : 'CAMPO_FUNCAO_BOARD',
      colaboradorInformado: Boolean(String(item.COLABORADOR || item.VENDEDOR || '').trim()),
      responsavelRegistrado: String(item.COLABORADOR || item.VENDEDOR || '').trim().slice(0, 90),
      transcricaoStatus: String(item.STATUS_TRANSCRICAO || '').trim().toUpperCase(),
      auditoriaStatus: String(item.STATUS_AUDITORIA || '').trim().toUpperCase(),
      textoDisponivel: false
    };
  });
}

function viLeadLigacoesBoard_(interacoes, dealId, idCliente) {
  return viLeadInteracoesBoard_(interacoes, dealId, idCliente)
    .filter(function(item) { return item.tipo === 'LIGACAO'; });
}

/**
 * Metadados da TRANSCRICOES em leitura de colunas seletivas.
 * Nao percorre CONTEUDO / CONTEUDO_NORMALIZADO: textos sensiveis e volumosos
 * ficam fora da consulta automatica do painel.
 */
function viLeadMetadadosTranscricoesBoard_(idsInteracoes) {
  const conjunto = new Set((idsInteracoes || []).map(String).filter(Boolean));
  const vazio = {porInteracao:{},fonte:{acessivel:false,completo:false,
    vinculadas:0,concluidas:0,pendentes:0,conflitos:0,origem:'TRANSCRICOES'}};
  if (!conjunto.size) return {porInteracao:{},fonte:Object.assign({},vazio.fonte,
    {acessivel:true,completo:true,origem:'SEM_INTERACOES_VINCULADAS'})};
  try {
    const aba = abrirPlanilha_().getSheetByName(APP.sheets.transcricoes);
    if (!aba) return vazio;
    const linhas = aba.getLastRow();
    if (linhas < 1) return vazio;
    const titulos = aba.getRange(1,1,1,aba.getLastColumn()).getDisplayValues()[0];
    const indice = function(nome) { return titulos.indexOf(nome) + 1; };
    if (!indice('ID_INTERACAO') || !indice('STATUS') || !indice('ID_TRANSCRICAO')) return vazio;
    const n = Math.max(0, linhas-1);
    const nomes = ['ID_INTERACAO','ID_TRANSCRICAO','STATUS','TAMANHO_CARACTERES'];
    const colunas = {};
    nomes.forEach(function(nome) {
      const pos = indice(nome);
      colunas[nome] = n && pos ?
        aba.getRange(2,pos,n,1).getDisplayValues().map(function(row) { return String(row[0] || ''); }) : [];
    });
    const retorno = {},repetidas = new Set();
    for (let i=0; i<n; i++) {
      const id = String(colunas.ID_INTERACAO[i] || '').trim();
      if (!conjunto.has(id)) continue;
      if (retorno[id]) {
        repetidas.add(id);
        retorno[id] = {status:'CONFLITO',temConteudo:false,referenciaConfirmada:false};
        continue;
      }
      const status = String(colunas.STATUS[i] || '').toUpperCase();
      const chars = Number(colunas.TAMANHO_CARACTERES[i]) || 0;
      retorno[id] = {
        status:status || 'NAO_INFORMADO',
        temConteudo:status === 'CONCLUIDA' && chars > 0,
        idTranscricao:String(colunas.ID_TRANSCRICAO[i] || '').trim(),
        referenciaConfirmada:Boolean(colunas.ID_TRANSCRICAO[i]),
        tamanhoCaracteres:Math.max(0,chars)
      };
    }
    const valores = Object.values(retorno);
    return {porInteracao:retorno,fonte:{
      acessivel:true,completo:true,vinculadas:valores.length,
      concluidas:valores.filter(function(x) {return x.temConteudo;}).length,
      pendentes:valores.filter(function(x) {return x.status==='PENDENTE';}).length,
      conflitos:repetidas.size,origem:'METADADOS_TRANSCRICOES'
    }};
  } catch (erro) {
    return {porInteracao:{},fonte:Object.assign({},vazio.fonte,{motivo:'FALHA_LEITURA'})};
  }
}


/**
 * Resume metadados de reunião/formalização sem retornar URL, participante,
 * conteúdo de transcrição ou resultado textual. Vínculo é estritamente por
 * ID de interação/transcrição já associado ao mesmo cliente.
 */
function viLeadResumirJornadaRows_(reunioes, formalizacoes, idsInteracoes, idsTranscricoes, idCliente) {
  const interacoes = new Set((idsInteracoes || []).map(String).filter(Boolean));
  const transcricoes = new Set((idsTranscricoes || []).map(String).filter(Boolean));
  const cliente = String(idCliente || '').trim();
  const pertence = function(item) {
    if (!item) return false;
    if (cliente && String(item.ID_CLIENTE || '').trim() && String(item.ID_CLIENTE || '').trim() !== cliente) return false;
    return interacoes.has(String(item.ID_INTERACAO || '').trim()) ||
      transcricoes.has(String(item.ID_TRANSCRICAO || '').trim());
  };
  const reunioesVinculadas = (Array.isArray(reunioes) ? reunioes : []).filter(pertence).map(function(item) {
    const resultado = String(item.RESULTADO_REUNIAO || '').trim();
    return {
      id:String(item.ID_REUNIAO || '').trim(),
      idInteracao:String(item.ID_INTERACAO || '').trim(),
      idTranscricao:String(item.ID_TRANSCRICAO || '').trim(),
      data:viLeadDataIso_(item.INICIO || item.FIM),
      status:String(item.STATUS || '').trim().toUpperCase() || 'NAO_INFORMADO',
      resultadoRegistrado:Boolean(resultado),
      gravacaoReferenciada:Boolean(String(item.GRAVACAO_URL || '').trim()),
      transcricaoReferenciada:Boolean(String(item.TRANSCRICAO_URL || item.ID_TRANSCRICAO || '').trim()),
      origem:'REUNIOES_CALENDARIO'
    };
  });
  const formalizacoesVinculadas = (Array.isArray(formalizacoes) ? formalizacoes : []).filter(pertence).map(function(item) {
    return {
      id:String(item.ID_FORMALIZACAO || item.ID || '').trim(),
      idInteracao:String(item.ID_INTERACAO || '').trim(),
      idTranscricao:String(item.ID_TRANSCRICAO || '').trim(),
      status:String(item.STATUS || '').trim().toUpperCase() || 'NAO_INFORMADO',
      origem:'FORMALIZACOES_REUNIAO'
    };
  });
  return {reunioes:reunioesVinculadas,formalizacoes:formalizacoesVinculadas,
    fonteReunioes:{acessivel:true,completo:true,origem:'REUNIOES_CALENDARIO',vinculadas:reunioesVinculadas.length,
      comResultado:reunioesVinculadas.filter(function(x){return x.resultadoRegistrado;}).length,
      comGravacao:reunioesVinculadas.filter(function(x){return x.gravacaoReferenciada;}).length,
      comTranscricaoReferenciada:reunioesVinculadas.filter(function(x){return x.transcricaoReferenciada;}).length},
    fonteFormalizacoes:{acessivel:true,completo:true,origem:'FORMALIZACOES_REUNIAO',vinculadas:formalizacoesVinculadas.length}};
}

function viLeadMetadadosJornadaBoard_(idsInteracoes, idsTranscricoes, idCliente) {
  const vazio={reunioes:[],formalizacoes:[],
    fonteReunioes:{acessivel:false,completo:false,origem:'REUNIOES_CALENDARIO',vinculadas:0},
    fonteFormalizacoes:{acessivel:false,completo:false,origem:'FORMALIZACOES_REUNIAO',vinculadas:0}};
  try {
    // As linhas são transformadas imediatamente em metadados mínimos; a função
    // não devolve textos, URLs, participantes ou RESULTADO_JSON.
    const reunioes=lerObjetos_(APP.sheets.reunioesCalendario);
    const formalizacoes=lerObjetos_(APP.sheets.formalizacoes);
    return viLeadResumirJornadaRows_(reunioes, formalizacoes, idsInteracoes, idsTranscricoes, idCliente);
  } catch (erro) {
    return vazio;
  }
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

function viLeadLinhaTempo_(atividades, tarefas, ligacoes, etapas, reunioesBoard, reunioesCalendario, formalizacoes) {
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
  (Array.isArray(reunioesBoard) ? reunioesBoard : []).forEach(r => {
    if(r.data) eventos.push({data:r.data,fonte:'BOARD_REUNIAO',tipo:'REUNIAO_REGISTRADA',ref:r.id});
  });
  (Array.isArray(reunioesCalendario) ? reunioesCalendario : []).forEach(r => {
    if(r.data) eventos.push({data:r.data,fonte:'BOARD_REUNIOES_CALENDARIO',tipo:'REUNIAO_CALENDARIO_REGISTRADA',ref:r.id});
  });
  (Array.isArray(formalizacoes) ? formalizacoes : []).forEach(f => {
    eventos.push({data:'',fonte:'BOARD_FORMALIZACOES',tipo:'FORMALIZACAO_REGISTRADA',ref:f.id});
  });
  etapas.forEach(e => { if (e.inicio) eventos.push({ data: e.inicio, fonte: 'RD_NEGOCIACAO', tipo: 'ENTRADA_ETAPA', ref: e.etapaId }); });
  return eventos.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Agente LEAD: entrada e encaminhamento inicial. O LMV informado pelo
 * formulario e provisório; validacao pelo SDR pertence ao Agente CONEXAO.
 */
function viCerebroLead_(ctx) {
  const negocio=ctx.negociacao || {};
  const cadastro=ctx.cadastro || {};
  const tarefas=Array.isArray(ctx.tarefas)?ctx.tarefas:[];
  const atividades=Array.isArray(ctx.atividades)?ctx.atividades:[];
  const ligacoes=Array.isArray(ctx.ligacoes)?ctx.ligacoes:[];
  const etapas=Array.isArray(ctx.etapas)?ctx.etapas:[];
  const fontes=ctx.fontes||{};
  const inicio=String(ctx.criadaEm||'');
  const criacao=viLeadDataMs_(inicio);
  const primeiroRegistro=(ctx.timeline||[]).find(e=>e.tipo!=='ENTRADA_ETAPA'&&e.data);
  const primeiroRegistroMs=primeiroRegistro?viLeadDataMs_(primeiroRegistro.data):null;
  const primeiraLigacao=ligacoes.filter(x=>x.data).sort((a,b)=>a.data.localeCompare(b.data))[0];
  const primeiraLigacaoMs=primeiraLigacao?viLeadDataMs_(primeiraLigacao.data):null;
  const textoInicial=atividades.filter(x=>x.data&&(criacao===null||viLeadDataMs_(x.data)>=criacao))
    .sort((a,b)=>a.data.localeCompare(b.data));
  const cad=(numero,canal,tipo)=>textoInicial.find(a=>{
    const texto=String(a.texto||'');
    const marcado=new RegExp('\\[CAD\\s*'+numero+'\\]','i').test(texto)&&canal.test(texto);
    return marcado||viCadenciaCanaisTexto_(a).includes(tipo);
  });
  const whats=cad(1,/whats/i,'WHATSAPP'),email=cad(2,/e-?mail/i,'EMAIL');
  const coberturaAtividades=fontes.atividades?.acessivel===true&&fontes.atividades?.completo===true;
  const coberturaTarefas=fontes.tarefas?.acessivel===true&&fontes.tarefas?.completo===true;
  const regra=ctx.regraLead||{};
  const campos=Array.isArray(regra.camposObrigatorios)?regra.camposObrigatorios:[];
  const campoValor=String(cadastro.lmvDeclarado||'').trim();
  const itens=[];
  function criterio(id,titulo,status,detalhe,fonte,evidencia,acao) {
    itens.push({id,titulo,status,detalhe,fonte,evidencia:evidencia||'',acao});
  }
  criterio('origem','Origem e fluxo de entrada',cadastro.origem?'INDICIO':'NAO_VERIFICAVEL',
    cadastro.origem?'Origem declarada no cadastro: '+String(cadastro.origem).slice(0,100)+'.':'Origem do formulario ainda nao recuperada.',
    'RD · cadastro',cadastro.origem?'Campo de origem presente':'','Recuperar origem, campanha e fluxo antes de aplicar regras especificas.');
  const faltantes=campos.filter(k=>!String(cadastro[k]||'').trim());
  criterio('integridade','Integridade do cadastro',campos.length?(faltantes.length?'ATENCAO':'EVIDENCIADO'):'NAO_VERIFICAVEL',
    campos.length?(faltantes.length?'Campos obrigatorios nao preenchidos: '+faltantes.join(', '):'Campos obrigatorios do processo preenchidos.'):'Campos obrigatorios do cliente ainda nao configurados.',
    'RD · cadastro / regras do cliente','','Validar campos obrigatorios para o fluxo de entrada.');
  criterio('lmv','LMV declarado (provisorio)',campoValor?'INDICIO':'NAO_VERIFICAVEL',
    campoValor?'Faturamento informado no formulario: '+campoValor+'. Nao equivale a validacao pelo SDR.':'LMV original do formulario nao foi recuperado; nao deduzir a partir de anotacoes posteriores.',
    'RD · formulario',campoValor?'Declaracao do lead':'','Validacao do LMV durante conexao/pitch pertence ao Agente CONEXAO.');
  criterio('priorizacao','Priorizacao inicial','NAO_VERIFICAVEL',
    'Sem fluxo, LMV declarado e regra vigente consolidados, nao e possivel avaliar a prioridade atribuida.',
    'RD · cadastro / metodo Wisetec','','Aplicar regras de priorizacao da origem e do LMV provisório.');
  criterio('responsavel','Responsavel pelo lead',negocio.responsavel?'EVIDENCIADO':'NAO_VERIFICAVEL',
    negocio.responsavel?'Responsavel atual identificado; atribuicao no momento de entrada nao comprovada.':'Nao foi possivel identificar responsavel pelo registro.',
    'RD · negociacao',negocio.responsavel?'Responsavel atual: '+String(negocio.responsavel).slice(0,80):'',
    'Confirmar responsavel inicial e eventuais redistribuicoes na entrada.');
  function sinalEnvio(a,tipo) {
    if(!a)return {status:coberturaAtividades?'NAO_VERIFICAVEL':'FONTE_INCOMPLETA',detalhe:'Registro de '+tipo+' nao confirmavel nesta consulta; a obrigatoriedade depende do perfil.'};
    return {status:'INDICIO',detalhe:'Registro de comunicacao localizado, sem confirmacao de autoria ou entrega.'};
  }
  const w=sinalEnvio(whats,'WhatsApp 0'),e=sinalEnvio(email,'E-mail 0');
  criterio('whatsapp0','Primeiro registro de WhatsApp',w.status,w.detalhe,'RD · atividades',whats?'Atividade '+whats.id+' · '+whats.data:'','Verificar canal, horario e autoria segundo a regra aplicavel; tarefa criada nao prova envio.');
  criterio('email0','Primeiro registro de e-mail',e.status,e.detalhe,'RD · atividades',email?'Atividade '+email.id+' · '+email.data:'','Validar destinatario e origem do envio conforme o tipo de SDR; nao inferir entrega.');
  criterio('primeiro_contato','Inicio efetivo do contato',primeiraLigacao?'INDICIO':coberturaTarefas?'NAO_VERIFICAVEL':'FONTE_INCOMPLETA',
    primeiraLigacao?'Primeira ligacao tecnica encontrada; nao prova que o cliente atendeu.':'A criacao/conclusao de tarefa nao equivale a tentativa efetiva.',
    'Board · API4COM / RD · tarefas',primeiraLigacao?'Ligacao '+primeiraLigacao.id+' · '+primeiraLigacao.data:'',
    'Conferir primeira tentativa real e horario comercial antes de medir SLA.');
  criterio('transicao','Entrada na cadencia',etapas.length?'INDICIO':'NAO_VERIFICAVEL',
    etapas.length?'Historico de etapas encontrado; nomes e gatilhos ainda exigem conciliacao com o funil.':'Sem historico suficiente para validar transicao.',
    'RD · historico de etapas','','Verificar passagem LEAD para CADENCIA e tarefas iniciais sem presumir execucao.');
  return {
    agente:'LEAD',estado:'AUDITORIA_DE_ENTRADA',indicadores:{
      criadaEm:inicio,primeiraEvidenciaEm:primeiroRegistro?.data||'',
      minutosAtePrimeiroRegistro:criacao!==null&&primeiroRegistroMs!==null&&primeiroRegistroMs>=criacao?
        Math.round((primeiroRegistroMs-criacao)/60000):null,
      primeiraLigacaoEm:primeiraLigacao?.data||'',
      minutosAtePrimeiraLigacao:criacao!==null&&primeiraLigacaoMs!==null&&primeiraLigacaoMs>=criacao?
        Math.round((primeiraLigacaoMs-criacao)/60000):null,
      tarefasCriadas:tarefas.length,
      lmvDeclaradoStatus:campoValor?'PROVISORIO':'NAO_RECUPERADO',
      lmvValidadoStatus:'COMPETENCIA_AGENTE_CONEXAO'
    },criterios:itens,
    limite:'Registro automatico nao prova contato. LMV do formulario e provisório; classificacao definitiva e pitch pertencem ao Agente CONEXAO.'
  };
}

/**
 * Datas de cadencia sao calculadas na hora local do CRM (Sao Paulo), nunca
 * diretamente pelo dia UTC. Ponto facultativo nao e automaticamente feriado.
 */
function viCadenciaDiaBrasil_(valor) {
  const s=String(valor||'').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt=valor instanceof Date?valor:new Date(s);
  if (!Number.isFinite(dt.getTime())) return '';
  const partes=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(dt);
  const p={};
  partes.forEach(x=>{if(x.type!=='literal')p[x.type]=x.value;});
  return p.year+'-'+p.month+'-'+p.day;
}

function viCadenciaAdicionarDias_(dia,delta) {
  const dt=new Date(dia+'T12:00:00Z');
  if(!Number.isFinite(dt.getTime()))return '';
  dt.setUTCDate(dt.getUTCDate()+delta);
  return dt.toISOString().slice(0,10);
}

function viCadenciaSextaPaixao_(ano) {
  // Algoritmo gregoriano (Meeus/Jones/Butcher), para o calendario nacional.
  const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k+7*1000)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const mes=Math.floor((h+l-7*m+114)/31),dia=(h+l-7*m+114)%31+1;
  const pascoa=ano+'-'+String(mes).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
  return viCadenciaAdicionarDias_(pascoa,-2);
}

function viCadenciaEhUtil_(dia,feriadosExtras) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return false;
  const data=new Date(dia+'T12:00:00Z');
  const sem=data.getUTCDay();
  if(sem===0||sem===6)return false;
  const md=dia.slice(5);
  if(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'].includes(md))return false;
  if(dia===viCadenciaSextaPaixao_(Number(dia.slice(0,4))))return false;
  return !(Array.isArray(feriadosExtras)&&feriadosExtras.includes(dia));
}

function viCadenciaDiasUteis_(inicio,total,feriadosExtras) {
  const a=[];
  let dia=String(inicio||'');
  for(let i=0;i<380&&a.length<total&&dia;i++){
    if(viCadenciaEhUtil_(dia,feriadosExtras))a.push(dia);
    dia=viCadenciaAdicionarDias_(dia,1);
  }
  return a;
}

function viCadenciaIntervaloDiasUteis_(diaA,diaB,feriadosExtras) {
  if(!diaA||!diaB||diaB<=diaA)return 0;
  let d=viCadenciaAdicionarDias_(diaA,1),n=0;
  for(let i=0;i<380&&d&&d<=diaB;i++,d=viCadenciaAdicionarDias_(d,1)){
    if(viCadenciaEhUtil_(d,feriadosExtras))n++;
  }
  return n;
}

function viCadenciaPadraoDia_(numero,lmv) {
  const positivo=[
    {LIGACAO:2,WHATSAPP:1},
    {LIGACAO:1,EMAIL:1,WHATSAPP:1},
    {LIGACAO:2,EMAIL:1},
    {LIGACAO:1,WHATSAPP:2},
    {EMAIL:1,WHATSAPP:2},
    {LIGACAO:1,EMAIL:1,BREAKDOWN:1}
  ];
  const negativo=[
    {WHATSAPP:1},
    {EMAIL:1,WHATSAPP:1},
    {EMAIL:1},
    {WHATSAPP:2},
    {EMAIL:1,WHATSAPP:2},
    {EMAIL:1,BREAKDOWN:1}
  ];
  if(!Number.isInteger(numero)||numero<1)return null;
  if(lmv==='POSITIVO'&&numero<=18)return Object.assign({},positivo[(numero-1)%6]);
  if(lmv==='NEGATIVO'&&numero<=6)return Object.assign({},negativo[numero-1]);
  return null;
}

/**
 * Extrai canais de anotacoes sem depender de nome CAD. Texto futuro ou negado
 * nao conta como execucao. Atividade do RD e indício; nao e prova de entrega.
 */
function viCadenciaCanaisTexto_(atividade) {
  const texto=String(atividade&&atividade.texto||'');
  if(!texto.trim())return [];
  const n=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const tipo=String(atividade.tipo||'').toLowerCase();
  const origem=String(atividade.origemClassificacao||'');
  const tipoConfiavel=origem==='CAMPO_API';
  const temVerbo=/\b(enviei|enviado|enviada|envio realizado|mandei|disparei|disparo realizado|liguei|ligacao realizada|chamada realizada|tentei ligar|tentativa de ligacao|realizamos contato|encaminhei|contactei|fizemos contato)\b/i.test(n);
  const futuro=/\b(vou enviar|vamos enviar|irei enviar|preciso enviar|a enviar|vou ligar|vamos ligar|preciso ligar|devera enviar|pretendo enviar)\b/i.test(n);
  const negado=/\b(nao enviei|nao foi enviado|nao mandei|nao liguei|sem envio|sem ligacao|nao houve contato)\b/i.test(n);
  if((futuro||negado)&&!tipoConfiavel)return [];
  // Alguns registros agregam WhatsApp 0 e email 0 na mesma atividade.
  const channels=[];
  if(tipoConfiavel&&tipo==='email')channels.push('EMAIL');
  if(tipoConfiavel&&tipo==='call')channels.push('LIGACAO');
  if(tipoConfiavel&&tipo==='messenger')channels.push('WHATSAPP');
  if(temVerbo) {
    if(/\b(whatsapp|whats|zap)\b/i.test(n))channels.push('WHATSAPP');
    if(/\b(e-?mail|correio eletronico)\b/i.test(n))channels.push('EMAIL');
    if(/\b(ligacao|liguei|chamada|telefonei|telefonema)\b/i.test(n))channels.push('LIGACAO');
  }
  return Array.from(new Set(channels));
}

function viCadenciaSinalParada_(atividades) {
  const achados=(atividades||[]).filter(a=>{
    const t=String(a.texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!t||/nao respondeu|nao atendeu|sem resposta|aguardando retorno|conexao nao realizada/.test(t))return false;
    return /\[conexao realizada\]|cliente respondeu|lead respondeu|conversa realizada|agendou reuniao|reuniao agendada|confirmou interesse/.test(t);
  }).filter(a=>a.data).sort((a,b)=>a.data.localeCompare(b.data));
  return achados.length?achados[0]:null;
}

function viCerebroCadencia_(ctx) {
  const tarefas=Array.isArray(ctx.tarefas)?ctx.tarefas:[];
  const atividades=Array.isArray(ctx.atividades)?ctx.atividades:[];
  const ligacoes=Array.isArray(ctx.ligacoes)?ctx.ligacoes:[];
  const fontes=ctx.fontes||{};
  const regra=ctx.regraCadencia||{};
  const modo=String(regra.modoSdr||'NAO_DEFINIDO').toUpperCase();
  const lmv=String(regra.lmv||'NAO_CONFIRMADO').toUpperCase();
  const escopo=String(regra.fluxo||'NAO_CONFIRMADO').toUpperCase();
  const feriados=Array.isArray(regra.feriadosExtras)?regra.feriadosExtras:[];
  const cobertura=fontes.tarefas?.completo===true&&fontes.atividades?.completo===true;
  const extra=regra.calendarioLocalConfirmado===true;
  const estiloConfirmado=['HUMANO','ROBO','HIBRIDO'].includes(modo);
  const modeloAplicavel=(modo==='HUMANO'||(modo==='HIBRIDO'&&regra.perfilHumanoConfirmado===true))&&
    escopo==='INBOUND'&&['POSITIVO','NEGATIVO'].includes(lmv);
  const canais={};
  const registros=[];
  const linksBoard=new Set(ligacoes.map(x=>String(x.tarefaId||'')).filter(Boolean));
  const closerIgnoradas=ligacoes.filter(x=>String(x.funcaoDeclarada||'').toUpperCase()==='CLOSER').length;
  ligacoes.filter(x=>x.data&&String(x.funcaoDeclarada||'').toUpperCase()!=='CLOSER').forEach(l=>{
    // O ID de tarefa ja foi vinculado aos registros do board, inclusive closer.
    registros.push({dia:viCadenciaDiaBrasil_(l.data),data:l.data,canal:'LIGACAO',
      grau:'REGISTRO_TECNICO',fonte:'BOARD_API4COM',id:String(l.id||''),
      papel:String(l.funcaoDeclarada||'NAO_COMPROVADO'),descricao:'Tentativa no sistema de telefonia; nao comprova conversa.'});
  });
  atividades.filter(x=>x.data).forEach(a=>{
    const cs=viCadenciaCanaisTexto_(a);
    cs.forEach(c=>{
      if(c==='LIGACAO'&&ligacoes.some(l=>l.data&&Math.abs(Date.parse(l.data)-Date.parse(a.data))<=5*60000))return;
      const titulo=String(a.texto||'');
      const anotacaoAutomatica=/\[(?:CAD\s*\d+|CONEXAO REALIZADA)\]/i.test(titulo)&&/\bENVIAD[OA]\b/i.test(titulo);
      registros.push({dia:viCadenciaDiaBrasil_(a.data),data:a.data,canal:c,
        grau:a.origemClassificacao==='CAMPO_API'?'REGISTRO_RD':'INDICIO_TEXTUAL',
        fonte:'RD_ATIVIDADES',id:String(a.id||''),papel:'NAO_COMPROVADO',
        automacaoPossivel:anotacaoAutomatica,
        descricao:anotacaoAutomatica?'Registro padronizado; origem automatizada a confirmar.':
          'Acao citada em atividade; conferir autoria e resultado.'});
    });
  });
  registros.sort((a,b)=>a.data.localeCompare(b.data)||a.canal.localeCompare(b.canal));
  const candidatosTarefa=tarefas.filter(t=>t.concluida&&String(t.tipo||'')==='call'&&!linksBoard.has(String(t.id||'')));
  const agendadas=tarefas.filter(t=>t.previstaPara).map(t=>({
    dia:viCadenciaDiaBrasil_(t.previstaPara),assunto:String(t.assunto||'').slice(0,110),
    concluida:t.concluida===true,id:t.id||'',criadaEm:t.criadaEm||'',
    concluidaEm:t.concluidaEm||''
  }));
  const parada=viCadenciaSinalParada_(atividades);
  const diaParada=parada?viCadenciaDiaBrasil_(parada.data):'';
  // A entrada nao confirma o SLA de inicio. O calendario e uma referencia e
  // nao vira violacao automatica quando falta LMV/versao/feriados locais.
  const entrada=viCadenciaDiaBrasil_(ctx.inicioCadenciaEm||ctx.criadaEm);
  const hoje=viCadenciaDiaBrasil_(ctx.agora||new Date());
  const ultimoRegistro=registros.length?registros[registros.length-1].dia:'';
  const limiteDias=modeloAplicavel?(lmv==='POSITIVO'?18:6):
    (ultimoRegistro?Math.min(18,Math.max(1,viCadenciaIntervaloDiasUteis_(entrada,ultimoRegistro,feriados)+
      (viCadenciaEhUtil_(entrada,feriados)?1:0))):0);
  const dias=viCadenciaDiasUteis_(entrada,limiteDias,feriados);
  const porDia={};
  registros.forEach(r=>{
    if(!r.dia)return;
    if(!porDia[r.dia])porDia[r.dia]={LIGACAO:0,WHATSAPP:0,EMAIL:0,itens:[]};
    porDia[r.dia][r.canal]=(porDia[r.dia][r.canal]||0)+1;
    porDia[r.dia].itens.push(r);
  });
  const calendario=dias.map((dia,i)=>{
    const encontrado=porDia[dia]||{LIGACAO:0,WHATSAPP:0,EMAIL:0,itens:[]};
    const esperado=modeloAplicavel?viCadenciaPadraoDia_(i+1,lmv):null;
    const suspenso=diaParada&&dia>diaParada;
    let estado='REFERENCIA_SEM_PONTUACAO';
    if(suspenso)estado='SUSPENSO_POR_CONEXAO';
    else if(dia>hoje)estado='FUTURO';
    else if(esperado){
      const incompleto=Object.keys(esperado).filter(c=>c!=='BREAKDOWN'&&encontrado[c] < esperado[c]);
      estado=incompleto.length?(cobertura?'COBERTURA_INSUFICIENTE_PARA_CONFIRMACAO':'FONTE_INCOMPLETA'):
        'INDICIOS_DE_EXECUCAO';
    }
    return {dia,numero:i+1,ciclo:Math.floor(i/6)+1,esperado,observado:{
      ligacoes:encontrado.LIGACAO,whatsapp:encontrado.WHATSAPP,email:encontrado.EMAIL
    },estado,referencias:encontrado.itens.slice(0,12).map(x=>({fonte:x.fonte,id:x.id,grau:x.grau}))};
  });
  const diasComRegistro=Object.keys(porDia).sort();
  const diasUteisComRegistro=diasComRegistro.filter(d=>viCadenciaEhUtil_(d,feriados));
  const foraDiaUtil=diasComRegistro.filter(d=>!viCadenciaEhUtil_(d,feriados));
  const gaps=[];
  diasUteisComRegistro.forEach((d,i)=>{
    if(i>0){const p=diasUteisComRegistro[i-1],intervalo=viCadenciaIntervaloDiasUteis_(p,d,feriados);
      if(intervalo>1)gaps.push({de:p,ate:d,diasUteisSemRegistro:intervalo-1});}
  });
  const criterios=[];
  function criterioCadencia(id,titulo,status,detalhe,fonte,acao,evidencia){
    criterios.push({id,titulo,status,detalhe,fonte,acao,evidencia:evidencia||''});
  }
  criterioCadencia('perfil','Tipo de operacao e regra aplicavel',modeloAplicavel?'INDICIO':'NAO_VERIFICAVEL',
    'Modo SDR: '+modo+'. Fluxo: '+escopo+'. LMV: '+lmv+
    '. A nomenclatura das tarefas nao define se o SDR e humano ou robo.',
    'Estrutura da Cadencia / cadastro do cliente',
    'Confirmar modo da operacao, origem inbound e LMV para habilitar comparacao da regua.');
  criterioCadencia('inicio','Inicio da cadencia',registros.length?'INDICIO':'NAO_VERIFICAVEL',
    'Primeiro contato registrado: '+(registros[0]?.data||'nao localizado')+
    '. A criacao de tarefas isolada nao comprova tentativa.',
    'RD / Board','Comparar inicio efetivo com SLA e horario comercial quando homologados.',
    registros[0]?.fonte||'');
  criterioCadencia('sequencia','Sequencia dos contatos',modeloAplicavel?'INDICIO':'NAO_VERIFICAVEL',
    'Dia a dia reconstituido por canal e data, sem exigir nomenclatura CAD. '+
    (modeloAplicavel?'Modelo esperado aplicado de modo preliminar.':'Nao e seguro pontuar sem perfil e LMV confirmados.'),
    'Estrutura da Cadencia / RD','Reconciliar a linha do tempo com a versao aprovada.');
  criterioCadencia('execucao','Execucao real x tarefas',ligacoes.length?'INDICIO':'NAO_VERIFICAVEL',
    (ligacoes.length-closerIgnoradas)+' chamada(s) possiveis de SDR no Board; '+candidatosTarefa.length+
    ' tarefa(s) de ligacao concluidas sem correspondencia direta no Board.',
    'Board API4COM / RD','Validar chamadas nao vinculadas; conclusao automatica nao equivale a ligacao.');
  criterioCadencia('canais','Canais utilizados',registros.length?'INDICIO':'NAO_VERIFICAVEL',
    'Registro observado: '+registros.filter(x=>x.canal==='LIGACAO').length+' ligacao(oes), '+
    registros.filter(x=>x.canal==='WHATSAPP').length+' WhatsApp e '+
    registros.filter(x=>x.canal==='EMAIL').length+' email(s). Os textos podem ser indicios, nao entregas.',
    'RD / Board','Verificar envio real, autora e destinatario nas fontes acessiveis.');
  criterioCadencia('dias_uteis','Dias uteis e horario comercial',entrada?'INDICIO':'NAO_VERIFICAVEL',
    'Calendario Brasil/Sao Paulo: '+dias.length+' dias uteis mapeados; '+
    foraDiaUtil.length+' dia(s) com registros em fim de semana ou feriado nacional. '+
    (extra?'Feriados locais configurados.':'Feriados locais e excecoes ainda nao confirmados.'),
    'Calendario nacional / RD','Validar calendario local e horario da equipe antes de declarar atraso.',
    foraDiaUtil.join(', '));
  criterioCadencia('intervalos','Intervalos entre contatos',diasUteisComRegistro.length>1?'INDICIO':'NAO_VERIFICAVEL',
    gaps.length+' intervalo(s) com ao menos um dia util sem registro de contato entre dias observados.',
    'RD / Board','Interpretar lacunas segundo a etapa, a regra aplicavel e a completude das fontes.',
    gaps.map(x=>x.de+' a '+x.ate+': '+x.diasUteisSemRegistro+' dia(s)').slice(0,5).join('; '));
  criterioCadencia('parada','Interrupcao apos resposta',parada?'INDICIO':'NAO_VERIFICAVEL',
    parada?'Registro sugere conexao em '+parada.data+
      '; contatos posteriores devem ser avaliados no contexto, nao como cadencia obrigatoria.':
      'Sem gatilho de conexao inequívoco na coleta; ausencia nao prova falta de resposta.',
    'RD · atividades','Confirmar resposta e a efetiva pausa/reclassificacao da negociacao.');
  criterioCadencia('pendencias','Tarefas pendentes e recuperacao',tarefas.length?'INDICIO':'NAO_VERIFICAVEL',
    tarefas.filter(x=>!x.concluida).length+' tarefa(s) pendente(s); '+
    agendadas.length+' com data prevista. Breakup e recuperacao exigem registro contextual.',
    'RD · tarefas','Separar tarefas vencidas, prorrogadas e suspensas; conferir proxima acao.');
  return {agente:'CADENCIA',estado:registros.length?'RECONSTRUCAO_PARCIAL':'DADOS_INSUFICIENTES',
    indicadores:{modoSdr:modo,fluxo:escopo,lmv:lmv,modelo:'ESTRUTURA_CADENCIA_INBOUND',
      inicioReferencia:entrada,calendarioFeriadosLocaisConfirmado:extra,
      diasUteisPlanejados:calendario.length,diasUteisComRegistro:diasUteisComRegistro.length,
      diasForaCalendario:foraDiaUtil,diasComLacuna:gaps.length,
      ligacoesNoBoard:ligacoes.length-closerIgnoradas,ligacoesCloserExcluidas:closerIgnoradas,
      chamadasConcluidasNoRdSemCorrespondenciaNoBoard:candidatosTarefa.length,
      tentativasCandidatasSemDuplicacao:ligacoes.length-closerIgnoradas+candidatosTarefa.length,
      diasComLigacoesNoBoard:Array.from(new Set(ligacoes.filter(l=>String(l.funcaoDeclarada||'')!=='CLOSER')
        .map(l=>viCadenciaDiaBrasil_(l.data)).filter(Boolean))).sort(),
      ligacoesComReferenciaGravacao:ligacoes.filter(l=>l.temReferenciaGravacao&&String(l.funcaoDeclarada||'')!=='CLOSER').length},
    criterios,calendario,intervalos:gaps,
    limite:'Sem regua e LMV aplicaveis, registro de canal e feriados locais, a auditoria informa evidencias mas nao certifica compliance. Dias de feriado e fim de semana sao excluidos da contagem.'};
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
  let oauthV2='';
  try { oauthV2=String(obterSegredo_('INTEGRACAO_OAUTH_V2_ACCESS_'+vinculo.idIntegracao)||''); }
  catch (erroCredencial) { oauthV2=''; }
  const arquivosRd = viLeadArquivosRd_(oauthV2, dealId);
  fontes.arquivosRd = arquivosRd.fonte;
  const boardVinculado = viLeadInteracoesBoard_(interacoes, dealId, vinculo.idCliente);
  const metadadosTranscricoes = viLeadMetadadosTranscricoesBoard_(
    boardVinculado.map(function(item) { return item.id; })
  );
  const comMetadados = boardVinculado.map(function(item) {
    const transcricao = metadadosTranscricoes.porInteracao[item.id] || {};
    return Object.assign({}, item, {
      transcricaoBoardStatus:transcricao.status || 'SEM_REGISTRO',
      transcricaoDisponivel:transcricao.temConteudo === true,
      transcricaoReferenciaConfirmada:transcricao.referenciaConfirmada === true
    });
  });
  const ligacoes = comMetadados.filter(function(x) {return x.tipo==='LIGACAO';});
  const reunioesBoard = comMetadados.filter(function(x) {return x.tipo==='REUNIAO' || x.tipo==='MEETING';});
  fontes.transcricoesBoard = metadadosTranscricoes.fonte;
  const metadadosJornada = viLeadMetadadosJornadaBoard_(
    comMetadados.map(function(item) { return item.id; }),
    Object.keys(metadadosTranscricoes.porInteracao).map(function(id) {
      const item = metadadosTranscricoes.porInteracao[id] || {};
      return String(item.idTranscricao || '');
    }).filter(Boolean),
    vinculo.idCliente
  );
  fontes.reunioesCalendarioBoard = metadadosJornada.fonteReunioes;
  fontes.formalizacoesBoard = metadadosJornada.fonteFormalizacoes;

  // A API v1 pode devolver a negociação apenas com o ID da etapa.
  // Resolver pelo endpoint oficial GET /deal_stages/{id} somente se necessário.
  const etapaIdRd = String((negociacao.deal_stage || {}).id ||
    (negociacao.deal_stage || {})._id || negociacao.deal_stage_id || '').trim();
  let nomeEtapaRd = String((negociacao.deal_stage || {}).name ||
    negociacao.deal_stage_name || '').trim();
  let origemEtapa = nomeEtapaRd ? 'DADOS_NEGOCIACAO_RD' : 'SEM_NOME';
  if (!nomeEtapaRd && /^[0-9a-f]{24}$/i.test(etapaIdRd)) {
    try {
      const etapaRetorno = viLeadRdGet_(vinculo.token, '/deal_stages/' + etapaIdRd, {});
      const etapaObj = (etapaRetorno || {}).deal_stage || etapaRetorno || {};
      const idConfirmado = String(etapaObj.id || etapaObj._id || '').toLowerCase();
      if (idConfirmado === etapaIdRd.toLowerCase() && String(etapaObj.name || '').trim()) {
        nomeEtapaRd = String(etapaObj.name).trim().slice(0, 120);
        origemEtapa = 'CONSULTA_ETAPA_RD';
      } else {
        origemEtapa = 'SEM_CONFIRMACAO_ID';
      }
    } catch (erroEtapa) {
      // Sem inferir o nome da etapa; a auditoria continua em modo parcial.
      origemEtapa = 'FALHA_CONSULTA_ETAPA';
    }
  }
  fontes.etapa = {acessivel:Boolean(nomeEtapaRd), origem:origemEtapa};

  const etapas = viLeadHistoricoEtapas_(negociacao || {});
  const timeline = viLeadLinhaTempo_(atividades, tarefas, ligacoes, etapas, reunioesBoard, metadadosJornada.reunioes, metadadosJornada.formalizacoes);
  const ctx = { atividades: atividades, tarefas: tarefas, ligacoes: ligacoes, etapas: etapas, timeline: timeline,
    criadaEm: viLeadDataIso_(negociacao.created_at),
    negociacao: { responsavel: String((negociacao.user || {}).name || '') },
    fontes: fontes, cadastro: {}, regraLead: {}, idCliente:vinculo.idCliente,
    regraCadencia: String(vinculo.idCliente)==='CLI-20260803131300-C4455D17' ?
      {modoSdr:'HUMANO',fluxo:'INBOUND_EM_VALIDACAO',lmv:'NAO_CONFIRMADO',
       fonte:'Estrutura da Cadencia V1',feriadosExtras:[],calendarioLocalConfirmado:false} : {} };

  return {
    modo: 'SOMENTE_LEITURA', versao: 'PILOTO_V2_TIPOS_ATIVIDADE', dealId: dealId, idCliente: vinculo.idCliente,
    negociacao: {
      nome: String(negociacao.name || ''), criadaEm: ctx.criadaEm,
      etapaAtualId: etapaIdRd,
      etapaAtualNome: nomeEtapaRd,
      etapaOrigem: origemEtapa,
      previsaoFechamento: String(negociacao.prediction_date || ''),
      valorInformado: Number.isFinite(Number(negociacao.amount_total)) && negociacao.amount_total !== null ? Number(negociacao.amount_total) : null,
      estadoFechamento: negociacao.win === true ? 'GANHA' : negociacao.win === false ? 'PERDIDA' : 'EM_ABERTO',
      responsavel: String((negociacao.user || {}).name || ''), historicoEtapas: etapas
    },
    fontes: Object.assign(fontes, { board: { acessivel: true,
      completo: true, interacoesVinculadas:comMetadados.length,
      ligacoesVinculadas: ligacoes.length, reunioesVinculadas:reunioesBoard.length } }),
    cerebros: [
      viCerebroLead_(ctx), viCerebroCadencia_(ctx), viCerebroConexao_(ctx),
      viCerebroAgenda_(ctx), viCerebroReuniao_(ctx)
    ],
    eventos: timeline,
    tarefas: tarefas,
    atividades: atividades,
    arquivosRd: arquivosRd.itens,
    anotacoes: atividades.filter(a => a.tipo === 'note'),
    ligacoesBoard: ligacoes,
    reunioesBoard: reunioesBoard,
    reunioesCalendarioBoard: metadadosJornada.reunioes,
    formalizacoesBoard: metadadosJornada.formalizacoes,
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

/**
 * Smoke test real de leitura RD - executar manualmente no editor do Apps Script.
 * NAO publica, altera, envia ou grava dados; imprime apenas contagens e sinais.
 * Nao registra texto de anotacoes, URLs, tokens ou IDs de contatos.
 * O codigo do piloto e da integracao deve estar presente no HEAD autenticado.
 */
function VOLUM_VALIDAR_API_WISETEC() {
  const id = '6acc888b98976f0023dc583f';
  const leitura = VOLUM_ANALISAR_LEAD(id, { incluirTextos: true });
  const notas = Array.isArray(leitura.anotacoes) ? leitura.anotacoes : [];
  const tarefas = Array.isArray(leitura.tarefas) ? leitura.tarefas : [];
  const fontes = leitura.fontes || {};
  const atividades = fontes.atividades || {};
  const sinais = {
    notaReuniaoDesmarcada: notas.filter(n => /desmarc|cancel|reagend/i.test(String(n.texto || ''))).length,
    notaNaoAtendeu: notas.filter(n => /n[aã]o atendeu|n[aã]o atende/i.test(String(n.texto || ''))).length,
    tarefaRecoveryDia1Ligacao3: tarefas.filter(t => /recovery\s*dia\s*1\s*liga(?:ç|c)[aã]o\s*3/i.test(String(t.assunto || ''))).length
  };
  const resumo = {
    modo: 'SOMENTE_LEITURA',
    sucessoConsulta: atividades.acessivel === true || (fontes.tarefas || {}).acessivel === true,
    atividadesAcessiveis: atividades.acessivel === true,
    atividadesCompletas: atividades.completo === true,
    tarefasAcessiveis: (fontes.tarefas || {}).acessivel === true,
    quantidadeAnotacoes: notas.length,
    quantidadeAnotacoesComTexto: notas.filter(n => n.textoDisponivel).length,
    quantidadeTarefas: tarefas.length,
    quantidadeTarefasConcluidas: tarefas.filter(t => t.concluida).length,
    quantidadeLigacoesBoard: (leitura.ligacoesBoard || []).length,
    sinais: sinais
  };
  console.log(JSON.stringify(resumo));
  return resumo;
}
