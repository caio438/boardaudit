/**
 * VOLUM RD multiempresa: consulta de evidencias por negociacao, SOMENTE LEITURA.
 * O token e sempre obtido pelo ID_CLIENTE da integracao protegida no Board.
 * Nenhuma credencial passa por parametros, logs, planilhas ou respostas.
 * Contrato inicial: Closer, etapa(s) mapeada(s), negociacoes em andamento.
 *
 * Uma empresa nova precisa de cadastro, integracao RD ativa e escopo em
 * INTEGRACOES_CLIENTES.CONFIG_JSON, por exemplo:
 * {"modo":"RESUMIDO_DIARIO","auditoriaVOLUM":{
 *   "pipelineId":"aaaaaaaaaaaaaaaaaaaaaaaa",
 *   "closerUserIds":["bbbbbbbbbbbbbbbbbbbbbbbb"],
 *   "closerStageIds":["cccccccccccccccccccccccc"]
 * }}
 * A configuracao e por cliente. NUNCA reaproveitar token, funil ou responsavel
 * de outra empresa, mesmo quando pertencem ao mesmo grupo empresarial.
 *
 * Operacoes no editor autenticado do Apps Script:
 *  VOLUM_RD_CONTAS_DISPONIVEIS()
 *  VOLUM_RD_CLIENTE_CONSULTAR('CLI-...', 'dealId')
 *  VOLUM_RD_CLIENTE_EXPORTAR_LOTE('CLI-...')
 *  VOLUM_RD_CLIENTE_REINICIAR('CLI-...')
 */
var VM_RD_MULTI = Object.freeze({
  permitidas: Object.freeze([
    'BUFFET MAIS','ASSINE MAIS','BLUERTEC','DALIA HEALTH','GESTAO FESTA',
    'GOPLIANCE','INGEE','SEMEIO CBI','SINERGIA','SIPTALK'
  ]),
  excluidas: Object.freeze(['WISETEC','IT WORKS','MAQUINACODE','CONVERTA']),
  aba: 'VOLUM_RD_MULTI_SNAPSHOT',
  maxPaginasDeals: 8, maxIdsCiclo: 200, porLote: 3,
  colunas: [
    'CICLO_ID','ID_CLIENTE','CLIENTE','DEAL_ID','NEGOCIACAO','STATUS_COLETA',
    'ATUALIZADO_RD','VALOR','TAREFAS','ANOTACOES','EMAILS','PROPOSTAS',
    'EVIDENCIAS_JSON','COLETADO_EM'
  ]
});

function vmRdMultiNorm_(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}

function vmRdMultiCliente_(idCliente) {
  var id = String(idCliente || '').trim();
  var c = lerObjetos_(APP.sheets.clientes).find(function(x) {
    return String(x.ID_CLIENTE || '') === id;
  });
  if (!c) throw new Error('Cliente nao registrado no Board.');
  var nome = vmRdMultiNorm_(c.NOME_CLIENTE);
  if (VM_RD_MULTI.permitidas.indexOf(nome) < 0) {
    throw new Error('Conta fora do escopo autorizado da trilha RD VOLUM.');
  }
  if (String(c.STATUS || 'ATIVO').toUpperCase() !== 'ATIVO') {
    throw new Error('Cliente esta inativo.');
  }
  return { id: id, nome: String(c.NOME_CLIENTE || '').trim(), normalizado: nome };
}

function vmRdMultiIntegracao_(cliente) {
  var i = obterIntegracaoCliente_(cliente.id, 'RD_STATION');
  if (!i || String(i.ATIVO || '').toUpperCase() !== 'SIM') {
    throw new Error('Integracao RD nao ativa para esta empresa.');
  }
  var token = obterSegredo_('INTEGRACAO_TOKEN_' + i.ID_INTEGRACAO);
  if (!token) throw new Error('Token RD ausente para esta empresa.');
  var config = {};
  try { config = JSON.parse(i.CONFIG_JSON || '{}'); } catch (e) {
    throw new Error('Configuracao RD invalida para esta empresa.');
  }
  return { token: token, id: i.ID_INTEGRACAO, config: config };
}

