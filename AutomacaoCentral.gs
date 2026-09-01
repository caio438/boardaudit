/* =========================================================
   AUTOMAÇÃO CENTRAL DAS 19H
   Um único acionador permanente coordena as integrações. As
   continuações são temporárias e existem somente enquanto há fila.
========================================================= */

const AUTOMACAO_CENTRAL_19H = Object.freeze({
  handlerDiario: 'EXECUTAR_AUTOMACAO_CENTRAL_19H',
  handlerContinuacao: 'EXECUTAR_AUTOMACAO_CENTRAL_CONTINUACAO',
  hora: 19,
  loteFormalizacoes: 3,
  atrasoEntreFasesMs: 5 * 60 * 1000,
  atrasoEntreLotesMs: 10 * 60 * 1000,
  atrasoErroMs: 30 * 60 * 1000,
  maxTentativasFase: 2,
  chaveFase: 'AUTOMACAO_CENTRAL_FASE',
  chaveDia: 'AUTOMACAO_CENTRAL_DIA',
  chaveTentativas: 'AUTOMACAO_CENTRAL_TENTATIVAS',
  chaveRodandoEm: 'AUTOMACAO_CENTRAL_RODANDO_EM',
  chaveUltimaExecucao: 'AUTOMACAO_CENTRAL_ULTIMA_EXECUCAO',
  chaveUltimoResultado: 'AUTOMACAO_CENTRAL_ULTIMO_RESULTADO'
});

function automacaoCentralHandlersLegados_() {
  return [
    'SINCRONIZAR_TLDV_AGENDADO',
    'EXECUTAR_AUTOMACAO_LIGACOES_V3',
    'EXECUTAR_FORMALIZACOES_AUTOMATICAS_AGENDA',
    'SINCRONIZAR_JORNADA_CALENDARIO',
    'SINCRONIZAR_RD_DIARIO'
  ];
}

function automacaoCentralRemoverAcionadores_(handlers) {
  const permitidos = {};
  (handlers || []).forEach(function(handler) { permitidos[String(handler)] = true; });
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (permitidos[trigger.getHandlerFunction()]) ScriptApp.deleteTrigger(trigger);
  });
}

function automacaoCentralInstalada_() {
  return ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === AUTOMACAO_CENTRAL_19H.handlerDiario;
  });
}

function instalarAutomacaoCentral19h_() {
  automacaoCentralRemoverAcionadores_(automacaoCentralHandlersLegados_());
  automacaoCentralRemoverAcionadores_([
    AUTOMACAO_CENTRAL_19H.handlerDiario,
    AUTOMACAO_CENTRAL_19H.handlerContinuacao
  ]);
  ScriptApp.newTrigger(AUTOMACAO_CENTRAL_19H.handlerDiario)
    .timeBased()
    .everyDays(1)
    .atHour(AUTOMACAO_CENTRAL_19H.hora)
    .nearMinute(0)
    .inTimezone(APP.timezone)
    .create();
  salvarConfiguracao_('AUTOMACAO_CENTRAL_ATIVA', 'SIM');
  salvarConfiguracao_('AUTOMACAO_CENTRAL_HORARIO', '19:00');
  salvarConfiguracao_('AUTOMACAO_CENTRAL_ATUALIZADA_EM', new Date());
  registrarLog_('AUTOMACAO', 'INSTALAR_CENTRAL_19H', 'Um acionador diário instalado para 19:00.');
  return obterStatusAutomacaoCentral19h();
}

function INSTALAR_AUTOMACAO_CENTRAL_19H() {
  return { sucesso: true, automacao: instalarAutomacaoCentral19h_() };
}

function obterStatusAutomacaoCentral19h() {
  const props = PropertiesService.getScriptProperties();
  const triggers = ScriptApp.getProjectTriggers();
  return {
    ativa: automacaoCentralInstalada_(),
    horario: '19:00',
    acionadoresPermanentes: triggers.filter(function(trigger) {
      return trigger.getHandlerFunction() === AUTOMACAO_CENTRAL_19H.handlerDiario;
    }).length,
    continuacoesAtivas: triggers.filter(function(trigger) {
      return trigger.getHandlerFunction() === AUTOMACAO_CENTRAL_19H.handlerContinuacao;
    }).length,
    faseAtual: props.getProperty(AUTOMACAO_CENTRAL_19H.chaveFase) || '',
    ultimaExecucao: props.getProperty(AUTOMACAO_CENTRAL_19H.chaveUltimaExecucao) || '',
    ultimoResultado: props.getProperty(AUTOMACAO_CENTRAL_19H.chaveUltimoResultado) || ''
  };
}

