var RD_AUDITORIA_EMAIL_VOLUM='crm@govolum.com';
// O envio de Closer fica desligado até a liberação explícita após o Canônico.
// O padrão seguro é NÃO, inclusive quando já há LINK_CRM preenchido.
function audRdPublicacaoCloserLiberada_() {
  return typeof obterConfiguracao_ === 'function' &&
    String(obterConfiguracao_('AUDITORIA_CLOSER_RD_AUTORIZADA') || '').toUpperCase() === 'SIM';
}
function audRdBloqueioCanonicoCloser_(auditoria) {
  return String((auditoria || {}).TIPO_AUDITORIA || '').toUpperCase() === 'CLOSER' &&
    !audRdPublicacaoCloserLiberada_();
}

function audRdPublicarAutomaticamente_(idAuditoria) {
  audRdEstr_();
  var id = String(idAuditoria || '').trim();
  var a = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id);
  if (!a) throw new Error('Auditoria não encontrada.');
  var tipo = String(a.TIPO_AUDITORIA || '').toUpperCase();
  if (['SDR', 'CLOSER'].indexOf(tipo) < 0) {
    return { aplicavel: false, publicada: false, status: 'NAO_APLICAVEL', mensagem: 'Publicação no RD não se aplica a este tipo de auditoria.' };
  }
  if (audRdBloqueioCanonicoCloser_(a)) {
    if (String(a.RD_STATUS || '').toUpperCase() !== 'PUBLICADA') {
      audRdStatus_(id, 'AGUARDANDO_CANONICO', '', '');
    }
    return {
      aplicavel: false,
      publicada: false,
      status: 'AGUARDANDO_CANONICO',
      mensagem: 'Closer não será enviado ao RD antes da liberação explícita após o vínculo Canônico.'
    };
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
  var tipoAuditoria = String(a.TIPO_AUDITORIA || '').toUpperCase();
  var aprovadaValidada = String(a.STATUS || '').toUpperCase() === 'APROVADA' &&
    String(a.VALIDACAO_STATUS || '').toUpperCase() === 'VALIDADA';

  if (deal && aprovadaValidada && ['SDR', 'CLOSER'].indexOf(tipoAuditoria) >= 0 &&
      !audRdBloqueioCanonicoCloser_(a)) {
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
  var statusAuditoria = String(a.STATUS || '').toUpperCase();
  return {
    sucesso: true,
    mensagem: audRdBloqueioCanonicoCloser_(a)
      ? (deal
          ? 'Vínculo da negociação salvo no Board. O Closer permanece sem envio ao RD até a liberação após o Canônico.'
          : 'Vínculo removido. O Closer permanece sem envio ao RD até o Canônico.')
      : deal
      ? (publicacao && publicacao.publicada
            ? 'Negociação vinculada e auditoria publicada automaticamente no RD CRM.'
            : statusAuditoria === 'APROVADA'
              ? 'Negociação do RD vinculada. O envio automático foi processado.'
              : 'Negociação do RD vinculada. O envio automático ocorrerá depois da aprovação da auditoria.')
      : 'Vínculo com o RD removido.',
    publicacaoRd: publicacao,
    auditoria: audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', id)),
    auditorias: audV3ListarAuditoriasFront_()
  };
}
function audRdPreviewCtx_(id){
  audRdEstr_();
  var a=audV3Localizar_('AUDITORIAS','ID_AUDITORIA',String(id||'').trim());
  if(!a)throw new Error('Auditoria não encontrada.');
  var tipo=String(a.TIPO_AUDITORIA||'').toUpperCase();
  if(['SDR','CLOSER'].indexOf(tipo)<0)throw new Error('Somente auditorias de SDR ou Closer possuem prévia para o RD CRM.');
  if(!String(a.RESULTADO_JSON||'').trim())throw new Error('A auditoria ainda não possui resultado para prévia.');
  var i=audV3Localizar_('INTERACOES','ID_INTERACAO',a.ID_INTERACAO)||{};
  var r=audV3ParseJson_(a.RESULTADO_JSON,'Resultado JSON inválido.');
  var it=typeof obterIntegracaoCliente_==='function'?obterIntegracaoCliente_(a.ID_CLIENTE,'RD_STATION'):null;
  var temToken=false;
  if(it&&String(it.ATIVO||'').toUpperCase()==='SIM'){
    try{temToken=Boolean(obterSegredo_('INTEGRACAO_TOKEN_'+it.ID_INTEGRACAO));}catch(e){}
  }
  var nomeResponsavelPreview=audRdUsaResponsavelGrupoSinergia_(a)
    ? 'Sinergia Engenharia'
    : String(i.COLABORADOR||i.VENDEDOR||((r.metadados||{}).closer)||((r.metadados||{}).sdr)||'Não identificado');
  return{
    a:a,i:i,r:r,
    dealId:audRdDeal_(i),
    token:'',
    sdr:{id:'',nome:nomeResponsavelPreview,email:''},
    volum:{id:'',nome:'VOLUM',email:RD_AUDITORIA_EMAIL_VOLUM},
    temToken:temToken
  };
}
function prepararEnvioAuditoriaRd(id){
  var c=audRdPreviewCtx_(id);
  var salvo=String(c.a.RD_TEXTO_APROVADO||'').trim();
  return{
    idAuditoria:c.a.ID_AUDITORIA,
    dealId:c.dealId,
    oportunidade:c.i.OPORTUNIDADE||c.i.TITULO||'',
    responsavel:c.sdr.nome||'',
    usuarioPublicacao:c.volum.email,
    texto:salvo||audRdTexto_(c),
    temToken:c.temToken,
    temVinculo:Boolean(c.dealId),
    statusAuditoria:String(c.a.STATUS||''),
    aviso:'Revise e edite o texto antes de aprovar. O RD registra a anotação no histórico da negociação.'
  };
}
function enviarAuditoriaParaRd(d){d=d||{};var registro=audV3Localizar_('AUDITORIAS','ID_AUDITORIA',String(d.idAuditoria||'').trim());if(!registro)throw new Error('Auditoria não encontrada.');if(audRdBloqueioCanonicoCloser_(registro))throw new Error('Publicação de auditorias Closer no RD bloqueada até o vínculo Canônico ser validado por Sales Ops.');var c=audRdCtx_(d.idAuditoria),textoEditado=String(d.texto||c.a.RD_TEXTO_APROVADO||'').trim(),texto=textoEditado||String(audRdTexto_(c)).trim();if(!texto)throw new Error('A anotação do RD ficou vazia.');texto=audRdSanitizarTextoPublico_(texto);if(texto.indexOf(String(c.a.LINK_DOCUMENTO))<0)texto+='\n\nAuditoria completa: '+String(c.a.LINK_DOCUMENTO);if(textoEditado){audV3Atualizar_('AUDITORIAS','ID_AUDITORIA',c.a.ID_AUDITORIA,{RD_TEXTO_APROVADO:texto,RD_TEXTO_APROVADO_EM:new Date()});c.a.RD_TEXTO_APROVADO=texto;}var ja=String(c.a.RD_STATUS||'').toUpperCase()==='PUBLICADA',ativId=String(c.a.RD_ACTIVITY_ID||'');if(!ja){var notas=audRdNotas_(c.token,c.dealId),legado='[BOARDAUDIT:'+c.a.ID_AUDITORIA+']';var dup=notas.find(function(x){var t=audRdTextoNota_(x);return t.indexOf(legado)>=0||audRdCmp_(t)===audRdCmp_(texto);});if(dup){ja=true;ativId=String(dup.id||dup._id||(dup.activity||{}).id||'');}}
if(!ja){var rr=requisicaoJson_(APP.rdBaseUrl+'/activities?token='+encodeURIComponent(c.token),{method:'post',contentType:'application/json',payload:audRdJsonSeguro_({activity:{user_id:c.volum.id,deal_id:c.dealId,text:texto}})}),at=rr.activity||rr.data||rr||{};ativId=String(at.id||at._id||'');audRdStatus_(c.a.ID_AUDITORIA,'PUBLICADA',ativId,'');}
var ts=audRdTarefas_(c);audRdStatus_(c.a.ID_AUDITORIA,'PUBLICADA',ativId,'',ts);return{sucesso:true,publicada:true,duplicada:ja,mensagem:(ja?'A anotação já estava no histórico. ':'Resultado registrado no histórico. ')+'As tarefas do VOLUM e do SDR foram conferidas.',auditoria:audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS','ID_AUDITORIA',c.a.ID_AUDITORIA)),auditorias:audV3ListarAuditoriasFront_()};}
function aprovarEEnviarAuditoriaRd(d){
  d=d||{};
  var id=String(d.idAuditoria||'').trim();
  var texto=String(d.texto||'').trim();
  if(!id)throw new Error('Auditoria não informada.');
  if(!texto)throw new Error('Revise o texto antes de aprovar.');
  audRdEstr_();
  audV3Atualizar_('AUDITORIAS','ID_AUDITORIA',id,{RD_TEXTO_APROVADO:texto,RD_TEXTO_APROVADO_EM:new Date()});
  var a=audV3Localizar_('AUDITORIAS','ID_AUDITORIA',id);
  if(!a)throw new Error('Auditoria não encontrada.');
  if(String(a.STATUS||'').toUpperCase()!=='APROVADA')aprovarAuditoriaV3(id);
  try{
    return enviarAuditoriaParaRd({idAuditoria:id,texto:texto});
  }catch(erro){
    var atual=audV3Localizar_('AUDITORIAS','ID_AUDITORIA',id);
    return{
      sucesso:true,
      publicada:false,
      mensagem:'Auditoria aprovada e texto do RD salvo. Envio pendente: '+String(erro&&erro.message?erro.message:erro),
      auditoria:audV3AuditoriaFront_(atual),
      auditorias:audV3ListarAuditoriasFront_()
    };
  }
}
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
  if (tipoAuditoria === 'CLOSER' && !String(a.LINK_DOCUMENTO || '').trim()) {
    throw new Error('A auditoria Closer só pode ser publicada no RD após a criação do Google Doc completo.');
  }

  var i = audV3Localizar_('INTERACOES', 'ID_INTERACAO', a.ID_INTERACAO) || {};
  var transcricao = audV3TranscricaoExataAuditoria_(a);
  if (!transcricao) throw new Error('A transcrição original da auditoria não foi encontrada.');

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

  var fonteIntegridade = audV3ResolverFonteHashAuditoria_(a, transcricao, i, cliente, pitch, modelo);
  if (!fonteIntegridade.confere) {
    throw new Error('A fonte persistida da auditoria não corresponde ao snapshot aprovado. Gere uma nova auditoria antes de enviar ao RD CRM.');
  }
  transcricao.CONTEUDO = String(fonteIntegridade.conteudo || '').trim();
  transcricao.NORMALIZACAO_VERSAO = fonteIntegridade.normalizacaoVersao || '';

  var resultado = audV3ParseJson_(a.RESULTADO_JSON, 'Resultado JSON inválido.');
  var hashResultado = String(a.HASH_RESULTADO || '').trim();
  if (hashResultado && hashResultado !== audV3HashResultado_(resultado)) {
    throw new Error('O resultado aprovado foi alterado depois da validação. Gere uma nova auditoria antes de enviar ao RD CRM.');
  }
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
function audRdEstr_(){audV3GarantirColunas_(audV3Planilha_(),'AUDITORIAS',['RD_STATUS','RD_ACTIVITY_ID','RD_PUBLICADO_EM','RD_TAREFA_VOLUM_ID','RD_TAREFA_SDR_ID','RD_ERRO','RD_TEXTO_APROVADO','RD_TEXTO_APROVADO_EM','HASH_RESULTADO']);}
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
function audRdUsaResponsavelGrupoSinergia_(auditoria){
  var ids={
    'CLI-20260806105306-25F3490A':true,
    'CLI-20260806112340-E575DA0D':true,
    'CLI_VOL_SEMEIO_CBI':true
  };
  var a=auditoria||{};
  var tipo=String(a.TIPO_AUDITORIA||'').toUpperCase();
  return Boolean(ids[String(a.ID_CLIENTE||'')]) && ['SDR','CLOSER'].indexOf(tipo)>=0;
}
function audRdResponsavelGrupoSinergia_(token){
  var chaveCompartilhada=normalizarTextoComparacao_('Sinergia Engenharia');
  var compartilhados=audRdUsuarios_(token).filter(function(u){
    return normalizarTextoComparacao_(String((u||{}).name||(u||{}).nome||''))===chaveCompartilhada;
  });
  if(compartilhados.length!==1){
    throw new Error(compartilhados.length
      ? 'Há mais de um usuário ativo no RD chamado Sinergia Engenharia. Mantenha apenas um usuário canônico para INGEE, Sinergia e Semeio.'
      : 'O usuário Sinergia Engenharia não foi encontrado entre os usuários ativos do RD CRM.');
  }
  var compartilhado=compartilhados[0]||{};
  return{
    id:String(compartilhado.id||compartilhado._id||compartilhado.user_id||''),
    nome:String(compartilhado.name||compartilhado.nome||'Sinergia Engenharia'),
    email:String(compartilhado.email||'')
  };
}
function audRdNomeResponsavelPublico_(c){
  c=c||{};
  if(audRdUsaResponsavelGrupoSinergia_(c.a||{}))return'Sinergia Engenharia';
  return String((c.i||{}).COLABORADOR||(c.i||{}).VENDEDOR||((c.sdr||{}).nome)||'Não identificado');
}
function audRdResponsavel_(token,i,r,a){
  var meta=(r||{}).metadados||{};
  var ident=String((i||{}).COLABORADOR||(i||{}).VENDEDOR||meta.sdr||meta.closer||'').trim();
  if(audRdUsaResponsavelGrupoSinergia_(a)){
    return audRdResponsavelGrupoSinergia_(token);
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
function audRdTarefas_(c){
  var a=audV3Localizar_('AUDITORIAS','ID_AUDITORIA',c.a.ID_AUDITORIA)||c.a;
  var lista=audRdListaTarefas_(c);
  var ident=audRdIdent_(c);
  var rotulo=String(a.TIPO_AUDITORIA||'').toUpperCase()==='CLOSER'?'atendimento':'ligação';
  var sv='Auditoria da ligação registrada — '+ident;
  var ss='Confira a anotação da Auditoria do '+rotulo+' no histórico — '+ident;
  var idv=String(a.RD_TAREFA_VOLUM_ID||'');
  var ids=String(a.RD_TAREFA_SDR_ID||'');

  if(!idv){
    var ev=lista.find(function(x){return String((x||{}).subject||'')===sv;});
    idv=ev?String(ev.id||ev._id||ev.task_id||''):'';
  }
  if(!ids){
    var es=lista.find(function(x){return String((x||{}).subject||'')===ss;});
    ids=es?String(es.id||es._id||es.task_id||''):'';
  }
  if(!idv){
    idv=audRdCriarTarefa_(c,c.volum.id,sv,'Resultado da auditoria registrado no histórico da negociação.');
    audRdConcluir_(c,idv);
  }
  if(!ids){
    var notaResponsavel=c.sdr&&c.sdr.nome?' Responsável pela tarefa: '+String(c.sdr.nome)+'.':'';
    ids=audRdCriarTarefa_(c,c.sdr.id,ss,'Confira a anotação da Auditoria do '+rotulo+' no histórico.'+notaResponsavel);
  }
  return{idVolum:idv,idSdr:ids};
}
function audRdCriarTarefa_(c,uid,subject,notes){var n=new Date(),r=requisicaoJson_(APP.rdBaseUrl+'/tasks?token='+encodeURIComponent(c.token),{method:'post',contentType:'application/json',payload:audRdJsonSeguro_({task:{deal_id:c.dealId,user_ids:[String(uid)],subject:subject,type:'task',hour:Utilities.formatDate(n,APP.timezone,'HH:mm'),date:Utilities.formatDate(n,APP.timezone,'yyyy-MM-dd'),notes:notes}})}),t=r.task||r.data||r||{},id=String(t.id||t._id||t.task_id||'');if(!id)throw new Error('O RD criou a tarefa, mas não devolveu o ID.');return id;}
function audRdConcluir_(c,id){return requisicaoJson_(APP.rdBaseUrl+'/tasks/'+encodeURIComponent(id)+'?token='+encodeURIComponent(c.token),{method:'put',contentType:'application/json',payload:audRdJsonSeguro_({task:{deal_id:c.dealId,done:true}})});}
function audRdTexto_(c){
  var tipo=String(((c||{}).a||{}).TIPO_AUDITORIA||'').toUpperCase();
  if(tipo==='SDR')return audRdTextoSdr_(c);
  if(tipo==='CLOSER')return audRdTextoCloserCanonico_(c);
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
  function divergenciaNeutraCloser(v) {
    var s = normCloser(v).replace(/[.!]+$/g, '').replace(/\s+/g, ' ').trim();
    return !s || [
      'NAO HOUVE DIVERGENCIA',
      'NENHUMA DIVERGENCIA',
      'NENHUMA DIVERGENCIA REGISTRADA',
      'SEM DIVERGENCIA',
      'NAO EVIDENCIADO',
      'NAO APLICAVEL',
      'N/A'
    ].includes(s);
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
  function listaUnicaCloser(itens) {
    var lista = [];
    var vistos = {};
    (itens || []).forEach(function(item) { adicionarUnico(lista, vistos, item); });
    return lista;
  }
  function criterioRelacionadoCloser(momento) {
    var nome = chaveUnica([(momento || {}).nome, (momento || {}).id].join(' '));
    var tokens = nome.split(' ').filter(function(token) { return token.length > 4; });
    return criterios.find(function(crit) {
      if (!crit || crit.aplicavel === false) return false;
      var statusCrit = normCloser(crit.status);
      if (statusCrit === 'CONFORME' || statusCrit === 'NAO_APLICAVEL' || statusCrit === 'NAO_EVIDENCIADO') return false;
      var alvo = chaveUnica([crit.nome, crit.id].join(' '));
      return tokens.some(function(token) { return alvo.indexOf(token) >= 0; });
    }) || null;
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

  var leiturasMomentos = momentos.filter(function(item) {
    return item && !naoAplicavelCloser(item);
  }).map(function(item) {
    var criterio = criterioRelacionadoCloser(item);
    var gaps = listaUnicaCloser(
      (!divergenciaNeutraCloser(item.divergencia) ? [item.divergencia] : [])
        .concat(Array.isArray(item.pontos_melhorar) ? item.pontos_melhorar : [])
        .concat(criterio && !divergenciaNeutraCloser(criterio.divergencia) ? [criterio.divergencia] : [])
    ).slice(0, 3);
    var fortes = listaUnicaCloser(Array.isArray(item.pontos_fortes) ? item.pontos_fortes : []).slice(0, 3);
    var acao = String(item.o_que_fazer || item.como_agir || (criterio && (criterio.correcao_pratica || criterio.regra_pitch)) || '').trim();
    var pitch = String(item.texto_script || (criterio && criterio.regra_pitch) || '').trim();
    return { item: item, gaps: gaps, fortes: fortes, acao: acao, pitch: pitch, conforme: conforme(item) };
  });

  var aderentes = leiturasMomentos.filter(function(x) { return x.conforme; }).map(function(x) { return x.item; });
  var desviosMomentos = leiturasMomentos.filter(function(x) { return !x.conforme; }).map(function(x) { return x.item; });

  var leituraExecutivaMomentos = leiturasMomentos.slice(0, 6).map(function(leitura) {
    var x = leitura.item;
    var cor = String(x.cor || x.status || (leitura.conforme ? 'VERDE' : 'AMARELO')).toUpperCase();
    var nota = x.nota === null || x.nota === undefined ? '' : ' · ' + String(x.nota) + '/5';
    var linhas = ['- ' + String(x.nome || x.id || 'Momento') + ' [' + cor + nota + ']'];
    if (x.o_que_foi_dito) linhas.push('  Evidência: ' + curtoCloser(x.o_que_foi_dito, 330));
    if (leitura.fortes.length) linhas.push('  Acertos: ' + leitura.fortes.map(function(item) { return curtoCloser(item, 210); }).join(' | '));
    if (!leitura.conforme && leitura.gaps.length) linhas.push('  O que faltou: ' + leitura.gaps.map(function(item) { return curtoCloser(item, 260); }).join(' | '));
    if (!leitura.conforme && leitura.acao) linhas.push('  Ação concreta: ' + curtoCloser(leitura.acao, 320));
    if (!leitura.conforme && leitura.pitch) linhas.push('  Referência / texto do pitch: ' + curtoCloser(leitura.pitch, 300));
    if (!leitura.conforme && x.como_agir && String(x.como_agir).trim() !== leitura.acao) {
      linhas.push('  Como aplicar: ' + curtoCloser(x.como_agir, 280));
    }
    return linhas.join(n);
  });

  var acertos = aderentes.slice(0, 4).map(function(x) {
    var fortes = Array.isArray(x.pontos_fortes) ? x.pontos_fortes.filter(Boolean).slice(0, 2) : [];
    var linha = '- ' + String(x.nome || x.id || 'Momento') + ': ' + curtoCloser(x.o_que_foi_dito || 'Execução evidenciada na transcrição.', 230);
    if (fortes.length) linha += ' | Acertos: ' + fortes.map(function(item) { return curtoCloser(item, 150); }).join(' • ');
    return linha;
  });

  var perguntasRealizadasBase = (Array.isArray(perguntas.perguntas_realizadas) ? perguntas.perguntas_realizadas : [])
    .filter(function(x) { return x && String(x.pergunta || '').trim(); });
  var perguntasFaltantesBase = (Array.isArray(perguntas.perguntas_esperadas_nao_realizadas) ? perguntas.perguntas_esperadas_nao_realizadas : [])
    .filter(function(x) { return x && String(x.pergunta || '').trim(); });

  var perguntasRealizadas = perguntasRealizadasBase.slice(0, 10).map(function(x) {
    var contexto = [x.categoria, x.timestamp].filter(Boolean).join(' · ');
    var linha = '- ' + (contexto ? '[' + contexto + '] ' : '') + '"' + curtoCloser(x.pergunta, 220) + '"';
    if (x.resposta_lead) linha += ' | Resposta: ' + curtoCloser(x.resposta_lead, 180);
    if (x.o_que_melhorar) linha += ' | Aprofundamento: ' + curtoCloser(x.o_que_melhorar, 180);
    return linha;
  });

  var perguntasFaltantes = perguntasFaltantesBase.slice(0, 8).map(function(x) {
    var linha = '- ' + (x.categoria ? '[' + curtoCloser(x.categoria, 60) + '] ' : '') + '"' + curtoCloser(x.pergunta, 230) + '"';
    if (x.motivo_importancia) linha += ' | Por que importa: ' + curtoCloser(x.motivo_importancia, 170);
    if (x.sugestao_aplicacao) linha += ' | Como aplicar: ' + curtoCloser(x.sugestao_aplicacao, 170);
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
    adicionarUnico(implicacaoNecessidade, vistosImplicacao, '- Lacuna a aprofundar: ' + curtoCloser(item, 240));
  });
  (Array.isArray(impacto.impactos_identificados) ? impacto.impactos_identificados : []).slice(0, 4).forEach(function(item) {
    adicionarUnico(implicacaoNecessidade, vistosImplicacao, '- Impacto do lead que deveria ser aprofundado: ' + curtoCloser(item, 240));
  });
  perguntasFaltantesBase.filter(function(item) {
    return ehTemaImplicacaoNecessidade([item.categoria, item.motivo_importancia, item.impacto_da_ausencia, item.pergunta].join(' '));
  }).slice(0, 4).forEach(function(item) {
    adicionarUnico(
      implicacaoNecessidade,
      vistosImplicacao,
      '- Pergunta do pitch para aprofundar: "' + curtoCloser(item.pergunta, 230) + '"' +
        (item.sugestao_aplicacao ? ' | Como aplicar: ' + curtoCloser(item.sugestao_aplicacao, 190) : '')
    );
  });
  perguntasSugeridasBase.filter(function(item) {
    return ehTemaImplicacaoNecessidade([item.categoria, item.objetivo, item.pergunta_sugerida].join(' '));
  }).slice(0, 3).forEach(function(item) {
    adicionarUnico(
      implicacaoNecessidade,
      vistosImplicacao,
      '- Sugestão de enablement para aprofundar: "' + curtoCloser(item.pergunta_sugerida, 230) + '"' +
        (item.objetivo ? ' | Objetivo: ' + curtoCloser(item.objetivo, 170) : '')
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
        (item.sugestao_aplicacao ? ' | Aplicação: ' + curtoCloser(item.sugestao_aplicacao, 190) : '')
    );
  });

  leiturasMomentos.filter(function(leitura) { return !leitura.conforme; }).slice(0, 4).forEach(function(leitura) {
    var item = leitura.item;
    var nome = String(item.nome || item.id || 'Momento');
    if (leitura.acao && coachingAcionavelCloser(leitura.acao)) {
      adicionarUnico(ajustesObjetivos, vistosAjustes, '- ' + nome + ': ' + curtoCloser(leitura.acao, 300));
      return;
    }
    if (leitura.pitch && coachingAcionavelCloser(leitura.pitch)) {
      adicionarUnico(ajustesObjetivos, vistosAjustes, '- ' + nome + ': execute conforme a regra do pitch "' + curtoCloser(leitura.pitch, 280) + '"');
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
      '- Fechamento: termine com duas opções objetivas de agenda. Exemplo: "Posso te enviar o convite para terça às 14h ou quarta às 16h. Qual funciona melhor?"'
    );
  }

  var proximos = ajustesObjetivos.slice(0, 7);
  if (!proximos.length) {
    passos.filter(function(x) {
      return x && String(x.acao || '').trim() && coachingAcionavelCloser(x.acao);
    }).slice(0, 5).forEach(function(x) {
      adicionarUnico(
        proximos,
        vistosAjustes,
        '- ' + curtoCloser(x.acao, 240) +
          (x.criterio_conclusao ? ' | Concluído quando: ' + curtoCloser(x.criterio_conclusao, 180) : '')
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
  if (acordoResumo) acordoLinhas.push('Acordo registrado: ' + curtoCloser(acordoResumo, 360));
  else acordoLinhas.push('Acordo registrado: Não evidenciado na reunião.');
  if (acordoEvidencia && !/^n[aã]o evidenciado/i.test(acordoEvidencia)) {
    acordoLinhas.push('Evidência do fechamento: "' + curtoCloser(acordoEvidencia, 280) + '"');
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
    'Responsável: ' + audRdNomeResponsavelPublico_(c),
    'Nota geral: ' + String(score != null && score !== '' ? score : '-') + '/5' + (pct != null && pct !== '' ? ' (' + pct + '%)' : ''),
    '',
    'CENÁRIO DA REUNIÃO',
    curtoCloser(co.resumo_conversa || 'Não evidenciado', 520),
    co.dor_principal ? 'Dor principal: ' + curtoCloser(co.dor_principal, 300) : '',
    co.impacto_principal ? 'Impacto principal: ' + curtoCloser(co.impacto_principal, 300) : '',
    co.resultado_reuniao ? 'Resultado da reunião: ' + curtoCloser(co.resultado_reuniao, 360) : '',
    '',
    'LEITURA EXECUTIVA DOS MOMENTOS',
    leituraExecutivaMomentos.length ? leituraExecutivaMomentos.join(n + n) : '- Nenhum momento aplicável foi registrado.',
    '',
    'EXECUÇÕES ADERENTES AO PROCESSO',
    acertos.length ? acertos.join(n) : '- Nenhum momento foi classificado como plenamente conforme.',
    '',
    'AJUSTES OBJETIVOS PARA A PRÓXIMA REUNIÃO',
    proximos.length ? proximos.join(n) : '- Nenhum ajuste objetivo adicional foi identificado.',
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
    'PONTUAÇÃO DE QUALIDADE',
    scoreLinhas.length ? scoreLinhas.join(n) : '- Pontuação por critério indisponível.',
    'Média dos critérios aplicáveis: ' + String(score != null && score !== '' ? score : '-') + '/5',
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

function audRdRotuloPublico_(valor) {
  var chave = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[ -]+/g, '_');
  return ({
    CONFORME:'Atingido', ATINGIDO:'Atingido', VERDE:'Atingido',
    DESVIO_EXECUCAO:'Parcial', PARCIAL:'Parcial', AMARELO:'Parcial',
    NAO_EXECUTADO:'Não executado', VERMELHO:'Não executado',
    NAO_APLICAVEL:'Não aplicável', NAO_EVIDENCIADO:'Não evidenciado', LACUNA_PROCESSO:'Lacuna de processo'
  })[chave] || String(valor || 'Não evidenciado');
}

function audRdSanitizarTextoPublico_(texto) {
  var substituicoes = {
    DESVIO_EXECUCAO:'Parcial', NAO_EXECUTADO:'Não executado', NAO_APLICAVEL:'Não aplicável',
    NAO_EVIDENCIADO:'Não evidenciado', LACUNA_PROCESSO:'Lacuna de processo', SUGESTAO_ENABLEMENT:'Sugestão de desenvolvimento'
  };
  var publico = String(texto || '');
  Object.keys(substituicoes).forEach(function(codigo) {
    publico = publico.replace(new RegExp('\\b' + codigo + '\\b', 'g'), substituicoes[codigo]);
  });
  return publico;
}

function audRdTextoCloserCanonico_(c) {
  var r = c.r || {};
  var n = String.fromCharCode(10);
  var mapa = r.mapa_oportunidade || {};
  var criterios = Array.isArray(r.criterios_avaliados) ? r.criterios_avaliados : [];
  var passos = Array.isArray(r.proximos_passos) ? r.proximos_passos : [];
  var pc = r.pontuacao_calculada || {};
  var score = pc.score_5 != null ? pc.score_5 : c.a.SCORE;
  var pct = pc.score_percentual != null ? pc.score_percentual : c.a.SCORE_PERCENTUAL;
  var curtoCanonico = function(valor, limite) {
    var texto = String(valor || 'Não evidenciado').replace(/\s+/g, ' ').trim() || 'Não evidenciado';
    return texto.length > limite ? texto.slice(0, limite - 1).trim() + '…' : texto;
  };
  var dimensoes = criterios.slice(0, 5).map(function(item) {
    var nota = (item || {}).pontuacao;
    return '- ' + String((item || {}).nome || (item || {}).id || 'Dimensão') + ': ' +
      (nota != null && nota !== '' ? String(nota) + '/5 | ' : '') + audRdRotuloPublico_((item || {}).status);
  });
  var fortes = criterios.filter(function(item) {
    return item && item.aplicavel !== false && Number(item.pontuacao) >= 4.5;
  }).slice(0, 2).map(function(item) { return '- ' + curtoCanonico(item.nome, 100); });
  var lacunas = criterios.filter(function(item) {
    return item && item.aplicavel !== false && Number(item.pontuacao) < 4.5;
  }).sort(function(a, b) { return Number(a.pontuacao || 0) - Number(b.pontuacao || 0); }).slice(0, 3).map(function(item) {
    return '- ' + curtoCanonico(item.nome + ': ' + (item.divergencia || item.justificativa_nota || 'requer melhoria'), 240);
  });
  var mapaLinhas = [
    ['Dor', mapa.dor_principal], ['Impacto operacional', mapa.impacto_operacional],
    ['Impacto financeiro', mapa.impacto_financeiro], ['Motivação', mapa.motivacao],
    ['Ganhos esperados', mapa.ganhos_esperados], ['Impacto de não avançar', mapa.impacto_nao_avancar],
    ['Urgência', mapa.urgencia], ['Decisor', mapa.decisor], ['Ponto focal', mapa.ponto_focal],
    ['Fit percebido', mapa.fit_percebido], ['Próximo passo', mapa.proximo_passo], ['Riscos', mapa.riscos]
  ].map(function(item) { return '- ' + item[0] + ': ' + curtoCanonico(item[1], 220); });
  var acoes = passos.slice(0, 3).map(function(item, indice) {
    return String(indice + 1) + '. ' + curtoCanonico((item || {}).acao, 240);
  });
  return audRdSanitizarTextoPublico_([
    'AUDITORIA CLOSER — ' + String(c.i.TITULO || c.i.OPORTUNIDADE || ''),
    'Responsável: ' + audRdNomeResponsavelPublico_(c),
    'Resultado: ' + String(score != null && score !== '' ? score : '-') + '/5' + (pct != null && pct !== '' ? ' (' + pct + '%)' : ''),
    '',
    'DIMENSÕES OFICIAIS',
    dimensoes.length ? dimensoes.join(n) : '- Não evidenciado',
    '',
    'PONTOS FORTES',
    fortes.length ? fortes.join(n) : '- Nenhuma dimensão plenamente atingida.',
    '',
    'LACUNAS PRIORITÁRIAS',
    lacunas.length ? lacunas.join(n) : '- Nenhuma lacuna prioritária identificada.',
    '',
    'MAPA DA OPORTUNIDADE',
    mapaLinhas.join(n),
    '',
    'PRÓXIMAS AÇÕES DO CLOSER',
    acoes.length ? acoes.join(n) : '1. Nenhuma ação adicional registrada.',
    '',
    c.a.LINK_DOCUMENTO ? 'Auditoria completa: ' + c.a.LINK_DOCUMENTO : '',
    c.i.URL_GRAVACAO ? 'Gravação: ' + c.i.URL_GRAVACAO : ''
  ].filter(function(linha, indice, lista) { return linha !== '' || (indice > 0 && lista[indice - 1] !== ''); }).join(n).trim());
}

function audRdTextoSdr_(c) {
  var r = c.r || {};
  var n = String.fromCharCode(10);
  var ep = Array.isArray(r.etapas_pitch) ? r.etapas_pitch : [];
  var co = r.resumo_contato || {};
  var pc = r.pontuacao_calculada || {};
  var contexto = r.contexto_interacao || {};
  var perguntas = r.perguntas_qualificacao || {};
  var passos = Array.isArray(r.proximos_passos) ? r.proximos_passos : [];

  function norm(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }
  function curto(v, max) {
    var t = String(v || '').replace(/\s+/g, ' ').trim();
    max = max || 220;
    return t.length > max ? t.slice(0, max - 1).trim() + '…' : t;
  }
  function rotuloContexto(v) {
    var t = String(v || '').trim().replace(/_/g, ' ').toLowerCase();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }
  function chaveUnicaSdr(v) {
    return norm(v).replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  function unicosPor(lista, seletor) {
    var vistos = {};
    return (Array.isArray(lista) ? lista : []).filter(function(item) {
      var chave = chaveUnicaSdr(seletor(item));
      if (!chave || vistos[chave]) return false;
      vistos[chave] = true;
      return true;
    });
  }
  function listaCompleta(rotulo, itens) {
    if (!itens.length) return [];
    return [rotulo + ':'].concat(itens.map(function(item) {
      return '- ' + String(item || '').replace(/\s+/g, ' ').trim();
    }));
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

  var conformes = unicosPor(ep.filter(function(x) {
    return norm((x || {}).status) === 'CONFORME';
  }), function(x) { return (x || {}).etapa; });
  var desvios = unicosPor(ep.filter(function(x) {
    var s = norm((x || {}).status);
    return s === 'DESVIO_EXECUCAO' || s === 'NAO_EXECUTADO' || s === 'NAO_EXECUTADA';
  }), function(x) { return (x || {}).etapa; });

  var acertos = conformes.slice(0, 3).map(function(x) {
    return '- ' + String(x.etapa || 'Etapa') + ' — ' + curto(x.fato_transcricao || 'Execução evidenciada na transcrição.', 135);
  });
  var ajustes = desvios.slice(0, 3).map(function(x, indice) {
    var linhas = [String(indice + 1) + '. ' + String(x.etapa || 'Etapa')];
    linhas.push('   Desvio: ' + curto(x.desvio || 'Execução não evidenciada.', 155));
    if (x.fato_transcricao && !/^n[aã]o evidenciado/i.test(String(x.fato_transcricao))) {
      linhas.push('   Evidência: "' + curto(x.fato_transcricao, 135) + '"');
    }
    if (x.correcao_pratica) {
      linhas.push('   Próxima ação: ' + curto(x.correcao_pratica, 165));
    } else if (x.regra_pitch) {
      linhas.push('   Próxima ação: executar ' + curto(x.regra_pitch, 135));
    }
    return linhas.join(n);
  });

  var perguntasCorretas = unicosPor(perguntas.corretas, function(x) { return (x || {}).pergunta; }).slice(0, 3).map(function(x) {
    var linha = '- "' + curto(x.pergunta, 145) + '"';
    if (x.resposta_lead && !/^n[aã]o evidenciado/i.test(String(x.resposta_lead))) linha += n + '  Resposta: ' + curto(x.resposta_lead, 145);
    return linha;
  });
  var perguntasDesvio = unicosPor(perguntas.com_desvio, function(x) { return (x || {}).pergunta; }).slice(0, 2).map(function(x) {
    var linha = '- "' + curto(x.pergunta, 140) + '" — ' + curto(x.erro_ou_desvio || x.correcao_pratica || 'Pergunta com desvio.', 145);
    return linha;
  });
  var perguntasAusentes = unicosPor(perguntas.ausentes, function(x) { return (x || {}).pergunta_esperada; }).slice(0, 2).map(function(x) {
    return '- Faltou: "' + curto(x.pergunta_esperada, 145) + '"';
  });
  var plano = unicosPor(passos, function(x) { return (x || {}).acao; }).slice(0, 2).map(function(x) {
    var linha = '- ' + curto(x.acao, 165);
    if (x.criterio_conclusao) linha += n + '  Concluído quando: ' + curto(x.criterio_conclusao, 135);
    return linha;
  });

  var score = pc.score_5 != null ? pc.score_5 : c.a.SCORE;
  var pct = pc.score_percentual != null ? pc.score_percentual : c.a.SCORE_PERCENTUAL;
  var contextoLinha = rotuloContexto(contexto.classificacao || '');
  var aplicaveis = unicosPor(contexto.etapas_aplicaveis, function(x) { return x; });
  var concluidas = unicosPor(contexto.etapas_ja_concluidas, function(x) { return x; });
  var nomesDesvios = desvios.slice(0, 3).map(function(x) { return String(x.etapa || '').trim(); }).filter(Boolean);
  var contextoLinhas = [];
  if (contextoLinha) contextoLinhas.push('Tipo: ' + contextoLinha);
  if (contexto.objetivo_principal) contextoLinhas.push('Objetivo: ' + curto(contexto.objetivo_principal, 180));
  contextoLinhas = contextoLinhas.concat(listaCompleta('Etapas avaliadas', aplicaveis));
  contextoLinhas = contextoLinhas.concat(listaCompleta('Etapas já concluídas', concluidas));

  var linhas = [
    'AUDITORIA SDR — ' + String(c.i.TITULO || c.i.OPORTUNIDADE || ''),
    'Responsável: ' + audRdNomeResponsavelPublico_(c),
    'Nota geral: ' + String(score != null && score !== '' ? score : '-') + '/5' + (pct != null && pct !== '' ? ' (' + pct + '%)' : ''),
    'PONTUAÇÃO POR CRITÉRIO',
    notasCriterios.length ? notasCriterios.join(n) : '- Pontuação por critério indisponível.',
    mediaCalculada != null ? 'Média dos critérios aplicáveis: ' + String(mediaCalculada) + '/5' : '',
    '',
    contextoLinhas.length ? 'CONTEXTO E RESULTADO' : 'RESULTADO DA LIGAÇÃO',
    contextoLinhas.join(n),
    co.motivacao_contato ? 'Motivação: ' + curto(co.motivacao_contato, 150) : '',
    co.necessidade_principal ? 'Necessidade principal: ' + curto(co.necessidade_principal, 150) : '',
    co.resultado_contato ? 'Resultado: ' + curto(co.resultado_contato, 165) : curto(co.resumo_conversa || 'Não evidenciado', 180),
    '',
    'PONTOS FORTES',
    acertos.length ? acertos.join(n) : '- Nenhuma etapa foi classificada como plenamente conforme.',
    '',
    (perguntasCorretas.length || perguntasDesvio.length || perguntasAusentes.length) ? 'QUALIFICAÇÃO' : '',
    perguntasCorretas.length ? 'Corretas:' : '',
    perguntasCorretas.length ? perguntasCorretas.join(n) : '',
    perguntasDesvio.length ? 'Com desvio:' : '',
    perguntasDesvio.length ? perguntasDesvio.join(n) : '',
    perguntasAusentes.length ? 'Não realizadas:' : '',
    perguntasAusentes.length ? perguntasAusentes.join(n) : '',
    (perguntasCorretas.length || perguntasDesvio.length || perguntasAusentes.length) ? '' : '',
    'AJUSTES PRIORITÁRIOS',
    ajustes.length ? ajustes.join(n + n) : '- Nenhum desvio de execução foi identificado.',
    '',
    plano.length ? 'PLANO DE AÇÃO' : '',
    plano.length ? plano.join(n) : '',
    plano.length ? '' : '',
    'RESUMO EXECUTIVO',
    nomesDesvios.length ? 'Prioridades: ' + nomesDesvios.join('; ') + '.' : 'Sem desvio prioritário nesta interação.',
    'Consulte a auditoria completa para metodologia, critérios e evidências detalhadas.',
    '',
    c.i.URL_GRAVACAO ? 'Gravação: ' + c.i.URL_GRAVACAO : '',
    c.a.LINK_DOCUMENTO ? 'Auditoria completa: ' + c.a.LINK_DOCUMENTO : ''
  ];

  return linhas.filter(function(x, i, a) {
    return x !== '' || (i > 0 && a[i - 1] !== '');
  }).join(n).trim();
}

function audRdJsonSeguro_(v){return JSON.stringify(v).replace(/[\u007f-\uffff]/g,function(ch){return '\\u'+('0000'+ch.charCodeAt(0).toString(16)).slice(-4);});}
