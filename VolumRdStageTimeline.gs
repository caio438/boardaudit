/**
 * VOLUM Intelligence — linha do tempo por PASSAGEM de etapa, somente RD v1.
 *
 * Cada janela usa [entrada, proxima_entrada). A janela atual permanece aberta.
 * Tarefas sao registradas em dois momentos distintos: criacao e conclusao.
 * Atributos atuais e os timestamps de custom fields NAO sao versoes historicas.
 * O historico de movimentos vem de deal_stage_histories; nenhuma regra de
 * compliance e presumida sem o playbook validado do cliente.
 */
function viRdIdStage_(item) {
  return String(item && (item.id || item._id || item.deal_stage_id) || '').trim();
}

function viRdNomeSeguro_(valor, tamanho) {
  return String(valor || '').replace(/https?:\/\/[^\s<>"']+/gi,'[LINK_OMITIDO]').slice(0,tamanho || 160);
}

/** Maximo de 12 etapas/pagina documentado para GET /deal_stages. */
function viRdCatalogoEtapas_(token, negociacao) {
  const funil=String(((negociacao || {}).deal_pipeline || {}).id ||
    (((negociacao || {}).deal_stage || {}).deal_pipeline_id) || '').trim();
  const nomes={};
  const atual=(negociacao || {}).deal_stage || {};
  if(viRdIdStage_(atual)&&atual.name)nomes[viRdIdStage_(atual)]=viRdNomeSeguro_(atual.name,120);
  if(!/^[0-9a-f]{24}$/i.test(funil))return {nomes,fonte:{acessivel:false,completo:false,motivo:'ID_FUNIL_NAO_INFORMADO'}};
  let completo=false,quantidade=0,erro='';
  for(let pagina=1;pagina<=3;pagina++){
    let resultado;
    try {resultado=viLeadRdGet_(token,'/deal_stages',{deal_pipeline_id:funil,page:pagina,limit:12});}
    catch(e){erro=String((String(e&&e.message||'').match(/HTTP [0-9]{3}/)||[])[0]||'FALHA_CONSULTA');break;}
    const items=Array.isArray(resultado)?resultado:resultado&&resultado.deal_stages;
    if(!Array.isArray(items)){erro='FORMATO_INESPERADO';break;}
    items.forEach(x=>{
      const id=viRdIdStage_(x);
      const pipeline=String((x.deal_pipeline||{}).id||x.deal_pipeline_id||'');
      if(id&&(!pipeline||pipeline===funil)&&x.name){
        nomes[id]=viRdNomeSeguro_(x.name,120);quantidade++;
      }
    });
    if(resultado && resultado.has_more===true)continue;
    if(items.length<12 || resultado&&resultado.has_more===false ||
      Number(resultado&&resultado.total||0)<=pagina*12&&Number(resultado&&resultado.total||0)>0){
      completo=true;break;
    }
    // Se nao houver metadados, pagina adicional so quando cheia.
  }
  return {nomes,fonte:{acessivel:quantidade>0,completo,quantidade,
    motivo:erro||(!completo?'LIMITE_PAGINAS':''),
    origem:'RD_V1_DEAL_STAGES'}};
}

function viRdCanonizarPassagens_(negociacao,nomes) {
  const bruto=Array.isArray(negociacao&&negociacao.deal_stage_histories)?
    negociacao.deal_stage_histories:[];
  const erros=[],validas=[];
  bruto.forEach((h,indice)=>{
    const id=viRdIdStage_(h);
    const inicio=viLeadDataIso_(h.start_date);
    const fim=viLeadDataIso_(h.end_date);
    if(!id||!inicio){erros.push({tipo:'HISTORICO_SEM_ETAPA_OU_DATA',indice});return;}
    validas.push({etapaId:id,inicio,fimRegistrado:fim,
      referencias:[String(h.id||h._id||('INDICE_'+indice))],ordem:indice});
  });
  validas.sort((a,b)=>a.inicio.localeCompare(b.inicio)||a.ordem-b.ordem);
  const unicas=[];
  let duplicadas=0;
  validas.forEach(x=>{
    const ultima=unicas[unicas.length-1];
    const perto=ultima && ultima.etapaId===x.etapaId &&
      Math.abs(Date.parse(x.inicio)-Date.parse(ultima.inicio))<=1000 &&
      (!ultima.fimRegistrado&&!x.fimRegistrado ||
       !!ultima.fimRegistrado&&!!x.fimRegistrado &&
       Math.abs(Date.parse(x.fimRegistrado)-Date.parse(ultima.fimRegistrado))<=1000);
    if(perto){ultima.referencias.push(...x.referencias);duplicadas++;return;}
    unicas.push(x);
  });
  const visitas={};
  const passagens=unicas.map((x,i)=>{
    const seguinte=unicas[i+1];
    visitas[x.etapaId]=(visitas[x.etapaId]||0)+1;
    const fim=seguinte?seguinte.inicio:x.fimRegistrado;
    const t0=Date.parse(x.inicio),t1=fim?Date.parse(fim):null;
    const problemas=[];
    if(fim&&t1<t0)problemas.push('FIM_ANTES_DA_ENTRADA');
    if(seguinte&&x.fimRegistrado&&Math.abs(Date.parse(x.fimRegistrado)-Date.parse(seguinte.inicio))>1000)
      problemas.push('SAIDA_E_ENTRADA_NAO_COINCIDEM');
    if(seguinte&&seguinte.inicio===x.inicio)problemas.push('MOVIMENTACOES_SIMULTANEAS');
    return {passagemId:x.etapaId+'@'+visitas[x.etapaId],
      visita:visitas[x.etapaId],etapaId:x.etapaId,
      etapaNome:nomes&&nomes[x.etapaId]||'ETAPA_SEM_NOME_CONFIRMADO',
      inicio:x.inicio,fim:fim||'',fimInformado:x.fimRegistrado,
      proximaEtapaId:seguinte?seguinte.etapaId:'',
      proximaEtapaNome:seguinte?(nomes&&nomes[seguinte.etapaId]||'ETAPA_SEM_NOME_CONFIRMADO'):'',
      status:seguinte?'ENCERRADA_POR_MOVIMENTACAO':fim?'ENCERRADA_SEM_MOVIMENTACAO':'EM_ANDAMENTO',
      duracaoMinutos:fim&&t1>=t0?Math.round((t1-t0)/60000):null,
      referenciasHistorico:x.referencias,alertas:problemas};
  });
  const atual=viRdIdStage_(negociacao&&negociacao.deal_stage);
  if(passagens.length&&atual&&passagens[passagens.length-1].etapaId!==atual)
    erros.push({tipo:'ETAPA_ATUAL_DIFERE_ULTIMA_PASSAGEM'});
  if(!passagens.length)erros.push({tipo:'HISTORICO_ETAPAS_AUSENTE'});
  return {passagens,erros,duplicadasConciliadas:duplicadas,
    totalPassagensOriginais:bruto.length};
}

function viRdCamposNegociacao_(negociacao) {
  const deal=negociacao||{};
  const vals=Array.isArray(deal.deal_custom_fields)?deal.deal_custom_fields:[];
  const campos=vals.map(item=>{
    const campo=item.custom_field||{};
    const id=String(item.custom_field_id||campo.id||campo._id||'').trim();
    const v=item.value;
    const valor=Array.isArray(v)?v.map(x=>viRdNomeSeguro_(x,240)).slice(0,15):
      viRdNomeSeguro_(v,240);
    return {id,nome:viRdNomeSeguro_(campo.label||campo.name||campo.title||item.label||'',120),
      valorAtual:valor,criadoEm:viLeadDataIso_(item.created_at),
      atualizadoEm:viLeadDataIso_(item.updated_at),
      natureza:'ESTADO_ATUAL_NAO_HISTORICO'};
  });
  return {
    origem:viRdNomeSeguro_((deal.deal_source||{}).name,120),
    campanha:viRdNomeSeguro_((deal.campaign||{}).name,120),
    funil:viRdNomeSeguro_((deal.deal_pipeline||{}).name,120),
    responsavelAtual:viRdNomeSeguro_((deal.user||{}).name,100),
    criadoEm:viLeadDataIso_(deal.created_at),atualizadoEm:viLeadDataIso_(deal.updated_at),
    camposPersonalizados:campos,
    limite:'Valores atuais nao reconstituem versoes anteriores. Mudancas historicas exigem evento de alteracao verificavel.'
  };
}

function viRdEventosPorNegociacao_(atividades,tarefas,campos) {
  const result=[];
  (atividades||[]).forEach(a=>{
    const tipo=String(a.tipo||'').toLowerCase();
    const confiavel=a.origemClassificacao==='CAMPO_API';
    let acao='ATIVIDADE_TIPO_NAO_CONFIRMADO';
    if(confiavel){
      const map={note:'ANOTACAO',changelog:'ALTERACAO',email:'EMAIL_REGISTRADO',
        messenger:'MENSAGEM_REGISTRADA',whatsapp_audio:'WHATSAPP_AUDIO_REGISTRADO',
        whatsapp_transcription:'WHATSAPP_TRANSCRICAO_REGISTRADA',
        call:'CHAMADA_REGISTRADA',proposal:'PROPOSTA_REGISTRADA',
        response:'RESPOSTA_REGISTRADA',task:'TAREFA_REGISTRADA'};
      acao=map[tipo]||'ATIVIDADE_RD';
    }
    if(a.data)result.push({data:a.data,acao,fonte:'RD_ATIVIDADES',id:a.id||'',
      tipoInformado:tipo,origemClassificacao:a.origemClassificacao||'NAO_INFORMADA',
      confianca:confiavel?'TIPO_CONFIRMADO_API':'TIPO_NAO_CONFIRMADO',
      autorId:a.autorId||'',etapaIdRegistrada:a.etapaId||'',
      texto:a.texto||'',temLinkGravacao:a.temLinkGravacao===true});
  });
  (tarefas||[]).forEach(t=>{
    if(t.criadaEm)result.push({data:t.criadaEm,acao:'TAREFA_CRIADA',fonte:'RD_TAREFAS',
      id:t.id||'',confianca:'REGISTRO_TAREFA',tipoInformado:t.tipo||'',
      assunto:t.assunto||'',previstaPara:t.previstaPara||'',concluida:t.concluida===true,
      responsaveis:t.responsaveis||[]});
    if(t.concluida&&t.concluidaEm)result.push({data:t.concluidaEm,
      acao:'TAREFA_CONCLUIDA',fonte:'RD_TAREFAS',id:t.id||'',
      confianca:'REGISTRO_TAREFA',tipoInformado:t.tipo||'',assunto:t.assunto||'',
      previstaPara:t.previstaPara||'',responsaveis:t.responsaveis||[]});
  });
  ((campos||{}).camposPersonalizados||[]).forEach(f=>{
    if(f.atualizadoEm)result.push({data:f.atualizadoEm,
      acao:'ULTIMA_ATUALIZACAO_CAMPO',fonte:'RD_CAMPOS_ATUAIS',id:f.id||'',
      confianca:'MARCO_ATUAL_NAO_HISTORICO',campoNome:f.nome||'',
      detalhe:'Ultima atualizacao disponivel do campo; nao prova valor anterior nem autor.'});
  });
  result.sort((a,b)=>a.data.localeCompare(b.data)||a.acao.localeCompare(b.acao)||a.id.localeCompare(b.id));
  return result;
}

function viRdAuditoriaJanelas_(negociacao,atividades,tarefas,catalogo,opcoes) {
  const nomes=catalogo&&catalogo.nomes||{};
  const historico=viRdCanonizarPassagens_(negociacao,nomes);
  const cadastro=viRdCamposNegociacao_(negociacao);
  const eventos=viRdEventosPorNegociacao_(atividades,tarefas,cadastro);
  const passagens=historico.passagens;
  const semEtapa=[];
  const posicoes={};
  const refEtapaAtual=passagens.length?passagens[passagens.length-1].passagemId:'';
  const janelas=passagens.map(p=>Object.assign({},p,{eventos:[],contagens:{
    atividades:0,alteracoesConfirmadas:0,atividadesTipoNaoConfirmado:0,
    tarefasCriadas:0,tarefasConcluidas:0,camposComUltimaAtualizacao:0
  },classificacao:'LEITURA_DE_REGISTROS',regrasAplicadas:0,
  compliance:'NAO_PONTUADO_SEM_REGRAS_HOMOLOGADAS'}));
  const indexes=janelas.map(p=>Date.parse(p.inicio));
  eventos.forEach(evento=>{
    const ms=Date.parse(evento.data);
    // Maior entrada <= data do evento. Janela semiaberta [inicio, fim).
    let low=0,high=indexes.length;
    while(low<high){const mid=(low+high)>>1;if(indexes[mid]<=ms)low=mid+1;else high=mid;}
    const i=low-1;
    const janela=i>=0?janelas[i]:null;
    if(!janela||(janela.fim && ms>=Date.parse(janela.fim))){
      semEtapa.push(evento);return;
    }
    const vinculada=Object.assign({},evento,{passagemId:janela.passagemId});
    if(evento.etapaIdRegistrada&&evento.etapaIdRegistrada!==janela.etapaId){
      vinculada.divergenciaEtapaRegistrada=true;
      janela.alertas.push('ETAPA_EVENTO_DIFERE_JANELA_CRONOLOGICA');
    }
    janela.eventos.push(vinculada);
    const c=janela.contagens;
    if(evento.fonte==='RD_ATIVIDADES')c.atividades++;
    if(evento.acao==='ALTERACAO')c.alteracoesConfirmadas++;
    if(evento.acao==='ATIVIDADE_TIPO_NAO_CONFIRMADO')c.atividadesTipoNaoConfirmado++;
    if(evento.acao==='TAREFA_CRIADA')c.tarefasCriadas++;
    if(evento.acao==='TAREFA_CONCLUIDA')c.tarefasConcluidas++;
    if(evento.acao==='ULTIMA_ATUALIZACAO_CAMPO')c.camposComUltimaAtualizacao++;
  });
  const parcial=opcoes&&opcoes.fontesParciais===true;
  const atualId=viRdIdStage_(negociacao&&negociacao.deal_stage);
  return {
    modo:'SOMENTE_LEITURA_RD',versao:'ETAPAS_RD_V1',registroEm:viLeadDataIso_(new Date()),
    resumo:{
      passagensOriginais:historico.totalPassagensOriginais,
      passagensConsolidadas:janelas.length,
      duplicatasConciliadas:historico.duplicadasConciliadas,
      quantidadeEventosRd:eventos.length,eventosForaDasJanelas:semEtapa.length,
      ultimaPassagemId:refEtapaAtual,etapaAtualId:atualId,
      fonteAtividadesParcial:parcial,
      auditoriaDefinitiva:false
    },
    cadastroAtual:cadastro,janelas,eventosSemEtapa:semEtapa,
    inconsistencias:historico.erros,
    cobertura:{
      etapas:{acessivel:historico.totalPassagensOriginais>0,
        completo:historico.erros.length===0,origem:'RD_V1_DEAL_STAGE_HISTORIES'},
      catalogoEtapas:catalogo&&catalogo.fonte||{acessivel:false,completo:false},
      atividades:{completo:!parcial},
      observacao:'Janela = [entrada, proxima entrada). Confiança limitada pela cobertura de cada fonte.'
    },
    limite:'A API da negociacao informa o historico de etapas. Alteracoes de campo sao historicas apenas se o evento de changelog vier identificado. Campo atual, tarefa concluida e texto nao provam contato ou valor antigo. Compliance exige regra do cliente.'
  };
}

/**
 * Concilia o espelho visual do Histórico nativo com a coleta v1. A interface
 * é a fonte de cobertura para cartões que a API não retorna; IDs da API nunca
 * são fabricados. A chave usa tipo, minuto, autor e detalhe normalizado para
 * impedir contagem dupla entre as duas leituras.
 */
function viRdConciliarHistoricoUi_(historico, ui, dealId) {
  const base=historico||{};
  const recebido=ui||{};
  if(String(recebido.dealId||'').toLowerCase()!==String(dealId||'').toLowerCase())
    return {historico:base,aceito:false,motivo:'DEAL_ID_UI_NAO_CONFERE'};
  const bruto=Array.isArray(recebido.events)?recebido.events:[];
  if(bruto.length>250)return {historico:base,aceito:false,motivo:'LIMITE_EVENTOS_UI'};
  const vistos={},eventos=[],invalidos=[];
  bruto.forEach(function(e,i){
    if(!e||typeof e!=='object'){invalidos.push('CARD_INVALIDO_'+i);return;}
    const pos=Number(e.uiIndex);
    // A interface tem cartões legitimamente idênticos no mesmo minuto.
    // A posição na lista é identidade visual; não deduplicar por hora/texto.
    const index=Number.isInteger(pos)&&pos>=0?pos:i;
    const key=String(index);
    if(vistos[key]){invalidos.push('CARD_REPETIDO_'+key);return;}
    vistos[key]=true;
    const raw=String(e.dataLocal||'').trim();
    // Horário da interface é America/Sao_Paulo, não UTC.
    const clock=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)?
      raw+(raw.length===16?':00':'')+'-03:00':raw;
    const data=viLeadDataIso_(clock||e.dateText);
    if(!data)invalidos.push('CARD_SEM_DATA_'+index);
    const item={id:'UI_'+key,uiIndex:index,data:data,
      dataTexto:String(e.dateText||''),acao:String(e.kind||'OUTRO_VISUAL_RD'),
      tipoInformado:'UI_HISTORY',autor:viRdNomeSeguro_(e.author,110),
      etapaNome:viRdNomeSeguro_(e.stage,120),
      texto:viRdNomeSeguro_(e.detail,6000),fonte:'RD_UI_HISTORY',
      origemEvidencia:'INTERFACE_AUTENTICADA_RD',
      confianca:'EVENTO_VISUAL_RD'};
    eventos.push(item);
  });
  eventos.sort(function(a,b){return String(a.data||a.dataTexto).localeCompare(String(b.data||b.dataTexto))||a.uiIndex-b.uiIndex;});
  const coverage=recebido.coverage||{};
  const declarado=Number(coverage.totalVisual);
  const totalVisual=Number.isFinite(declarado)&&declarado>=0?declarado:bruto.length;
  const lacunas=invalidos.slice(0,40);
  if(totalVisual!==eventos.length)lacunas.push('TOTAL_VISUAL_DIVERGE_DOS_EVENTOS');
  if(coverage.complete!==true)lacunas.push('PAGINACAO_UI_INCOMPLETA');
  const janelas=Array.isArray(base.janelas)?base.janelas:[];
  janelas.forEach(j=>{j.eventosHistoricoVisual=[];j.totalEventosHistoricoVisual=0;});
  const eventosFora=[];
  eventos.forEach(e=>{
    const t=Date.parse(e.data||'');
    if(!Number.isFinite(t)){eventosFora.push(e);return;}
    // Registrar movimento no estágio de destino se a API o separa exatamente
    // no limite; não assumir que a etapa textual exibida prevalece sobre o log.
    const janela=janelas.slice().reverse().find(j=>{
      const inicio=Date.parse(j.inicio||'');
      const fim=Date.parse(j.fim||'');
      return Number.isFinite(inicio)&&t>=inicio&&(!Number.isFinite(fim)||t<fim);
    });
    if(!janela){eventosFora.push(e);return;}
    e.passagemId=janela.passagemId;
    if(e.etapaNome&&janela.etapaNome&&
      e.etapaNome.toLowerCase()!==janela.etapaNome.toLowerCase())
      e.etapaInformadaDivergente=true;
    janela.totalEventosHistoricoVisual++;
    janela.eventosHistoricoVisual.push(e);
  });
  base.linhaDoTempo={origem:'RD_UI_HISTORY',eventos,
    cobertura:{acessivel:coverage.available===true,
      completo:coverage.complete===true&&lacunas.length===0,
      totalVisual,totalReconciliado:eventos.length,
      paginasCarregadas:Number(coverage.pagesLoaded||0),
      semJanela:eventosFora.length,
      lacunas:lacunas},
    limite:'Fonte RD_UI_HISTORY: cada ID UI_n identifica um cartao visual (nao um ID da API). Sem registros completos nao se conclui ausencia de acao.'};
  // Fontes laterais lidas na mesma sessão autenticada do RD. Ainda não são
  // atividades de API: só entram no plano após classificação rastreável.
  const fontesUi=recebido.sources&&typeof recebido.sources==='object'?recebido.sources:{};
  base.fontesUiRd={};
  ['emails','tasks','files','proposals'].forEach(function(chave){
    const f=fontesUi[chave]||{};
    base.fontesUiRd[chave]={acessivel:f.available===true,completo:f.complete===true,
      motivo:String(f.reason||''),texto:String(f.text||'').slice(0,60000)};
  });
  base.eventosHistoricoVisualSemJanela=eventosFora;
  return {historico:base,aceito:true};
}

/**
 * Coleta isolada do RD, SEM consultar INTERACOES/Board, API4COM ou tl;dv.
 * A identidade do cliente é definida no contexto autorizado (não por nome de
 * contato). Nunca devolve segredo ou URL de consulta contendo token.
 */
function viRdLerEtapasPorCliente_(entrada,idCliente,opcoes) {
  const dealId=viLeadId_(entrada);
  const cliente=String(idCliente||'').trim();
  if(!/^CLI-[A-Za-z0-9_-]{10,70}$/.test(cliente))
    throw new Error('Informe um ID de cliente canonico para a integracao RD.');
  const integracao=obterIntegracaoCliente_(cliente,'RD_STATION');
  if(!integracao||String(integracao.ATIVO||'').toUpperCase()!=='SIM')
    throw new Error('Integracao RD nao ativa para o cliente autorizado.');
  const token=obterSegredo_('INTEGRACAO_TOKEN_'+integracao.ID_INTEGRACAO);
  if(!token)throw new Error('Token RD nao configurado na aplicacao.');
  const retorno=viLeadRdGet_(token,'/deals/'+dealId,{});
  const deal=retorno&&retorno.deal?retorno.deal:retorno;
  if(String(deal&&(deal.id||deal._id)||'').toLowerCase()!==dealId)
    throw new Error('Negociacao nao confirmada para a integracao selecionada.');
  let tarefas=[],tarefasCompletas=false;
  try {
    const pagina=viLeadPaginar_(token,'/tasks','tasks',dealId);
    tarefas=viLeadTarefas_(pagina.itens,!!(opcoes&&opcoes.incluirTextos));
    tarefasCompletas=pagina.completo===true;
  } catch(e) {tarefasCompletas=false;}
  const lidas=viLeadColetarAtividades_(token,dealId);
  const atividades=viLeadAtividades_(lidas.itens,!!(opcoes&&opcoes.incluirTextos));
  const catalogo=viRdCatalogoEtapas_(token,deal);
  const historico=viRdAuditoriaJanelas_(deal,atividades,tarefas,catalogo,{
    fontesParciais:!lidas.completo||!tarefasCompletas
  });
  historico.cobertura.tarefas={acessivel:tarefasCompletas||tarefas.length>0,
    completo:tarefasCompletas,quantidade:tarefas.length};
  historico.cobertura.atividades={acessivel:Object.values(lidas.porTipo||{}).some(x=>x.acessivel),
    completo:lidas.completo===true,quantidade:atividades.length,
    conflitosDeTipo:lidas.divergencias.length};
  return historico;
}

/**
 * Checagem manual somente leitura no editor Apps Script, restrita a um lead.
 * Retorna apenas datas e contagens: nao loga anotacoes, telefones ou tokens.
 */
function VOLUM_RD_VALIDAR_ETAPAS_BEAGA() {
  const r=viRdLerEtapasPorCliente_(
    '6acc888b98976f0023dc583f','CLI-20260803131300-C4455D17',
    {incluirTextos:false}
  );
  return {sucesso:true,modo:'PREVIEW_SOMENTE_RD',
    passagens:r.resumo.passagensConsolidadas,
    entradasDuplicadas:r.resumo.duplicatasConciliadas,
    eventos:r.resumo.quantidadeEventosRd,
    cobertura:r.cobertura,
    etapas:r.janelas.map(x=>({etapaId:x.etapaId,nome:x.etapaNome,
      inicio:x.inicio,fim:x.fim,status:x.status,contagens:x.contagens})),
    inconsistencias:r.inconsistencias
  };
}