function vmRdMultiEscopo_(cliente, integracao) {
  var c = integracao.config || {};
  var s = c.auditoriaVOLUM || c.auditoriaRd || {};
  var fallback = cliente.normalizado === 'BUFFET MAIS' ? {
    pipelineId: '5f0f9bb808c0c723ae8d12a6',
    closerUserIds: ['69eead1427862e0018e09a24'],
    closerStageIds: ['5d3f5e31019fdc000f24043a']
  } : {};
  var id = function(x) { return String(x || '').trim().toLowerCase(); };
  var lista = function(x) {
    return (Array.isArray(x) ? x : []).map(id).filter(function(v) {
      return /^[a-f0-9]{24}$/.test(v);
    }).slice(0,5);
  };
  var pipelineId = id(s.pipelineId || fallback.pipelineId);
  var closerUserIds = lista(s.closerUserIds || fallback.closerUserIds);
  var closerStageIds = lista(s.closerStageIds || fallback.closerStageIds);
  if (!/^[a-f0-9]{24}$/.test(pipelineId) ||
      !closerUserIds.length || !closerStageIds.length) {
    throw new Error('Escopo de funil, closer e etapas nao configurado para esta empresa.');
  }
  return { pipelineId: pipelineId, closerUserIds: closerUserIds,
    closerStageIds: closerStageIds };
}

function vmRdMultiElegivel_(deal, escopo) {
  var d = deal && deal.deal || deal || {};
  var u = String((d.user||{}).id || (d.user||{})._id || d.user_id || '').toLowerCase();
  var p = String((d.deal_pipeline||{}).id || d.deal_pipeline_id ||
    (d.deal_stage||{}).deal_pipeline_id || '').toLowerCase();
  var s = String((d.deal_stage||{}).id || d.deal_stage_id || '').toLowerCase();
  var estado = String(d.status || '').toLowerCase();
  return d.win == null && !d.closed_at && d.hold !== true &&
    ['won','lost','paused','ganha','perdida'].indexOf(estado) < 0 &&
    p === escopo.pipelineId &&
    escopo.closerUserIds.indexOf(u) >= 0 &&
    escopo.closerStageIds.indexOf(s) >= 0;
}

function VOLUM_RD_CONTAS_DISPONIVEIS() {
  vmBmCloserAutorizar_();
  var rows = lerObjetos_(APP.sheets.clientes);
  var contas = VM_RD_MULTI.permitidas.map(function(nome) {
    var c = rows.find(function(r) {
      return vmRdMultiNorm_(r.NOME_CLIENTE) === nome;
    });
    if (!c) return {nome:nome,cadastrada:false,rdAtivo:false,
      credencialRegistrada:false,escopoConfigurado:false};
    var i = obterIntegracaoCliente_(c.ID_CLIENTE, 'RD_STATION');
    var conectada = !!(i && String(i.ATIVO || '').toUpperCase() === 'SIM');
    var credencial = !!(conectada && obterSegredo_('INTEGRACAO_TOKEN_' + i.ID_INTEGRACAO));
    var escopo = false;
    if (credencial) {
      try { vmRdMultiEscopo_(vmRdMultiCliente_(c.ID_CLIENTE),
        vmRdMultiIntegracao_({id:c.ID_CLIENTE})); escopo = true; } catch (e) {}
    }
    return {nome:c.NOME_CLIENTE,idCliente:c.ID_CLIENTE,cadastrada:true,
      rdAtivo:conectada,credencialRegistrada:credencial,
      escopoConfigurado:escopo};
  });
  return {modo:'SOMENTE_LEITURA',totalPermitidas:contas.length,contas:contas,
    excluidas:VM_RD_MULTI.excluidas.slice()};
}

function vmRdMultiCtx_(idCliente) {
  vmBmCloserAutorizar_();
  var cliente = vmRdMultiCliente_(idCliente);
  var integracao = vmRdMultiIntegracao_(cliente);
  return { cliente:cliente,integracao:integracao,
    escopo:vmRdMultiEscopo_(cliente,integracao) };
}

