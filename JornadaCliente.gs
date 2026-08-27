/**
 * ÁREA DO CLIENTE, JORNADA MENSAL E INTEGRAÇÃO GOOGLE WORKSPACE
 * Versão: 1.7.2
 *
 * O módulo usa apenas serviços do Google Workspace já disponíveis no projeto.
 * Nenhuma chamada de IA é feita para sincronizar Agenda, Meet, entregas, diário
 * ou otimizações.
 */

const JORNADA_CLIENTE_CONFIG = Object.freeze({
  versao: '1.7.3',
  versaoChave: 'JORNADA_ENGINE_VERSAO',
  calendarioIdChave: 'JORNADA_CALENDARIO_ID',
  fontesReunioesChave: 'JORNADA_FONTES_REUNIOES_JSON',
  pastaMeetPrincipal: 'https://drive.google.com/drive/folders/1xYSuRBYzo2fRc7Qq6gZiF_5EGRjknqqN',
  formalizacaoAutomaticaChave: 'JORNADA_FORMALIZACAO_AUTOMATICA',
  formalizacaoAutomaticaInicioChave: 'JORNADA_FORMALIZACAO_AUTOMATICA_INICIO',
  sincronizacaoChave: 'JORNADA_ULTIMA_SINCRONIZACAO',
  tiposReuniao: ['EXECUTIVA', 'OPERACIONAL_SDR', 'OPERACIONAL_CLOSER', 'OUTRA'],
  tiposIdentificador: ['NOME', 'EMAIL', 'DOMINIO', 'TITULO'],
  regrasPadrao: [
    { tipo: 'REUNIAO', escopo: 'GESTAO', nome: 'Reunião executiva', dia: 25 },
    { tipo: 'REUNIAO', escopo: 'SDR', nome: 'Reunião operacional SDR', dia: 10 },
    { tipo: 'REUNIAO', escopo: 'CLOSER', nome: 'Reunião operacional Closer', dia: 17 },
    { tipo: 'AUDITORIA', escopo: 'SDR', nome: 'Auditoria SDR', dia: 14 },
    { tipo: 'AUDITORIA', escopo: 'CLOSER', nome: 'Auditoria Closer', dia: 21 },
    { tipo: 'FORMALIZACAO', escopo: 'GESTAO', nome: 'Formalização da reunião executiva', dia: 26 },
    { tipo: 'FORMALIZACAO', escopo: 'SDR', nome: 'Formalização operacional SDR', dia: 11 },
    { tipo: 'FORMALIZACAO', escopo: 'CLOSER', nome: 'Formalização operacional Closer', dia: 18 },
    { tipo: 'PLANO', escopo: 'SDR', nome: 'Plano de Otimização SDR', dia: 31 },
    { tipo: 'PLANO', escopo: 'CLOSER', nome: 'Plano de Otimização Closer', dia: 31 }
  ]
});

function jornadaListarFontesReunioes_() {
  let fontes = [];
  try { fontes = JSON.parse(String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.fontesReunioesChave) || '[]')); } catch (erro) { fontes = []; }
  fontes = Array.isArray(fontes) ? fontes : [];
  if (!fontes.length) {
    const legado = String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.calendarioIdChave) || '').trim();
    fontes.push({ id: 'FONTE-AGENDA-PRINCIPAL', tipo: 'AGENDA', proprietario: 'MINHA', idCliente: '', nome: 'Agenda principal', endereco: legado || 'primary', ativo: true });
  }
  return fontes.filter(item => item && item.id && item.endereco && item.ativo !== false);
}

function jornadaStatusFontesReunioes_() {
  jornadaGarantirFontesPadrao_();
  const formalizacaoAutomatica = String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave) || 'NAO').toUpperCase() === 'SIM';
  return {
    fontes: jornadaListarFontesReunioes_(),
    calendarioId: String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.calendarioIdChave) || ''),
    formalizacaoAutomatica: formalizacaoAutomatica,
    formalizacaoAutomaticaInstalada: formalizacaoAutomatica && jornadaAutomacaoFormalizacoesInstalada_(),
    horariosFormalizacao: ['13:00', '18:30'],
    contaExecucao: jornadaEmailExecucao_(),
    ultimaSincronizacao: serializarData_(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.sincronizacaoChave)),
    automacaoAtiva: jornadaAutomacaoInstaladaCache_()
  };
}

function jornadaGarantirFontesPadrao_() {
  let fontes = [];
  try { fontes = JSON.parse(String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.fontesReunioesChave) || '[]')); } catch (erro) { fontes = []; }
  fontes = Array.isArray(fontes) ? fontes.filter(item => item && item.id && item.endereco) : [];
  let alterou = false;
  const existe = (tipo, endereco, idCliente) => fontes.some(item =>
    String(item.tipo || '').toUpperCase() === tipo &&
    String(item.endereco || '').trim().toLowerCase() === String(endereco || '').trim().toLowerCase() &&
    String(item.idCliente || '') === String(idCliente || '')
  );
  if (!fontes.some(item => String(item.tipo || '').toUpperCase() === 'AGENDA')) {
    fontes.push({ id: 'FONTE-AGENDA-PRINCIPAL', tipo: 'AGENDA', proprietario: 'MINHA', idCliente: '', nome: 'Agenda principal', endereco: String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.calendarioIdChave) || 'primary').trim() || 'primary', ativo: true, criadoEm: new Date().toISOString() });
    alterou = true;
  }
  if (!existe('PASTA', JORNADA_CLIENTE_CONFIG.pastaMeetPrincipal, '')) {
    fontes.push({ id: 'FONTE-PASTA-MEET-CAIO', tipo: 'PASTA', proprietario: 'MINHA', idCliente: '', nome: 'Arquivos do Google Meet — Caio', endereco: JORNADA_CLIENTE_CONFIG.pastaMeetPrincipal, ativo: true, origem: 'CONFIGURACAO_VOLUM', criadoEm: new Date().toISOString() });
    alterou = true;
  }
  lerObjetos_(APP.sheets.clientes).forEach(cliente => {
    const idCliente = String(cliente.ID_CLIENTE || '');
    const nomeCliente = String(cliente.NOME_CLIENTE || idCliente);
    const enderecos = {};
    const gravacoes = String(cliente.URL_PASTA_GRAVACOES || '').trim();
    const transcricoes = String(cliente.URL_PASTA_TRANSCRICOES || '').trim();
    if (gravacoes) enderecos[gravacoes] = 'Gravações';
    if (transcricoes) enderecos[transcricoes] = enderecos[transcricoes] ? 'Gravações e transcrições' : 'Transcrições';
    Object.keys(enderecos).forEach(endereco => {
      if (existe('PASTA', endereco, idCliente)) return;
      fontes.push({ id: gerarId_('FON'), tipo: 'PASTA', proprietario: 'CLIENTE', idCliente: idCliente, nome: enderecos[endereco] + ' — ' + nomeCliente, endereco: endereco, ativo: true, origem: 'MIGRACAO_CLIENTE', criadoEm: new Date().toISOString() });
      alterou = true;
    });
  });
  if (alterou) salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.fontesReunioesChave, JSON.stringify(fontes));
  return fontes;
}

function AAA_TESTAR_PASTA_MEET_PRINCIPAL() {
  return TESTAR_PASTA_MEET_PRINCIPAL();
}

function AAA_TESTAR_ABA_TRANSCRICAO_MEET() {
  const arquivo = DriveApp.getFileById('1KuLflNGPOFwVO3CGu-jJuiKLrGGKGLOkOMnYoU-9_XI');
  const leitura = jornadaLerArquivoTranscricaoDetalhe_(arquivo);
  const retorno = {
    sucesso: leitura.conteudo.length >= 20,
    aba: leitura.aba,
    usouAbaTranscricao: leitura.usouAbaTranscricao,
    caracteres: leitura.conteudo.length,
    inicio: leitura.conteudo.slice(0, 240)
  };
  console.log(JSON.stringify(retorno));
  return retorno;
}

function AAA_TESTAR_CONTEUDO_FORMALIZACAO_HITECNET() {
  const idDocumento = '1KuLflNGPOFwVO3CGu-jJuiKLrGGKGLOkOMnYoU-9_XI';
  const interacao = lerObjetos_(APP.sheets.interacoes).find(item =>
    String(item.LINK_ORIGINAL || '').includes(idDocumento) || String(item.ID_EXTERNO || '').includes(idDocumento)
  );
  if (!interacao) throw new Error('Interação da reunião Hitecnet não encontrada.');
  const transcricao = localizarObjeto_(APP.sheets.transcricoes, 'ID_INTERACAO', interacao.ID_INTERACAO);
  if (!transcricao) throw new Error('Transcrição da reunião Hitecnet não encontrada.');
  const completo = audV3ConteudoCompletoTranscricao_(transcricao, interacao);
  const retorno = {
    sucesso: completo.length >= 20 && jornadaConteudoPareceTranscricao_(completo),
    titulo: interacao.TITULO,
    caracteresArmazenados: String(transcricao.CONTEUDO || '').length,
    caracteresCompletosParaFormalizacao: completo.length,
    transcricaoLiteral: jornadaConteudoPareceTranscricao_(completo),
    inicio: completo.slice(0, 220)
  };
  console.log(JSON.stringify(retorno));
  return retorno;
}

function salvarFonteReuniao(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const idFonte = String(dados.idFonte || '').trim();
  const tipo = String(dados.tipo || '').trim().toUpperCase();
  const proprietario = String(dados.proprietario || '').trim().toUpperCase();
  const endereco = String(dados.endereco || '').trim();
  const contaId = String(dados.contaId || (tipo === 'AGENDA' ? endereco : '')).trim().toLowerCase();
  const idCliente = proprietario === 'CLIENTE' ? String(dados.idCliente || '').trim() : '';
  if (!['AGENDA', 'PASTA'].includes(tipo)) throw new Error('Selecione Agenda ou Pasta.');
  if (!['MINHA', 'TIME', 'CLIENTE'].includes(proprietario)) throw new Error('Informe de quem é esta fonte.');
  if (!endereco) throw new Error(tipo === 'AGENDA' ? 'Informe o e-mail ou ID da agenda.' : 'Informe o link da pasta.');
  if (proprietario === 'CLIENTE' && !localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente)) throw new Error('Selecione o cliente dono desta fonte.');
  if (tipo === 'AGENDA') {
    const calendario = endereco === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(endereco);
    if (!calendario) throw new Error('A conta do Board não possui acesso a esta agenda. Compartilhe a agenda antes de cadastrá-la.');
  } else {
    jornadaValidarPastaDrive_(endereco, 'reuniões');
  }
  let fontes = jornadaListarFontesReunioes_();
  const indiceExistente = idFonte ? fontes.findIndex(item => String(item.id) === idFonte) : -1;
  if (idFonte && indiceExistente < 0) throw new Error('A fonte que você tentou editar não foi encontrada. Atualize a página e tente novamente.');
  if (!idFonte && tipo === 'AGENDA') fontes = fontes.filter(item => item.id !== 'FONTE-AGENDA-PRINCIPAL' || item.endereco !== 'primary');
  const duplicada = fontes.find(item => String(item.id) !== idFonte && item.tipo === tipo && String(item.endereco).toLowerCase() === endereco.toLowerCase() && String(item.idCliente || '') === idCliente);
  if (duplicada) throw new Error('Esta fonte já está cadastrada.');
  const existente = indiceExistente >= 0 ? fontes[indiceExistente] : {};
  const registro = {
    id: idFonte || gerarId_('FON'),
    tipo,
    proprietario,
    idCliente,
    nome: String(dados.nome || '').trim(),
    contaId,
    endereco,
    ativo: true,
    criadoEm: existente.criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
  if (indiceExistente >= 0) fontes[indiceExistente] = registro;
  else fontes.push(registro);
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.fontesReunioesChave, JSON.stringify(fontes));
  instalarAutomacaoJornadaCliente();
  return { sucesso: true, mensagem: idFonte ? 'Fonte de reuniões atualizada.' : 'Fonte de reuniões cadastrada.', agenda: jornadaStatusFontesReunioes_() };
}

function carregarDadosFontesReunioesConfig() {
  jornadaGarantirEstrutura_();
  return {
    clientes: listarClientesCache_(),
    agenda: jornadaStatusFontesReunioes_()
  };
}

function removerFonteReuniao(idFonte) {
  const id = String(idFonte || '').trim();
  const fontes = jornadaListarFontesReunioes_().filter(item => String(item.id) !== id);
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.fontesReunioesChave, JSON.stringify(fontes));
  return { sucesso: true, mensagem: 'Fonte removida.', agenda: jornadaStatusFontesReunioes_() };
}

function salvarPreferenciasFontesReuniao(dados) {
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave, dados && dados.formalizacaoAutomatica ? 'SIM' : 'NAO');
  instalarAutomacaoJornadaCliente();
  return { sucesso: true, mensagem: 'Preferência de formalização salva.', agenda: jornadaStatusFontesReunioes_() };
}

function jornadaFontesAgenda_(idCliente) {
  const id = String(idCliente || '');
  return jornadaListarFontesReunioes_().filter(item => item.tipo === 'AGENDA' && (!id || !item.idCliente || String(item.idCliente) === id));
}

function jornadaFontesPasta_(idCliente) {
  const id = String(idCliente || '');
  return jornadaListarFontesReunioes_().filter(item => item.tipo === 'PASTA' && (!id || !item.idCliente || String(item.idCliente) === id));
}

function INSTALAR_JORNADA_CLIENTE() {
  jornadaGarantirEstrutura_();
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.versaoChave, JORNADA_CLIENTE_CONFIG.versao);
  // Encerra definitivamente a configuração antiga que limitava a jornada a
  // um único cliente. A sincronização atual sempre considera todos os ativos.
  salvarConfiguracao_('JORNADA_MODO_PILOTO', 'NAO');
  salvarConfiguracao_('JORNADA_CLIENTE_PILOTO_ID', '');
  return {
    sucesso: true,
    mensagem: 'Área do Cliente instalada. Identificadores e regras serão preparados sob demanda para cada cliente.',
    versao: JORNADA_CLIENTE_CONFIG.versao
  };
}

function jornadaGarantirEstrutura_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('JORNADA_ESTRUTURA_OK') === JORNADA_CLIENTE_CONFIG.versao) return;
  const ss = abrirPlanilha_();
  const obrigatorias = [
    APP.sheets.identificadoresClientes,
    APP.sheets.reunioesCalendario,
    APP.sheets.regrasEntregas,
    APP.sheets.entregasMensais,
    APP.sheets.diarioClientes,
    APP.sheets.otimizacoesClientes,
    APP.sheets.equipeClientes
  ];
  const nomesExistentes = {};
  ss.getSheets().forEach(aba => { nomesExistentes[aba.getName()] = true; });
  criarAbasAusentes_();
  cache.put('JORNADA_ESTRUTURA_OK', JORNADA_CLIENTE_CONFIG.versao, 21600);
}

function carregarAreaCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  let base = jornadaCarregarContextoAreaCliente_();
  let configuracoes = jornadaMapaConfiguracoes_(base.configuracoes);
  if (String(configuracoes[JORNADA_CLIENTE_CONFIG.versaoChave] || '') !== JORNADA_CLIENTE_CONFIG.versao) {
    INSTALAR_JORNADA_CLIENTE();
    base = jornadaCarregarContextoAreaCliente_();
    configuracoes = jornadaMapaConfiguracoes_(base.configuracoes);
  }
  const clientes = listarClientes(base.integracoesClientes, base.materiais, base.clientes)
    .filter(item => String(item.status || 'ATIVO').toUpperCase() === 'ATIVO');
  const idCliente = String(dados.idCliente || (clientes[0] || {}).idCliente || '');
  const periodo = jornadaNormalizarPeriodo_(dados.periodo);
  const clienteBase = base.clientes.find(item => String(item.ID_CLIENTE) === idCliente) || null;
  if (clienteBase) {
    jornadaGarantirIdentificadoresPadrao_(clienteBase, base.identificadores);
    jornadaGarantirRegrasPadrao_(idCliente, base.regrasEntregas);
    jornadaGerarEntregasPeriodo_(idCliente, periodo, base);
    jornadaAtualizarEntregasPorEvidencias_(idCliente, periodo, base);
  }

  const reunioes = jornadaListarReunioes_(idCliente, periodo, base.reunioes);
  const entregas = jornadaListarEntregas_(idCliente, periodo, base.entregas, base.reunioes, base.formalizacoes, base.auditorias);
  const diario = jornadaListarDiario_(idCliente, base.diario);
  const otimizacoes = jornadaListarOtimizacoes_(idCliente, base.otimizacoes);
  const auditorias = jornadaListarAuditorias_(idCliente, periodo, base.auditorias);
  const formalizacoes = jornadaListarFormalizacoes_(idCliente, periodo, base.formalizacoes);
  const metas = typeof listarMetasClientes_ === 'function'
    ? listarMetasClientes_(base.metas).filter(item => String(item.idCliente) === idCliente)
    : [];
  const materiais = typeof listarMateriaisClientes_ === 'function'
    ? listarMateriaisClientes_(base.materiais).filter(item => String(item.idCliente) === idCliente)
    : [];
  const pitches = typeof listarPitches === 'function'
    ? listarPitches(base.pitches).filter(item => String(item.idCliente) === idCliente)
    : [];
  const equipe = jornadaListarEquipe_(idCliente, base.equipe);
  const historico = jornadaListarHistoricoOperacional_(idCliente, base);

  return JSON.parse(JSON.stringify({
    clientes: clientes,
    idCliente: idCliente,
    periodo: periodo,
    cliente: clientes.find(item => String(item.idCliente) === idCliente) || null,
    agenda: jornadaStatusFontesReunioes_(),
    resumo: jornadaResumo_(entregas, reunioes, otimizacoes, historico, equipe),
    identificadores: jornadaListarIdentificadores_(idCliente, base.identificadores),
    entregas: entregas,
    reunioes: reunioes,
    diario: diario,
    otimizacoes: otimizacoes,
    auditorias: auditorias,
    formalizacoes: formalizacoes,
    metas: metas,
    materiais: materiais,
    pitches: pitches,
    equipe: equipe,
    historicoOperacional: historico
  }));
}