function automacaoCentralAgendarContinuacao_(fase, atrasoMs) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(AUTOMACAO_CENTRAL_19H.chaveFase, String(fase || 'AGENDA'));
  automacaoCentralRemoverAcionadores_([AUTOMACAO_CENTRAL_19H.handlerContinuacao]);
  ScriptApp.newTrigger(AUTOMACAO_CENTRAL_19H.handlerContinuacao)
    .timeBased()
    .after(Math.max(60000, Number(atrasoMs || AUTOMACAO_CENTRAL_19H.atrasoEntreFasesMs)))
    .create();
}

function automacaoCentralPrepararRd_() {
  if (String(obterConfiguracao_('RD_AUTOMACAO_ATIVA') || 'NAO').toUpperCase() !== 'SIM') {
    return { sucesso: true, ignorada: true, mensagem: 'RD automático desativado.' };
  }
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataReferencia = Utilities.formatDate(ontem, APP.timezone, 'yyyy-MM-dd');
  const fila = criarFilaRd_(dataReferencia, dataReferencia, 'AUTOMATICO_CENTRAL_19H', '');
  agendarProcessamentoRd_();
  return { sucesso: true, enfileirada: true, totalClientes: Number(fila.totalClientes || 0) };
}

function automacaoCentralConcluir_(resumo) {
  const props = PropertiesService.getScriptProperties();
  automacaoCentralRemoverAcionadores_([AUTOMACAO_CENTRAL_19H.handlerContinuacao]);
  props.deleteProperty(AUTOMACAO_CENTRAL_19H.chaveFase);
  props.deleteProperty(AUTOMACAO_CENTRAL_19H.chaveTentativas);
  props.setProperty(AUTOMACAO_CENTRAL_19H.chaveUltimoResultado, String(resumo || 'Rotina concluída.'));
  registrarLog_('AUTOMACAO', 'CENTRAL_19H_CONCLUIDA', String(resumo || 'Rotina concluída.'));
  if (typeof limparCachesDados_ === 'function') limparCachesDados_();
  return { sucesso: true, concluida: true, mensagem: resumo || 'Rotina concluída.' };
}

