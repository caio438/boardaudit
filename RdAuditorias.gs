var RD_AUDITORIA_EMAIL_VOLUM='crm@govolum.com';
function salvarIdRdAuditoriaV3(d){d=d||{};var id=String(d.idAuditoria||'').trim(),a=audV3Localizar_('AUDITORIAS','ID_AUDITORIA',id);if(!a)throw new Error('Auditoria não encontrada.');if(String(a.RD_STATUS||'').toUpperCase()==='PUBLICADA')throw new Error('Esta auditoria já foi enviada ao RD e o vínculo não pode ser alterado por aqui.');var deal=audRdNormalizarDeal_(d.rdDealId||d.linkCrm||''),link=deal?audV3RdLinkNegociacao_(deal):'';audV3Atualizar_('INTERACOES','ID_INTERACAO',a.ID_INTERACAO,{LINK_CRM:link,ATUALIZADO_EM:new Date()});if(typeof limparCachesDados_==='function')limparCachesDados_();return{sucesso:true,mensagem:deal?'Negociação do RD vinculada à auditoria.':'Vínculo com o RD removido.',auditoria:audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS','ID_AUDITORIA',id)),auditorias:audV3ListarAuditoriasFront_()};}
function prepararEnvioAuditoriaRd(id){var c=audRdCtx_(id);return{idAuditoria:c.a.ID_AUDITORIA,dealId:c.dealId,oportunidade:c.i.OPORTUNIDADE||c.i.TITULO||'',responsavel:c.sdr.nome||'',usuarioPublicacao:c.volum.email,texto:audRdTexto_(c),aviso:'A anotação ficará no histórico da negociação e não poderá ser editada nem excluída pelo RD CRM.'};}
function enviarAuditoriaParaRd(d){d=d||{};var c=audRdCtx_(d.idAuditoria),texto=String(d.texto||audRdTexto_(c)).trim();if(!texto)throw new Error('A anotação do RD ficou vazia.');var ja=String(c.a.RD_STATUS||'').toUpperCase()==='PUBLICADA',ativId=String(c.a.RD_ACTIVITY_ID||'');if(!ja){var notas=audRdNotas_(c.token,c.dealId),legado='[BOARDAUDIT:'+c.a.ID_AUDITORIA+']';var dup=notas.find(function(x){var t=audRdTextoNota_(x);return t.indexOf(legado)>=0||audRdCmp_(t)===audRdCmp_(texto);});if(dup){ja=true;ativId=String(dup.id||dup._id||(dup.activity||{}).id||'');}}
if(!ja){var rr=requisicaoJson_(APP.rdBaseUrl+'/activities?token='+encodeURIComponent(c.token),{method:'post',contentType:'application/json',payload:audRdJsonSeguro_({activity:{user_id:c.volum.id,deal_id:c.dealId,text:texto}})}),at=rr.activity||rr.data||rr||{};ativId=String(at.id||at._id||'');audRdStatus_(c.a.ID_AUDITORIA,'PUBLICADA',ativId,'');}
var ts=audRdTarefas_(c);audRdStatus_(c.a.ID_AUDITORIA,'PUBLICADA',ativId,'',ts);return{sucesso:true,duplicada:ja,mensagem:(ja?'A anotação já estava no histórico. ':'Resultado registrado no histórico. ')+'As tarefas do VOLUM e do SDR foram conferidas.',auditoria:audV3AuditoriaFront_(audV3Localizar_('AUDITORIAS','ID_AUDITORIA',c.a.ID_AUDITORIA)),auditorias:audV3ListarAuditoriasFront_()};}
function audRdCtx_(id) {
  audRdEstr_();
  var a = audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', String(id || '').trim());
  if (!a) throw new Error('Auditoria não encontrada.');
  if (String(a.STATUS || '').toUpperCase() !== 'APROVADA') {
    throw new Error('Somente auditorias aprovadas podem ser enviadas ao RD CRM.');
  }
  if (String(a.VALIDACAO_STATUS || '').toUpperCase() !== 'VALIDADA' || !String(a.HASH_FONTE || '').trim()) {
    throw new Error('A auditoria ainda não possui validação de integridade para envio ao RD CRM.');
  }

  var i = audV3Localizar_('INTERACOES', 'ID_INTERACAO', a.ID_INTERACAO) || {};
  var transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', a.ID_INTERACAO);
  if (!transcricao) throw new Error('A transcrição original da auditoria não foi encontrada.');
  transcricao.CONTEUDO = audV3ConteudoCompletoTranscricao_(transcricao, i);

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

  var dealId = audRdDeal_(i);
  if (!dealId) throw new Error('A ligação não possui negociação do RD vinculada.');
  var it = typeof obterIntegracaoCliente_ === 'function' ? obterIntegracaoCliente_(a.ID_CLIENTE, 'RD_STATION') : null;
  if (!it || String(it.ATIVO || '').toUpperCase() !== 'SIM') throw new Error('A integração RD deste cliente não está ativa.');
  var token = obterSegredo_('INTEGRACAO_TOKEN_' + it.ID_INTEGRACAO);
  if (!token) throw new Error('Token do RD não encontrado.');
  var sdr = audRdResponsavel_(token, i, resultado);
  if (!sdr || !sdr.id || sdr.id === 'SEM_ID') throw new Error('Usuário responsável pela auditoria não identificado.');

  return {
    a: a,
    i: i,
    r: resultado,
    dealId: dealId,
    token: token,
    sdr: sdr,
    volum: audRdUsuario_(token, RD_AUDITORIA_EMAIL_VOLUM)
  };
}
function audRdEstr_(){audV3GarantirColunas_(audV3Planilha_(),'AUDITORIAS',['RD_STATUS','RD_ACTIVITY_ID','RD_PUBLICADO_EM','RD_TAREFA_VOLUM_ID','RD_TAREFA_SDR_ID','RD_ERRO']);}
function audRdDeal_(i){var l=String((i||{}).LINK_CRM||''),m=l.match(/(?:\/deals\/|^)([0-9a-f]{24})(?:\b|\/|\?|$)/i);if(m)return m[1];m=String((i||{}).DESCRICAO_ORIGEM||'').match(/(?:deal(?:_id)?|negocia(?:cao|ção))[^0-9a-f]{0,12}([0-9a-f]{24})/i);return m?m[1]:'';}
function audRdNormalizarDeal_(v){var t=String(v||'').trim();if(!t)return'';var m=t.match(/(?:\/deals\/|^)([0-9a-f]{24})(?:\b|\/|\?|$)/i)||t.match(/\b([0-9a-f]{24})\b/i);if(!m)throw new Error('Informe o ID de 24 caracteres da negociação do RD ou cole o link completo da negociação.');return String(m[1]).toLowerCase();}
function audV3RdLinkNegociacao_(v){var t=String(v||'').trim();if(!t)return'';var id=audRdNormalizarDeal_(t);return'https://crm.rdstation.com/app/deals/'+encodeURIComponent(id)+'?view=pipeline';}
function audRdUsuarios_(token){var r=requisicaoJson_(APP.rdBaseUrl+'/users?token='+encodeURIComponent(token)+'&active=true&limit=200',{method:'get',headers:{Accept:'application/json'}});return Array.isArray(r)?r:(r.users||r.data||r.results||r.items||[]);}
function audRdResponsavel_(token,i,r){var ext=String((i||{}).ID_EXTERNO||'');if(/^RD_TASK_/i.test(ext)){try{var origem=audRdOrigem_(token,ext),resp=typeof extrairResponsaveisRd_==='function'?extrairResponsaveisRd_(origem)[0]:null;if(resp&&resp.id&&resp.id!=='SEM_ID')return resp;}catch(e){}}var meta=(r||{}).metadados||{},ident=String((i||{}).COLABORADOR||(i||{}).VENDEDOR||meta.sdr||meta.closer||'').trim();if(!ident)throw new Error('Informe o responsável auditado para localizar o usuário correspondente no RD CRM.');var chave=normalizarTextoComparacao_(ident),email=ident.indexOf('@')>=0?ident.toLowerCase():'',cand=audRdUsuarios_(token).filter(function(u){var nome=normalizarTextoComparacao_(String((u||{}).name||(u||{}).nome||'')),mail=String((u||{}).email||'').trim().toLowerCase();return(email&&mail===email)||(chave&&nome===chave);});if(cand.length!==1)throw new Error(cand.length?'Há mais de um usuário do RD com o nome '+ident+'. Informe o e-mail no campo de colaborador.':'O responsável '+ident+' não foi encontrado entre os usuários ativos do RD CRM.');var u=cand[0]||{};return{id:String(u.id||u._id||u.user_id||''),nome:String(u.name||u.nome||ident),email:String(u.email||'')};}
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
function audRdCategoriaSpin_(valor){var original=String(valor||'').trim(),t=original.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();if(/^(?:S|SITUACAO|CONTEXTO)$/.test(t))return'Situação (SPIN)';if(/^(?:P|PROBLEMA|DOR)$/.test(t))return'Problema (SPIN)';if(/^(?:I|IMPLICACAO|IMPACTO)$/.test(t))return'Implicação (SPIN)';if(/^(?:N|NECESSIDADE|NEED[-_ ]?PAYOFF|SOLUCAO)$/.test(t))return'Necessidade de solução (SPIN)';return original||'Complementar ao diagnóstico';}
function audRdTexto_(c){
  var r=c.r||{},tipo=String(c.a.TIPO_AUDITORIA||'').toUpperCase(),co=r.resumo_contato||r.resumo_reuniao||{},p=r.resumo_publicacao||{},pc=r.pontuacao_calculada||{};
  if(tipo==='SDR')return audRdTextoSdr_(c);
  var score=pc.score_5!=null?pc.score_5:c.a.SCORE,pct=pc.score_percentual!=null?pc.score_percentual:c.a.SCORE_PERCENTUAL;
  var ds=tipo==='CLOSER'?(r.momentos||[]).filter(function(x){return String((x||{}).cor||(x||{}).status||'').toUpperCase()!=='VERDE';}).slice(0,5).map(function(x){return'- '+(x.nome||x.id||'Momento')+': '+(x.divergencia||'Execução não evidenciada.')+(x.justificativa_nota?' Impacto: '+x.justificativa_nota:'');}):(r.etapas_pitch||[]).filter(function(x){return['DESVIO_EXECUCAO','NAO_EXECUTADO'].indexOf(String((x||{}).status||'').toUpperCase())>=0;}).slice(0,5).map(function(x){return'- '+x.etapa+': '+(x.desvio||'Execução não evidenciada.')+(x.impacto_resultado?' Impacto: '+x.impacto_resultado:'');});
  var ms=(p.correcoes_prioritarias||[]).slice(0,5).map(function(x){return'- '+(x.acao||'')+(x.criterio_conclusao?' Concluído quando: '+x.criterio_conclusao:'');});
  var todosPassos=(r.proximos_passos||[]),condutas=todosPassos.filter(function(x){return tipo==='CLOSER'&&['OUTRA','NAO_DEFINIDA',''].indexOf(String((x||{}).equipe||'').toUpperCase())>=0;}).slice(0,5).map(function(x){return'- '+(x.acao||'')+(x.criterio_conclusao?' Concluído quando: '+x.criterio_conclusao:'');});
  var operacionais=todosPassos.filter(function(x){return tipo!=='CLOSER'||condutas.indexOf('- '+(x.acao||'')+(x.criterio_conclusao?' Concluído quando: '+x.criterio_conclusao:''))<0;}).slice(0,5).map(function(x){return'- '+(x.acao||'')+(x.responsavel?' — '+x.responsavel:'');});
  var qs=tipo==='CLOSER'?(r.repertorio_perguntas_sugeridas||[]).slice(0,8).map(function(x){return'- ['+audRdCategoriaSpin_(x.categoria)+'] '+(x.pergunta_sugerida||'')+(x.quando_usar?' Quando usar: '+x.quando_usar:'');}):[];
  var os=tipo==='CLOSER'?(r.objecoes_respostas||[]).slice(0,3).map(function(x){return'- Lead: '+(x.objecao_ou_pergunta_lead||'Não evidenciado')+' | Resposta: '+(x.resposta_closer||'Não evidenciada')+(x.avaliacao?' | Avaliação: '+x.avaliacao:'');}):[];
  var linhas=['AUDITORIA DA LIGAÇÃO — '+String(c.i.TITULO||c.i.OPORTUNIDADE||''),'Responsável: '+String(c.i.COLABORADOR||c.i.VENDEDOR||c.sdr.nome||'Não identificado'),'Nota: '+String(score||'-')+'/5'+(pct!==''&&pct!=null?' ('+pct+'%)':''),'','Resumo do contato: '+String(co.resumo_conversa||p.resumo||'Não evidenciado'),'Motivação: '+String(co.motivacao_contato||'Não evidenciada'),'Resultado: '+String(co.resultado_contato||co.resultado_reuniao||'Não evidenciado'),'','Desvios e impactos:',ds.length?ds.join('\n'):'- Nenhum desvio relevante identificado.','','O que melhorar:',ms.length?ms.join('\n'):'- Consultar a auditoria completa.'];
  if(tipo==='CLOSER')linhas=linhas.concat(['','Perguntas sugeridas para aprofundar o diagnóstico (SPIN Selling):',qs.length?qs.join('\n'):'- Nenhuma pergunta adicional sugerida nesta auditoria.','','Objeções do lead e condução do Closer:',os.length?os.join('\n'):'- Nenhuma objeção relevante evidenciada.','','Conduta para os próximos atendimentos:',condutas.length?condutas.join('\n'):'- Revisar os momentos com desvio antes do próximo atendimento.']);
  linhas=linhas.concat(['','Próximos passos operacionais:',operacionais.length?operacionais.join('\n'):'- Nenhum próximo passo operacional adicional.',c.i.URL_GRAVACAO?'Gravação: '+c.i.URL_GRAVACAO:'',c.a.LINK_DOCUMENTO?'Auditoria completa: '+c.a.LINK_DOCUMENTO:'']);
  return linhas.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function audRdTextoSdr_(c) {
  var r = c.r || {};
  var n = String.fromCharCode(10);
  var ep = Array.isArray(r.etapas_pitch) ? r.etapas_pitch : [];
  var co = r.resumo_contato || {};
  var pc = r.pontuacao_calculada || {};
  var feedback = r.feedback || {};
  var passos = Array.isArray(r.proximos_passos) ? r.proximos_passos : [];

  function norm(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }
  function curto(v, max) {
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

  var conformes = ep.filter(function(x) {
    return norm((x || {}).status) === 'CONFORME';
  });
  var desvios = ep.filter(function(x) {
    var s = norm((x || {}).status);
    return s === 'DESVIO_EXECUCAO' || s === 'NAO_EXECUTADO';
  });

  var acertos = conformes.slice(0, 6).map(function(x) {
    return '- ' + String(x.etapa || 'Etapa') + ': ' + curto(x.fato_transcricao || 'Execução evidenciada na transcrição.', 180);
  });
  var erros = desvios.slice(0, 6).map(function(x) {
    return '- ' + String(x.etapa || 'Etapa') + ': ' + curto(x.desvio || 'Execução não evidenciada.', 180) +
      (x.regra_pitch ? ' | Pitch: ' + curto(x.regra_pitch, 150) : '');
  });

  var principal = desvios[0] || {};
  var proximos = passos.filter(function(x) {
    return x && String(x.acao || '').trim();
  }).slice(0, 5).map(function(x) {
    return '- ' + curto(x.acao, 190) +
      (x.criterio_conclusao ? ' | Concluído quando: ' + curto(x.criterio_conclusao, 150) : '');
  });

  var fortes = Array.isArray(feedback.pontos_fortes) ? feedback.pontos_fortes.filter(Boolean) : [];
  var melhorias = Array.isArray(feedback.areas_melhoria) ? feedback.areas_melhoria.filter(Boolean) : [];
  var nomesConformes = conformes.slice(0, 3).map(function(x) { return String(x.etapa || '').trim(); }).filter(Boolean);
  var nomesDesvios = desvios.slice(0, 2).map(function(x) { return String(x.etapa || '').trim(); }).filter(Boolean);
  var primeiroPasso = passos.find(function(x) { return x && String(x.acao || '').trim(); }) || {};

  var p1 = nomesConformes.length
    ? 'A SDR executou corretamente ' + nomesConformes.join(', ') + '.'
    : (fortes.length ? 'A SDR apresentou execução aderente em ' + fortes.slice(0, 2).map(semPonto).join('; ') + '.' : 'A auditoria não identificou etapa plenamente conforme para destacar nesta conclusão.');

  var p2 = nomesDesvios.length
    ? 'O principal ajuste está em ' + nomesDesvios.join(' e ') + '.'
    : (melhorias.length ? 'O principal ajuste está em ' + melhorias.slice(0, 2).map(fraseMin).join(' e ') + '.' : 'Não foi identificado desvio prioritário nesta auditoria.');

  var p3 = primeiroPasso.acao
    ? 'Na prática, ' + fraseMin(primeiroPasso.acao) + '.'
    : 'Na prática, a próxima ligação deve manter as etapas conformes e corrigir os desvios indicados acima.';

  var score = pc.score_5 != null ? pc.score_5 : c.a.SCORE;
  var pct = pc.score_percentual != null ? pc.score_percentual : c.a.SCORE_PERCENTUAL;
  var linhas = [
    'AUDITORIA SDR — ' + String(c.i.TITULO || c.i.OPORTUNIDADE || ''),
    'Responsável: ' + String(c.i.COLABORADOR || c.i.VENDEDOR || c.sdr.nome || 'Não identificado'),
    'Nota geral: ' + String(score != null && score !== '' ? score : '-') + '/5' + (pct != null && pct !== '' ? ' (' + pct + '%)' : ''),
    '',
    'CENÁRIO DA LIGAÇÃO',
    curto(co.resumo_conversa || 'Não evidenciado', 450),
    co.motivacao_contato ? 'Motivação do contato: ' + curto(co.motivacao_contato, 260) : '',
    co.resultado_contato ? 'Resultado do contato: ' + curto(co.resultado_contato, 260) : '',
    '',
    'EXECUÇÕES ADERENTES AO PROCESSO',
    acertos.length ? acertos.join(n) : '- Nenhuma etapa foi classificada como plenamente conforme.',
    '',
    'DESVIOS EM RELAÇÃO AO PITCH/PROCESSO',
    erros.length ? erros.join(n) : '- Nenhum desvio de execução foi identificado.',
    principal.fato_transcricao ? 'Evidência do principal desvio: "' + curto(principal.fato_transcricao, 220) + '"' : '',
    '',
    'PRÓXIMOS PASSOS CONFORME O PITCH/PROCESSO',
    proximos.length ? proximos.join(n) : '- Manter a execução conforme e acompanhar os critérios da próxima ligação.',
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
function TESTAR_PREVIA_RD_STEC(){var p=prepararEnvioAuditoriaRd('AUD-20260911143731-8E4C2BA4');console.log(JSON.stringify(p));return p;}
function APLICAR_FLUXO_RD_STEC(){var r=enviarAuditoriaParaRd({idAuditoria:'AUD-20260911143731-8E4C2BA4'});console.log(JSON.stringify({sucesso:r.sucesso,duplicada:r.duplicada,mensagem:r.mensagem}));return r;}