function jornadaCarregarContextoAreaCliente_() {
  const ss = abrirPlanilha_();
  const abas = {
    configuracoes: APP.sheets.configuracoes,
    clientes: APP.sheets.clientes,
    integracoesClientes: APP.sheets.integracoesClientes,
    materiais: APP.sheets.materiaisClientes,
    metas: APP.sheets.metasClientes,
    pitches: APP.sheets.pitches,
    identificadores: APP.sheets.identificadoresClientes,
    regrasEntregas: APP.sheets.regrasEntregas,
    entregas: APP.sheets.entregasMensais,
    reunioes: APP.sheets.reunioesCalendario,
    auditorias: APP.sheets.auditorias,
    formalizacoes: APP.sheets.formalizacoes,
    interacoes: APP.sheets.interacoes,
    diario: APP.sheets.diarioClientes,
    otimizacoes: APP.sheets.otimizacoesClientes,
    equipe: APP.sheets.equipeClientes
  };
  const retorno = {};
  Object.keys(abas).forEach(chave => {
    retorno[chave] = jornadaLerObjetosAba_(ss, abas[chave]);
  });
  return retorno;
}

function jornadaLerObjetosAba_(ss, nomeAba) {
  const aba = ss.getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2 || aba.getLastColumn() < 1) return [];
  const valores = aba.getDataRange().getValues();
  const cabecalhos = valores[0];
  return valores.slice(1).filter(linha => linha.some(valor => valor !== '')).map(linha => {
    const objeto = {};
    cabecalhos.forEach((cabecalho, indice) => { if (cabecalho) objeto[cabecalho] = linha[indice]; });
    return objeto;
  });
}

function jornadaMapaConfiguracoes_(itens) {
  const mapa = {};
  (itens || []).forEach(item => { if (item.CHAVE) mapa[String(item.CHAVE)] = item.VALOR; });
  return mapa;
}

function salvarConfiguracaoJornadaCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const cliente = localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente);
  if (!cliente) throw new Error('Selecione um cliente válido para configurar as reuniões.');
  const pastaGravacoes = jornadaValidarPastaDrive_(dados.urlPastaGravacoes, 'gravações');
  const pastaTranscricoes = jornadaValidarPastaDrive_(dados.urlPastaTranscricoes, 'transcrições');
  atualizarPorCampo_(APP.sheets.clientes, 'ID_CLIENTE', idCliente, {
    URL_PASTA_GRAVACOES: pastaGravacoes,
    URL_PASTA_TRANSCRICOES: pastaTranscricoes,
    ATUALIZADO_EM: new Date()
  });
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.calendarioIdChave, String(dados.calendarioId || '').trim());
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave, dados.formalizacaoAutomatica ? 'SIM' : 'NAO');
  jornadaGarantirIdentificadoresPadrao_(cliente);
  jornadaGarantirRegrasPadrao_(idCliente);
  instalarAutomacaoJornadaCliente();
  limparCachesDados_();
  return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
}

function instalarAutomacaoJornadaCliente() {
  const funcao = 'SINCRONIZAR_JORNADA_CALENDARIO';
  const existentes = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === funcao);
  existentes.slice(1).forEach(trigger => ScriptApp.deleteTrigger(trigger));
  if (!existentes.length) ScriptApp.newTrigger(funcao).timeBased().everyHours(2).create();
  if (String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave) || 'NAO').toUpperCase() === 'SIM') {
    instalarAutomacaoFormalizacoesAgenda_();
  }
  CacheService.getScriptCache().put('JORNADA_AUTOMACAO_ATIVA_V1', 'SIM', 21600);
  return { sucesso: true, mensagem: 'Sincronização da Agenda configurada para executar a cada duas horas.' };
}

function INSTALAR_FORMALIZACOES_AUTOMATICAS_AGENDA() {
  const hoje = new Date();
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave, 'SIM');
  if (!obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaInicioChave)) {
    salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaInicioChave, Utilities.formatDate(amanha, APP.timezone, 'yyyy-MM-dd'));
  }
  instalarAutomacaoFormalizacoesAgenda_();
  return {
    sucesso: true,
    inicio: String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaInicioChave) || ''),
    horarios: ['13:00', '18:30'],
    mensagem: 'Formalizações automáticas configuradas para 13:00 e 18:30.'
  };
}

function instalarAutomacaoFormalizacoesAgenda_() {
  const funcao = 'EXECUTAR_FORMALIZACOES_AUTOMATICAS_AGENDA';
  if (!obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaInicioChave)) {
    const hoje = new Date();
    const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaInicioChave, Utilities.formatDate(amanha, APP.timezone, 'yyyy-MM-dd'));
  }
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === funcao)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(funcao).timeBased().everyDays(1).atHour(13).nearMinute(0).inTimezone(APP.timezone).create();
  ScriptApp.newTrigger(funcao).timeBased().everyDays(1).atHour(18).nearMinute(30).inTimezone(APP.timezone).create();
}

function jornadaAutomacaoFormalizacoesInstalada_() {
  return ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'EXECUTAR_FORMALIZACOES_AUTOMATICAS_AGENDA').length >= 2;
}

function EXECUTAR_FORMALIZACOES_AUTOMATICAS_AGENDA() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { sucesso: false, mensagem: 'Outra rotina de formalização já está em andamento.' };
  try {
    if (String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave) || 'NAO').toUpperCase() !== 'SIM') {
      return { sucesso: true, ignorada: true, mensagem: 'Formalização automática desativada.' };
    }
    const hojeTexto = Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd');
    const inicioTexto = String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaInicioChave) || '').trim();
    if (inicioTexto && hojeTexto < inicioTexto) {
      return { sucesso: true, ignorada: true, mensagem: 'A rotina automática começa em ' + inicioTexto + '.' };
    }

    // Atualiza primeiro a Agenda e os artefatos. A transcrição é suficiente para
    // formalizar; a ausência da gravação permanece somente como alerta operacional.
    SINCRONIZAR_JORNADA_CALENDARIO();
    const fontesMinhas = jornadaListarFontesReunioes_().filter(item => item.tipo === 'AGENDA' && String(item.proprietario || 'MINHA').toUpperCase() === 'MINHA');
    const calendarios = {};
    fontesMinhas.forEach(fonte => {
      let id = String(fonte.endereco || '');
      if (id === 'primary') {
        try { id = CalendarApp.getDefaultCalendar().getId(); } catch (erro) { id = 'primary'; }
      }
      calendarios[id] = true;
      calendarios[String(fonte.endereco || '')] = true;
    });

    const agora = new Date();
    const limite = new Date(agora.getTime() - 7 * 86400000);
    const formalizacoes = lerObjetos_(APP.sheets.formalizacoes).filter(item =>
      String(item.STATUS || '').toUpperCase() !== 'DESCARTADA'
    );
    const candidatas = lerObjetos_(APP.sheets.reunioesCalendario)
      .filter(item => item.ID_REUNIAO && item.ID_CLIENTE && new Date(item.FIM || item.INICIO).getTime() <= agora.getTime())
      .filter(item => new Date(item.INICIO).getTime() >= limite.getTime())
      .filter(item => calendarios[String(item.CALENDAR_ID || '')])
      .filter(item => Boolean(String(item.TRANSCRICAO_URL || item.ID_TRANSCRICAO || '').trim()) && Boolean(String(item.ID_TRANSCRICAO || '').trim()))
      .filter(jornadaReuniaoDeveFormalizar_)
      .filter(item => !formalizacoes.some(formalizacao =>
        (item.ID_TRANSCRICAO && String(formalizacao.ID_TRANSCRICAO || '') === String(item.ID_TRANSCRICAO)) ||
        (item.ID_INTERACAO && String(formalizacao.ID_INTERACAO || '') === String(item.ID_INTERACAO))
      ))
      .sort((a, b) => new Date(a.INICIO) - new Date(b.INICIO))
      .slice(0, 4);

    const geradas = [];
    const erros = [];
    candidatas.forEach(reuniao => {
      try {
        const id = jornadaGerarFormalizacaoSeNecessario_(reuniao, {
          idInteracao: reuniao.ID_INTERACAO,
          idTranscricao: reuniao.ID_TRANSCRICAO
        });
        if (id) geradas.push(id);
      } catch (erro) {
        erros.push(String(reuniao.TITULO || reuniao.ID_REUNIAO) + ': ' + String(erro.message || erro));
      }
    });
    registrarLog_('JORNADA', 'FORMALIZACOES_AUTOMATICAS', geradas.length + ' gerada(s); ' + erros.length + ' erro(s).');
    limparCachesDados_();
    return { sucesso: erros.length === 0, geradas: geradas.length, ids: geradas, erros: erros };
  } finally {
    lock.releaseLock();
  }
}

function jornadaReuniaoDeveFormalizar_(reuniao) {
  const tipo = String(reuniao.TIPO_REUNIAO || '').toUpperCase();
  if (['EXECUTIVA', 'OPERACIONAL_SDR', 'OPERACIONAL_CLOSER'].includes(tipo)) return true;
  const titulo = String(reuniao.TITULO || '');
  return /(?:volum\s*\+|\+\s*volum)/i.test(titulo);
}

function jornadaAutomacaoInstalada_() {
  return ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'SINCRONIZAR_JORNADA_CALENDARIO');
}

function jornadaAutomacaoInstaladaCache_() {
  const cache = CacheService.getScriptCache();
  const chave = 'JORNADA_AUTOMACAO_ATIVA_V1';
  const armazenado = cache.get(chave);
  if (armazenado === 'SIM' || armazenado === 'NAO') return armazenado === 'SIM';
  const instalada = jornadaAutomacaoInstalada_();
  cache.put(chave, instalada ? 'SIM' : 'NAO', 21600);
  return instalada;
}

function jornadaGarantirAutomacao_() {
  if (!jornadaAutomacaoInstalada_()) instalarAutomacaoJornadaCliente();
  if (String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave) || 'NAO').toUpperCase() === 'SIM' && !jornadaAutomacaoFormalizacoesInstalada_()) {
    instalarAutomacaoFormalizacoesAgenda_();
  }
}

function SINCRONIZAR_JORNADA_CALENDARIO() {
  const hoje = new Date();
  const inicio = new Date(hoje.getTime() - 14 * 86400000);
  const fim = new Date(hoje.getTime() + 45 * 86400000);
  return sincronizarAgendaTodosClientes({ dataInicio: inicio.toISOString(), dataFim: fim.toISOString(), origem: 'AUTOMATICA' });
}

function sincronizarAgendaTodosClientes(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const clientes = lerObjetos_(APP.sheets.clientes)
    .filter(item => item.ID_CLIENTE && String(item.STATUS || 'ATIVO').toUpperCase() === 'ATIVO');
  clientes.forEach(cliente => jornadaGarantirIdentificadoresPadrao_(cliente));
  const idsAtivos = {};
  clientes.forEach(cliente => { idsAtivos[String(cliente.ID_CLIENTE)] = cliente; });
  const regras = lerObjetos_(APP.sheets.identificadoresClientes)
    .filter(item => String(item.ATIVO || 'SIM').toUpperCase() !== 'NAO' && idsAtivos[String(item.ID_CLIENTE || '')]);
  const intervalo = jornadaIntervalo_('', dados.dataInicio, dados.dataFim);
  const tocados = {};
  let encontrados = 0;
  let artefatos = 0;
  let transcricoesPastas = 0;
  const erros = [];
  const agendas = jornadaFontesAgenda_().map(fonte => {
    const calendario = fonte.endereco === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(fonte.endereco);
    if (!calendario) { erros.push((fonte.nome || fonte.endereco) + ': agenda sem acesso.'); return null; }
    return { fonte: fonte, calendario: calendario };
  }).filter(Boolean);
  if (!agendas.length) throw new Error('Nenhuma agenda cadastrada está disponível para a conta que executa o Board.');

  agendas.forEach(origem => {
    origem.calendario.getEvents(intervalo.inicio, intervalo.fim).forEach(evento => {
      try {
        const candidato = jornadaIdentificarClienteEvento_(evento, regras);
        if (!candidato || candidato.pontos < 50 || !idsAtivos[String(candidato.idCliente)]) return;
        encontrados++;
        tocados[String(candidato.idCliente)] = true;
        const reuniao = jornadaSalvarEvento_(evento, origem.calendario.getId(), candidato);
        const encerrada = new Date(reuniao.FIM).getTime() <= Date.now();
        const incompleta = !reuniao.ID_TRANSCRICAO || !reuniao.GRAVACAO_URL;
        if (reuniao.MEETING_CODE && encerrada && incompleta) {
          try {
            const enriquecida = jornadaEnriquecerComMeet_(reuniao);
            if (enriquecida && (enriquecida.CONFERENCE_RECORD || enriquecida.TRANSCRICAO_URL || enriquecida.GRAVACAO_URL)) artefatos++;
          } catch (erroMeet) {
            atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', reuniao.ID_REUNIAO, {
              ERRO_MEET: String(erroMeet.message || erroMeet).slice(0, 500),
              ATUALIZADO_EM: new Date()
            });
            erros.push(reuniao.TITULO + ': ' + String(erroMeet.message || erroMeet));
          }
        }
      } catch (erroEvento) {
        erros.push(String(erroEvento.message || erroEvento));
      }
    });
  });

  clientes.forEach(cliente => {
    const fontesCliente = jornadaFontesPasta_(cliente.ID_CLIENTE).filter(item => String(item.idCliente || '') === String(cliente.ID_CLIENTE));
    const pastas = [];
    if (cliente.URL_PASTA_TRANSCRICOES || cliente.URL_PASTA_GRAVACOES) pastas.push(cliente);
    fontesCliente.forEach(fonte => pastas.push(Object.assign({}, cliente, { NOME_FONTE: fonte.nome || '', URL_PASTA_TRANSCRICOES: fonte.endereco, URL_PASTA_GRAVACOES: fonte.endereco })));
    pastas.forEach(origemPasta => {
      try {
        const retornoPastas = jornadaSincronizarPastasCliente_(origemPasta, intervalo);
        transcricoesPastas += retornoPastas.importadas;
        if (retornoPastas.importadas) tocados[String(cliente.ID_CLIENTE)] = true;
        (retornoPastas.erros || []).forEach(erro => erros.push(erro));
      } catch (erroPasta) {
        erros.push(String(cliente.NOME_CLIENTE || cliente.ID_CLIENTE) + ': ' + String(erroPasta.message || erroPasta));
      }
    });
  });

  jornadaFontesPasta_().forEach(fonte => {
    if (fonte.idCliente) return;
    try {
      const retornoPasta = jornadaSincronizarPastasCliente_({ ID_CLIENTE: '', NOME_CLIENTE: fonte.nome || 'Pasta geral', NOME_FONTE: fonte.nome || '', URL_PASTA_TRANSCRICOES: fonte.endereco, URL_PASTA_GRAVACOES: fonte.endereco }, intervalo);
      transcricoesPastas += retornoPasta.importadas;
      (retornoPasta.erros || []).forEach(erro => erros.push(erro));
    } catch (erroPastaGeral) {
      erros.push((fonte.nome || 'Pasta geral') + ': ' + String(erroPastaGeral.message || erroPastaGeral));
    }
  });

  Object.keys(tocados).forEach(idCliente => {
    const periodo = Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM');
    jornadaGarantirRegrasPadrao_(idCliente);
    jornadaGerarEntregasPeriodo_(idCliente, periodo);
    jornadaAtualizarEntregasPorEvidencias_(idCliente, periodo);
  });
  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.sincronizacaoChave, new Date());
  limparCachesDados_();
  registrarLog_('JORNADA', 'SINCRONIZAR_TODOS', encontrados + ' reunião(ões), ' + artefatos + ' artefato(s) Meet e ' + transcricoesPastas + ' transcrição(ões) de pasta.');
  return {
    sucesso: true,
    mensagem: 'Sincronização automática concluída para todos os clientes.',
    encontrados: encontrados,
    artefatos: artefatos,
    transcricoesPastas: transcricoesPastas,
    clientesAtualizados: Object.keys(tocados).length,
    erros: erros.slice(0, 20)
  };
}

function jornadaValidarPastaDrive_(url, rotulo) {
  const texto = String(url || '').trim();
  if (!texto) return '';
  const id = jornadaExtrairIdDrive_(texto);
  if (!id) throw new Error('Informe um link válido para a pasta de ' + rotulo + '.');
  try {
    DriveApp.getFolderById(id).getName();
  } catch (erro) {
    throw new Error('A conta do Board não conseguiu acessar a pasta de ' + rotulo + '.');
  }
  return texto;
}

function jornadaExtrairIdDrive_(valor) {
  const texto = String(valor || '').trim();
  const achou = texto.match(/\/folders\/([a-zA-Z0-9_-]+)/) || texto.match(/[?&]id=([a-zA-Z0-9_-]+)/) || texto.match(/^([a-zA-Z0-9_-]{15,})$/);
  return achou ? achou[1] : '';
}

