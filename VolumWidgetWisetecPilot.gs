/** Wisetec piloto — leitura do BoardAudit validado, apenas negociacao vinculada. */
const VI_WISETEC_PILOTO='CLI-20260803131300-C4455D17';
const VI_WISETEC_PILARES={
  SDR:['cadencia','voip','pitch','no_show','handoff','registros','tarefas'],
  CLOSER:['gravacao','anotacao','proposta_pdf','proximo_passo','valores','recebimento','followup']
};
function viPilotTexto_(v,n){
  const s=typeof viWidgetSanitizar_==='function'?viWidgetSanitizar_(v||''):
    String(v||'').replace(/https?:\/\/\S+/gi,'[LINK_OMITIDO]')
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[EMAIL_OMITIDO]');
  return s.replace(/\s+/g,' ').trim().slice(0,n||200);
}
/** Extracao de trechos e correcoes, nunca conteudo integral da transcricao. */
function viPilotResumoAuditoria_(reg,res){
  const tipo=String(reg.TIPO_AUDITORIA||'').toUpperCase();
  const etapas=tipo==='SDR'?res.etapas_pitch:res.momentos;
  const validas=(Array.isArray(etapas)?etapas:[]).filter(x=>x&&(
    x.divergencia_identificada===true||
    ['PARCIAL','NAO_EXECUTADO','NAO_CONFORME','AMARELO','VERMELHO'].includes(String(x.status||x.cor||'').toUpperCase())
  ));
  const pontos=validas.slice(0,4).map(x=>({
    etapa:viPilotTexto_(x.etapa||x.nome||'Pitch',90),
    evidencia:viPilotTexto_(x.fato_transcricao||x.o_que_foi_dito||'',180),
    desvio:viPilotTexto_(x.desvio||x.divergencia||'',180),
    impacto:viPilotTexto_(x.impacto_resultado||x.justificativa_nota||'',140),
    acao:viPilotTexto_(x.correcao_pratica||x.o_que_fazer||x.como_agir||'',210)
  }));
  const proximos=Array.isArray(res.proximos_passos)?res.proximos_passos:[];
  if(!pontos.length&&proximos[0]?.acao)pontos.push({
    etapa:'Proximo passo',evidencia:'',desvio:'',impacto:'',
    acao:viPilotTexto_(proximos[0].acao,210)});
  return {idAuditoria:viPilotTexto_(reg.ID_AUDITORIA,90),
    idInteracao:viPilotTexto_(reg.ID_INTERACAO,90),tipo,
    estado:String(reg.STATUS||'').toUpperCase(),
    publicadoRd:String(reg.RD_STATUS||'').toUpperCase()==='PUBLICADA',
    dataValidacao:viPilotTexto_(reg.VALIDADA_EM,38),
    classificacao:viPilotTexto_(res.contexto_interacao?.classificacao,90),
    resultado:viPilotTexto_(res.resumo_contato?.resultado_contato||
       res.resumo_reuniao?.resultado_reuniao,230),
    aderenciaPct:tipo==='SDR'&&Number.isFinite(Number(res.aderencia_script?.aderencia_pitch_percentual))?
       Number(res.aderencia_script.aderencia_pitch_percentual):null,
    lacunasPerguntas:tipo==='SDR'?Number(res.perguntas_qualificacao?.total_ausentes||0):
       (Array.isArray(res.perguntas_diagnostico?.perguntas_esperadas_nao_realizadas)?
        res.perguntas_diagnostico.perguntas_esperadas_nao_realizadas.length:0),
    lmvAvaliado:tipo==='SDR'?viPilotTexto_(res.qualidade_perguntas_respostas?.validacao_lmv,130):'',
    sinteseImpacto:tipo==='CLOSER'?viPilotTexto_(res.analise_impacto_implicacao?.correcao_pratica,175):'',
    pontos,fonte:'AUDITORIAS_BOARD_VALIDADA'};
}
/** Pure function para permitir testar controles de isolamento sem acessar a planilha. */
function viPilotAuditoriaRow_(cab,linha,idCliente,ids){
  const val=n=>{const i=cab.indexOf(n);return i<0?'':String(linha[i]||'').trim();};
  const ref=val('ID_INTERACAO'),tipo=val('TIPO_AUDITORIA').toUpperCase();
  if(!ids.has(ref)||val('ID_CLIENTE')!==idCliente||
     !['SDR','CLOSER'].includes(tipo)||
     val('VALIDACAO_STATUS').toUpperCase()!=='VALIDADA'||
     !val('HASH_FONTE')||!['APROVADA','EM_REVISAO'].includes(val('STATUS').toUpperCase()))
    return null;
  let payload;
  try{payload=JSON.parse(val('RESULTADO_JSON')+val('RESULTADO_JSON__PARTE_02'));}
  catch(e){return null;}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!val('ID_AUDITORIA'))return null;
  return viPilotResumoAuditoria_({
    ID_AUDITORIA:val('ID_AUDITORIA'),ID_INTERACAO:ref,TIPO_AUDITORIA:tipo,
    STATUS:val('STATUS'),RD_STATUS:val('RD_STATUS'),VALIDADA_EM:val('VALIDADA_EM')
  },payload);
}
function viPilotLerAuditoriasBoard_(leitura){
  const meta={acessivel:false,completo:false,associacao:'ID_CLIENTE + ID_INTERACAO + LINK_CRM'};
  const saida={itens:[],cobertura:meta};
  if(leitura.idCliente!==VI_WISETEC_PILOTO){meta.motivo='CLIENTE_NAO_HABILITADO';return saida;}
  if(leitura.fontes?.board?.completo!==true){meta.motivo='BOARD_INCOMPLETO';return saida;}
  const ids=new Set([...(leitura.ligacoesBoard||[]),...(leitura.reunioesBoard||[])]
    .filter(x=>x?.id&&x.idCliente===leitura.idCliente).map(x=>String(x.id)));
  if(!ids.size){meta.acessivel=true;meta.completo=true;meta.motivo='SEM_INTERACOES_VINCULADAS';return saida;}
  try{
    const aba=abrirPlanilha_().getSheetByName(APP.sheets.auditorias);
    if(!aba){meta.motivo='ABA_INDISPONIVEL';return saida;}
    const n=aba.getLastRow()-1,c=aba.getLastColumn();
    if(n<0||n>5000){meta.motivo='LIMITE_SEGURO';return saida;}
    if(n===0){meta.acessivel=true;meta.completo=true;return saida;}
    const cab=aba.getRange(1,1,1,c).getDisplayValues()[0];
    const ci=cab.indexOf('ID_INTERACAO')+1,cc=cab.indexOf('ID_CLIENTE')+1;
    if(!ci||!cc||cab.indexOf('RESULTADO_JSON')<0){meta.motivo='SCHEMA_NAO_SUPORTADO';return saida;}
    const refs=aba.getRange(2,ci,n,1).getDisplayValues();
    const clis=aba.getRange(2,cc,n,1).getDisplayValues();
    const linhas=[];
    for(let i=0;i<n;i++)if(clis[i][0]===leitura.idCliente&&ids.has(String(refs[i][0]||'')))
      linhas.push(i+2);
    if(linhas.length>25){meta.motivo='MUITAS_AUDITORIAS';return saida;}
    const escolhidos=new Map();
    for(const row of linhas){
      const celulas=aba.getRange(row,1,1,c).getDisplayValues()[0];
      const a=viPilotAuditoriaRow_(cab,celulas,leitura.idCliente,ids);
      if(!a)continue;
      const k=a.idInteracao+'|'+a.tipo,old=escolhidos.get(k);
      if(!old||a.estado==='APROVADA'&&old.estado!=='APROVADA')escolhidos.set(k,a);
    }
    saida.itens=[...escolhidos.values()].slice(-12);
    Object.assign(meta,{acessivel:true,completo:true,validas:saida.itens.length,
      candidatas:linhas.length,interacoes:ids.size,
      aviso:'Auditoria validada ao ser gerada, nao reprocessamento do audio nesta leitura.'});
  }catch(e){meta.motivo='FALHA_LEITURA_RESTRITA';}
  return saida;
}
function viPilotConsolidarUm_(tipo,leitura,parecer){
  const base=tipo==='SDR'?parecer.planoOtimizacaoSdr:parecer.planoOtimizacaoCloser;
  const oficiais=(base?.itens||[]).filter(x=>x.pilar==='OFICIAL');
  const pilares=VI_WISETEC_PILARES[tipo].map(id=>{
    const x=oficiais.find(y=>y.id===id)||{id,titulo:id,status:'NAO_VERIFICAVEL',
       conformidade:'PENDENTE',detalhe:'Ainda sem dados suficientes.',
       acao:'Conferir o criterio no CRM.',fonte:'RD'};
    const status=x.status==='NAO_APLICAVEL'?'NAO_APLICAVEL':
      x.status==='ATENCAO'||x.conformidade==='NAO_CONFORME'?'ATENCAO_A_VALIDAR':
      x.status==='SEM_EVIDENCIA'?'REGISTRO_NAO_ENCONTRADO':
      x.status==='EVIDENCIADO'?'REGISTRO_ENCONTRADO':'VERIFICACAO_PARCIAL';
    return {id,titulo:x.titulo,status,detalhe:viPilotTexto_(x.detalhe,320),
      evidencia:viPilotTexto_(x.evidencia,260),fonte:viPilotTexto_(x.fonte,180),
      acao:viPilotTexto_(x.acao,220),
      conclusao:'Comprovar acao exigida no CRM com data, autoria, resultado e referencia da fonte.'};
  });
  const audit=(leitura.auditoriasBoard?.itens||[]).filter(x=>x.tipo===tipo);
  const melhorias=([
    ...pilares.filter(x=>['ATENCAO_A_VALIDAR','REGISTRO_NAO_ENCONTRADO'].includes(x.status)&&x.acao)
      .map(x=>({titulo:x.titulo,evidencia:x.evidencia,porQue:x.detalhe,acao:x.acao,
        criterioConclusao:x.conclusao,fonte:x.fonte,prioridade:'ALTA'})),
    ...audit.flatMap(x=>x.pontos.filter(p=>p.acao).map(p=>({
      titulo:'Pitch · '+p.etapa,evidencia:p.evidencia,
      porQue:p.desvio||p.impacto,acao:p.acao,
      criterioConclusao:'Auditar proxima ligacao/reuniao e confirmar correcao no trecho correspondente.',
      fonte:'Board · '+x.idAuditoria,prioridade:x.estado==='APROVADA'?'MEDIA':'REVISAO'})))
  ]).slice(0,6);
  return {tipo,origem:'RD_UI_HISTORY + BOARD_AUDITORIAS_VINCULADAS',
    pilares,melhorias,auditorias: audit.slice(0,5),
    quantidadeAuditorias:audit.length,semNota:true,
    aviso:'Leitura por negociacao; nao equivale a analise mensal da carteira ou compliance aprovado.'};
}
function viPilotPlanosWisetec_(leitura,parecer){
  if(leitura.idCliente!==VI_WISETEC_PILOTO)return {ativo:false,motivo:'FORA_DO_PILOTO'};
  const h=leitura.historicoRdEtapas?.linhaDoTempo||{};
  if(h.cobertura?.acessivel!==true||h.cobertura?.completo!==true||
     (h.cobertura?.lacunas||[]).length>0)return {ativo:false,motivo:'HISTORICO_RD_INCOMPLETO'};
  return {ativo:true,versao:'WISETEC_PLANOS_V1',
    sdr:viPilotConsolidarUm_('SDR',leitura,parecer),
    closer:viPilotConsolidarUm_('CLOSER',leitura,parecer),
    coberturaBoard:leitura.auditoriasBoard?.cobertura||{},
    limite:'Sem documentacao de cadencia e prazos homologados, o resultado de compliance continua pendente.'};
}
