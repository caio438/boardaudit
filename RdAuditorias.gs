var RD_AUDITORIA_EMAIL_VOLUM='crm@govolum.com';
function audRdPublicarAutomaticamente_(idAuditoria) {
  audRdEstr_();
  var id = String(idAuditoria || '').trim();
  var a = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!a) throw new Error('Auditoria não encontrada.');
  var tipo = String(a.TIPO_AUDITORIA || '').toUpperCase();
  if (['SDR', 'CLOSER'].indexOf(tipo) < 0) {
    return { aplicavel: false, publicada: false, status: 'NAO_APLICAVEL', mensagem: 'Publicação no RD não se aplica a este tipo de auditoria.' };
  }

  var i = audV3Localizar_('INTERACOES', 'ID_INTERACAO', a.ID_INTERACAO) || {};
  var dealId = audRdDeal_(i);
  if (!dealId) {
    audRdStatus_(id, 'AGUARDANDO_VINCULO', '', 'Negociação do RD ainda não vinculada.');
    return {
      aplicavel: true,
      publicada: false,
      status: 'AGUARDANDO_VINCULO',
      mensagem: 'Aguardando vínculo da negociação no RD CRM.'
    };
  }

  var integracao = typeof obterIntegracaoCliente_ === 'function'
    ? obterIntegracaoCliente_(a.ID_CLIENTE, 'RD_STATION')
    : null;
  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM') {
    audRdStatus_(id, 'AGUARDANDO_INTEGRACAO', '', 'Integração RD deste cliente não está ativa.');
    return {
      aplicavel: true,
      publicada: false,
      status: 'AGUARDANDO_INTEGRACAO',
      mensagem: 'Aguardando ativação da integração RD do cliente.'
    };
  }

  try {
    var resposta = enviarAuditoriaParaRd({ idAuditoria: id });
    return {
      aplicavel: true,
      publicada: true,
      status: 'PUBLICADA',
      mensagem: resposta.mensagem || 'Resultado registrado automaticamente no RD CRM.',
      duplicada: Boolean(resposta.duplicada)
    };
  } catch (erro) {
    var mensagem = String(erro && erro.message ? erro.message : erro);
    audRdStatus_(id, 'ERRO', '', mensagem);
    return {
      aplicavel: true,
      publicada: false,
      status: 'ERRO',
      mensagem: 'Falha na publicação automática no RD CRM.',
      erro: mensagem
    };
  }
}