function jornadaSincronizarPastasCliente_(cliente, intervalo) {
  const idTranscricoes = jornadaExtrairIdDrive_(cliente.URL_PASTA_TRANSCRICOES);
  if (!idTranscricoes) return { importadas: 0, erros: [] };
  const idGravacoes = jornadaExtrairIdDrive_(cliente.URL_PASTA_GRAVACOES);
  const arquivosPasta = jornadaListarArquivosPasta_(cliente.URL_PASTA_TRANSCRICOES, intervalo, 200);
  const gravacoes = idGravacoes && idGravacoes === idTranscricoes
    ? arquivosPasta
    : jornadaListarArquivosPasta_(cliente.URL_PASTA_GRAVACOES, intervalo, 200);
  const arquivos = arquivosPasta
    .filter(arquivo => {
      const mime = String(arquivo.getMimeType() || '');
      return mime === MimeType.GOOGLE_DOCS || mime === MimeType.PLAIN_TEXT || mime === 'text/plain';
    })
    .sort((a, b) => new Date(b.getLastUpdated() || b.getDateCreated() || 0) - new Date(a.getLastUpdated() || a.getDateCreated() || 0))
    .slice(0, 120);
  const reunioesCliente = lerObjetos_(APP.sheets.reunioesCalendario)
    .filter(item => !cliente.ID_CLIENTE || String(item.ID_CLIENTE || '') === String(cliente.ID_CLIENTE || ''));
  const interacoesPorExterno = {};
  lerObjetos_(APP.sheets.interacoes).forEach(item => { if (item.ID_EXTERNO) interacoesPorExterno[String(item.ID_EXTERNO)] = item; });
  const transcricoesPorInteracao = {};
  lerObjetos_(APP.sheets.transcricoes).forEach(item => { if (item.ID_INTERACAO) transcricoesPorInteracao[String(item.ID_INTERACAO)] = item; });
  let importadas = 0;
  let atualizadas = 0;
  const erros = [];
  arquivos.forEach(arquivo => {
    try {
      const idExterno = 'DRIVE_TRANSCRIPT|' + arquivo.getId();
      const existente = interacoesPorExterno[idExterno] || null;
      const gravacao = jornadaEncontrarGravacao_(arquivo, gravacoes);
      const reuniao = jornadaEncontrarReuniaoArquivo_(cliente.ID_CLIENTE, arquivo, reunioesCliente);
      const idClienteVinculado = String(cliente.ID_CLIENTE || (reuniao && reuniao.ID_CLIENTE) || '').trim();
      let leitura = null;
      if (existente) {
        const ajustesInteracao = {};
        if (idClienteVinculado && String(existente.ID_CLIENTE || '') !== idClienteVinculado) ajustesInteracao.ID_CLIENTE = idClienteVinculado;
        if (gravacao && String(existente.URL_GRAVACAO || '') !== String(gravacao.getUrl() || '')) ajustesInteracao.URL_GRAVACAO = gravacao.getUrl();
        if (Object.keys(ajustesInteracao).length) {
          ajustesInteracao.ATUALIZADO_EM = new Date();
          atualizarPorCampo_(APP.sheets.interacoes, 'ID_INTERACAO', existente.ID_INTERACAO, ajustesInteracao);
          Object.keys(ajustesInteracao).forEach(chave => { existente[chave] = ajustesInteracao[chave]; });
        }
        const transcricaoExistente = transcricoesPorInteracao[String(existente.ID_INTERACAO)] || null;
        if (transcricaoExistente && String(transcricaoExistente.CONTEUDO || '').trim().length >= 20) {
          if (!jornadaConteudoPareceTranscricao_(transcricaoExistente.CONTEUDO)) {
            leitura = jornadaLerArquivoTranscricaoDetalhe_(arquivo);
            if (leitura.usouAbaTranscricao && leitura.conteudo.length >= 20 && leitura.conteudo !== String(transcricaoExistente.CONTEUDO || '').trim()) {
              const conteudoPlanilha = jornadaConteudoParaPlanilha_(leitura.conteudo);
              atualizarPorCampo_(APP.sheets.transcricoes, 'ID_TRANSCRICAO', transcricaoExistente.ID_TRANSCRICAO, {
                CONTEUDO: conteudoPlanilha,
                TAMANHO_CARACTERES: leitura.conteudo.length,
                STATUS: 'CONCLUIDA',
                ERRO: '',
                ATUALIZADO_EM: new Date()
              });
              transcricaoExistente.CONTEUDO = conteudoPlanilha;
              atualizadas++;
            }
          }
          jornadaVincularArtefatosPasta_(reuniao, arquivo, gravacao, existente.ID_INTERACAO, transcricaoExistente.ID_TRANSCRICAO);
          return;
        }
      }
      leitura = leitura || jornadaLerArquivoTranscricaoDetalhe_(arquivo);
      const conteudo = leitura.conteudo;
      if (conteudo.length < 20) return;
      const conteudoPlanilha = jornadaConteudoParaPlanilha_(conteudo);
      const agora = new Date();
      const idInteracao = existente ? existente.ID_INTERACAO : gerarId_('INT');
      if (!existente) {
        const novaInteracao = {
          ID_INTERACAO: idInteracao,
          FONTE: 'GOOGLE_MEET',
          ID_EXTERNO: idExterno,
          TIPO_INTERACAO: 'REUNIAO',
          ID_CLIENTE: idClienteVinculado,
          VENDEDOR: cliente.NOME_FONTE || '', LEAD: '', TITULO: arquivo.getName().replace(/\.[^.]+$/, ''),
          DATA_INTERACAO: arquivo.getDateCreated() || arquivo.getLastUpdated() || agora,
          DURACAO_SEGUNDOS: 0,
          LINK_ORIGINAL: arquivo.getUrl(),
          URL_GRAVACAO: gravacao ? gravacao.getUrl() : '',
          STATUS_TRANSCRICAO: 'CONCLUIDA', STATUS_AUDITORIA: 'PENDENTE',
          IMPORTADO_EM: agora, ATUALIZADO_EM: agora,
          NOME_ARQUIVO_ORIGEM: arquivo.getName(), EMPRESA_ARQUIVO: '', NUMERO_CHAMADA: '',
          COLABORADOR: '', FUNCAO: '', OPORTUNIDADE: '', LINK_CRM: '',
          SCHEMA_VERSAO: APP.versao, PARTICIPANTES_JSON: '[]'
        };
        adicionarObjeto_(APP.sheets.interacoes, novaInteracao);
        interacoesPorExterno[idExterno] = novaInteracao;
      }
      const idTranscricao = gerarId_('TRA');
      adicionarObjeto_(APP.sheets.transcricoes, {
        ID_TRANSCRICAO: idTranscricao, ID_INTERACAO: idInteracao, FONTE: 'GOOGLE_MEET',
        IDIOMA: 'pt-BR', CONTEUDO: conteudoPlanilha, TAMANHO_CARACTERES: conteudo.length,
        STATUS: 'CONCLUIDA', ERRO: '', IMPORTADO_EM: agora, ATUALIZADO_EM: agora
      });
      transcricoesPorInteracao[String(idInteracao)] = { ID_TRANSCRICAO: idTranscricao, ID_INTERACAO: idInteracao, CONTEUDO: conteudoPlanilha, STATUS: 'CONCLUIDA' };
      jornadaVincularArtefatosPasta_(reuniao, arquivo, gravacao, idInteracao, idTranscricao);
      importadas++;
    } catch (erroArquivo) {
      erros.push(arquivo.getName() + ': ' + String(erroArquivo.message || erroArquivo));
    }
  });
  return { importadas: importadas, atualizadas: atualizadas, erros: erros };
}

function jornadaEncontrarReuniaoArquivo_(idCliente, arquivo, reunioes) {
  const nomeArquivo = jornadaNormalizarArquivo_(arquivo.getName());
  const tokensArquivoDistintivos = jornadaTokensDistintivosArquivo_(nomeArquivo);
  const dataArquivo = arquivo.getDateCreated() || arquivo.getLastUpdated() || new Date();
  const horarioArquivo = new Date(dataArquivo).getTime();
  let melhor = null;
  let melhorPontos = 0;
  (reunioes || []).forEach(reuniao => {
    if (idCliente && String(reuniao.ID_CLIENTE || '') !== String(idCliente || '')) return;
    const horarioReuniao = new Date(reuniao.INICIO).getTime();
    const diferencaHoras = Math.abs(horarioArquivo - horarioReuniao) / 3600000;
    if (!isFinite(diferencaHoras) || diferencaHoras > 96) return;
    const titulo = jornadaNormalizarArquivo_(reuniao.TITULO);
    let pontosNome = 0;
    if (titulo && nomeArquivo && titulo === nomeArquivo) pontosNome = 100;
    else if (titulo && nomeArquivo && (titulo.indexOf(nomeArquivo) >= 0 || nomeArquivo.indexOf(titulo) >= 0)) pontosNome = 75;
    else {
      const tokensTitulo = titulo.split(' ').filter(token => token.length >= 4);
      const tokensArquivo = nomeArquivo.split(' ').filter(token => token.length >= 4);
      const comuns = tokensTitulo.filter(token => tokensArquivo.indexOf(token) >= 0).length;
      const distintivosTitulo = jornadaTokensDistintivosArquivo_(titulo);
      const distintivosComuns = distintivosTitulo.filter(token => tokensArquivoDistintivos.indexOf(token) >= 0).length;
      // Palavras como "VOLUM", "operacional", "SDR" e "Closer" aparecem em
      // quase todas as reuniões e não identificam o cliente. O pareamento por
      // tokens só é aceito quando existe ao menos um termo realmente distintivo
      // (normalmente o nome do cliente), evitando vínculos cruzados.
      if (comuns >= 2 && distintivosComuns >= 1) pontosNome = Math.min(70, 45 + distintivosComuns * 15);
    }
    const pontosData = diferencaHoras <= 18 ? 35 : (diferencaHoras <= 48 ? 20 : 5);
    const total = pontosNome + pontosData;
    if (pontosNome >= 50 && total > melhorPontos) {
      melhor = reuniao;
      melhorPontos = total;
    }
  });
  return melhorPontos >= 80 ? melhor : null;
}

function jornadaTokensDistintivosArquivo_(valor) {
  const genericos = {
    volum: true, reuniao: true, operacional: true, executiva: true,
    performance: true, closer: true, sdr: true, sales: true, follow: true,
    semanal: true, setup: true, alinhamento: true, alinhamentos: true,
    anotacoes: true, gemini: true, transcricao: true, transcript: true,
    gravacao: true, recording: true, google: true, meet: true
  };
  return jornadaNormalizarArquivo_(valor).split(' ').filter(token =>
    token.length >= 4 && !genericos[token] && !/^\d+$/.test(token)
  );
}

function jornadaVincularArtefatosPasta_(reuniao, transcricao, gravacao, idInteracao, idTranscricao) {
  if (!reuniao || !reuniao.ID_REUNIAO) return;
  const transcricaoUrl = transcricao ? transcricao.getUrl() : String(reuniao.TRANSCRICAO_URL || '');
  const gravacaoUrl = gravacao ? gravacao.getUrl() : String(reuniao.GRAVACAO_URL || '');
  const alteracoes = {
    STATUS: gravacaoUrl && (transcricaoUrl || idTranscricao || reuniao.ID_TRANSCRICAO) ? 'REALIZADA' : 'PENDENTE_EVIDENCIA',
    TRANSCRICAO_URL: transcricaoUrl,
    GRAVACAO_URL: gravacaoUrl,
    ID_INTERACAO: idInteracao || reuniao.ID_INTERACAO || '',
    ID_TRANSCRICAO: idTranscricao || reuniao.ID_TRANSCRICAO || '',
    ERRO_MEET: '',
    ATUALIZADO_EM: new Date()
  };
  atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', reuniao.ID_REUNIAO, alteracoes);
  Object.keys(alteracoes).forEach(chave => { reuniao[chave] = alteracoes[chave]; });
}

function jornadaListarArquivosPasta_(urlPasta, intervalo, limite) {
  const id = jornadaExtrairIdDrive_(urlPasta);
  if (!id) return [];
  const arquivos = [];
  const inicio = intervalo && intervalo.inicio ? new Date(intervalo.inicio).getTime() : 0;
  const maximo = Math.max(1, Number(limite || 100));
  const fila = [DriveApp.getFolderById(id)];
  let pastasVisitadas = 0;
  while (fila.length && arquivos.length < maximo && pastasVisitadas < 100) {
    const pasta = fila.shift();
    pastasVisitadas++;
    const iteradorArquivos = pasta.getFiles();
    while (iteradorArquivos.hasNext() && arquivos.length < maximo) {
      const arquivo = iteradorArquivos.next();
      const atualizado = (arquivo.getLastUpdated() || arquivo.getDateCreated() || new Date(0)).getTime();
      if (!inicio || atualizado >= inicio) arquivos.push(arquivo);
    }
    const iteradorPastas = pasta.getFolders();
    while (iteradorPastas.hasNext() && fila.length < 100) fila.push(iteradorPastas.next());
  }
  return arquivos;
}

function jornadaLerArquivoTranscricao_(arquivo) {
  return jornadaLerArquivoTranscricaoDetalhe_(arquivo).conteudo;
}

function jornadaLerArquivoTranscricaoDetalhe_(arquivo) {
  try {
    if (String(arquivo.getMimeType()) !== String(MimeType.GOOGLE_DOCS)) {
      return { conteudo: String(arquivo.getBlob().getDataAsString('UTF-8') || '').trim(), aba: '', usouAbaTranscricao: false };
    }
    const documento = DocumentApp.openById(arquivo.getId());
    const abas = jornadaListarAbasDocumento_(documento);
    const abaTranscricao = abas.find(function(aba) {
      const titulo = jornadaNormalizar_(aba.getTitle ? aba.getTitle() : '');
      return titulo === 'transcricao' || titulo.indexOf('transcricao') >= 0 || titulo.indexOf('transcript') >= 0;
    });
    if (abaTranscricao) {
      const conteudoTranscricao = String(abaTranscricao.asDocumentTab().getBody().getText() || '').trim();
      return { conteudo: conteudoTranscricao, aba: String(abaTranscricao.getTitle() || 'Transcrição'), usouAbaTranscricao: true };
    }
    return { conteudo: String(documento.getBody().getText() || '').trim(), aba: 'Primeira aba', usouAbaTranscricao: false };
  } catch (erro) {
    return { conteudo: '', aba: '', usouAbaTranscricao: false, erro: String(erro && erro.message || erro) };
  }
}

function jornadaLerDocumentoTranscricaoEstrita_(url) {
  const achou = String(url || '').match(/\/d\/([a-zA-Z0-9_-]+)/) || String(url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!achou) return { conteudo: '', aba: '', usouAbaTranscricao: false, erro: 'Documento não identificado.' };
  try {
    const leitura = jornadaLerArquivoTranscricaoDetalhe_(DriveApp.getFileById(achou[1]));
    if (!leitura.usouAbaTranscricao) {
      return { conteudo: '', aba: leitura.aba || '', usouAbaTranscricao: false, erro: 'A aba Transcrição não foi encontrada.' };
    }
    return leitura;
  } catch (erro) {
    return { conteudo: '', aba: '', usouAbaTranscricao: false, erro: String(erro && erro.message || erro) };
  }
}

function jornadaListarAbasDocumento_(documento) {
  const resultado = [];
  const visitar = function(aba) {
    if (!aba) return;
    resultado.push(aba);
    const filhas = typeof aba.getChildTabs === 'function' ? aba.getChildTabs() : [];
    (filhas || []).forEach(visitar);
  };
  const principais = documento && typeof documento.getTabs === 'function' ? documento.getTabs() : [];
  (principais || []).forEach(visitar);
  return resultado;
}

function jornadaConteudoPareceTranscricao_(conteudo) {
  const texto = String(conteudo || '');
  const marcadoresTempo = texto.match(/(?:^|\n)\s*\d{2}:\d{2}:\d{2}\s*(?:\n|$)/g) || [];
  // A aba de observações do Gemini também contém linhas com dois-pontos.
  // Os timestamps isolados são o sinal confiável da aba literal do Google Meet.
  return marcadoresTempo.length >= 2;
}

function jornadaConteudoParaPlanilha_(conteudo) {
  // O Google Sheets limita cada célula a 50 mil caracteres. O conteúdo integral
  // continua no Google Docs e é carregado sob demanda na auditoria/formalização.
  return String(conteudo || '').slice(0, 48000);
}

function jornadaEncontrarGravacao_(arquivoTranscricao, gravacoes) {
  const idTranscricao = arquivoTranscricao && typeof arquivoTranscricao.getId === 'function' ? String(arquivoTranscricao.getId() || '') : '';
  const nomeTranscricao = arquivoTranscricao && typeof arquivoTranscricao.getName === 'function' ? arquivoTranscricao.getName() : String(arquivoTranscricao || '');
  const base = jornadaNormalizarArquivo_(nomeTranscricao);
  let melhor = null;
  let melhorPontos = 0;
  (gravacoes || []).forEach(arquivo => {
    if (!arquivo || (idTranscricao && String(arquivo.getId() || '') === idTranscricao) || !jornadaArquivoEhGravacao_(arquivo)) return;
    const nome = jornadaNormalizarArquivo_(arquivo.getName());
    const pontos = nome === base ? 100 : (nome && base && (nome.indexOf(base) >= 0 || base.indexOf(nome) >= 0) ? 70 : 0);
    if (pontos > melhorPontos) { melhor = arquivo; melhorPontos = pontos; }
  });
  return melhor;
}

function jornadaArquivoEhGravacao_(arquivo) {
  const mime = String(arquivo && arquivo.getMimeType ? arquivo.getMimeType() : '').toLowerCase();
  const nome = String(arquivo && arquivo.getName ? arquivo.getName() : '').toLowerCase();
  return /^(audio|video)\//.test(mime) || /\.(mp3|m4a|wav|aac|ogg|opus|mp4|webm|mov|mkv)$/i.test(nome);
}

function CORRIGIR_DOUBLE_CHECK_PASTAS_REUNIOES() {
  jornadaGarantirEstrutura_();
  const aba = abrirPlanilha_().getSheetByName(APP.sheets.reunioesCalendario);
  if (!aba || aba.getLastRow() < 2) return { sucesso: true, corrigidas: 0 };
  const faixa = aba.getDataRange();
  const valores = faixa.getValues();
  const cabecalhos = valores[0].map(String);
  const indice = nome => cabecalhos.indexOf(nome);
  const iGravacao = indice('GRAVACAO_URL');
  const iTranscricao = indice('TRANSCRICAO_URL');
  const iStatus = indice('STATUS');
  const iAtualizado = indice('ATUALIZADO_EM');
  let corrigidas = 0;
  for (let linha = 1; linha < valores.length; linha++) {
    const gravacao = String(valores[linha][iGravacao] || '').trim();
    const transcricao = String(valores[linha][iTranscricao] || '').trim();
    if (!gravacao || !transcricao || gravacao !== transcricao) continue;
    valores[linha][iGravacao] = '';
    if (iStatus >= 0) valores[linha][iStatus] = 'PENDENTE_EVIDENCIA';
    if (iAtualizado >= 0) valores[linha][iAtualizado] = new Date();
    corrigidas++;
  }
  if (corrigidas) faixa.setValues(valores);
  limparCachesDados_();
  registrarLog_('JORNADA', 'CORRIGIR_DOUBLE_CHECK', corrigidas + ' reunião(ões) corrigida(s).');
  return { sucesso: true, corrigidas: corrigidas };
}