function automacaoCentralExecutarFase_() {
  const props = PropertiesService.getScriptProperties();
  const rodandoEm = Number(props.getProperty(AUTOMACAO_CENTRAL_19H.chaveRodandoEm) || 0);
  if (rodandoEm && Date.now() - rodandoEm < 20 * 60 * 1000) {
    return { sucesso: true, ignorada: true, mensagem: 'A rotina central já está em andamento.' };
  }
  props.setProperty(AUTOMACAO_CENTRAL_19H.chaveRodandoEm, String(Date.now()));
  props.setProperty(AUTOMACAO_CENTRAL_19H.chaveUltimaExecucao, new Date().toISOString());
  const fase = props.getProperty(AUTOMACAO_CENTRAL_19H.chaveFase) || 'AGENDA';
  try {
    if (fase === 'AGENDA') {
      const agenda = SINCRONIZAR_JORNADA_CALENDARIO();
      props.setProperty(AUTOMACAO_CENTRAL_19H.chaveTentativas, '0');
      automacaoCentralAgendarContinuacao_('FONTES_EXTERNAS', AUTOMACAO_CENTRAL_19H.atrasoEntreFasesMs);
      return { sucesso: true, fase: fase, resultado: agenda, proximaFase: 'FONTES_EXTERNAS' };
    }
    if (fase === 'FONTES_EXTERNAS') {
      const tldvAtivo = String(obterConfiguracao_('TLDV_AUTOMACAO_ATIVA') || 'NAO').toUpperCase() === 'SIM';
      const tldv = tldvAtivo ? SINCRONIZAR_TLDV_AGENDADO() : { sucesso: true, ignorada: true };
      const rd = automacaoCentralPrepararRd_();
      props.setProperty(AUTOMACAO_CENTRAL_19H.chaveTentativas, '0');
      automacaoCentralAgendarContinuacao_('LIGACOES', AUTOMACAO_CENTRAL_19H.atrasoEntreFasesMs);
      return { sucesso: true, fase: fase, tldv: tldv, rd: rd, proximaFase: 'LIGACOES' };
    }
    if (fase === 'LIGACOES') {
      const auditorias = EXECUTAR_AUTOMACAO_LIGACOES_V3();
      const statusAuditorias = obterStatusAutomacaoLigacoesV3();
      const processadas = Number((((auditorias || {}).resultado || {}).processadas) || 0);
      if (processadas > 0 && statusAuditorias.elegiveis > 0 && statusAuditorias.saldoHoje > 0) {
        automacaoCentralAgendarContinuacao_('LIGACOES', AUTOMACAO_CENTRAL_19H.atrasoEntreLotesMs);
        return { sucesso: true, fase: fase, resultado: auditorias, restante: statusAuditorias.elegiveis };
      }
      props.setProperty(AUTOMACAO_CENTRAL_19H.chaveTentativas, '0');
      automacaoCentralAgendarContinuacao_('FORMALIZACOES', AUTOMACAO_CENTRAL_19H.atrasoEntreFasesMs);
      return { sucesso: true, fase: fase, resultado: auditorias, proximaFase: 'FORMALIZACOES' };
    }
    if (fase === 'FORMALIZACOES') {
      const formalizacoes = EXECUTAR_FORMALIZACOES_AUTOMATICAS_AGENDA({
        pularSincronizacao: true,
        limite: AUTOMACAO_CENTRAL_19H.loteFormalizacoes
      });
      if (Number(formalizacoes.geradas || 0) > 0 && Number(formalizacoes.restantes || 0) > 0) {
        automacaoCentralAgendarContinuacao_('FORMALIZACOES', AUTOMACAO_CENTRAL_19H.atrasoEntreLotesMs);
        return { sucesso: true, fase: fase, resultado: formalizacoes };
      }
      return automacaoCentralConcluir_('Agenda, fontes, ligações e formalizações processadas.');
    }
    return automacaoCentralConcluir_('Fase desconhecida descartada com segurança.');
  } catch (erro) {
    const mensagem = erro && erro.message ? erro.message : String(erro);
    const tentativas = Number(props.getProperty(AUTOMACAO_CENTRAL_19H.chaveTentativas) || 0) + 1;
    props.setProperty(AUTOMACAO_CENTRAL_19H.chaveTentativas, String(tentativas));
    props.setProperty(AUTOMACAO_CENTRAL_19H.chaveUltimoResultado, fase + ': ' + mensagem);
    registrarLog_('AUTOMACAO', 'CENTRAL_19H_ERRO', fase + ': ' + mensagem);
    if (tentativas <= AUTOMACAO_CENTRAL_19H.maxTentativasFase) {
      automacaoCentralAgendarContinuacao_(fase, AUTOMACAO_CENTRAL_19H.atrasoErroMs);
      return { sucesso: false, reagendada: true, fase: fase, erro: mensagem };
    }
    automacaoCentralRemoverAcionadores_([AUTOMACAO_CENTRAL_19H.handlerContinuacao]);
    props.deleteProperty(AUTOMACAO_CENTRAL_19H.chaveFase);
    return { sucesso: false, interrompida: true, fase: fase, erro: mensagem };
  } finally {
    props.deleteProperty(AUTOMACAO_CENTRAL_19H.chaveRodandoEm);
  }
}

function EXECUTAR_AUTOMACAO_CENTRAL_19H() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(AUTOMACAO_CENTRAL_19H.chaveDia, Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd'));
  props.setProperty(AUTOMACAO_CENTRAL_19H.chaveFase, 'AGENDA');
  props.setProperty(AUTOMACAO_CENTRAL_19H.chaveTentativas, '0');
  automacaoCentralRemoverAcionadores_([AUTOMACAO_CENTRAL_19H.handlerContinuacao]);
  return automacaoCentralExecutarFase_();
}

function EXECUTAR_AUTOMACAO_CENTRAL_CONTINUACAO() {
  return automacaoCentralExecutarFase_();
}