function vmRdMultiConsulta_(ctx,dealId,board) {
  var id = vmBmCloserId_(dealId);
  var bruto = viLeadRdGet_(ctx.integracao.token, '/deals/' + id, {});
  var d = bruto && bruto.deal || bruto;
  if (String(d.id || d._id || '').toLowerCase() !== id)
    throw new Error('Identidade da negociacao nao confirmada no RD.');
  if (!vmRdMultiElegivel_(d,ctx.escopo)) {
    return { elegivel:false,dealId:id,cliente:ctx.cliente.nome,
      idCliente:ctx.cliente.id,motivo:'FORA_DO_ESCOPO_ATUAL_RD' };
  }
  var tarefas=[],tarefasInfo={acessivel:false,completo:false,motivo:'NAO_CONSULTADO'};
  try {
    var pag = viLeadPaginar_(ctx.integracao.token,'/tasks','tasks',id,{},3);
    tarefasInfo = {acessivel:true,completo:pag.completo,totalLido:pag.itens.length};
    tarefas = viLeadTarefas_(pag.itens,true).slice(-60).map(function(t) {
      return {id:t.id,assunto:vmBmCloserTexto_(t.assunto,180),
        previstaPara:t.previstaPara,concluida:t.concluida,
        concluidaEm:t.concluidaEm,responsaveis:t.responsaveis,
        anotacao:vmBmCloserTexto_(t.anotacao,650)};
    });
  } catch(e) { tarefasInfo.motivo='FALHA_CONSULTA_RD'; }
  var atv = vmBmCloserAtividades_(ctx.integracao.token,id);
  var oauth = '';
  try { oauth = String(obterSegredo_('INTEGRACAO_OAUTH_V2_ACCESS_' +
    ctx.integracao.id) || ''); } catch(e) {}
  var arquivos=viLeadArquivosRd_(oauth,id);
  var vinculos=viLeadInteracoesBoard_(board || [],id,ctx.cliente.id)
    .filter(function(x) {return x.funcaoDeclarada === 'CLOSER';})
    .slice(-30).map(function(x) {
      return {id:x.id,data:x.data,tipo:x.tipo,fonte:x.fonte,
        gravacao:x.temReferenciaGravacao,transcricao:x.transcricaoStatus,
        auditoria:x.auditoriaStatus};
    });
  return {
    elegivel:true,modo:'SOMENTE_LEITURA_RD',idCliente:ctx.cliente.id,
    cliente:ctx.cliente.nome,dealId:id,consultadoEm:new Date().toISOString(),
    negociacao:{
      nome:vmBmCloserTexto_(d.name,200),
      responsavel:vmBmCloserTexto_((d.user||{}).name,90),
      etapa:vmBmCloserTexto_((d.deal_stage||{}).name,80),
      criadoEm:viLeadDataIso_(d.created_at),
      atualizadoEm:viLeadDataIso_(d.updated_at),
      valorTotal:d.amount_total == null ? null : Number(d.amount_total),
      previsaoFechamento:String(d.prediction_date || '')
    },
    fontes: {tarefas:tarefasInfo,atividades:atv.cobertura,arquivos:arquivos.fonte,
      board:{acessivel:true,reunioesVinculadas:vinculos.length}},
    tarefas:tarefas,atividades:atv.itens,
    arquivos:(arquivos.itens||[]).slice(-40),reunioesBoard:vinculos,
    regra:'Etapa nao prova reuniao. Falta de registro em fonte incompleta nao prova falha. PDFs somente com OAuth v2.'
  };
}

/**
 * Descoberta inicial por uma negociacao conhecida, sem exigir escopo previo.
 * Retorna apenas IDs e metadados necessarios para configurar o cliente.
 */