function DIAGNOSTICAR_PAREAMENTO_AGENDA_PASTA() {
  jornadaGarantirEstrutura_();
  const reunioes = lerObjetos_(APP.sheets.reunioesCalendario).filter(item => item.ID_REUNIAO);
  const interacoes = lerObjetos_(APP.sheets.interacoes).filter(item => String(item.FONTE || '').toUpperCase() === 'GOOGLE_MEET');
  const resultado = {
    reunioes: reunioes.length,
    comTranscricao: reunioes.filter(item => String(item.TRANSCRICAO_URL || item.ID_TRANSCRICAO || '').trim()).length,
    comGravacao: reunioes.filter(item => String(item.GRAVACAO_URL || '').trim()).length,
    doubleCheckReal: reunioes.filter(item => String(item.GRAVACAO_URL || '').trim() && String(item.TRANSCRICAO_URL || item.ID_TRANSCRICAO || '').trim() && String(item.GRAVACAO_URL || '').trim() !== String(item.TRANSCRICAO_URL || '').trim()).length,
    falsosDoubleChecks: reunioes.filter(item => String(item.GRAVACAO_URL || '').trim() && String(item.GRAVACAO_URL || '').trim() === String(item.TRANSCRICAO_URL || '').trim()).length,
    interacoesMeet: interacoes.length,
    interacoesMeetSemCliente: interacoes.filter(item => !String(item.ID_CLIENTE || '').trim()).length,
    fontesPastaAtivas: jornadaFontesPasta_().length
  };
  console.log(JSON.stringify(resultado));
  return resultado;
}

function TESTAR_PASTA_MEET_PRINCIPAL() {
  jornadaGarantirEstrutura_();
  const fonte = jornadaFontesPasta_().find(item => !item.idCliente && jornadaExtrairIdDrive_(item.endereco) === jornadaExtrairIdDrive_(JORNADA_CLIENTE_CONFIG.pastaMeetPrincipal));
  if (!fonte) throw new Error('A pasta principal do Google Meet não está cadastrada como fonte ativa.');
  const fim = new Date();
  const inicio = new Date(fim.getTime() - 60 * 86400000);
  const retorno = jornadaSincronizarPastasCliente_({
    ID_CLIENTE: '', NOME_CLIENTE: fonte.nome || 'Pasta principal do Meet', NOME_FONTE: fonte.nome || '',
    URL_PASTA_TRANSCRICOES: fonte.endereco, URL_PASTA_GRAVACOES: fonte.endereco
  }, { inicio: inicio, fim: fim });
  const diagnostico = DIAGNOSTICAR_PAREAMENTO_AGENDA_PASTA();
  const resultado = {
    sucesso: true,
    importadas: retorno.importadas,
    atualizadas: retorno.atualizadas || 0,
    erros: retorno.erros,
    diagnostico: diagnostico
  };
  console.log(JSON.stringify(resultado));
  return resultado;
}

function AAA_DIAGNOSTICAR_ORIGEM_TRANSCRICOES_MEET() {
  jornadaGarantirEstrutura_();
  const interacoes = {};
  lerObjetos_(APP.sheets.interacoes).forEach(item => {
    if (item.ID_INTERACAO) interacoes[String(item.ID_INTERACAO)] = item;
  });
  const itens = lerObjetos_(APP.sheets.transcricoes).filter(item =>
    String(item.FONTE || '').toUpperCase() === 'GOOGLE_MEET'
  );
  const resumir = lista => ({
    total: lista.length,
    transcricaoLiteral: lista.filter(item => jornadaConteudoPareceTranscricao_(item.CONTEUDO)).length,
    aindaSemTranscricaoLiteral: lista.filter(item => !jornadaConteudoPareceTranscricao_(item.CONTEUDO)).length
  });
  const agosto = itens.filter(item => {
    const interacao = interacoes[String(item.ID_INTERACAO || '')] || {};
    const bruto = interacao.DATA_INTERACAO || interacao.DATA_HORA || item.IMPORTADO_EM || item.CRIADO_EM || '';
    const data = bruto instanceof Date ? bruto : new Date(bruto);
    return !isNaN(data.getTime()) && data.getFullYear() === 2026 && data.getMonth() === 7;
  });
  const retorno = { todos: resumir(itens), agosto2026: resumir(agosto) };
  console.log(JSON.stringify(retorno));
  return retorno;
}

function jornadaNormalizarArquivo_(valor) {
  return jornadaNormalizar_(String(valor || '').replace(/\.[^.]+$/, '').replace(/\b(transcri[cç][aã]o|transcript|grava[cç][aã]o|recording)\b/gi, ''));
}

function sincronizarAgendaCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const cliente = localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente);
  if (!cliente) throw new Error('Selecione um cliente válido para sincronizar a Agenda.');
  jornadaGarantirIdentificadoresPadrao_(cliente);

  const periodo = jornadaNormalizarPeriodo_(dados.periodo);
  const intervalo = jornadaIntervalo_(periodo, dados.dataInicio, dados.dataFim);
  let encontrados = 0;
  let atualizados = 0;
  let artefatos = 0;
  let transcricoesPastas = 0;
  const erros = [];
  const agendas = jornadaFontesAgenda_(idCliente).map(fonte => {
    const calendario = fonte.endereco === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(fonte.endereco);
    if (!calendario) { erros.push((fonte.nome || fonte.endereco) + ': agenda sem acesso.'); return null; }
    return { fonte: fonte, calendario: calendario };
  }).filter(Boolean);
  if (!agendas.length) throw new Error('Nenhuma agenda cadastrada está disponível para a conta do Board.');

  agendas.forEach(origem => {
    origem.calendario.getEvents(intervalo.inicio, intervalo.fim).forEach(evento => {
      try {
        const candidato = jornadaIdentificarClienteEvento_(evento);
        if (!candidato || String(candidato.idCliente) !== idCliente || candidato.pontos < 50) return;
        encontrados++;
        const reuniao = jornadaSalvarEvento_(evento, origem.calendario.getId(), candidato);
        atualizados++;
        if (reuniao.MEETING_CODE && new Date(reuniao.FIM).getTime() <= Date.now() && (!reuniao.ID_TRANSCRICAO || !reuniao.GRAVACAO_URL)) {
          try {
            const enriquecida = jornadaEnriquecerComMeet_(reuniao);
            if (enriquecida && (enriquecida.CONFERENCE_RECORD || enriquecida.TRANSCRICAO_URL || enriquecida.GRAVACAO_URL)) artefatos++;
          } catch (erroMeet) {
            atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', reuniao.ID_REUNIAO, {
              ERRO_MEET: String(erroMeet.message || erroMeet).slice(0, 500),
              ATUALIZADO_EM: new Date()
            });
            erros.push(reuniao.TITULO + ': ' + String(erroMeet.message || erroMeet));
          }
        }
      } catch (erroEvento) {
        erros.push(String(erroEvento.message || erroEvento));
      }
    });
  });

  const pastas = [];
  if (cliente.URL_PASTA_TRANSCRICOES || cliente.URL_PASTA_GRAVACOES) pastas.push(cliente);
  jornadaFontesPasta_(idCliente).forEach(fonte => pastas.push(Object.assign({}, cliente, { NOME_FONTE: fonte.nome || '', URL_PASTA_TRANSCRICOES: fonte.endereco, URL_PASTA_GRAVACOES: fonte.endereco })));
  pastas.forEach(origemPasta => {
    const retornoPastas = jornadaSincronizarPastasCliente_(origemPasta, intervalo);
    transcricoesPastas += retornoPastas.importadas;
    (retornoPastas.erros || []).forEach(erro => erros.push(erro));
  });

  salvarConfiguracao_(JORNADA_CLIENTE_CONFIG.sincronizacaoChave, new Date());
  if (dados.modoConferenciaRapida !== true) {
    jornadaGerarEntregasPeriodo_(idCliente, periodo);
    jornadaAtualizarEntregasPorEvidencias_(idCliente, periodo);
  }
  limparCachesDados_();
  registrarLog_('JORNADA', 'SINCRONIZAR_AGENDA', idCliente + ': ' + encontrados + ' evento(s), ' + artefatos + ' com artefatos.');
  const resumoSincronizacao = { encontrados: encontrados, atualizados: atualizados, artefatos: artefatos, transcricoesPastas: transcricoesPastas, erros: erros.slice(0, 10) };
  const mensagem = 'Reuniões sincronizadas: ' + encontrados + ' evento(s), ' + artefatos + ' artefato(s) do Meet e ' + transcricoesPastas + ' transcrição(ões) nova(s) das pastas.';
  if (dados.retornoSimples === true) {
    return { sucesso: true, sincronizacao: resumoSincronizacao, mensagem: mensagem };
  }
  if (dados.modoConferenciaRapida === true) {
    return JSON.parse(JSON.stringify({
      sucesso: true,
      sincronizacao: resumoSincronizacao,
      mensagem: mensagem,
      reunioes: jornadaListarReunioes_(idCliente, periodo),
      agenda: {
        ativo: true,
        fontes: jornadaListarFontesReunioes_(),
        calendarioId: '',
        formalizacaoAutomatica: String(obterConfiguracao_(JORNADA_CLIENTE_CONFIG.formalizacaoAutomaticaChave) || 'NAO').toUpperCase() === 'SIM',
        contaExecucao: jornadaEmailExecucao_(),
        ultimaSincronizacao: serializarData_(new Date()),
        automacaoAtiva: jornadaAutomacaoInstalada_()
      }
    }));
  }
  const retorno = carregarAreaCliente({ idCliente: idCliente, periodo: periodo });
  retorno.sincronizacao = resumoSincronizacao;
  retorno.mensagem = mensagem;
  return retorno;
}

function sincronizarAgendaFormalizacoes(dados) {
  dados = Object.assign({}, dados || {}, { retornoSimples: true, modoConferenciaRapida: true, origem: 'MANUAL_FORMALIZACAO' });
  let sincronizacao;
  if (String(dados.idCliente || '').trim()) {
    sincronizacao = sincronizarAgendaCliente(dados);
  } else {
    const intervalo = jornadaIntervalo_(jornadaNormalizarPeriodo_(dados.periodo), dados.dataInicio, dados.dataFim);
    const retorno = sincronizarAgendaTodosClientes({ dataInicio: intervalo.inicio.toISOString(), dataFim: intervalo.fim.toISOString(), origem: dados.origem });
    sincronizacao = { sincronizacao: retorno, mensagem: retorno.mensagem };
  }
  return {
    sucesso: true,
    mensagem: sincronizacao.mensagem,
    sincronizacao: sincronizacao.sincronizacao,
    dados: carregarDadosFormalizacoes()
  };
}

function SINCRONIZAR_HISTORICO_FORMALIZACOES_DOIS_MESES() {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0);
  const retorno = sincronizarAgendaTodosClientes({
    dataInicio: inicio.toISOString(),
    dataFim: agora.toISOString(),
    origem: 'BACKFILL_FORMALIZACOES_DOIS_MESES'
  });
  return {
    sucesso: true,
    mensagem: 'Varredura única do mês atual e do mês passado concluída.',
    sincronizacao: retorno,
    dados: carregarDadosFormalizacoes()
  };
}

function RECLASSIFICAR_REUNIOES_HISTORICAS_DOIS_MESES() {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
  const clientes = lerObjetos_(APP.sheets.clientes)
    .filter(item => item.ID_CLIENTE && String(item.STATUS || 'ATIVO').toUpperCase() === 'ATIVO');
  clientes.forEach(cliente => jornadaGarantirIdentificadoresPadrao_(cliente));
  const clientesPorId = {};
  clientes.forEach(cliente => { clientesPorId[String(cliente.ID_CLIENTE)] = cliente; });
  const regras = lerObjetos_(APP.sheets.identificadoresClientes)
    .filter(item => String(item.ATIVO || 'SIM').toUpperCase() !== 'NAO' && clientesPorId[String(item.ID_CLIENTE || '')]);
  let analisadas = 0;
  let reclassificadas = 0;
  let semCliente = 0;
  lerObjetos_(APP.sheets.reunioesCalendario).forEach(reuniao => {
    const horario = new Date(reuniao.INICIO).getTime();
    if (!isFinite(horario) || horario < inicio || horario > agora.getTime()) return;
    analisadas++;
    const emails = jornadaJsonLista_(reuniao.PARTICIPANTES_JSON);
    const evento = {
      getTitle: function() { return String(reuniao.TITULO || ''); },
      getDescription: function() { return ''; },
      getGuestList: function() { return emails.map(email => ({ getEmail: function() { return email; } })); },
      getCreators: function() { return reuniao.ORGANIZADOR ? [reuniao.ORGANIZADOR] : []; }
    };
    const candidato = jornadaIdentificarClienteEvento_(evento, regras);
    const idAtual = String(reuniao.ID_CLIENTE || '');
    const novoId = candidato && candidato.pontos >= 50 ? String(candidato.idCliente) : '';
    if (novoId === idAtual) return;
    atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', reuniao.ID_REUNIAO, {
      ID_CLIENTE: novoId,
      CONFIANCA_CLIENTE: candidato ? Math.round(candidato.pontos) : 0,
      MOTIVO_IDENTIFICACAO: candidato ? candidato.motivo : 'cliente não confirmado após reclassificação',
      ATUALIZADO_EM: new Date()
    });
    reclassificadas++;
    if (!novoId) semCliente++;
  });
  limparCachesDados_();
  registrarLog_('JORNADA', 'RECLASSIFICAR_HISTORICO', analisadas + ' analisadas, ' + reclassificadas + ' alteradas, ' + semCliente + ' sem cliente confirmado.');
  return { sucesso: true, analisadas: analisadas, reclassificadas: reclassificadas, semCliente: semCliente };
}

function salvarClassificacaoReuniaoJornada(dados) {
  dados = dados || {};
  const idReuniao = String(dados.idReuniao || '').trim();
  const reuniao = localizarObjeto_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', idReuniao);
  if (!reuniao) throw new Error('Reunião não encontrada.');
  const tipo = String(dados.tipoReuniao || 'OUTRA').toUpperCase();
  if (JORNADA_CLIENTE_CONFIG.tiposReuniao.indexOf(tipo) < 0) throw new Error('Selecione um tipo de reunião válido.');
  atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', idReuniao, {
    TIPO_REUNIAO: tipo,
    ATUALIZADO_EM: new Date()
  });
  return carregarAreaCliente({ idCliente: reuniao.ID_CLIENTE, periodo: dados.periodo });
}

function validarRealizacaoEntregaAgendaCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const idReuniao = String(dados.idReuniao || '').trim();
  const idEntrega = String(dados.idEntrega || '').trim();
  const reuniao = localizarObjeto_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', idReuniao);
  if (!reuniao) throw new Error('A reunião indicada pela Agenda não foi encontrada.');
  const realizada = dados.realizada === true || String(dados.realizada).toUpperCase() === 'TRUE';
  const agora = new Date();
  const status = realizada ? 'REALIZADA' : 'NAO_REALIZADA';
  atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', idReuniao, {
    STATUS: status,
    ATUALIZADO_EM: agora
  });

  const entrega = idEntrega ? localizarObjeto_(APP.sheets.entregasMensais, 'ID_ENTREGA', idEntrega) : null;
  if (entrega && String(entrega.ID_CLIENTE) === String(reuniao.ID_CLIENTE)) {
    atualizarPorCampo_(APP.sheets.entregasMensais, 'ID_ENTREGA', idEntrega, {
      STATUS: status,
      ORIGEM: 'VALIDACAO_MANUAL_AGENDA',
      ID_REUNIAO: idReuniao,
      LINK_DOCUMENTO: realizada ? (reuniao.TRANSCRICAO_URL || reuniao.GRAVACAO_URL || reuniao.MEET_URL || entrega.LINK_DOCUMENTO || '') : (entrega.LINK_DOCUMENTO || ''),
      CONCLUIDO_EM: realizada ? (reuniao.FIM || agora) : '',
      ATUALIZADO_EM: agora
    });
  }

  limparCachesDados_();
  registrarLog_('JORNADA', 'VALIDAR_REUNIAO_AGENDA', idReuniao + ': ' + status + '.');
  return carregarAreaCliente({
    idCliente: reuniao.ID_CLIENTE,
    periodo: dados.periodo || jornadaPeriodoData_(reuniao.INICIO)
  });
}