function salvarIdRdAuditoriaV3(d) {
  d = d || {};
  var id = String(d.idAuditoria || '').trim();
  var a = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!a) throw new Error('Auditoria não encontrada.');
  if (String(a.RD_STATUS || '').toUpperCase() === 'PUBLICADA') {
    throw new Error('Esta auditoria já foi enviada ao RD e o vínculo não pode ser alterado por aqui.');
  }

  var deal = audRdNormalizarDeal_(d.rdDealId || d.linkCrm || '');
  var link = deal ? audV3RdLinkNegociacao_(deal) : '';
  audV3Atualizar_('INTERACOES', 'ID_INTERACAO', a.ID_INTERACAO, {
    LINK_CRM: link,
    ATUALIZADO_EM: new Date()
  });

  var publicacao = null;
  if (deal &&
      String(a.STATUS || '').toUpperCase() === 'APROVADA' &&
      String(a.VALIDACAO_STATUS || '').toUpperCase() === 'VALIDADA') {
    publicacao = audRdPublicarAutomaticamente_(id);
    if (typeof audV3Atualizar_ === 'function') {
      audV3Atualizar_('AUDITORIAS', 'ID_AUDITORIA', id, {
        AUTOMACAO_STATUS: publicacao.publicada
          ? 'CONCLUIDA'
          : (publicacao.status === 'ERRO' ? 'CONCLUIDA_COM_ERRO_RD' : 'CONCLUIDA_AGUARDANDO_RD'),
        AUTOMACAO_ERRO: publicacao.erro || '',
        AUTOMACAO_ATUALIZADO_EM: new Date()
      });
    }
  }

  if (typeof limparCachesDados_ === 'function') limparCachesDados_();
  return {
    sucesso: true,
    mensagem: deal
      ? (publicacao && publicacao.publicada
          ? 'Negociação vinculada e auditoria publicada automaticamente no RD CRM.'
          : 'Negociação do RD vinculada. O envio automático foi processado.')
      : 'Vínculo com o RD removido.',
    publicacaoRd: publicacao,
    auditoria: audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id)),
    auditorias: audV3ListarAuditoriasFront_()
  };
}
function prepararEnvioAuditoriaRd(id){var c=audRdCtx_(id);return{idAuditoria:c.a.ID_AUDITORIA,dealId:c.dealId,oportunidade:c.i.OPORTUNIDADE||c.i.TITULO||'',responsavel:c.sdr.nome||'',usuarioPublicacao:c.volum.email,texto:audRdTexto_(c),aviso:'A anotação ficará no histórico da negociação e não poderá ser editada nem excluída pelo RD CRM.'};}
function enviarAuditoriaParaRd(d){d=d||{};var c=audRdCtx_(d.idAuditoria),texto=String(d.texto||audRdTexto_(c)).trim();if(!texto)throw new Error('A anotação do RD ficou vazia.');var ja=String(c.a.RD_STATUS||'').toUpperCase()==='PUBLICADA',ativId=String(c.a.RD_ACTIVITY_ID||'');if(!ja){var notas=audRdNotas_(c.token,c.dealId),legado='[BOARDAUDIT:'+c.a.ID_AUDITORIA+']';var dup=notas.find(function(x){var t=audRdTextoNota_(x);return t.indexOf(legado)>=0||audRdCmp_(t)===audRdCmp_(texto);});if(dup){ja=true;ativId=String(dup.id||dup._id||(dup.activity||{}).id||'');}}
if(!ja){var rr=requisicaoJson_(APP.rdBaseUrl+'/activities?token='+encodeURIComponent(c.token),{method:'post',contentType:'application/json',payload:audRdJsonSeguro_({activity:{user_id:c.volum.id,deal_id:c.dealId,text:texto}})}),at=rr.activity||rr.data||rr||{};ativId=String(at.id||at._id||'');audRdStatus_(c.a.ID_AUDITORIA,'PUBLICADA',ativId,'');}
var ts=audRdTarefas_(c);audRdStatus_(c.a.ID_AUDITORIA,'PUBLICADA',ativId,'',ts);return{sucesso:true,duplicada:ja,mensagem:(ja?'A anotação já estava no histórico. ':'Resultado registrado no histórico. ')+'As tarefas do VOLUM e do SDR foram conferidas.',auditoria:audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS','ID_AUDITORIA',c.a.ID_AUDITORIA)),auditorias:audV3ListarAuditoriasFront_()};}
function audRdCtx_(id) {
  audRdEstr_();
  var a = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', String(id || '').trim());
  if (!a) throw new Error('Auditoria não encontrada.');
  var tipoAuditoria = String(a.TIPO_AUDITORIA || '').toUpperCase();
  if (['SDR', 'CLOSER'].indexOf(tipoAuditoria) < 0) {
    throw new Error('Somente auditorias de SDR ou Closer podem ser enviadas ao RD CRM.');
  }
  if (String(a.STATUS || '').toUpperCase() !== 'APROVADA') {
    throw new Error('Somente auditorias aprovadas podem ser enviadas ao RD CRM.');
  }
  if (String(a.VALIDACAO_STATUS || '').toUpperCase() !== 'VALIDADA' || !String(a.HASH_FONTE || '').trim()) {
    throw new Error('A auditoria ainda não possui validação de integridade para envio ao RD CRM.');
  }

  var i = audV3Localizar_('INTERACOES', 'ID_INTERACAO', a.ID_INTERACAO) || {};
  var transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', a.ID_INTERACAO);
  if (!transcricao) throw new Error('A transcrição original da auditoria não foi encontrada.');
  var fontePreparada = audV3PrepararTranscricaoParaIntegridade_(transcricao, i, a.ENGINE_VERSAO);
  transcricao.CONTEUDO = String(fontePreparada.conteudo || '').trim();
  transcricao.NORMALIZACAO_VERSAO = fontePreparada.normalizacaoVersao || '';

  var pitch = {
    ID_PITCH: a.ID_PITCH || '',
    ID_CLIENTE: a.ID_CLIENTE || '',
    TIPO_PITCH: a.TIPO_AUDITORIA || '',
    NOME_VERSAO: a.NOME_PITCH_SNAPSHOT || '',
    NUMERO_VERSAO: a.VERSAO_PITCH_SNAPSHOT || '',
    CONTEUDO_PITCH: a.CONTEUDO_PITCH_SNAPSHOT || ''
  };
  var modelo = {
    ID_MODELO: a.ID_MODELO || '',
    NOME_MODELO: a.NOME_MODELO_SNAPSHOT || '',
    VERSAO_MODELO: a.VERSAO_MODELO_SNAPSHOT || '',
    TIPO_AUDITORIA: a.TIPO_AUDITORIA || '',
    PROMPT_AUDITORIA: a.PROMPT_SNAPSHOT || '',
    CRITERIOS_JSON: a.CRITERIOS_SNAPSHOT_JSON || ''
  };
  var cliente = audV3Localizar_('CLIENTES', 'ID_CLIENTE', a.ID_CLIENTE);
  if (!cliente) throw new Error('Cliente da auditoria não encontrado.');

  var hashAtual = audV3HashFonte_(cliente, pitch, modelo, transcricao, a.TIPO_AUDITORIA);
  if (String(a.HASH_FONTE || '') !== hashAtual) {
    throw new Error('A fonte da auditoria mudou após a aprovação. Gere uma nova auditoria antes de enviar ao RD CRM.');
  }

  var resultado = audV3ParseJson_(a.RESULTADO_JSON, 'Resultado JSON inválido.');
  var criterios = audV3ParseJson_(String(a.CRITERIOS_SNAPSHOT_JSON || '{}'), 'Critérios da auditoria inválidos.');
  audV3ValidarResultadoOficial_(resultado, a.TIPO_AUDITORIA, criterios, transcricao.CONTEUDO, a.CONTEUDO_PITCH_SNAPSHOT || '');
  audV3ExigirGatePublicavel_(resultado, a.TIPO_AUDITORIA);

  var dealId = audRdDeal_(i);
  if (!dealId) throw new Error('A interação não possui negociação do RD vinculada. Informe o vínculo manualmente quando necessário.');
  var it = typeof obterIntegracaoCliente_ === 'function' ? obterIntegracaoCliente_(a.ID_CLIENTE, 'RD_STATION') : null;
  if (!it || String(it.ATIVO || '').toUpperCase() !== 'SIM') throw new Error('A integração RD deste cliente não está ativa.');
  var token = obterSegredo_('INTEGRACAO_TOKEN_' + it.ID_INTEGRACAO);
  if (!token) throw new Error('Token do RD não encontrado.');
  var sdr = audRdResponsavel_(token, i, resultado, a);
  if (!sdr || !sdr.id || sdr.id === 'SEM_ID') throw new Error('Usuário responsável pela auditoria não identificado.');

  return {
    a: a,
    i: i,
    r: resultado,
    dealId: dealId,
    token: token,
    sdr: sdr,
    volum: audRdUsuarioVolum_(token, it)
  };
}
function audRdEstr_(){audV3GarantirColunas_(audV3Planilha_(),'AUDITORIAS',['RD_STATUS','RD_ACTIVITY_ID','RD_PUBLICADO_EM','RD_TAREFA_VOLUM_ID','RD_TAREFA_SDR_ID','RD_ERRO']);}
function audRdDeal_(i){var item=i||{},tipoInteracao=String(item.TIPO_INTERACAO||'').toUpperCase(),l=String(item.LINK_CRM||''),m=l.match(/(?:\/deals\/|^)([0-9a-f]{24})(?:\b|\/|\?|$)/i);if(m)return m[1];if(tipoInteracao==='REUNIAO')return'';m=String(item.DESCRICAO_ORIGEM||'').match(/(?:deal(?:_id)?|negocia(?:cao|ção))[^0-9a-f]{0,12}([0-9a-f]{24})/i);return m?m[1]:'';}
function audRdNormalizarDeal_(v){var t=String(v||'').trim();if(!t)return'';var m=t.match(/(?:\/deals\/|^)([0-9a-f]{24})(?:\b|\/|\?|$)/i)||t.match(/\b([0-9a-f]{24})\b/i);if(!m)throw new Error('Informe o ID de 24 caracteres da negociação do RD ou cole o link completo da negociação.');return String(m[1]).toLowerCase();}
function audV3RdLinkNegociacao_(v){var t=String(v||'').trim();if(!t)return'';var id=audRdNormalizarDeal_(t);return'https://crm.rdstation.com/app/deals/'+encodeURIComponent(id)+'?view=pipeline';}
function audRdUsuarios_(token){var r=requisicaoJson_(APP.rdBaseUrl+'/users?token='+encodeURIComponent(token)+'&active=true&limit=200',{method:'get',headers:{Accept:'application/json'}});return Array.isArray(r)?r:(r.users||r.data||r.results||r.items||[]);}
function audRdConfigIntegracao_(integracao){var bruto=String((integracao||{}).CONFIG_JSON||'').trim();if(!bruto)return{};try{var cfg=JSON.parse(bruto);return cfg&&typeof cfg==='object'?cfg:{};}catch(e){throw new Error('CONFIG_JSON da integração RD está inválido.');}}
function audRdUsuarioVolum_(token,integracao){
  var usuarios=audRdUsuarios_(token),cfg=audRdConfigIntegracao_(integracao);
  var idCfg=String(cfg.rdAuditoriaUsuarioVolumId||cfg.usuarioVolumId||'').trim();
  var emailCfg=String(cfg.rdAuditoriaUsuarioVolumEmail||cfg.usuarioVolumEmail||'').trim().toLowerCase();
  var porId=function(u){return String((u||{}).id||(u||{})._id||(u||{}).user_id||'')===idCfg;};
  var porEmail=function(u,email){return String((u||{}).email||'').trim().toLowerCase()===email;};
  var serializar=function(u,fallback){u=u||{};return{id:String(u.id||u._id||u.user_id||''),nome:String(u.name||u.nome||fallback||'VOLUM'),email:String(u.email||'')};};
  if(idCfg){
    var ui=usuarios.find(porId);
    if(!ui)throw new Error('O usuário VOLUM configurado para esta integração não foi encontrado entre os usuários ativos do RD CRM.');
    return serializar(ui,'VOLUM');
  }
  if(emailCfg){
    var ue=usuarios.find(function(u){return porEmail(u,emailCfg);});
    if(!ue)throw new Error('O usuário VOLUM configurado ('+emailCfg+') não foi encontrado entre os usuários ativos do RD CRM.');
    return serializar(ue,emailCfg);
  }
  var emailPadrao=String(RD_AUDITORIA_EMAIL_VOLUM||'').trim().toLowerCase();
  var up=emailPadrao?usuarios.find(function(u){return porEmail(u,emailPadrao);}):null;
  if(up)return serializar(up,emailPadrao);
  var candidatos=usuarios.filter(function(u){
    var email=String((u||{}).email||'').trim().toLowerCase();
    var nome=normalizarTextoComparacao_(String((u||{}).name||(u||{}).nome||''));
    return /@govolum\.com$/.test(email)||nome.indexOf('volum')>=0;
  });
  if(candidatos.length===1)return serializar(candidatos[0],'VOLUM');
  if(candidatos.length>1)throw new Error('Há mais de um usuário VOLUM ativo no RD CRM. Configure rdAuditoriaUsuarioVolumId no CONFIG_JSON da integração.');
  throw new Error('Nenhum usuário VOLUM ativo foi encontrado no RD CRM. Configure rdAuditoriaUsuarioVolumId no CONFIG_JSON da integração.');
}
function audRdResponsavel_(token,i,r,a){
  var meta=(r||{}).metadados||{};
  var ident=String((i||{}).COLABORADOR||(i||{}).VENDEDOR||meta.sdr||meta.closer||'').trim();
  var ingeCloser=String((a||{}).ID_CLIENTE||'')==='CLI-20260806105306-25F3490A' &&
    String((a||{}).TIPO_AUDITORIA||'').toUpperCase()==='CLOSER' &&
    typeof audV3CloserIngeeValido_==='function' && audV3CloserIngeeValido_(ident);

  if(ingeCloser){
    var chaveCompartilhada=normalizarTextoComparacao_('Sinergia Engenharia');
    var compartilhados=audRdUsuarios_(token).filter(function(u){
      return normalizarTextoComparacao_(String((u||{}).name||(u||{}).nome||''))===chaveCompartilhada;
    });
    if(compartilhados.length!==1){
      throw new Error(compartilhados.length
        ? 'Há mais de um usuário ativo no RD chamado Sinergia Engenharia. Mantenha apenas um usuário canônico para as closers da INGEE.'
        : 'O usuário Sinergia Engenharia não foi encontrado entre os usuários ativos do RD CRM.');
    }
    var compartilhado=compartilhados[0]||{};
    return{
      id:String(compartilhado.id||compartilhado._id||compartilhado.user_id||''),
      nome:String(compartilhado.name||compartilhado.nome||'Sinergia Engenharia'),
      email:String(compartilhado.email||'')
    };
  }

  var ext=String((i||{}).ID_EXTERNO||'');
  if(/^RD_TASK_/i.test(ext)){
    try{
      var origem=audRdOrigem_(token,ext);
      var resp=typeof extrairResponsaveisRd_==='function'?extrairResponsaveisRd_(origem)[0]:null;
      if(resp&&resp.id&&resp.id!=='SEM_ID')return resp;
    }catch(e){}
  }
  if(!ident)throw new Error('Informe o responsável auditado para localizar o usuário correspondente no RD CRM.');
  var chave=normalizarTextoComparacao_(ident),email=ident.indexOf('@')>=0?ident.toLowerCase():'';
  var cand=audRdUsuarios_(token).filter(function(u){
    var nome=normalizarTextoComparacao_(String((u||{}).name||(u||{}).nome||'')),mail=String((u||{}).email||'').trim().toLowerCase();
    return(email&&mail===email)||(chave&&nome===chave);
  });
  if(cand.length!==1)throw new Error(cand.length?'Há mais de um usuário do RD com o nome '+ident+'. Informe o e-mail no campo de colaborador.':'O responsável '+ident+' não foi encontrado entre os usuários ativos do RD CRM.');
  var u=cand[0]||{};
  return{id:String(u.id||u._id||u.user_id||''),nome:String(u.name||u.nome||ident),email:String(u.email||'')};
}
function audRdOrigem_(token,id){id=String(id||'').replace(/^RD_TASK_/i,'').trim();if(!id)throw new Error('Tarefa original não identificada.');var r=requisicaoJson_(APP.rdBaseUrl+'/tasks/'+encodeURIComponent(id)+'?token='+encodeURIComponent(token),{method:'get',headers:{Accept:'application/json'}});return r.task||r.data||r;}
function audRdUsuario_(token,email){var us=audRdUsuarios_(token),e=String(email).toLowerCase(),u=us.find(function(x){return String((x||{}).email||'').toLowerCase()===e;});if(!u)throw new Error('O usuário '+email+' não foi encontrado ou não está ativo no RD CRM.');return{id:String(u.id||u._id||u.user_id||''),nome:String(u.name||email),email:String(u.email||email)};}
function audRdNotas_(token,deal){var r=requisicaoJson_(APP.rdBaseUrl+'/activities?token='+encodeURIComponent(token)+'&deal_id='+encodeURIComponent(deal)+'&type=note&limit=200',{method:'get',headers:{Accept:'application/json'}});return Array.isArray(r)?r:(r.activities||r.data||r.results||r.items||[]);}
function audRdTextoNota_(x){x=x||{};return String(x.text||x.note||x.description||(x.activity||{}).text||'');}
function audRdCmp_(t){return String(t||'').replace(/^\[BOARDAUDIT:[^\]]+\]\s*/i,'').replace(/\s+/g,' ').trim().toLowerCase();}
function audRdStatus_(id,s,aid,erro,t){t=t||{};audV3Atualizar_('AUDITORIAS','ID_AUDITORIA',id,{RD_STATUS:s,RD_ACTIVITY_ID:aid||'',RD_PUBLICADO_EM:s==='PUBLICADA'?new Date():'',RD_TAREFA_VOLUM_ID:t.idVolum||'',RD_TAREFA_SDR_ID:t.idSdr||'',RD_ERRO:erro||''});}
function audRdListaTarefas_(c){var r=requisicaoJson_(APP.rdBaseUrl+'/tasks?token='+encodeURIComponent(c.token)+'&deal_id='+encodeURIComponent(c.dealId)+'&limit=200',{method:'get',headers:{Accept:'application/json'}});return Array.isArray(r)?r:(r.tasks||r.data||r.results||r.items||[]);}
function audRdIdent_(c){var n=String(c.i.OPORTUNIDADE||c.i.TITULO||'Ligação').trim(),d=audV3DataIso_(c.i.DATA_INTERACAO).slice(0,10);return n+(d?' · '+d:'');}
function audRdTarefas_(c){var a=audV3Localizar_('AUDITORIAS','ID_AUDITORIA',c.a.ID_AUDITORIA)||c.a,lista=audRdListaTarefas_(c),ident=audRdIdent_(c),sv='Auditoria da ligação registrada — '+ident,ss='Confira a anotação da Auditoria do '+(String(a.TIPO_AUDITORIA||'').toUpperCase()==='CLOSER'?'atendimento':'ligação')+' no histórico — '+ident,idv=String(a.RD_TAREFA_VOLUM_ID||''),ids=String(a.RD_TAREFA_SDR_ID||'');if(!idv){var ev=lista.find(function(x){return String((x||{}).subject||'')===sv;});idv=ev?String(ev.id||ev._id||ev.task_id||''):'';}if(!ids){var es=lista.find(function(x){return String((x||{}).subject||'')===ss;});ids=es?String(es.id||es._id||es.task_id||''):'';}if(!idv){idv=audRdCriarTarefa_(c,c.volum.id,sv,'Resultado da auditoria registrado no histórico da negociação.');audRdConcluir_(c,idv);}if(!ids)ids=audRdCriarTarefa_(c,c.sdr.id,ss,'Confira a anotação da Auditoria do '+(String(a.TIPO_AUDITORIA||'').toUpperCase()==='CLOSER'?'atendimento':'ligação')+' no histórico.');return{idVolum:idv,idSdr:ids};}
function audRdCriarTarefa_(c,uid,subject,notes){var n=new Date(),r=requisicaoJson_(APP.rdBaseUrl+'/tasks?token='+encodeURIComponent(c.token),{method:'post',contentType:'application/json',payload:audRdJsonSeguro_({task:{deal_id:c.dealId,user_ids:[String(uid)],subject:subject,type:'task',hour:Utilities.formatDate(n,APP.timezone,'HH:mm'),date:Utilities.formatDate(n,APP.timezone,'yyyy-MM-dd'),notes:notes}})}),t=r.task||r.data||r||{},id=String(t.id||t._id||t.task_id||'');if(!id)throw new Error('O RD criou a tarefa, mas não devolveu o ID.');return id;}
function audRdConcluir_(c,id){return requisicaoJson_(APP.rdBaseUrl+'/tasks/'+encodeURIComponent(id)+'?token='+encodeURIComponent(c.token),{method:'put',contentType:'application/json',payload:audRdJsonSeguro_({task:{deal_id:c.dealId,done:true}})});}
function audRdTexto_(c){
  var tipo=String(((c||{}).a||{}).TIPO_AUDITORIA||'').toUpperCase();
  if(tipo==='SDR')return audRdTextoSdr_(c);
  if(tipo==='CLOSER')return audRdTextoCloser_(c);
  throw new Error('Tipo de auditoria não suportado para publicação no RD: '+(tipo||'NAO_INFORMADO'));
}
function audRdTextoCloser_(c) {
  var r = c.r || {};
  var n = String.fromCharCode(10);
  var momentos = Array.isArray(r.momentos) ? r.momentos : [];
  var co = r.resumo_reuniao || {};
  var pc = r.pontuacao_calculada || {};
  var feedback = r.feedback || {};
  var perguntas = r.perguntas_diagnostico || {};
  var impacto = r.analise_impacto_implicacao || {};
  var repertorio = Array.isArray(r.repertorio_perguntas_sugeridas) ? r.repertorio_perguntas_sugeridas : [];
  var criterios = Array.isArray(r.criterios_avaliados) ? r.criterios_avaliados : [];
  var passos = Array.isArray(r.proximos_passos) ? r.proximos_passos : [];

  function normCloser(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }
  function curtoCloser(v, max) {
    var t = String(v || '').replace(/\s+/g, ' ').trim();
    if (/Comportamento faltante:.*Critério verificável:/.test(t)) return t;
    max = max || 220;
    return t.length > max ? t.slice(0, max - 1).trim() + '…' : t;
  }
  function semPontoCloser(v) {
    return String(v || '').trim().replace(/[.;]+$/g, '');
  }
  function conforme(x) {
    var s = normCloser((x || {}).cor || (x || {}).status);
    return s === 'VERDE' || s === 'CONFORME';
  }
  function naoAplicavelCloser(x) {
    var s = normCloser((x || {}).cor || (x || {}).status);
    return s === 'NAO_APLICAVEL' || s === 'NAO_EVIDENCIADO';
  }
  function rotuloStatus(v) {
    var s = normCloser(v).replace(/[ -]+/g, '_');
    if (s === 'CONFORME') return 'CONFORME';
    if (s === 'DESVIO_EXECUCAO') return 'Desvio na execução';
    if (s === 'NAO_EXECUTADO') return 'Não executado';
    if (s === 'NAO_APLICAVEL') return 'Não aplicável';
    if (s === 'NAO_EVIDENCIADO') return 'Não evidenciado';
    return String(v || 'Não evidenciado');
  }
  function chaveUnica(v) {
    return normCloser(v).replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  function adicionarUnico(lista, vistos, texto) {
    var limpo = String(texto || '').trim();
    if (!limpo) return;
    var chave = chaveUnica(limpo);
    if (!chave || vistos[chave]) return;
    vistos[chave] = true;
    lista.push(limpo);
  }
  function ehTemaImplicacaoNecessidade(v) {
    var t = normCloser(v);
    return /(IMPLIC|IMPACT|CONSEQU|CUSTO|FINANCEIR|INA[CÇ]AO|NECESS|RESULTADO|PRIORIDADE|URGENC|RISCO|PERDA|GANHO)/.test(t);
  }
  function coachingAcionavelCloser(v) {
    var bruto = String(v || '').trim();
    if (!bruto) return false;
    if (audV3TemRecomendacaoGenerica_(bruto)) return false;
    var t = normCloser(bruto);
    if (/[?"]/g.test(bruto)) return true;
    if (/(PERGUNTE|DIGA|CONFIRME|OFERECA|OFEREÇA|ENVIE|MARQUE|AGEND|CONVITE|DUAS OPCOES|DUAS OPÇÕES|DATA|HORARIO|HORÁRIO|REGISTRE|VALIDAR COM O LEAD|PERGUNTA DO PITCH)/.test(t)) return true;
    if (/(REVISAR|MELHORAR|APROFUNDAR|REFORCAR|REFORÇAR|ESTRUTURAR|SEGUIR O PITCH|APLICAR CORRETAMENTE|EXPLORAR MELHOR)/.test(t) && bruto.length < 180) return false;
    return bruto.length >= 90 && /(COMO|QUANDO|ANTES DE|DEPOIS DE|PARA QUE|ATE QUE|ATÉ QUE)/.test(t);
  }

  var aderentes = momentos.filter(conforme);
  var desviosMomentos = momentos.filter(function(x) { return !conforme(x) && !naoAplicavelCloser(x); });

  var acertos = aderentes.slice(0, 4).map(function(x) {
    return '- ' + String(x.nome || x.id || 'Momento') + ': ' + curtoCloser(x.o_que_foi_dito || 'Execução evidenciada na transcrição.', 210);
  });

  var perguntasRealizadasBase = (Array.isArray(perguntas.perguntas_realizadas) ? perguntas.perguntas_realizadas : [])
    .filter(function(x) { return x && String(x.pergunta || '').trim(); });
  var perguntasFaltantesBase = (Array.isArray(perguntas.perguntas_esperadas_nao_realizadas) ? perguntas.perguntas_esperadas_nao_realizadas : [])
    .filter(function(x) { return x && String(x.pergunta || '').trim(); });

  var perguntasRealizadas = perguntasRealizadasBase.slice(0, 10).map(function(x) {
    var contexto = [x.categoria, x.timestamp].filter(Boolean).join(' · ');
    var linha = '- ' + (contexto ? '[' + contexto + '] ' : '') + '"' + curtoCloser(x.pergunta, 220) + '"';
    if (x.resposta_lead) linha += ' | Resposta: ' + curtoCloser(x.resposta_lead, 180);
    return linha;
  });

  var perguntasFaltantes = perguntasFaltantesBase.slice(0, 8).map(function(x) {
    var linha = '- ' + (x.categoria ? '[' + curtoCloser(x.categoria, 60) + '] ' : '') + '"' + curtoCloser(x.pergunta, 230) + '"';
    if (x.motivo_importancia) linha += ' | Por que importa: ' + curtoCloser(x.motivo_importancia, 170);
    return linha;
  });

  var perguntasSugeridasBase = repertorio.filter(function(x) {
    return x && String(x.pergunta_sugerida || '').trim() && normCloser(x.origem) === 'SUGESTAO_ENABLEMENT';
  });
  var perguntasSugeridas = perguntasSugeridasBase.slice(0, 4).map(function(x) {
    return '- ' + (x.categoria ? '[' + curtoCloser(x.categoria, 60) + '] ' : '') + '"' + curtoCloser(x.pergunta_sugerida, 230) + '"' +
      (x.objetivo ? ' | Objetivo: ' + curtoCloser(x.objetivo, 160) : '');
  });

  var implicacaoNecessidade = [];
  var vistosImplicacao = {};
  (Array.isArray(impacto.lacunas) ? impacto.lacunas : []).slice(0, 4).forEach(function(item) {
    adicionarUnico(implicacaoNecessidade, vistosImplicacao, '- Lacuna a aprofundar: ' + curtoCloser(item, 220));
  });
  (Array.isArray(impacto.impactos_identificados) ? impacto.impactos_identificados : []).slice(0, 4).forEach(function(item) {
    adicionarUnico(implicacaoNecessidade, vistosImplicacao, '- Impacto do lead que deveria ser aprofundado: ' + curtoCloser(item, 220));
  });
  perguntasFaltantesBase.filter(function(item) {
    return ehTemaImplicacaoNecessidade([item.categoria, item.motivo_importancia, item.impacto_da_ausencia, item.pergunta].join(' '));
  }).slice(0, 4).forEach(function(item) {
    adicionarUnico(
      implicacaoNecessidade,
      vistosImplicacao,
      '- Pergunta do pitch para aprofundar: "' + curtoCloser(item.pergunta, 230) + '"' +
        (item.sugestao_aplicacao ? ' | Como aplicar: ' + curtoCloser(item.sugestao_aplicacao, 170) : '')
    );
  });
  perguntasSugeridasBase.filter(function(item) {
    return ehTemaImplicacaoNecessidade([item.categoria, item.objetivo, item.pergunta_sugerida].join(' '));
  }).slice(0, 3).forEach(function(item) {
    adicionarUnico(
      implicacaoNecessidade,
      vistosImplicacao,
      '- Sugestão de enablement para aprofundar: "' + curtoCloser(item.pergunta_sugerida, 230) + '"' +
        (item.objetivo ? ' | Objetivo: ' + curtoCloser(item.objetivo, 160) : '')
    );
  });

  var ajustesObjetivos = [];
  var vistosAjustes = {};
  perguntasFaltantesBase.slice(0, 5).forEach(function(item) {
    adicionarUnico(
      ajustesObjetivos,
      vistosAjustes,
      '- ' + (item.categoria ? curtoCloser(item.categoria, 60) + ': ' : 'Diagnóstico: ') +
        'pergunte "' + curtoCloser(item.pergunta, 230) + '"' +
        (item.sugestao_aplicacao ? ' | Aplicação: ' + curtoCloser(item.sugestao_aplicacao, 170) : '')
    );
  });

  desviosMomentos.slice(0, 4).forEach(function(item) {
    var nome = String(item.nome || item.id || 'Momento');
    if (String(item.texto_script || '').trim() && coachingAcionavelCloser(item.texto_script)) {
      adicionarUnico(ajustesObjetivos, vistosAjustes, '- ' + nome + ': orientação prática — ' + curtoCloser(item.texto_script, 240));
      return;
    }
    if (String(item.como_agir || '').trim() && coachingAcionavelCloser(item.como_agir)) {
      adicionarUnico(ajustesObjetivos, vistosAjustes, '- ' + nome + ': ' + curtoCloser(item.como_agir, 240));
      return;
    }
    if (String(item.o_que_fazer || '').trim() && coachingAcionavelCloser(item.o_que_fazer)) {
      adicionarUnico(ajustesObjetivos, vistosAjustes, '- ' + nome + ': ' + curtoCloser(item.o_que_fazer, 240));
      return;
    }
    var criterioRelacionado = criterios.find(function(crit) {
      if (!crit || crit.aplicavel === false) return false;
      var statusCrit = normCloser(crit.status);
      if (statusCrit === 'CONFORME') return false;
      return chaveUnica([crit.nome, crit.id].join(' ')).split(' ').some(function(token) {
        return token.length > 4 && chaveUnica(nome).indexOf(token) >= 0;
      });
    });
    if (criterioRelacionado && String(criterioRelacionado.correcao_pratica || '').trim() && coachingAcionavelCloser(criterioRelacionado.correcao_pratica)) {
      adicionarUnico(ajustesObjetivos, vistosAjustes, '- ' + nome + ': ' + curtoCloser(criterioRelacionado.correcao_pratica, 240));
      return;
    }
    if (criterioRelacionado && /\?/.test(String(criterioRelacionado.regra_pitch || '')) && !audV3TemRecomendacaoGenerica_(criterioRelacionado.regra_pitch)) {
      adicionarUnico(ajustesObjetivos, vistosAjustes, '- ' + nome + ': execute conforme a regra do pitch "' + curtoCloser(criterioRelacionado.regra_pitch, 240) + '"');
    }
  });

  var fechamento = momentos.find(function(x) { return String((x || {}).id || '') === 'momento_3'; }) || {};
  var fechamentoTexto = [
    fechamento.divergencia,
    fechamento.o_que_fazer,
    fechamento.como_agir,
    (fechamento.pontos_melhorar || []).join(' ')
  ].join(' ');
  if (!conforme(fechamento) && /(AGEND|HORAR|PROXIMO PASSO|FOLLOW|DATA|CONVITE|COMPROMISSO)/.test(normCloser(fechamentoTexto))) {
    adicionarUnico(
      ajustesObjetivos,
      vistosAjustes,
      '- Fechamento: termine com duas opções objetivas de agenda. Exemplo de execução: "Posso te enviar o convite para terça às 14h ou quarta às 16h. Qual funciona melhor?"'
    );
  }

  var proximos = ajustesObjetivos.slice(0, 7);
  if (!proximos.length) {
    passos.filter(function(x) {
      return x && String(x.acao || '').trim() && coachingAcionavelCloser(x.acao);
    }).slice(0, 5).forEach(function(x) {
      adicionarUnico(
        proximos,
        {},
        '- ' + curtoCloser(x.acao, 210) +
          (x.criterio_conclusao ? ' | Concluído quando: ' + curtoCloser(x.criterio_conclusao, 170) : '')
      );
    });
  }
  if (!proximos.length) {
    perguntasSugeridasBase.slice(0, 3).forEach(function(item) {
      adicionarUnico(
        proximos,
        vistosAjustes,
        '- Enablement: pergunte "' + curtoCloser(item.pergunta_sugerida, 230) + '"' +
          (item.quando_usar ? ' | Quando usar: ' + curtoCloser(item.quando_usar, 150) : '') +
          (item.objetivo ? ' | Objetivo: ' + curtoCloser(item.objetivo, 150) : '')
      );
    });
  }

  var fortes = Array.isArray(feedback.pontos_fortes) ? feedback.pontos_fortes.filter(Boolean).slice(0, 3) : [];
  var nomesAderentes = aderentes.slice(0, 2).map(function(x) { return String(x.nome || x.id || '').trim(); }).filter(Boolean);
  var p1 = fortes.length
    ? 'Pontos fortes: ' + fortes.map(semPontoCloser).join('; ') + '.'
    : (nomesAderentes.length
      ? 'Pontos fortes: ' + nomesAderentes.join('; ') + '.'
      : 'Pontos fortes: nenhum ponto foi destacado sem evidência suficiente.');

  var resumoAjustes = proximos.slice(0, 3).map(function(item) {
    return String(item || '').replace(/^[-•]\s*/, '').trim();
  }).filter(Boolean);
  var p2 = resumoAjustes.length
    ? 'Prioridade prática para a próxima reunião: ' + resumoAjustes.join(' | ')
    : 'Prioridade prática: nenhuma ação adicional foi incluída porque não havia orientação específica e rastreável suficiente para coaching.';

  var acordoResumo = String(co.resultado_reuniao || '').trim();
  var acordoEvidencia = String(fechamento.o_que_foi_dito || '').trim();
  var acordoLinhas = [];
  if (acordoResumo) acordoLinhas.push('Acordo registrado: ' + curtoCloser(acordoResumo, 320));
  else acordoLinhas.push('Acordo registrado: Não evidenciado na reunião.');
  if (acordoEvidencia && !/^n[aã]o evidenciado/i.test(acordoEvidencia)) {
    acordoLinhas.push('Evidência do fechamento: "' + curtoCloser(acordoEvidencia, 240) + '"');
  }

  var scoreLinhas = criterios.slice(0, 8).map(function(item) {
    var nota = item && item.aplicavel === false
      ? 'N/A'
      : (item && item.pontuacao !== null && item.pontuacao !== undefined && item.pontuacao !== '' ? String(item.pontuacao) + '/5' : 'N/A');
    return '- ' + String((item || {}).nome || (item || {}).id || 'Critério') + ' | ' +
      rotuloStatus((item || {}).status) + ' | ' + nota;
  });

  var score = pc.score_5 != null ? pc.score_5 : c.a.SCORE;
  var pct = pc.score_percentual != null ? pc.score_percentual : c.a.SCORE_PERCENTUAL;

  var linhas = [
    'AUDITORIA CLOSER — ' + String(c.i.TITULO || c.i.OPORTUNIDADE || ''),
    'Responsável: ' + String(c.i.COLABORADOR || c.i.VENDEDOR || c.sdr.nome || 'Não identificado'),
    'Nota geral: ' + String(score != null && score !== '' ? score : '-') + '/5' + (pct != null && pct !== '' ? ' (' + pct + '%)' : ''),
    'PONTUAÇÃO DE QUALIDADE',
    scoreLinhas.length ? scoreLinhas.join(n) : '- Pontuação por critério indisponível.',
    'Média dos critérios aplicáveis: ' + String(score != null && score !== '' ? score : '-') + '/5',
    '',
    'CENÁRIO DA REUNIÃO',
    curtoCloser(co.resumo_conversa || 'Não evidenciado', 450),
    co.dor_principal ? 'Dor principal: ' + curtoCloser(co.dor_principal, 250) : '',
    co.impacto_principal ? 'Impacto principal: ' + curtoCloser(co.impacto_principal, 250) : '',
    co.resultado_reuniao ? 'Resultado da reunião: ' + curtoCloser(co.resultado_reuniao, 300) : '',
    '',
    'EXECUÇÕES ADERENTES AO PROCESSO',
    acertos.length ? acertos.join(n) : '- Nenhum momento foi classificado como plenamente conforme.',
    '',
    'PERGUNTAS REALIZADAS PELO CLOSER',
    perguntasRealizadas.length ? perguntasRealizadas.join(n) : '- Nenhuma pergunta foi registrada com evidência literal suficiente.',
    '',
    'PERGUNTAS DO PITCH QUE DEVERIAM TER SIDO FEITAS',
    perguntasFaltantes.length ? perguntasFaltantes.join(n) : '- Nenhuma pergunta obrigatória ausente foi identificada.',
    '',
    'IMPLICAÇÃO E NECESSIDADE — O QUE DEVERIA TER SIDO EXPLORADO',
    implicacaoNecessidade.length ? implicacaoNecessidade.join(n) : '- Nenhuma lacuna específica de implicação ou necessidade foi identificada com segurança.',
    '',
    perguntasSugeridas.length ? 'SUGESTÕES DE APROFUNDAMENTO' : '',
    perguntasSugeridas.length ? perguntasSugeridas.join(n) : '',
    perguntasSugeridas.length ? 'Observação: estas perguntas são sugestões de enablement e não substituem o pitch vigente.' : '',
    perguntasSugeridas.length ? '' : '',
    'ACORDO DE PRÓXIMO PASSO',
    acordoLinhas.join(n),
    '',
    'AJUSTES OBJETIVOS PARA A PRÓXIMA REUNIÃO',
    proximos.length ? proximos.join(n) : '- Nenhum ajuste objetivo adicional foi identificado.',
    '',
    'CONCLUSÃO',
    p1,
    p2,
    '',
    c.i.URL_GRAVACAO ? 'Gravação: ' + c.i.URL_GRAVACAO : '',
    c.a.LINK_DOCUMENTO ? 'Auditoria completa: ' + c.a.LINK_DOCUMENTO : ''
  ];

  return linhas.filter(function(x, i, a) {
    return x !== '' || (i > 0 && a[i - 1] !== '');
  }).join(n).trim();
}

function audRdTextoSdr_(c) {
  var r = c.r || {};
  var n = String.fromCharCode(10);
  var ep = Array.isArray(r.etapas_pitch) ? r.etapas_pitch : [];
  var co = r.resumo_contato || {};
  var pc = r.pontuacao_calculada || {};
  var feedback = r.feedback || {};
  var contexto = r.contexto_interacao || {};
  var perguntas = r.perguntas_qualificacao || {};
  var objecoes = Array.isArray(r.manejo_objecoes) ? r.manejo_objecoes : [];
  var objecoesForaPitch = Array.isArray(r.objecoes_fora_pitch) ? r.objecoes_fora_pitch : [];
  var passos = Array.isArray(r.proximos_passos) ? r.proximos_passos : [];

  function norm(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }
  function curto(v, max) {
    if (/Comportamento faltante:.*Critério verificável:/.test(String(v || ''))) return String(v);
    var t = String(v || '').replace(/\s+/g, ' ').trim();
    max = max || 220;
    return t.length > max ? t.slice(0, max - 1).trim() + '…' : t;
  }
  function semPonto(v) {
    return String(v || '').trim().replace(/[.;]+$/g, '');
  }
  function fraseMin(v) {
    var t = semPonto(v);
    return t ? t.charAt(0).toLowerCase() + t.slice(1) : '';
  }
  function rotuloContexto(v) {
    var t = String(v || '').trim().replace(/_/g, ' ').toLowerCase();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }
  function adicionarUnicoSdr(lista, vistos, valor) {
    var texto = String(valor || '').trim();
    if (!texto) return;
    var chave = norm(texto).replace(/[^A-Z0-9]+/g, ' ').trim();
    if (!chave || vistos[chave]) return;
    vistos[chave] = true;
    lista.push(texto);
  }

  var criterios = Array.isArray(r.criterios_avaliados) ? r.criterios_avaliados : [];
  var notasCriterios = criterios.filter(function(item) {
    return item && item.aplicavel !== false;
  }).slice(0, 12).map(function(item) {
    var nota = item.pontuacao;
    if (nota === null || nota === undefined || nota === '') nota = '-';
    var status = String(item.status || '').trim();
    return '- ' + curto(item.nome || item.id || 'Critério', 110) + ': ' + String(nota) + '/5' + (status ? ' | ' + status.replace(/_/g, ' ') : '');
  });
  var mediaCriterios = criterios.filter(function(item) {
    return item && item.aplicavel !== false && item.pontuacao !== null && item.pontuacao !== undefined && item.pontuacao !== '';
  });
  var mediaCalculada = mediaCriterios.length
    ? Math.round((mediaCriterios.reduce(function(total, item) { return total + Number(item.pontuacao || 0); }, 0) / mediaCriterios.length) * 100) / 100
    : null;

  var conformes = ep.filter(function(x) {
    return norm((x || {}).status) === 'CONFORME';
  });
  var desvios = ep.filter(function(x) {
    var s = norm((x || {}).status);
    return s === 'DESVIO_EXECUCAO' || s === 'NAO_EXECUTADO';
  });

  var acertos = conformes.slice(0, 5).map(function(x) {
    return '- ' + String(x.etapa || 'Etapa') + ': ' + curto(x.fato_transcricao || 'Execução evidenciada na transcrição.', 180);
  });
  var erros = desvios.slice(0, 5).map(function(x) {
    var linha = '- ' + String(x.etapa || 'Etapa') + ': ' + curto(x.desvio || 'Execução não evidenciada.', 180);
    if (x.regra_pitch) linha += ' | Pitch: ' + curto(x.regra_pitch, 150);
    return linha;
  });

  var perguntasCorretas = (Array.isArray(perguntas.corretas) ? perguntas.corretas : []).slice(0, 5).map(function(x) {
    var linha = '- SDR: "' + curto(x.pergunta, 190) + '"';
    if (x.resposta_lead && !/^n[aã]o evidenciado/i.test(String(x.resposta_lead))) linha += ' | Lead: ' + curto(x.resposta_lead, 170);
    return linha;
  });
  var perguntasDesvio = (Array.isArray(perguntas.com_desvio) ? perguntas.com_desvio : []).slice(0, 5).map(function(x) {
    var linha = '- SDR: "' + curto(x.pergunta, 190) + '"';
    if (x.resposta_lead && !/^n[aã]o evidenciado/i.test(String(x.resposta_lead))) linha += ' | Lead: ' + curto(x.resposta_lead, 150);
    if (x.correcao_pratica) linha += ' | Ajuste: ' + curto(x.correcao_pratica, 190);
    return linha;
  });
  var perguntasAusentes = (Array.isArray(perguntas.ausentes) ? perguntas.ausentes : []).slice(0, 5).map(function(x) {
    var linha = '- Faltou: "' + curto(x.pergunta_esperada, 200) + '"';
    if (x.como_perguntar) linha += ' | Como executar: "' + curto(x.como_perguntar, 190) + '"';
    return linha;
  });

  var ajustes = [];
  var vistosAjustes = {};
  (Array.isArray(perguntas.com_desvio) ? perguntas.com_desvio : []).forEach(function(x) {
    adicionarUnicoSdr(ajustes, vistosAjustes, x && x.correcao_pratica ? '- Pergunta: ' + curto(x.correcao_pratica, 230) : '');
  });
  (Array.isArray(perguntas.ausentes) ? perguntas.ausentes : []).forEach(function(x) {
    adicionarUnicoSdr(ajustes, vistosAjustes, x && x.como_perguntar ? '- Pergunte: "' + curto(x.como_perguntar, 220) + '"' : '');
  });
  objecoes.forEach(function(x) {
    adicionarUnicoSdr(ajustes, vistosAjustes, x && x.correcao_pratica ? '- Objeção: ' + curto(x.correcao_pratica, 230) : '');
  });
  objecoesForaPitch.forEach(function(x) {
    adicionarUnicoSdr(ajustes, vistosAjustes, x && x.sugestao_tratamento ? '- Enablement: ' + curto(x.sugestao_tratamento, 230) : '');
  });
  desvios.forEach(function(x) {
    adicionarUnicoSdr(ajustes, vistosAjustes, x && x.correcao_pratica ? '- ' + String(x.etapa || 'Etapa') + ': ' + curto(x.correcao_pratica, 230) : '');
  });
  passos.forEach(function(x) {
    if (!x || !String(x.acao || '').trim()) return;
    adicionarUnicoSdr(
      ajustes,
      vistosAjustes,
      '- Próximo passo: ' + curto(x.acao, 220) +
        (x.criterio_conclusao ? ' | Concluído quando: ' + curto(x.criterio_conclusao, 150) : '')
    );
  });
  ajustes = ajustes.slice(0, 6);

  var principal = desvios[0] || {};
  var fortes = Array.isArray(feedback.pontos_fortes) ? feedback.pontos_fortes.filter(Boolean) : [];
  var nomesConformes = conformes.slice(0, 3).map(function(x) { return String(x.etapa || '').trim(); }).filter(Boolean);
  var nomesDesvios = desvios.slice(0, 2).map(function(x) { return String(x.etapa || '').trim(); }).filter(Boolean);

  var p1 = nomesConformes.length
    ? 'A SDR executou corretamente ' + nomesConformes.join(', ') + '.'
    : (fortes.length ? 'A SDR apresentou execução aderente em ' + fortes.slice(0, 2).map(semPonto).join('; ') + '.' : 'Não houve etapa plenamente conforme para destacar com segurança.');

  var p2 = nomesDesvios.length
    ? 'O principal ajuste está em ' + nomesDesvios.join(' e ') + '.'
    : 'Não foi identificado desvio prioritário nesta interação.';

  var p3 = ajustes.length
    ? 'Na prática, a próxima execução deve começar por: ' + fraseMin(ajustes[0].replace(/^[-•]\s*/, '')) + '.'
    : 'Na prática, mantenha as etapas conformes e repita o mesmo padrão na próxima ligação.';

  var score = pc.score_5 != null ? pc.score_5 : c.a.SCORE;
  var pct = pc.score_percentual != null ? pc.score_percentual : c.a.SCORE_PERCENTUAL;
  var contextoLinha = rotuloContexto(contexto.classificacao || '');
  var aplicaveis = Array.isArray(contexto.etapas_aplicaveis) ? contexto.etapas_aplicaveis.filter(Boolean).slice(0, 6) : [];
  var concluidas = Array.isArray(contexto.etapas_ja_concluidas) ? contexto.etapas_ja_concluidas.filter(Boolean).slice(0, 6) : [];

  var linhas = [
    'AUDITORIA SDR — ' + String(c.i.TITULO || c.i.OPORTUNIDADE || ''),
    'Responsável: ' + String(c.i.COLABORADOR || c.i.VENDEDOR || c.sdr.nome || 'Não identificado'),
    'Nota geral: ' + String(score != null && score !== '' ? score : '-') + '/5' + (pct != null && pct !== '' ? ' (' + pct + '%)' : ''),
    'PONTUAÇÃO POR CRITÉRIO',
    notasCriterios.length ? notasCriterios.join(n) : '- Pontuação por critério indisponível.',
    mediaCalculada != null ? 'Média dos critérios aplicáveis: ' + String(mediaCalculada) + '/5' : '',
    '',
    contextoLinha ? 'CONTEXTO DA INTERAÇÃO' : '',
    contextoLinha ? 'Tipo: ' + contextoLinha : '',
    contexto.objetivo_principal ? 'Objetivo: ' + curto(contexto.objetivo_principal, 260) : '',
    aplicaveis.length ? 'Aplicável nesta ligação: ' + aplicaveis.map(curto).join(' | ') : '',
    concluidas.length ? 'Já concluído anteriormente: ' + concluidas.map(curto).join(' | ') : '',
    contextoLinha ? '' : '',
    'CENÁRIO DA LIGAÇÃO',
    curto(co.resumo_conversa || 'Não evidenciado', 430),
    co.motivacao_contato ? 'Motivação: ' + curto(co.motivacao_contato, 240) : '',
    co.necessidade_principal ? 'Necessidade principal: ' + curto(co.necessidade_principal, 240) : '',
    co.resultado_contato ? 'Resultado: ' + curto(co.resultado_contato, 240) : '',
    '',
    'O QUE FOI EXECUTADO CORRETAMENTE',
    acertos.length ? acertos.join(n) : '- Nenhuma etapa foi classificada como plenamente conforme.',
    '',
    (perguntasCorretas.length || perguntasDesvio.length || perguntasAusentes.length) ? 'PERGUNTAS DE QUALIFICAÇÃO' : '',
    perguntasCorretas.length ? 'Corretas:' : '',
    perguntasCorretas.length ? perguntasCorretas.join(n) : '',
    perguntasDesvio.length ? 'Com desvio:' : '',
    perguntasDesvio.length ? perguntasDesvio.join(n) : '',
    perguntasAusentes.length ? 'Aplicáveis e não realizadas:' : '',
    perguntasAusentes.length ? perguntasAusentes.join(n) : '',
    (perguntasCorretas.length || perguntasDesvio.length || perguntasAusentes.length) ? '' : '',
    'DESVIOS EM RELAÇÃO AO PITCH/PROCESSO',
    erros.length ? erros.join(n) : '- Nenhum desvio de execução foi identificado.',
    principal.fato_transcricao ? 'Evidência principal: "' + curto(principal.fato_transcricao, 210) + '"' : '',
    '',
    'SE EU FOSSE O SDR, FARIA ASSIM',
    ajustes.length ? ajustes.join(n) : '- Manteria a execução conforme observada nesta ligação.',
    '',
    'CONCLUSÃO',
    p1,
    '',
    p2,
    '',
    p3,
    '',
    c.i.URL_GRAVACAO ? 'Gravação: ' + c.i.URL_GRAVACAO : '',
    c.a.LINK_DOCUMENTO ? 'Auditoria completa: ' + c.a.LINK_DOCUMENTO : ''
  ];

  return linhas.filter(function(x, i, a) {
    return x !== '' || (i > 0 && a[i - 1] !== '');
  }).join(n).trim();
}

function audRdJsonSeguro_(v){return JSON.stringify(v).replace(/[\u007f-\uffff]/g,function(ch){return '\\u'+('0000'+ch.charCodeAt(0).toString(16)).slice(-4);});}