function VOLUM_RD_CLIENTE_DESCOBRIR_ESCOPO(idCliente, dealId) {
  vmBmCloserAutorizar_();
  var cliente = vmRdMultiCliente_(idCliente);
  var integracao = vmRdMultiIntegracao_(cliente);
  var id = vmBmCloserId_(dealId);
  var bruto = viLeadRdGet_(integracao.token, '/deals/' + id, {});
  var d = bruto && bruto.deal || bruto || {};
  if (String(d.id || d._id || '').toLowerCase() !== id) {
    throw new Error('Identidade da negociacao nao confirmada no RD.');
  }
  return {
    modo: 'SOMENTE_LEITURA_RD',
    cliente: cliente.nome,
    idCliente: cliente.id,
    dealId: id,
    pipelineId: String((d.deal_pipeline || {}).id || d.deal_pipeline_id || ''),
    pipelineNome: vmBmCloserTexto_((d.deal_pipeline || {}).name, 120),
    stageId: String((d.deal_stage || {}).id || d.deal_stage_id || ''),
    stageNome: vmBmCloserTexto_((d.deal_stage || {}).name, 120),
    userId: String((d.user || {}).id || d.user_id || ''),
    userNome: vmBmCloserTexto_((d.user || {}).name, 120),
    status: vmBmCloserTexto_(d.status, 40),
    win: d.win,
    hold: d.hold,
    fechadoEm: viLeadDataIso_(d.closed_at),
    consultadoEm: new Date().toISOString()
  };
}

function VOLUM_RD_CLIENTE_CONSULTAR(idCliente,dealId) {
  var ctx = vmRdMultiCtx_(idCliente);
  return vmRdMultiConsulta_(ctx,dealId,lerObjetos_(APP.sheets.interacoes));
}

function vmRdMultiIds_(ctx) {
  var ids = {};
  ctx.escopo.closerStageIds.forEach(function(etapaId) {
    ctx.escopo.closerUserIds.forEach(function(userId) {
      var completo=false;
      for(var page=1;page<=VM_RD_MULTI.maxPaginasDeals;page++) {
        var r=viLeadRdGet_(ctx.integracao.token,'/deals',{
          deal_pipeline_id:ctx.escopo.pipelineId,deal_stage_id:etapaId,
          user_id:userId,closed_at:'false',page:page,limit:200
        });
        var itens=Array.isArray(r)?r:(Array.isArray(r.deals)?r.deals:r.data);
        if (!Array.isArray(itens)) throw new Error('Consulta RD sem lista de negociações.');
        itens.forEach(function(x) {
          var id=String(x.id||x._id||'').toLowerCase();
          if (/^[a-f0-9]{24}$/.test(id)) ids[id]=true;
        });
        if (r.has_more === false || (!r.has_more&&!r.next_page&&itens.length<200)) {
          completo=true;break;
        }
      }
      if (!completo) throw new Error('Paginacao RD nao concluiu; nenhum ciclo criado.');
    });
  });
  var all=Object.keys(ids).sort();
  if(all.length>VM_RD_MULTI.maxIdsCiclo)
    throw new Error('Muitas negociacoes para um snapshot; dividir o lote antes da coleta.');
  return all;
}