function jornadaIdentificarClienteEvento_(evento, regrasInformadas) {
  const titulo = String(evento.getTitle() || '');
  const tituloNormalizado = jornadaNormalizar_(titulo);
  const descricao = String(evento.getDescription() || '');
  const emails = jornadaEmailsEvento_(evento);
  const regras = (Array.isArray(regrasInformadas) ? regrasInformadas : lerObjetos_(APP.sheets.identificadoresClientes))
    .filter(item => String(item.ATIVO || 'SIM').toUpperCase() !== 'NAO' && item.ID_CLIENTE);
  const resultados = {};
  regras.forEach(regra => {
    const id = String(regra.ID_CLIENTE);
    const tipo = String(regra.TIPO || '').toUpperCase();
    const valor = String(regra.VALOR || '').trim();
    const normal = String(regra.VALOR_NORMALIZADO || jornadaNormalizar_(valor));
    if (!normal) return;
    let pontos = 0;
    let motivo = '';
    if (tipo === 'EMAIL' && emails.some(email => jornadaNormalizar_(email) === normal)) {
      pontos = 100; motivo = 'e-mail exato: ' + valor;
    } else if (tipo === 'DOMINIO' && emails.some(email => jornadaDominio_(email) === jornadaDominio_(valor))) {
      pontos = 85; motivo = 'domínio do participante: ' + valor;
    } else if ((tipo === 'NOME' || tipo === 'TITULO') && normal.length >= 4 && tituloNormalizado.includes(normal) && (normal !== 'volum' || tituloNormalizado.indexOf('volum') === 0)) {
      pontos = tipo === 'TITULO' ? 80 : 70; motivo = 'nome no título: ' + valor;
    } else if (tipo === 'NOME' && normal.length >= 5 && jornadaNormalizar_(descricao).includes(normal)) {
      pontos = 45; motivo = 'nome na descrição: ' + valor;
    }
    pontos += pontos ? Number(regra.PRIORIDADE || 0) / 100 : 0;
    if (!resultados[id] || pontos > resultados[id].pontos) resultados[id] = { idCliente: id, pontos: pontos, motivo: motivo };
  });
  const ordenados = Object.keys(resultados).map(id => resultados[id]).filter(item => item.pontos > 0).sort((a, b) => b.pontos - a.pontos);
  if (!ordenados.length) return null;
  if (ordenados[1] && Math.abs(ordenados[0].pontos - ordenados[1].pontos) < 5) return null;
  return ordenados[0];
}

function jornadaSalvarEvento_(evento, calendarId, candidato) {
  const inicio = evento.getStartTime();
  const fim = evento.getEndTime();
  const chaveEvento = String(evento.getId() || '') + '|' + inicio.toISOString();
  const existente = localizarObjeto_(APP.sheets.reunioesCalendario, 'EVENTO_ID', chaveEvento);
  const meetUrl = jornadaMeetUrlEvento_(evento, calendarId);
  const agora = new Date();
  const objeto = {
    ID_REUNIAO: existente ? existente.ID_REUNIAO : gerarId_('REU'),
    ID_CLIENTE: candidato.idCliente,
    CALENDAR_ID: calendarId,
    EVENTO_ID: chaveEvento,
    TITULO: String(evento.getTitle() || 'Reunião sem título'),
    TIPO_REUNIAO: existente && existente.TIPO_REUNIAO ? existente.TIPO_REUNIAO : jornadaClassificarTipoReuniao_(evento.getTitle()),
    INICIO: inicio,
    FIM: fim,
    ORGANIZADOR: jornadaOrganizadorEvento_(evento),
    PARTICIPANTES_JSON: JSON.stringify(jornadaEmailsEvento_(evento)),
    MEET_URL: meetUrl,
    MEETING_CODE: jornadaMeetingCode_(meetUrl),
    CONFERENCE_RECORD: existente ? existente.CONFERENCE_RECORD || '' : '',
    STATUS: existente && existente.CONFERENCE_RECORD
      ? 'REALIZADA'
      : (existente && ['REALIZADA','NAO_REALIZADA'].includes(String(existente.STATUS || '').toUpperCase())
        ? String(existente.STATUS).toUpperCase()
        : (fim.getTime() > Date.now() ? 'AGENDADA' : 'POSSIVEL_ENTREGA')),
    CONFIANCA_CLIENTE: Math.round(candidato.pontos),
    MOTIVO_IDENTIFICACAO: candidato.motivo,
    GRAVACAO_URL: existente ? existente.GRAVACAO_URL || '' : '',
    TRANSCRICAO_URL: existente ? existente.TRANSCRICAO_URL || '' : '',
    ID_INTERACAO: existente ? existente.ID_INTERACAO || '' : '',
    ID_TRANSCRICAO: existente ? existente.ID_TRANSCRICAO || '' : '',
    ERRO_MEET: '',
    ORIGEM: 'GOOGLE_CALENDAR',
    SINCRONIZADO_EM: agora,
    ATUALIZADO_EM: agora
  };
  if (existente) atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', existente.ID_REUNIAO, objeto);
  else adicionarObjeto_(APP.sheets.reunioesCalendario, objeto);
  return objeto;
}

function jornadaEnriquecerComMeet_(reuniao) {
  const codigo = String(reuniao.MEETING_CODE || '').trim();
  if (!codigo) return reuniao;
  const lista = jornadaMeetGet_('/v2/conferenceRecords', {
    filter: 'space.meeting_code = "' + codigo + '"',
    pageSize: 20
  });
  const registros = Array.isArray(lista.conferenceRecords) ? lista.conferenceRecords : [];
  if (!registros.length) return reuniao;
  const alvo = new Date(reuniao.INICIO).getTime();
  registros.sort((a, b) => Math.abs(new Date(a.startTime).getTime() - alvo) - Math.abs(new Date(b.startTime).getTime() - alvo));
  const registro = registros[0];
  const nome = String(registro.name || '');
  if (!nome) return reuniao;
  const gravacoes = jornadaMeetGet_('/v2/' + nome + '/recordings', { pageSize: 100 });
  const transcricoes = jornadaMeetGet_('/v2/' + nome + '/transcripts', { pageSize: 100 });
  const gravacao = (gravacoes.recordings || [])[0] || {};
  const transcricao = (transcricoes.transcripts || [])[0] || {};
  const gravacaoUrl = jornadaArtefatoUrl_(gravacao.driveDestination || gravacao);
  const transcricaoUrl = jornadaArtefatoUrl_(transcricao.docsDestination || transcricao.driveDestination || transcricao);
  const alteracoes = {
    CONFERENCE_RECORD: nome,
    STATUS: registro.endTime ? (gravacaoUrl && transcricaoUrl ? 'REALIZADA' : 'PENDENTE_EVIDENCIA') : 'EM_ANDAMENTO',
    GRAVACAO_URL: gravacaoUrl,
    TRANSCRICAO_URL: transcricaoUrl,
    ERRO_MEET: '',
    ATUALIZADO_EM: new Date()
  };
  const reuniaoComArtefatos = Object.assign({}, reuniao, {
    GRAVACAO_URL: gravacaoUrl,
    TRANSCRICAO_URL: transcricaoUrl,
    CONFERENCE_RECORD: nome
  });
  const importada = jornadaImportarTranscricaoMeet_(reuniaoComArtefatos, registro, transcricao, transcricaoUrl);
  if (importada) {
    alteracoes.ID_INTERACAO = importada.idInteracao;
    alteracoes.ID_TRANSCRICAO = importada.idTranscricao;
  }
  atualizarPorCampo_(APP.sheets.reunioesCalendario, 'ID_REUNIAO', reuniao.ID_REUNIAO, alteracoes);
  return Object.assign({}, reuniao, alteracoes);
}

function jornadaGerarFormalizacaoSeNecessario_(reuniao, importada) {
  if (typeof gerarFormalizacaoReuniao !== 'function') return null;
  const existente = lerObjetos_(APP.sheets.formalizacoes).find(item =>
    String(item.ID_TRANSCRICAO || '') === String(importada.idTranscricao || '')
  );
  if (existente) return existente.ID_FORMALIZACAO;
  const tipoOrigem = String(reuniao.TIPO_REUNIAO || '').toUpperCase();
  const tipo = tipoOrigem === 'EXECUTIVA' ? 'EXECUTIVA' : (tipoOrigem === 'OUTRA' ? 'OUTRA' : 'OPERACIONAL');
  const resposta = gerarFormalizacaoReuniao({
    idTranscricao: importada.idTranscricao,
    idCliente: reuniao.ID_CLIENTE,
    tipoReuniao: tipo,
    titulo: reuniao.TITULO,
    dataReuniao: reuniao.INICIO,
    participantes: typeof formalParticipantes_ === 'function' ? formalParticipantes_(reuniao.PARTICIPANTES_JSON) : jornadaJsonLista_(reuniao.PARTICIPANTES_JSON)
  });
  return resposta && resposta.formalizacao ? resposta.formalizacao.idFormalizacao : null;
}

function jornadaImportarTranscricaoMeet_(reuniao, registro, transcript, transcriptUrl) {
  if (!transcript || !transcript.name) return null;
  const idExterno = 'MEET|' + String(transcript.name);
  const interacaoExistente = localizarObjeto_(APP.sheets.interacoes, 'ID_EXTERNO', idExterno);
  if (interacaoExistente) {
    const transcricaoExistente = localizarObjeto_(APP.sheets.transcricoes, 'ID_INTERACAO', interacaoExistente.ID_INTERACAO);
    if (transcricaoExistente && String(transcricaoExistente.CONTEUDO || '').trim()) {
      return { idInteracao: interacaoExistente.ID_INTERACAO, idTranscricao: transcricaoExistente.ID_TRANSCRICAO };
    }
  }
  const leituraDocumento = jornadaLerDocumentoTranscricaoEstrita_(transcriptUrl);
  let conteudo = leituraDocumento.usouAbaTranscricao ? leituraDocumento.conteudo : '';
  if (!conteudo) {
    try {
      const entradas = jornadaMeetGet_('/v2/' + transcript.name + '/entries', { pageSize: 1000 });
      conteudo = (entradas.transcriptEntries || []).map(item => {
        const momento = item.startTime ? '[' + Utilities.formatDate(new Date(item.startTime), APP.timezone, 'HH:mm:ss') + '] ' : '';
        return momento + String(item.participant || 'Participante') + ': ' + String(item.text || '');
      }).join('\n');
    } catch (erroEntradas) {}
  }
  conteudo = String(conteudo || '').trim();
  if (conteudo.length < 20) return null;
  const agora = new Date();
  const idInteracao = interacaoExistente ? interacaoExistente.ID_INTERACAO : gerarId_('INT');
  const idTranscricao = gerarId_('TRA');
  const funcao = String(reuniao.TIPO_REUNIAO || '').includes('CLOSER') ? 'CLOSER' : (String(reuniao.TIPO_REUNIAO || '').includes('SDR') ? 'SDR' : '');
  if (!interacaoExistente) {
    adicionarObjeto_(APP.sheets.interacoes, {
      ID_INTERACAO: idInteracao,
      FONTE: 'GOOGLE_MEET',
      ID_EXTERNO: idExterno,
      TIPO_INTERACAO: 'REUNIAO',
      ID_CLIENTE: reuniao.ID_CLIENTE,
      VENDEDOR: '', LEAD: '', TITULO: reuniao.TITULO,
      DATA_INTERACAO: reuniao.INICIO,
      DURACAO_SEGUNDOS: Math.max(0, Math.round((new Date(reuniao.FIM).getTime() - new Date(reuniao.INICIO).getTime()) / 1000)),
      LINK_ORIGINAL: reuniao.MEET_URL,
      URL_GRAVACAO: reuniao.GRAVACAO_URL || '',
      STATUS_TRANSCRICAO: 'CONCLUIDA', STATUS_AUDITORIA: 'PENDENTE',
      IMPORTADO_EM: agora, ATUALIZADO_EM: agora,
      NOME_ARQUIVO_ORIGEM: reuniao.TITULO, EMPRESA_ARQUIVO: '', NUMERO_CHAMADA: '',
      COLABORADOR: '', FUNCAO: funcao, OPORTUNIDADE: '', LINK_CRM: '',
      SCHEMA_VERSAO: APP.versao, PARTICIPANTES_JSON: reuniao.PARTICIPANTES_JSON || '[]'
    });
  }
  adicionarObjeto_(APP.sheets.transcricoes, {
    ID_TRANSCRICAO: idTranscricao, ID_INTERACAO: idInteracao, FONTE: 'GOOGLE_MEET',
    IDIOMA: 'pt-BR', CONTEUDO: conteudo, TAMANHO_CARACTERES: conteudo.length,
    STATUS: 'CONCLUIDA', ERRO: '', IMPORTADO_EM: agora, ATUALIZADO_EM: agora
  });
  return { idInteracao: idInteracao, idTranscricao: idTranscricao };
}

function jornadaMeetGet_(caminho, parametros) {
  const query = Object.keys(parametros || {}).filter(chave => parametros[chave] !== '' && parametros[chave] !== null && parametros[chave] !== undefined)
    .map(chave => encodeURIComponent(chave) + '=' + encodeURIComponent(parametros[chave])).join('&');
  const resposta = UrlFetchApp.fetch('https://meet.googleapis.com' + caminho + (query ? '?' + query : ''), {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  const status = resposta.getResponseCode();
  const texto = resposta.getContentText();
  if (status >= 200 && status < 300) return texto ? JSON.parse(texto) : {};
  let detalhe = texto;
  try { detalhe = (JSON.parse(texto).error || {}).message || texto; } catch (e) {}
  throw new Error('Google Meet API ' + status + ': ' + String(detalhe).slice(0, 400));
}

function jornadaGarantirIdentificadoresPadrao_(cliente, identificadoresInformados) {
  if (!cliente || !cliente.ID_CLIENTE) return;
  const chaveCliente = String(cliente.CHAVE_VOLUMBERG || '').trim();
  const nomeCompacto = jornadaCompactarIdentificador_(cliente.NOME_CLIENTE);
  const catalogo = typeof CATALOGO_CLIENTES_AUDIT !== 'undefined'
    ? CATALOGO_CLIENTES_AUDIT.find(item => {
        if (chaveCliente && String(item.chave) === chaveCliente) return true;
        const candidatos = [item.nome].concat(item.aliases || []);
        return candidatos.some(valor => jornadaCompactarIdentificador_(valor) === nomeCompacto);
      })
    : null;
  const nomes = [cliente.NOME_CLIENTE].concat((catalogo && catalogo.aliases) || []);
  nomes.filter(Boolean).forEach((nome, indice) => jornadaUpsertIdentificador_(
    cliente.ID_CLIENTE, 'NOME', nome, 10 - indice, 'CATALOGO', identificadoresInformados
  ));
}

function jornadaCompactarIdentificador_(valor) {
  return jornadaNormalizar_(valor).replace(/[^a-z0-9]/g, '');
}

function salvarIdentificadoresCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const cliente = localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente);
  if (!cliente) throw new Error('Cliente não encontrado.');
  const tipos = { nomes: 'NOME', emails: 'EMAIL', dominios: 'DOMINIO', titulos: 'TITULO' };
  const atuais = lerObjetos_(APP.sheets.identificadoresClientes).filter(item => String(item.ID_CLIENTE) === idCliente && String(item.ORIGEM) === 'MANUAL');
  atuais.forEach(item => atualizarPorCampo_(APP.sheets.identificadoresClientes, 'ID_IDENTIFICADOR', item.ID_IDENTIFICADOR, { ATIVO: 'NAO', ATUALIZADO_EM: new Date() }));
  Object.keys(tipos).forEach(chave => {
    jornadaListaEntrada_(dados[chave]).forEach((valor, indice) => jornadaUpsertIdentificador_(idCliente, tipos[chave], valor, 30 - indice, 'MANUAL'));
  });
  jornadaGarantirIdentificadoresPadrao_(cliente);
  return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
}

function jornadaUpsertIdentificador_(idCliente, tipo, valor, prioridade, origem, identificadoresInformados) {
  const normal = jornadaNormalizar_(tipo === 'DOMINIO' ? jornadaDominio_(valor) : valor);
  if (!normal) return;
  const identificadores = Array.isArray(identificadoresInformados)
    ? identificadoresInformados
    : lerObjetos_(APP.sheets.identificadoresClientes);
  const existente = identificadores.find(item =>
    String(item.ID_CLIENTE) === String(idCliente) && String(item.TIPO).toUpperCase() === String(tipo).toUpperCase() &&
    String(item.VALOR_NORMALIZADO) === normal
  );
  const agora = new Date();
  const objeto = { VALOR: String(valor).trim(), VALOR_NORMALIZADO: normal, PRIORIDADE: prioridade || 0, ATIVO: 'SIM', ORIGEM: origem || 'MANUAL', ATUALIZADO_EM: agora };
  if (existente) {
    const mudou = String(existente.VALOR || '') !== objeto.VALOR ||
      Number(existente.PRIORIDADE || 0) !== Number(objeto.PRIORIDADE || 0) ||
      String(existente.ATIVO || '').toUpperCase() !== 'SIM' ||
      String(existente.ORIGEM || '') !== objeto.ORIGEM;
    if (mudou) {
      atualizarPorCampo_(APP.sheets.identificadoresClientes, 'ID_IDENTIFICADOR', existente.ID_IDENTIFICADOR, objeto);
      Object.assign(existente, objeto);
    }
    return;
  }
  const novo = Object.assign({ ID_IDENTIFICADOR: gerarId_('IDE'), ID_CLIENTE: idCliente, TIPO: tipo, CRIADO_EM: agora }, objeto);
  adicionarObjeto_(APP.sheets.identificadoresClientes, novo);
  identificadores.push(novo);
}

function jornadaGarantirRegrasPadrao_(idCliente, regrasInformadas) {
  const todas = Array.isArray(regrasInformadas)
    ? regrasInformadas
    : lerObjetos_(APP.sheets.regrasEntregas);
  const existentes = todas.filter(item => String(item.ID_CLIENTE) === String(idCliente));
  JORNADA_CLIENTE_CONFIG.regrasPadrao.forEach(regra => {
    const igual = existentes.find(item => String(item.TIPO_ENTREGA) === regra.tipo && String(item.ESCOPO) === regra.escopo && String(item.NOME) === regra.nome);
    if (igual) return;
    const agora = new Date();
    const nova = {
      ID_REGRA: gerarId_('REG'), ID_CLIENTE: idCliente, TIPO_ENTREGA: regra.tipo,
      ESCOPO: regra.escopo, NOME: regra.nome, QUANTIDADE_MENSAL: 1,
      DIA_LIMITE: regra.dia, OBRIGATORIA: 'SIM', ATIVA: 'SIM', CRIADO_EM: agora, ATUALIZADO_EM: agora
    };
    adicionarObjeto_(APP.sheets.regrasEntregas, nova);
    existentes.push(nova);
    todas.push(nova);
  });
}