function vmRdMultiAba_() {
  var ss=SpreadsheetApp.openById(APP.spreadsheetId);
  var aba=ss.getSheetByName(VM_RD_MULTI.aba);
  if(!aba) aba=ss.insertSheet(VM_RD_MULTI.aba);
  var h=VM_RD_MULTI.colunas;
  if(aba.getLastRow()<1) {
    aba.getRange(1,1,1,h.length).setValues([h]);
    aba.setFrozenRows(1);
  } else {
    var atual=aba.getRange(1,1,1,h.length).getDisplayValues()[0];
    if(h.some(function(v,i){return v!==atual[i];}))
      throw new Error('Contrato do snapshot RD diferente; dados nao alterados.');
  }
  return aba;
}
function vmRdMultiGravar_(aba,ciclo,ctx,resp) {
  var d=resp.negociacao||{};
  var fontes=resp.fontes||{};
  var json=JSON.stringify(resp);
  var status=resp.elegivel?'COLETADO':'FORA_ESCOPO';
  if(json.length>44000) {
    json=JSON.stringify({dealId:resp.dealId,idCliente:ctx.cliente.id,
      fontes:fontes,alerta:'JSON_MAIOR_QUE_LIMITE',
      metadados:d,evidenciasTruncadas:true});
    status='PARCIAL';
  }
  var row=[ciclo,ctx.cliente.id,ctx.cliente.nome,resp.dealId||'',d.nome||'',
    status,d.atualizadoEm||'',d.valorTotal==null?'':d.valorTotal,
    fontes.tarefas?.totalLido||0, fontes.atividades?.note?.totalLido||0,
    fontes.atividades?.email?.totalLido||0,
    fontes.atividades?.proposal?.totalLido||0,
    json,new Date().toISOString()];
  var last=aba.getLastRow();
  var keys=last>1?aba.getRange(2,2,last-1,3).getDisplayValues():[];
  var idx=keys.findIndex(function(v) {
    return v[0]===ctx.cliente.id&&v[2]===resp.dealId;
  });
  if(idx<0)aba.appendRow(row);
  else aba.getRange(idx+2,1,1,row.length).setValues([row]);
}
function vmRdMultiProps_(idCliente) {
  var id=String(idCliente||'');
  // O hash evita nomes de propriedades longos. O ID ja foi validado na allowlist.
  var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,id)
    .map(function(c){return ('0'+(c&255).toString(16)).slice(-2);}).join('').slice(0,18);
  return 'VM_RD_MULTICLIENTE_'+digest+'_';
}

function VOLUM_RD_CLIENTE_EXPORTAR_LOTE(idCliente) {
  var ctx=vmRdMultiCtx_(idCliente);
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw new Error('Outra exportacao esta ativa.');
  try {
    var props=PropertiesService.getScriptProperties(), key=vmRdMultiProps_(ctx.cliente.id);
    var idsJson=props.getProperty(key+'IDS');
    if(!idsJson) {
      idsJson=JSON.stringify(vmRdMultiIds_(ctx));
      var inicio={};
      inicio[key+'IDS']=idsJson;inicio[key+'CURSOR']='0';
      inicio[key+'CICLO']=new Date().toISOString();
      props.setProperties(inicio,false);
    }
    var ids=JSON.parse(idsJson);
    var cursor=Math.max(0,Number(props.getProperty(key+'CURSOR'))||0);
    var ciclo=props.getProperty(key+'CICLO')||'';
    var aba=vmRdMultiAba_(),board=lerObjetos_(APP.sheets.interacoes);
    var ok=0,fora=0,erros=0;
    for(var i=cursor;i<Math.min(cursor+VM_RD_MULTI.porLote,ids.length);i++){
      var resp;
      try {
        resp=vmRdMultiConsulta_(ctx,ids[i],board);
        if(resp.elegivel)ok++;else fora++;
      } catch(e) {
        erros++;
        resp={elegivel:false,dealId:ids[i],motivo:'FALHA_COLETA_RD'};
      }
      vmRdMultiGravar_(aba,ciclo,ctx,resp);
      props.setProperty(key+'CURSOR',String(i+1));
    }
    var proximo=Math.min(cursor+VM_RD_MULTI.porLote,ids.length);
    var concluido=proximo>=ids.length;
    if(concluido) {
      props.deleteProperty(key+'IDS');props.deleteProperty(key+'CURSOR');
      props.deleteProperty(key+'CICLO');
    }
    return {modo:'SOMENTE_LEITURA_RD',cliente:ctx.cliente.nome,
      total:ids.length,proximo:proximo,concluido:concluido,
      noLote:{coletados:ok,foraEscopo:fora,erros:erros},
      aba:VM_RD_MULTI.aba};
  } finally {lock.releaseLock();}
}

function VOLUM_RD_CLIENTE_REINICIAR(idCliente) {
  var ctx=vmRdMultiCtx_(idCliente);
  var props=PropertiesService.getScriptProperties(),k=vmRdMultiProps_(ctx.cliente.id);
  [k+'IDS',k+'CURSOR',k+'CICLO'].forEach(function(v){props.deleteProperty(v);});
  return {sucesso:true,cliente:ctx.cliente.nome};
}