function jornadaGerarEntregasPeriodo_(idCliente, periodo, contexto) {
  const todasRegras = contexto && Array.isArray(contexto.regrasEntregas)
    ? contexto.regrasEntregas
    : lerObjetos_(APP.sheets.regrasEntregas);
  const todasEntregas = contexto && Array.isArray(contexto.entregas)
    ? contexto.entregas
    : lerObjetos_(APP.sheets.entregasMensais);
  const regras = todasRegras.filter(item => String(item.ID_CLIENTE) === String(idCliente) && String(item.ATIVA || 'SIM').toUpperCase() !== 'NAO');
  const existentes = todasEntregas.filter(item =>
    String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.PERIODO) === periodo
  );
  regras.forEach(regra => {
    const quantidade = Math.max(1, Number(regra.QUANTIDADE_MENSAL || 1));
    for (let ordem = 1; ordem <= quantidade; ordem++) {
      if (existentes.some(item => String(item.ID_REGRA) === String(regra.ID_REGRA) && Number(item.ORDEM_MES || 1) === ordem)) continue;
      const agora = new Date();
      const nova = {
        ID_ENTREGA: gerarId_('ENT'), ID_CLIENTE: idCliente, PERIODO: periodo,
        ID_REGRA: regra.ID_REGRA, TIPO_ENTREGA: regra.TIPO_ENTREGA, ESCOPO: regra.ESCOPO,
        NOME: regra.NOME, ORDEM_MES: ordem, DATA_LIMITE: jornadaDataLimite_(periodo, regra.DIA_LIMITE),
        STATUS: 'PREVISTA', ORIGEM: 'REGRA_MENSAL', ID_REUNIAO: '', ID_AUDITORIA: '',
        ID_FORMALIZACAO: '', LINK_DOCUMENTO: '', LINK_CIRCLE: '', PUBLICADO_EM: '',
        RESPONSAVEL: '', OBSERVACOES: '', CONCLUIDO_EM: '', CRIADO_EM: agora, ATUALIZADO_EM: agora
      };
      adicionarObjeto_(APP.sheets.entregasMensais, nova);
      existentes.push(nova);
      todasEntregas.push(nova);
    }
  });
}

function jornadaAtualizarEntregasPorEvidencias_(idCliente, periodo, contexto) {
  const fonte = contexto || {};
  const entregas = (Array.isArray(fonte.entregas) ? fonte.entregas : lerObjetos_(APP.sheets.entregasMensais)).filter(item =>
    String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.PERIODO) === periodo
  );
  const reunioes = (Array.isArray(fonte.reunioes) ? fonte.reunioes : lerObjetos_(APP.sheets.reunioesCalendario)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.INICIO) === periodo).sort((a, b) => new Date(a.INICIO) - new Date(b.INICIO));
  const auditorias = (Array.isArray(fonte.auditorias) ? fonte.auditorias : lerObjetos_(APP.sheets.auditorias)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.CONCLUIDO_EM || item.SOLICITADO_EM) === periodo && String(item.STATUS).toUpperCase() === 'CONCLUIDA');
  const formalizacoes = (Array.isArray(fonte.formalizacoes) ? fonte.formalizacoes : lerObjetos_(APP.sheets.formalizacoes)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.DATA_REUNIAO || item.SOLICITADO_EM) === periodo && ['APROVADA', 'CONCLUIDA'].includes(String(item.STATUS).toUpperCase()));
  const interacoes = Array.isArray(fonte.interacoes) ? fonte.interacoes : lerObjetos_(APP.sheets.interacoes);
  const alteracoesEmLote = {};
  entregas.forEach(entrega => {
    if (['ENTREGUE', 'PUBLICADA', 'DISPENSADA'].includes(String(entrega.STATUS).toUpperCase()) && String(entrega.ORIGEM) === 'MANUAL') return;
    const tipo = String(entrega.TIPO_ENTREGA || '').toUpperCase();
    const escopo = String(entrega.ESCOPO || '').toUpperCase();
    const ordem = Math.max(0, Number(entrega.ORDEM_MES || 1) - 1);
    let evidencia = null;
    let alteracoes = null;
    if (tipo === 'REUNIAO') {
      const tipoReuniao = escopo === 'GESTAO' ? 'EXECUTIVA' : 'OPERACIONAL_' + escopo;
      evidencia = reunioes.filter(item => String(item.TIPO_REUNIAO) === tipoReuniao)[ordem] || null;
      if (evidencia) {
        const statusReuniao = String(evidencia.STATUS || '').toUpperCase();
        const temGravacao = Boolean(String(evidencia.GRAVACAO_URL || '').trim());
        const temTranscricao = Boolean(String(evidencia.TRANSCRICAO_URL || evidencia.ID_TRANSCRICAO || '').trim());
        const encerrada = new Date(evidencia.FIM || evidencia.INICIO).getTime() <= Date.now();
        const statusEntrega = temGravacao && temTranscricao
          ? 'REALIZADA'
          : (statusReuniao === 'NAO_REALIZADA'
            ? 'NAO_REALIZADA'
            : (encerrada ? 'PENDENTE_EVIDENCIA' : 'AGENDADA'));
        alteracoes = { ID_REUNIAO: evidencia.ID_REUNIAO, STATUS: statusEntrega, LINK_DOCUMENTO: evidencia.TRANSCRICAO_URL || evidencia.GRAVACAO_URL || evidencia.MEET_URL || '', CONCLUIDO_EM: statusEntrega === 'REALIZADA' ? evidencia.FIM : '' };
      }
    } else if (tipo === 'AUDITORIA' || tipo === 'PLANO') {
      const candidatas = auditorias.filter(item => {
        if (tipo === 'AUDITORIA') return String(item.TIPO_AUDITORIA).toUpperCase() === escopo;
        if (String(item.TIPO_AUDITORIA).toUpperCase() !== 'PLANO') return false;
        const interacao = interacoes.find(i => String(i.ID_INTERACAO) === String(item.ID_INTERACAO)) || {};
        return !interacao.FUNCAO || String(interacao.FUNCAO).toUpperCase() === escopo;
      });
      evidencia = candidatas[ordem] || null;
      if (evidencia) alteracoes = { ID_AUDITORIA: evidencia.ID_AUDITORIA, STATUS: evidencia.CIRCLE_POST_URL ? 'PUBLICADA' : 'ENTREGUE', LINK_DOCUMENTO: evidencia.LINK_DOCUMENTO || '', LINK_CIRCLE: evidencia.CIRCLE_POST_URL || '', PUBLICADO_EM: evidencia.CIRCLE_PUBLICADO_EM || '', CONCLUIDO_EM: evidencia.CONCLUIDO_EM || '' };
    } else if (tipo === 'FORMALIZACAO') {
      const candidatas = formalizacoes.filter(item => jornadaEscopoFormalizacao_(item, reunioes) === escopo);
      evidencia = candidatas[ordem] || null;
      if (evidencia) alteracoes = { ID_FORMALIZACAO: evidencia.ID_FORMALIZACAO, STATUS: evidencia.CIRCLE_POST_URL ? 'PUBLICADA' : 'ENTREGUE', LINK_CIRCLE: evidencia.CIRCLE_POST_URL || '', PUBLICADO_EM: evidencia.CIRCLE_PUBLICADO_EM || '', CONCLUIDO_EM: evidencia.APROVADO_EM || evidencia.ATUALIZADO_EM || '' };
    }
    if (alteracoes) {
      const completas = Object.assign(alteracoes, { ORIGEM: 'BOARD' });
      if (jornadaAplicarAlteracoesSeDiferentes_(entrega, completas)) {
        entrega.ATUALIZADO_EM = new Date();
        alteracoesEmLote[String(entrega.ID_ENTREGA)] = Object.assign({}, completas, { ATUALIZADO_EM: entrega.ATUALIZADO_EM });
      }
    } else if (new Date(entrega.DATA_LIMITE).getTime() < Date.now() && String(entrega.STATUS) === 'PREVISTA') {
      entrega.STATUS = 'ATRASADA';
      entrega.ATUALIZADO_EM = new Date();
      alteracoesEmLote[String(entrega.ID_ENTREGA)] = { STATUS: 'ATRASADA', ATUALIZADO_EM: entrega.ATUALIZADO_EM };
    }
  });
  if (Object.keys(alteracoesEmLote).length) {
    jornadaAtualizarLinhasEmLote_(APP.sheets.entregasMensais, 'ID_ENTREGA', alteracoesEmLote);
  }
}

function jornadaAplicarAlteracoesSeDiferentes_(destino, alteracoes) {
  let mudou = false;
  Object.keys(alteracoes || {}).forEach(chave => {
    const atual = destino[chave] instanceof Date ? destino[chave].getTime() : String(destino[chave] == null ? '' : destino[chave]);
    const novo = alteracoes[chave] instanceof Date ? alteracoes[chave].getTime() : String(alteracoes[chave] == null ? '' : alteracoes[chave]);
    if (atual !== novo) {
      destino[chave] = alteracoes[chave];
      mudou = true;
    }
  });
  return mudou;
}

function jornadaAtualizarLinhasEmLote_(nomeAba, campo, alteracoesPorId) {
  const aba = abrirPlanilha_().getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return 0;
  const dados = aba.getDataRange().getValues();
  const cabecalhos = dados[0];
  const indiceCampo = cabecalhos.indexOf(campo);
  if (indiceCampo < 0) throw new Error('Campo não encontrado: ' + campo);
  let alteradas = 0;
  for (let linha = 1; linha < dados.length; linha++) {
    const alteracoes = alteracoesPorId[String(dados[linha][indiceCampo])];
    if (!alteracoes) continue;
    Object.keys(alteracoes).forEach(chave => {
      const indice = cabecalhos.indexOf(chave);
      if (indice >= 0) dados[linha][indice] = alteracoes[chave];
    });
    alteradas++;
  }
  if (alteradas) aba.getRange(2, 1, dados.length - 1, cabecalhos.length).setValues(dados.slice(1));
  return alteradas;
}

function registrarEntregaExternaJornada(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  if (!localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente)) throw new Error('Selecione um cliente válido.');
  const periodo = jornadaNormalizarPeriodo_(dados.periodo);
  const tipo = String(dados.tipoEntrega || '').toUpperCase();
  const escopo = String(dados.escopo || '').toUpperCase();
  const linkDocumento = String(dados.linkDocumento || '').trim();
  if (!tipo || !escopo || !linkDocumento) throw new Error('Informe tipo, escopo e link do documento externo.');
  const agora = new Date();
  adicionarObjeto_(APP.sheets.entregasMensais, {
    ID_ENTREGA: gerarId_('ENT'), ID_CLIENTE: idCliente, PERIODO: periodo, ID_REGRA: '',
    TIPO_ENTREGA: tipo, ESCOPO: escopo, NOME: String(dados.nome || 'Entrega externa'),
    ORDEM_MES: 1, DATA_LIMITE: String(dados.data || Utilities.formatDate(agora, APP.timezone, 'yyyy-MM-dd')),
    STATUS: String(dados.linkCircle || '').trim() ? 'PUBLICADA' : 'ENTREGUE', ORIGEM: 'MANUAL',
    ID_REUNIAO: '', ID_AUDITORIA: '', ID_FORMALIZACAO: '', LINK_DOCUMENTO: linkDocumento,
    LINK_CIRCLE: String(dados.linkCircle || '').trim(), PUBLICADO_EM: dados.linkCircle ? agora : '',
    RESPONSAVEL: String(dados.responsavel || jornadaEmailExecucao_()), OBSERVACOES: String(dados.observacoes || ''),
    CONCLUIDO_EM: agora, CRIADO_EM: agora, ATUALIZADO_EM: agora
  });
  return carregarAreaCliente({ idCliente: idCliente, periodo: periodo });
}

function registrarLinkCircleEntregaJornada(dados) {
  dados = dados || {};
  const id = String(dados.idEntrega || '').trim();
  const url = String(dados.linkCircle || '').trim();
  if (!id || !/^https?:\/\//i.test(url)) throw new Error('Cole a URL completa do post publicado.');
  const entrega = localizarObjeto_(APP.sheets.entregasMensais, 'ID_ENTREGA', id);
  if (!entrega) throw new Error('Entrega não encontrada.');
  atualizarPorCampo_(APP.sheets.entregasMensais, 'ID_ENTREGA', id, { LINK_CIRCLE: url, STATUS: 'PUBLICADA', PUBLICADO_EM: new Date(), ATUALIZADO_EM: new Date() });
  return carregarAreaCliente({ idCliente: entrega.ID_CLIENTE, periodo: entrega.PERIODO });
}

function salvarRegistroDiarioCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Outro registro está sendo salvo. Aguarde alguns segundos.');
  try {
  const idCliente = String(dados.idCliente || '').trim();
  if (!localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente)) throw new Error('Cliente não encontrado.');
  const titulo = String(dados.titulo || '').trim();
  const descricao = String(dados.descricao || '').trim();
  if (!titulo || !descricao) throw new Error('Informe o título e o registro operacional.');
  const agora = new Date();
  const idRegistro = String(dados.idRegistro || '').trim();
  if (idRegistro) {
    const existente = localizarObjeto_(APP.sheets.diarioClientes, 'ID_REGISTRO', idRegistro);
    if (!existente || String(existente.ID_CLIENTE) !== idCliente) throw new Error('Registro não encontrado para este cliente.');
    atualizarPorCampo_(APP.sheets.diarioClientes, 'ID_REGISTRO', idRegistro, {
      TITULO: titulo, DESCRICAO: descricao, CATEGORIA: String(dados.categoria || 'INSIGHT').toUpperCase(),
      ESCOPO: String(dados.escopo || 'GERAL').toUpperCase(), LEVAR_PROXIMA_REUNIAO: dados.levarProximaReuniao ? 'SIM' : 'NAO',
      ATUALIZADO_EM: agora
    });
    return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
  }
  const idRequisicao = String(dados.idRequisicao || '').trim();
  const registros = lerObjetos_(APP.sheets.diarioClientes);
  const repetido = registros.find(function(item) {
    if (String(item.ID_CLIENTE) !== idCliente || String(item.STATUS || 'ATIVO').toUpperCase() === 'ARQUIVADO') return false;
    if (idRequisicao && String(item.ID_ORIGEM || '') === idRequisicao) return true;
    const criadoEm = new Date(item.CRIADO_EM || item.DATA_HORA || 0).getTime();
    return Date.now() - criadoEm < 120000 &&
      normalizarTextoComparacao_(item.TITULO) === normalizarTextoComparacao_(titulo) &&
      normalizarTextoComparacao_(item.DESCRICAO) === normalizarTextoComparacao_(descricao) &&
      String(item.ESCOPO || 'GERAL').toUpperCase() === String(dados.escopo || 'GERAL').toUpperCase();
  });
  if (repetido) return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
  adicionarObjeto_(APP.sheets.diarioClientes, {
    ID_REGISTRO: gerarId_('DIA'), ID_CLIENTE: idCliente, DATA_HORA: dados.dataHora ? new Date(dados.dataHora) : agora,
    TITULO: titulo, DESCRICAO: descricao, CATEGORIA: String(dados.categoria || 'INSIGHT').toUpperCase(),
    ESCOPO: String(dados.escopo || 'GERAL').toUpperCase(), ORIGEM: String(dados.origem || 'MANUAL').toUpperCase(),
    ID_ORIGEM: idRequisicao || String(dados.idOrigem || ''), LINK_REFERENCIA: String(dados.linkReferencia || ''),
    AUTOR: String(dados.autor || jornadaEmailExecucao_()), LEVAR_PROXIMA_REUNIAO: dados.levarProximaReuniao ? 'SIM' : 'NAO',
    STATUS: 'ATIVO', CRIADO_EM: agora, ATUALIZADO_EM: agora
  });
  return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
  } finally {
    lock.releaseLock();
  }
}

function excluirRegistroDiarioCliente(dados) {
  dados = dados || {};
  const item = localizarObjeto_(APP.sheets.diarioClientes, 'ID_REGISTRO', String(dados.idRegistro || ''));
  if (!item) throw new Error('Registro não encontrado.');
  atualizarPorCampo_(APP.sheets.diarioClientes, 'ID_REGISTRO', item.ID_REGISTRO, { STATUS: 'ARQUIVADO', ATUALIZADO_EM: new Date() });
  return carregarAreaCliente({ idCliente: item.ID_CLIENTE, periodo: dados.periodo });
}

function salvarOtimizacaoCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Outra otimização está sendo salva. Aguarde alguns segundos.');
  try {
  const idCliente = String(dados.idCliente || '').trim();
  const titulo = String(dados.titulo || '').trim();
  if (!localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente) || !titulo) throw new Error('Informe o cliente e o título da otimização.');
  const agora = new Date();
  const idOtimizacao = String(dados.idOtimizacao || '').trim();
  if (idOtimizacao) {
    const existente = localizarObjeto_(APP.sheets.otimizacoesClientes, 'ID_OTIMIZACAO', idOtimizacao);
    if (!existente || String(existente.ID_CLIENTE) !== idCliente) throw new Error('Otimização não encontrada para este cliente.');
    atualizarPorCampo_(APP.sheets.otimizacoesClientes, 'ID_OTIMIZACAO', idOtimizacao, {
      ESCOPO: String(dados.escopo || 'GERAL').toUpperCase(), TITULO: titulo,
      PROBLEMA: String(dados.problema || ''), ACAO: String(dados.acao || ''), COMO_EXECUTAR: String(dados.comoExecutar || ''),
      RESPONSAVEL: String(dados.responsavel || ''), PRIORIDADE: String(dados.prioridade || 'MEDIA').toUpperCase(),
      DATA_REVISAO: dados.dataRevisao || '', ATUALIZADO_EM: agora
    });
    return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
  }
  const idRequisicao = String(dados.idRequisicao || '').trim();
  const otimizacoes = lerObjetos_(APP.sheets.otimizacoesClientes);
  const repetida = otimizacoes.find(function(item) {
    if (String(item.ID_CLIENTE) !== idCliente || String(item.STATUS || '').toUpperCase() === 'ARQUIVADA') return false;
    if (idRequisicao && String(item.ID_ORIGEM || '') === idRequisicao) return true;
    const criadoEm = new Date(item.CRIADO_EM || 0).getTime();
    return Date.now() - criadoEm < 120000 &&
      normalizarTextoComparacao_(item.TITULO) === normalizarTextoComparacao_(titulo) &&
      normalizarTextoComparacao_(item.PROBLEMA) === normalizarTextoComparacao_(dados.problema || '');
  });
  if (repetida) return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
  adicionarObjeto_(APP.sheets.otimizacoesClientes, {
    ID_OTIMIZACAO: gerarId_('OTI'), ID_CLIENTE: idCliente, ESCOPO: String(dados.escopo || 'GERAL').toUpperCase(),
    TITULO: titulo, PROBLEMA: String(dados.problema || ''), EVIDENCIA: String(dados.evidencia || ''),
    HIPOTESE: String(dados.hipotese || ''), ACAO: String(dados.acao || ''), COMO_EXECUTAR: String(dados.comoExecutar || ''),
    RESPONSAVEL: String(dados.responsavel || ''), PRIORIDADE: String(dados.prioridade || 'MEDIA').toUpperCase(),
    INDICADOR: String(dados.indicador || ''), LINHA_BASE: String(dados.linhaBase || ''),
    RESULTADO_ESPERADO: String(dados.resultadoEsperado || ''), DATA_INICIO: dados.dataInicio || '',
    DATA_REVISAO: dados.dataRevisao || '', PRAZO: dados.prazo || '', STATUS: String(dados.status || 'SUGESTAO').toUpperCase(),
    RESULTADO_OBSERVADO: '', DECISAO: '', ID_REGISTRO_DIARIO: String(dados.idRegistroDiario || ''),
    ID_ORIGEM: idRequisicao || String(dados.idOrigem || ''), CRIADO_EM: agora, ATUALIZADO_EM: agora
  });
  return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
  } finally {
    lock.releaseLock();
  }
}

function excluirOtimizacaoCliente(dados) {
  dados = dados || {};
  const item = localizarObjeto_(APP.sheets.otimizacoesClientes, 'ID_OTIMIZACAO', String(dados.idOtimizacao || ''));
  if (!item) throw new Error('Otimização não encontrada.');
  atualizarPorCampo_(APP.sheets.otimizacoesClientes, 'ID_OTIMIZACAO', item.ID_OTIMIZACAO, { STATUS: 'ARQUIVADA', ATUALIZADO_EM: new Date() });
  return carregarAreaCliente({ idCliente: item.ID_CLIENTE, periodo: dados.periodo });
}

function atualizarStatusOtimizacaoCliente(dados) {
  dados = dados || {};
  const item = localizarObjeto_(APP.sheets.otimizacoesClientes, 'ID_OTIMIZACAO', String(dados.idOtimizacao || ''));
  if (!item) throw new Error('Otimização não encontrada.');
  atualizarPorCampo_(APP.sheets.otimizacoesClientes, 'ID_OTIMIZACAO', item.ID_OTIMIZACAO, {
    STATUS: String(dados.status || item.STATUS).toUpperCase(),
    RESULTADO_OBSERVADO: String(dados.resultadoObservado || item.RESULTADO_OBSERVADO || ''),
    DECISAO: String(dados.decisao || item.DECISAO || ''), ATUALIZADO_EM: new Date()
  });
  return carregarAreaCliente({ idCliente: item.ID_CLIENTE, periodo: dados.periodo });
}

function salvarMembroEquipeCliente(dados) {
  jornadaGarantirEstrutura_();
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const nome = String(dados.nome || '').trim();
  const papel = String(dados.papel || '').trim().toUpperCase();
  const papeis = ['SDR', 'CLOSER', 'GESTOR', 'SALES_OPS', 'CRO_OPS', 'OUTRO'];
  if (!localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente)) throw new Error('Selecione um cliente válido.');
  if (!nome) throw new Error('Informe o nome do profissional.');
  if (papeis.indexOf(papel) < 0) throw new Error('Selecione uma função válida para o profissional.');
  const email = String(dados.email || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido ou deixe o campo vazio.');
  const agora = new Date();
  const existentes = lerObjetos_(APP.sheets.equipeClientes);
  const idInformado = String(dados.idMembro || '').trim();
  const existente = idInformado ? existentes.find(item => String(item.ID_MEMBRO) === idInformado && String(item.ID_CLIENTE) === idCliente) : null;
  const duplicado = existentes.find(item =>
    String(item.ID_CLIENTE) === idCliente && String(item.ID_MEMBRO) !== idInformado &&
    jornadaNormalizar_(item.NOME) === jornadaNormalizar_(nome) &&
    String(item.PAPEL).toUpperCase() === papel && String(item.ATIVO || 'SIM').toUpperCase() !== 'NAO'
  );
  if (duplicado) throw new Error('Este profissional já está cadastrado nesta função.');
  const liderId = String(dados.liderId || '').trim();
  if (liderId && !existentes.some(item => String(item.ID_MEMBRO) === liderId && String(item.ID_CLIENTE) === idCliente)) {
    throw new Error('O líder selecionado não pertence à equipe deste cliente.');
  }
  const objeto = {
    ID_MEMBRO: existente ? existente.ID_MEMBRO : gerarId_('MEM'),
    ID_CLIENTE: idCliente,
    NOME: nome,
    PAPEL: papel,
    EMAIL: email,
    TELEFONE: String(dados.telefone || '').trim(),
    LIDER_ID: liderId,
    ATIVO: dados.ativo === false ? 'NAO' : 'SIM',
    DATA_INICIO: dados.dataInicio || (existente ? existente.DATA_INICIO : Utilities.formatDate(agora, APP.timezone, 'yyyy-MM-dd')),
    DATA_FIM: dados.ativo === false ? (dados.dataFim || Utilities.formatDate(agora, APP.timezone, 'yyyy-MM-dd')) : '',
    OBSERVACOES: String(dados.observacoes || '').trim(),
    CRIADO_EM: existente ? existente.CRIADO_EM : agora,
    ATUALIZADO_EM: agora
  };
  if (existente) atualizarPorCampo_(APP.sheets.equipeClientes, 'ID_MEMBRO', objeto.ID_MEMBRO, objeto);
  else adicionarObjeto_(APP.sheets.equipeClientes, objeto);
  limparCachesDados_();
  return carregarAreaCliente({ idCliente: idCliente, periodo: dados.periodo });
}

function alterarStatusMembroEquipeCliente(dados) {
  dados = dados || {};
  const idMembro = String(dados.idMembro || '').trim();
  const membro = localizarObjeto_(APP.sheets.equipeClientes, 'ID_MEMBRO', idMembro);
  if (!membro) throw new Error('Profissional não encontrado.');
  const ativo = dados.ativo !== false;
  atualizarPorCampo_(APP.sheets.equipeClientes, 'ID_MEMBRO', idMembro, {
    ATIVO: ativo ? 'SIM' : 'NAO',
    DATA_FIM: ativo ? '' : Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd'),
    ATUALIZADO_EM: new Date()
  });
  return carregarAreaCliente({ idCliente: membro.ID_CLIENTE, periodo: dados.periodo });
}

function jornadaListarEquipe_(idCliente, itensInformados) {
  const todos = (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.equipeClientes))
    .filter(item => String(item.ID_CLIENTE) === String(idCliente));
  const nomes = {};
  todos.forEach(item => { nomes[String(item.ID_MEMBRO)] = item.NOME || ''; });
  return todos.map(item => ({
    idMembro: item.ID_MEMBRO,
    nome: item.NOME,
    papel: String(item.PAPEL || 'OUTRO').toUpperCase(),
    email: item.EMAIL || '',
    telefone: item.TELEFONE || '',
    liderId: item.LIDER_ID || '',
    liderNome: nomes[String(item.LIDER_ID || '')] || '',
    ativo: String(item.ATIVO || 'SIM').toUpperCase() !== 'NAO',
    dataInicio: typeof serializarDataSomenteDia_ === 'function' ? serializarDataSomenteDia_(item.DATA_INICIO) : serializarData_(item.DATA_INICIO),
    dataFim: typeof serializarDataSomenteDia_ === 'function' ? serializarDataSomenteDia_(item.DATA_FIM) : serializarData_(item.DATA_FIM),
    observacoes: item.OBSERVACOES || ''
  })).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.papel.localeCompare(b.papel) || a.nome.localeCompare(b.nome));
}

function jornadaListarHistoricoOperacional_(idCliente, contexto) {
  contexto = contexto || {};
  const itens = [];
  (Array.isArray(contexto.auditorias) ? contexto.auditorias : lerObjetos_(APP.sheets.auditorias)).filter(item => String(item.ID_CLIENTE) === String(idCliente)).forEach(item => {
    const score = item.SCORE === '' || item.SCORE === null || item.SCORE === undefined ? null : Number(item.SCORE);
    itens.push({
      id: item.ID_AUDITORIA,
      tipo: 'AUDITORIA',
      escopo: String(item.TIPO_AUDITORIA || '').toUpperCase(),
      titulo: 'Auditoria ' + String(item.TIPO_AUDITORIA || ''),
      data: serializarData_(item.CONCLUIDO_EM || item.SOLICITADO_EM),
      status: item.STATUS || '',
      detalhe: isFinite(score) && score !== null ? 'Nota ' + score + '/5' : '',
      score: isFinite(score) ? score : null,
      link: item.LINK_DOCUMENTO || ''
    });
  });
  (Array.isArray(contexto.formalizacoes) ? contexto.formalizacoes : lerObjetos_(APP.sheets.formalizacoes)).filter(item => String(item.ID_CLIENTE) === String(idCliente)).forEach(item => itens.push({
    id: item.ID_FORMALIZACAO, tipo: 'FORMALIZACAO', escopo: jornadaEscopoFormalizacao_(item, []),
    titulo: item.TITULO || 'Formalização de reunião', data: serializarData_(item.DATA_REUNIAO || item.SOLICITADO_EM),
    status: item.STATUS || '', detalhe: item.TIPO_REUNIAO || '', score: null, link: item.CIRCLE_POST_URL || ''
  }));
  (Array.isArray(contexto.diario) ? contexto.diario : lerObjetos_(APP.sheets.diarioClientes)).filter(item => String(item.ID_CLIENTE) === String(idCliente)).forEach(item => itens.push({
    id: item.ID_REGISTRO, tipo: 'DIARIO', escopo: item.ESCOPO || 'GERAL', titulo: item.TITULO || 'Registro operacional',
    data: serializarData_(item.DATA_HORA), status: item.CATEGORIA || '', detalhe: item.DESCRICAO || '', score: null, link: item.LINK_REFERENCIA || ''
  }));
  (Array.isArray(contexto.otimizacoes) ? contexto.otimizacoes : lerObjetos_(APP.sheets.otimizacoesClientes)).filter(item => String(item.ID_CLIENTE) === String(idCliente)).forEach(item => itens.push({
    id: item.ID_OTIMIZACAO, tipo: 'OTIMIZACAO', escopo: item.ESCOPO || 'GERAL', titulo: item.TITULO || 'Otimização',
    data: serializarData_(item.ATUALIZADO_EM || item.CRIADO_EM), status: item.STATUS || '', detalhe: item.RESULTADO_OBSERVADO || item.ACAO || '', score: null, link: ''
  }));
  return itens.filter(item => item.data).sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 120);
}

function jornadaListarIdentificadores_(idCliente, itensInformados) {
  return (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.identificadoresClientes)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && String(item.ATIVO || 'SIM').toUpperCase() !== 'NAO').map(item => ({
    id: item.ID_IDENTIFICADOR, tipo: item.TIPO, valor: item.VALOR, origem: item.ORIGEM, prioridade: Number(item.PRIORIDADE || 0)
  }));
}

function jornadaListarReunioes_(idCliente, periodo, itensInformados) {
  return (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.reunioesCalendario)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.INICIO) === periodo).sort((a, b) => new Date(b.INICIO) - new Date(a.INICIO)).map(item => ({
    idReuniao: item.ID_REUNIAO, titulo: item.TITULO, tipoReuniao: item.TIPO_REUNIAO, inicio: serializarData_(item.INICIO), fim: serializarData_(item.FIM),
    organizador: item.ORGANIZADOR, participantes: typeof formalParticipantes_ === 'function' ? formalParticipantes_(item.PARTICIPANTES_JSON) : jornadaJsonLista_(item.PARTICIPANTES_JSON), meetUrl: item.MEET_URL, status: item.STATUS,
    confianca: Number(item.CONFIANCA_CLIENTE || 0), motivo: item.MOTIVO_IDENTIFICACAO, gravacaoUrl: item.GRAVACAO_URL,
    transcricaoUrl: item.TRANSCRICAO_URL, idInteracao: item.ID_INTERACAO, idTranscricao: item.ID_TRANSCRICAO, erroMeet: item.ERRO_MEET
  }));
}

function jornadaListarEntregas_(idCliente, periodo, itensInformados, reunioesInformadas, formalizacoesInformadas, auditoriasInformadas) {
  const reunioes = (Array.isArray(reunioesInformadas) ? reunioesInformadas : lerObjetos_(APP.sheets.reunioesCalendario))
    .filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.INICIO) === periodo)
    .sort((a, b) => new Date(a.INICIO) - new Date(b.INICIO));
  const formalizacoesTodas = (Array.isArray(formalizacoesInformadas) ? formalizacoesInformadas : lerObjetos_(APP.sheets.formalizacoes))
    .filter(item => jornadaPeriodoData_(item.DATA_REUNIAO || item.SOLICITADO_EM) === periodo);
  const formalizacoes = formalizacoesTodas.filter(item => String(item.ID_CLIENTE) === String(idCliente));
  const auditorias = (Array.isArray(auditoriasInformadas) ? auditoriasInformadas : lerObjetos_(APP.sheets.auditorias))
    .filter(item => {
      const status = String(item.STATUS || '').toUpperCase();
      const temResultado = Boolean(String(item.RESULTADO_JSON || '').trim());
      return String(item.ID_CLIENTE) === String(idCliente)
        && jornadaPeriodoData_(item.CONCLUIDO_EM || item.SOLICITADO_EM) === periodo
        && ['EM_REVISAO', 'APROVADA'].includes(status)
        && temResultado;
    })
    .sort((a, b) => new Date(a.CONCLUIDO_EM || a.SOLICITADO_EM) - new Date(b.CONCLUIDO_EM || b.SOLICITADO_EM));
  return (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.entregasMensais))
    .filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.PERIODO) === periodo)
    .sort((a, b) => new Date(a.DATA_LIMITE) - new Date(b.DATA_LIMITE))
    .map(item => {
      const tipo = String(item.TIPO_ENTREGA || '').toUpperCase();
      const escopo = String(item.ESCOPO || '').toUpperCase();
      const tipoReuniao = escopo === 'GESTAO' ? 'EXECUTIVA' : 'OPERACIONAL_' + escopo;
      const reuniao = reunioes.find(registro => String(registro.ID_REUNIAO || '') === String(item.ID_REUNIAO || ''))
        || ((tipo === 'REUNIAO' || tipo === 'FORMALIZACAO') ? reunioes.find(registro => String(registro.TIPO_REUNIAO || '') === tipoReuniao) : null);
      const formalizacao = formalizacoesTodas.find(registro => item.ID_FORMALIZACAO && String(registro.ID_FORMALIZACAO || '') === String(item.ID_FORMALIZACAO))
        || (reuniao ? formalizacoesTodas.find(registro =>
          (reuniao.ID_TRANSCRICAO && String(registro.ID_TRANSCRICAO || '') === String(reuniao.ID_TRANSCRICAO)) ||
          (reuniao.ID_INTERACAO && String(registro.ID_INTERACAO || '') === String(reuniao.ID_INTERACAO))
        ) : null)
        || (tipo === 'FORMALIZACAO' ? formalizacoes.find(registro => jornadaEscopoFormalizacao_(registro, reunioes) === escopo) : null);
      const auditoriasCompativeis = auditorias.filter(registro => {
        const tipoAuditoria = String(registro.TIPO_AUDITORIA || '').toUpperCase();
        return tipo === 'AUDITORIA' ? tipoAuditoria === escopo : (tipo === 'PLANO' ? tipoAuditoria === 'PLANO' : false);
      });
      const ordemAuditoria = Math.max(1, Number(item.ORDEM_MES || 1));
      const auditoria = auditorias.find(registro => item.ID_AUDITORIA && String(registro.ID_AUDITORIA || '') === String(item.ID_AUDITORIA))
        || auditoriasCompativeis[ordemAuditoria - 1]
        || null;
      const temGravacao = Boolean(reuniao && String(reuniao.GRAVACAO_URL || '').trim());
      const temTranscricao = Boolean(reuniao && String(reuniao.TRANSCRICAO_URL || reuniao.ID_TRANSCRICAO || '').trim());
      const comunidadeUrl = String(
        (auditoria && auditoria.COMUNIDADE_POST_URL) ||
        (formalizacao && formalizacao.COMUNIDADE_POST_URL) ||
        ''
      ).trim();
      const comunidadeStatus = String(
        (auditoria && auditoria.COMUNIDADE_STATUS) ||
        (formalizacao && formalizacao.COMUNIDADE_STATUS) ||
        (comunidadeUrl ? 'PUBLICADA' : '')
      ).toUpperCase();
      const auditoriaCircleUrl = String(auditoria && auditoria.CIRCLE_POST_URL || '').trim();
      const auditoriaComunidadeUrl = String(auditoria && auditoria.COMUNIDADE_POST_URL || '').trim();
      const formalizacaoCircleUrl = String(formalizacao && formalizacao.CIRCLE_POST_URL || '').trim();
      const formalizacaoComunidadeUrl = String(formalizacao && formalizacao.COMUNIDADE_POST_URL || '').trim();
      const circleUrl = String(item.LINK_CIRCLE || auditoriaCircleUrl || formalizacaoCircleUrl || '').trim();
      const circleStatus = String(
        (auditoria && auditoria.CIRCLE_STATUS) ||
        (formalizacao && formalizacao.CIRCLE_STATUS) ||
        (circleUrl ? 'PUBLICADA' : '')
      ).toUpperCase();
      const circlePublicado = Boolean(circleUrl) || ['PUBLICADA', 'PUBLICADA_MANUALMENTE', 'SUCESSO', 'POSTADA'].includes(circleStatus);
      const comunidadePublicado = Boolean(auditoriaComunidadeUrl || formalizacaoComunidadeUrl) || ['PUBLICADA', 'SUCESSO', 'POSTADA'].includes(comunidadeStatus);
      const formalizacaoPreAprovada = Boolean(formalizacao) && String(formalizacao.STATUS || '').toUpperCase() === 'APROVADA' && !Boolean(formalizacaoCircleUrl) && !['PUBLICADA', 'PUBLICADA_MANUALMENTE', 'SUCESSO', 'POSTADA'].includes(String(formalizacao.CIRCLE_STATUS || '').toUpperCase());
      return {
        idEntrega: item.ID_ENTREGA, tipoEntrega: item.TIPO_ENTREGA, escopo: item.ESCOPO, nome: item.NOME, dataLimite: serializarData_(item.DATA_LIMITE),
        status: item.STATUS, origem: item.ORIGEM, idReuniao: item.ID_REUNIAO || (reuniao && reuniao.ID_REUNIAO) || '', idAuditoria: item.ID_AUDITORIA || (auditoria && auditoria.ID_AUDITORIA) || '',
        idFormalizacao: item.ID_FORMALIZACAO || (formalizacao && formalizacao.ID_FORMALIZACAO) || '', linkDocumento: item.LINK_DOCUMENTO,
        linkCircle: item.LINK_CIRCLE || (formalizacao && formalizacao.CIRCLE_POST_URL) || '', publicadoEm: serializarData_(item.PUBLICADO_EM),
        responsavel: item.RESPONSAVEL, observacoes: item.OBSERVACOES,
        idTranscricao: reuniao ? reuniao.ID_TRANSCRICAO || '' : '', reuniaoConfirmada: temGravacao && temTranscricao,
        gravacaoEncontrada: temGravacao, transcricaoEncontrada: temTranscricao,
        formalizacaoEncontrada: Boolean(formalizacao), statusFormalizacao: formalizacao ? formalizacao.STATUS || '' : '',
        formalizacaoCircleUrl: formalizacaoCircleUrl,
        formalizacaoComunidadeUrl: formalizacaoComunidadeUrl,
        formalizacaoPreAprovada: formalizacaoPreAprovada,
        proximoPassoFormalizacao: formalizacaoPreAprovada ? 'Formalizar no Circle' : '',
        auditoriaEncontrada: Boolean(auditoria), statusAuditoria: auditoria ? auditoria.STATUS || '' : '',
        auditoriaLinkDocumento: auditoria ? auditoria.LINK_DOCUMENTO || '' : '',
        auditoriaCircleUrl: auditoriaCircleUrl,
        auditoriaComunidadeUrl: auditoriaComunidadeUrl,
        circleUrl: circleUrl, circleStatus: circleStatus, circlePublicado: circlePublicado,
        publicacaoComunidadeUrl: comunidadeUrl, publicacaoComunidadeStatus: comunidadeStatus,
        publicacaoComunidadeFeita: comunidadePublicado
      };
    });
}

function jornadaListarDiario_(idCliente, itensInformados) {
  return (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.diarioClientes)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && String(item.STATUS || 'ATIVO').toUpperCase() !== 'ARQUIVADO').sort((a, b) => new Date(b.DATA_HORA) - new Date(a.DATA_HORA)).slice(0, 100).map(item => ({
    idRegistro: item.ID_REGISTRO, dataHora: serializarData_(item.DATA_HORA), titulo: item.TITULO, descricao: item.DESCRICAO,
    categoria: item.CATEGORIA, escopo: item.ESCOPO, origem: item.ORIGEM, linkReferencia: item.LINK_REFERENCIA,
    autor: item.AUTOR, levarProximaReuniao: String(item.LEVAR_PROXIMA_REUNIAO).toUpperCase() === 'SIM'
  }));
}

function jornadaListarOtimizacoes_(idCliente, itensInformados) {
  return (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.otimizacoesClientes)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && String(item.STATUS || '').toUpperCase() !== 'ARQUIVADA').sort((a, b) => new Date(b.ATUALIZADO_EM || b.CRIADO_EM) - new Date(a.ATUALIZADO_EM || a.CRIADO_EM)).map(item => ({
    idOtimizacao: item.ID_OTIMIZACAO, escopo: item.ESCOPO, titulo: item.TITULO, problema: item.PROBLEMA,
    evidencia: item.EVIDENCIA, hipotese: item.HIPOTESE, acao: item.ACAO, comoExecutar: item.COMO_EXECUTAR,
    responsavel: item.RESPONSAVEL, prioridade: item.PRIORIDADE, indicador: item.INDICADOR, linhaBase: item.LINHA_BASE,
    resultadoEsperado: item.RESULTADO_ESPERADO, dataRevisao: serializarData_(item.DATA_REVISAO), prazo: serializarData_(item.PRAZO),
    status: item.STATUS, resultadoObservado: item.RESULTADO_OBSERVADO, decisao: item.DECISAO
  }));
}

function jornadaListarAuditorias_(idCliente, periodo, itensInformados) {
  return (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.auditorias)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.CONCLUIDO_EM || item.SOLICITADO_EM) === periodo).map(item => ({
    idAuditoria: item.ID_AUDITORIA, tipo: item.TIPO_AUDITORIA, status: item.STATUS, score: item.SCORE,
    data: serializarData_(item.CONCLUIDO_EM || item.SOLICITADO_EM), linkDocumento: item.LINK_DOCUMENTO, linkCircle: item.CIRCLE_POST_URL
  }));
}

function jornadaListarFormalizacoes_(idCliente, periodo, itensInformados) {
  return (Array.isArray(itensInformados) ? itensInformados : lerObjetos_(APP.sheets.formalizacoes)).filter(item => String(item.ID_CLIENTE) === String(idCliente) && jornadaPeriodoData_(item.DATA_REUNIAO || item.SOLICITADO_EM) === periodo).map(item => ({
    idFormalizacao: item.ID_FORMALIZACAO, titulo: item.TITULO, tipoReuniao: item.TIPO_REUNIAO, status: item.STATUS,
    data: serializarData_(item.DATA_REUNIAO || item.SOLICITADO_EM), linkCircle: item.CIRCLE_POST_URL
  }));
}

function jornadaResumo_(entregas, reunioes, otimizacoes, historico, equipe) {
  const concluidos = entregas.filter(item => ['ENTREGUE', 'PUBLICADA', 'REALIZADA'].includes(String(item.status).toUpperCase())).length;
  const atrasados = entregas.filter(item => String(item.status).toUpperCase() === 'ATRASADA').length;
  const pendentes = Math.max(0, entregas.length - concluidos);
  const abertas = otimizacoes.filter(item => !['VALIDADA', 'CANCELADA', 'NAO_FUNCIONOU'].includes(String(item.status).toUpperCase())).length;
  const validadas = otimizacoes.filter(item => String(item.status).toUpperCase() === 'VALIDADA').length;
  const ativos = (equipe || []).filter(item => item.ativo);
  const contagem = papel => ativos.filter(item => item.papel === papel).length;
  const notas = (historico || []).filter(item => item.tipo === 'AUDITORIA' && item.score !== null && isFinite(Number(item.score))).map(item => Number(item.score));
  const notaAtual = notas.length ? notas[0] : null;
  const notaAnterior = notas.length > 1 ? notas[1] : null;
  return {
    totalEntregas: entregas.length,
    concluidas: concluidos,
    pendentes: pendentes,
    atrasadas: atrasados,
    percentual: entregas.length ? Math.round(concluidos / entregas.length * 100) : 0,
    reunioes: reunioes.length,
    otimizacoesAbertas: abertas,
    otimizacoesValidadas: validadas,
    totalEquipe: ativos.length,
    sdrs: contagem('SDR'),
    closers: contagem('CLOSER'),
    gestores: contagem('GESTOR'),
    salesOps: contagem('SALES_OPS') + contagem('CRO_OPS'),
    notaAuditoriaAtual: notaAtual,
    evolucaoNota: notaAtual !== null && notaAnterior !== null ? Math.round((notaAtual - notaAnterior) * 10) / 10 : null
  };
}

function jornadaEscopoFormalizacao_(formalizacao, reunioes) {
  if (String(formalizacao.TIPO_REUNIAO).toUpperCase() === 'EXECUTIVA') return 'GESTAO';
  const reuniao = reunioes.find(item => String(item.ID_INTERACAO || '') === String(formalizacao.ID_INTERACAO || ''));
  if (reuniao && String(reuniao.TIPO_REUNIAO).includes('CLOSER')) return 'CLOSER';
  if (reuniao && String(reuniao.TIPO_REUNIAO).includes('SDR')) return 'SDR';
  const titulo = jornadaNormalizar_(formalizacao.TITULO || '');
  return titulo.includes('closer') ? 'CLOSER' : (titulo.includes('sdr') ? 'SDR' : 'GESTAO');
}

function jornadaNormalizarPeriodo_(periodo) {
  if (periodo instanceof Date && !isNaN(periodo.getTime())) {
    return Utilities.formatDate(periodo, APP.timezone, 'yyyy-MM');
  }
  const texto = String(periodo || '').trim();
  if (/^\d{4}-\d{2}$/.test(texto)) return texto;
  const data = new Date(periodo);
  if (!isNaN(data.getTime())) return Utilities.formatDate(data, APP.timezone, 'yyyy-MM');
  return Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM');
}

function jornadaIntervalo_(periodo, inicioInformado, fimInformado) {
  if (inicioInformado && fimInformado) return { inicio: new Date(inicioInformado), fim: new Date(fimInformado) };
  const partes = periodo.split('-').map(Number);
  return { inicio: new Date(partes[0], partes[1] - 1, 1), fim: new Date(partes[0], partes[1], 1) };
}

function jornadaDataLimite_(periodo, dia) {
  const partes = periodo.split('-').map(Number);
  const ultimo = new Date(partes[0], partes[1], 0).getDate();
  return new Date(partes[0], partes[1] - 1, Math.min(Math.max(1, Number(dia || ultimo)), ultimo), 18, 0, 0);
}

function jornadaPeriodoData_(valor) {
  if (!valor) return '';
  const data = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(data.getTime())) return String(valor).slice(0, 7);
  return Utilities.formatDate(data, APP.timezone, 'yyyy-MM');
}

function jornadaClassificarTipoReuniao_(titulo) {
  const texto = jornadaNormalizar_(titulo);
  if (/executiv|diretoria|comite|resultado mensal/.test(texto)) return 'EXECUTIVA';
  if (/closer|fechamento|vendas/.test(texto)) return 'OPERACIONAL_CLOSER';
  if (/sdr|pre vendas|prospecc|qualificacao/.test(texto)) return 'OPERACIONAL_SDR';
  return 'OUTRA';
}

function jornadaMeetUrlEvento_(evento, calendarId) {
  try { if (typeof evento.getHangoutLink === 'function' && evento.getHangoutLink()) return evento.getHangoutLink(); } catch (e) {}
  const texto = [evento.getDescription(), evento.getLocation()].join(' ');
  const achou = String(texto || '').match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
  if (achou) return achou[0];
  try {
    const uid = String(evento.getId() || '').trim();
    if (!uid) return '';
    const resposta = jornadaCalendarGet_('/calendar/v3/calendars/' + encodeURIComponent(calendarId || 'primary') + '/events', {
      iCalUID: uid,
      singleEvents: 'true',
      maxResults: 5
    });
    const item = (resposta.items || [])[0] || {};
    if (item.hangoutLink) return String(item.hangoutLink);
    const pontos = (((item.conferenceData || {}).entryPoints) || []);
    const video = pontos.find(ponto => String(ponto.entryPointType).toLowerCase() === 'video' && ponto.uri);
    return video ? String(video.uri) : '';
  } catch (e) {
    return '';
  }
}

function jornadaCalendarGet_(caminho, parametros) {
  const query = Object.keys(parametros || {}).map(chave => encodeURIComponent(chave) + '=' + encodeURIComponent(parametros[chave])).join('&');
  const resposta = UrlFetchApp.fetch('https://www.googleapis.com' + caminho + (query ? '?' + query : ''), {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() >= 200 && resposta.getResponseCode() < 300) return JSON.parse(resposta.getContentText() || '{}');
  throw new Error('Google Calendar API ' + resposta.getResponseCode());
}

function jornadaMeetingCode_(url) {
  const achou = String(url || '').match(/meet\.google\.com\/([a-z0-9-]+)/i);
  return achou ? achou[1].toLowerCase() : '';
}

function jornadaEmailsEvento_(evento) {
  const lista = [];
  try { evento.getGuestList(true).forEach(item => { if (item.getEmail()) lista.push(String(item.getEmail()).toLowerCase()); }); } catch (e) {}
  const organizador = jornadaOrganizadorEvento_(evento);
  if (organizador) lista.push(organizador.toLowerCase());
  return Array.from(new Set(lista.filter(Boolean)));
}

function jornadaOrganizadorEvento_(evento) {
  try { return String((evento.getCreators() || [])[0] || ''); } catch (e) { return ''; }
}

function jornadaArtefatoUrl_(destino) {
  destino = destino || {};
  const documento = String(destino.document || '').replace(/^documents\//, '').trim();
  if (documento) return 'https://docs.google.com/document/d/' + encodeURIComponent(documento) + '/edit';
  const valor = String(destino.exportUri || destino.export_uri || destino.url || destino.file || '').trim();
  if (!valor) return '';
  if (/^https?:\/\//i.test(valor)) return valor;
  const id = valor.replace(/^files\//, '');
  return 'https://drive.google.com/open?id=' + encodeURIComponent(id);
}

function jornadaLerDocumentoUrl_(url) {
  const achou = String(url || '').match(/\/d\/([a-zA-Z0-9_-]+)/) || String(url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!achou) return '';
  try {
    const arquivo = DriveApp.getFileById(achou[1]);
    return jornadaLerArquivoTranscricaoDetalhe_(arquivo).conteudo;
  } catch (e) { return ''; }
}

function DIAGNOSTICAR_FONTES_FORMALIZACOES() {
  formalGarantirEstrutura_();
  const formalizacoes = audV3Ler_(FORMALIZACAO_REUNIAO.aba).filter(item =>
    item.ID_FORMALIZACAO && String(item.STATUS || '').toUpperCase() !== 'DESCARTADA'
  );
  const detalhes = formalizacoes.map(item => {
    const transcricao = audV3Localizar_('TRANSCRICOES', 'ID_TRANSCRICAO', String(item.ID_TRANSCRICAO || ''));
    const interacao = transcricao ? (audV3Localizar_('INTERACOES', 'ID_INTERACAO', transcricao.ID_INTERACAO) || {}) : {};
    const fonte = String((transcricao || {}).FONTE || interacao.FONTE || '').toUpperCase();
    let classificacao = 'TRANSCRICAO_ARMAZENADA';
    let observacao = '';
    if (!transcricao) {
      classificacao = 'SEM_TRANSCRICAO';
      observacao = 'A formalização não possui transcrição vinculada.';
    } else if (fonte === 'GOOGLE_MEET') {
      const reuniao = audV3Ler_('REUNIOES_CALENDARIO').find(registro =>
        String(registro.ID_TRANSCRICAO || '') === String(transcricao.ID_TRANSCRICAO || '') ||
        String(registro.ID_INTERACAO || '') === String(transcricao.ID_INTERACAO || '')
      ) || {};
      const urls = [reuniao.TRANSCRICAO_URL, interacao.LINK_ORIGINAL].filter(Boolean);
      const leitura = urls.map(jornadaLerDocumentoTranscricaoEstrita_).find(item => item.usouAbaTranscricao && String(item.conteudo || '').trim().length >= 20);
      if (leitura) {
        classificacao = 'ABA_TRANSCRICAO';
        observacao = 'Fonte confirmada na aba ' + String(leitura.aba || 'Transcrição') + '.';
      } else if (jornadaConteudoPareceTranscricao_(String(transcricao.CONTEUDO || ''))) {
        classificacao = 'TRANSCRICAO_LITERAL_ARMAZENADA';
        observacao = 'Conteúdo literal armazenado, sem confirmação atual da aba.';
      } else {
        classificacao = 'RISCO_ANOTACOES_GEMINI';
        observacao = 'Não foi possível confirmar a aba Transcrição no documento vinculado.';
      }
    }
    return {
      idFormalizacao: String(item.ID_FORMALIZACAO || ''),
      titulo: String(item.TITULO || ''),
      status: String(item.STATUS || ''),
      fonte: fonte || 'NÃO INFORMADA',
      classificacao: classificacao,
      observacao: observacao
    };
  });
  const resumo = detalhes.reduce((acc, item) => {
    acc[item.classificacao] = (acc[item.classificacao] || 0) + 1;
    return acc;
  }, {});
  const retorno = { sucesso: true, total: detalhes.length, resumo: resumo, detalhes: detalhes };
  console.log(JSON.stringify(retorno));
  return retorno;
}

function jornadaDominio_(valor) {
  const texto = String(valor || '').trim().toLowerCase().replace(/^@/, '');
  return texto.includes('@') ? texto.split('@').pop() : texto;
}

function jornadaNormalizar_(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9@.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function jornadaListaEntrada_(valor) {
  if (Array.isArray(valor)) return valor.map(String).map(item => item.trim()).filter(Boolean);
  return String(valor || '').split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);
}

function jornadaJsonLista_(valor) {
  try { const lista = JSON.parse(String(valor || '[]')); return Array.isArray(lista) ? lista : []; } catch (e) { return []; }
}

function jornadaEmailExecucao_() {
  try { return Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}
