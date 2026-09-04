/**
 * CONTROLE INTERNO DE CONSUMO DA IA
 * Registra somente chamadas realizadas por este Board.
 */

const CONSUMO_IA = {
  aba: 'CONSUMO_IA',
  fusoLimite: 'America/Los_Angeles',
  fusoExibicao: 'America/Sao_Paulo',
  percentualMaximo: 100,
  modoSomenteGratuito: true,
  modeloTextoGratuito: 'gemini-3.5-flash-lite',
  modeloAudioGratuito: 'gemini-3.5-flash',
  modelosPermitidos: [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash'
  ],
  modelosTextoGratuitos: [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash'
  ],
  modelosAudioGratuitos: [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
  ],
  colunas: [
    'ID_CONSUMO', 'DATA_HORA', 'DATA_DIA_PT', 'MODELO', 'OPERACAO',
    'STATUS_HTTP', 'SUCESSO', 'INPUT_TOKENS', 'OUTPUT_TOKENS',
    'TOTAL_TOKENS', 'DURACAO_MS', 'ERRO'
  ],
  limites: {
    'gemini-3.6-flash': { rpm: 5, tpm: 250000, rpd: 20 },
    'gemini-3.5-flash': { rpm: 5, tpm: 250000, rpd: 20 },
    'gemini-2.5-flash-lite': { rpm: 10, tpm: 250000, rpd: 20 },
    'gemini-3.1-flash-lite': { rpm: 15, tpm: 250000, rpd: 500 },
    'gemini-3.5-flash-lite': { rpm: 15, tpm: 250000, rpd: 500 }
  }
};

function consumoIaModeloTextoGratuito_() {
  return consumoIaSelecionarModeloGratuito_(CONSUMO_IA.modelosTextoGratuitos, 'texto');
}

function consumoIaModelosTextoDisponiveis_() {
  const disponiveis = CONSUMO_IA.modelosTextoGratuitos.filter(function(modelo) {
    const limite = CONSUMO_IA.limites[modelo];
    if (!limite || !limite.rpd) return false;
    const usadas = consumoIaContarHojeModelo_(modelo);
    const tetoSeguro = Math.max(1, Math.floor(limite.rpd * CONSUMO_IA.percentualMaximo / 100));
    return usadas < tetoSeguro;
  });
  if (disponiveis.length) return disponiveis;
  consumoIaSelecionarModeloGratuito_(CONSUMO_IA.modelosTextoGratuitos, 'texto');
  return [];
}

function consumoIaModeloAudioGratuito_() {
  return consumoIaSelecionarModeloGratuito_(CONSUMO_IA.modelosAudioGratuitos, 'áudio');
}

function consumoIaSelecionarModeloGratuito_(modelos, modalidade) {
  for (let indice = 0; indice < modelos.length; indice++) {
    const modelo = modelos[indice];
    const limite = CONSUMO_IA.limites[modelo];
    if (!limite || !limite.rpd) continue;
    const usadas = consumoIaContarHojeModelo_(modelo);
    const tetoSeguro = Math.max(1, Math.floor(limite.rpd * CONSUMO_IA.percentualMaximo / 100));
    if (usadas < tetoSeguro) return modelo;
  }
  throw new Error(
    'As cotas gratuitas de ' + modalidade + ' configuradas no Board chegaram à margem de segurança. ' +
    'Nenhuma chamada paga foi realizada. Tente novamente após o reinício diário.'
  );
}

function consumoIaContarHojeModelo_(modelo) {
  const aba = consumoIaGarantirEstrutura_();
  if (aba.getLastRow() <= 1) return 0;
  const hojePt = Utilities.formatDate(new Date(), CONSUMO_IA.fusoLimite, 'yyyy-MM-dd');
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, CONSUMO_IA.colunas.length).getValues();
  const indiceDia = CONSUMO_IA.colunas.indexOf('DATA_DIA_PT');
  const indiceModelo = CONSUMO_IA.colunas.indexOf('MODELO');
  return linhas.filter(function(linha) {
    return consumoIaDiaChave_(linha[indiceDia]) === hojePt && String(linha[indiceModelo] || '') === String(modelo || '');
  }).length;
}

function consumoIaDiaChave_(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    // O Sheets converte a chave textual yyyy-MM-dd em meia-noite no fuso da
    // planilha. Ler no fuso operacional recupera o dia exibido sem deslocar
    // para a véspera no horário do Pacífico.
    return Utilities.formatDate(valor, APP.timezone || CONSUMO_IA.fusoExibicao, 'yyyy-MM-dd');
  }
  const texto = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const data = new Date(valor);
  return isNaN(data.getTime()) ? texto : Utilities.formatDate(data, APP.timezone || CONSUMO_IA.fusoExibicao, 'yyyy-MM-dd');
}

function consumoIaExigirModeloGratuito_(modelo) {
  if (!CONSUMO_IA.modoSomenteGratuito) return;
  if (CONSUMO_IA.modelosPermitidos.indexOf(String(modelo || '')) < 0) {
    throw new Error('Modelo bloqueado pelo modo gratuito: ' + modelo + '. Nenhuma chamada foi realizada.');
  }
}

function consumoIaValidarAntes_(modelo) {
  consumoIaExigirModeloGratuito_(modelo);
  const limite = CONSUMO_IA.limites[String(modelo || '')];
  if (!limite || !limite.rpd) return;
  const usadas = consumoIaContarHojeModelo_(modelo);
  const tetoSeguro = Math.max(1, Math.floor(limite.rpd * CONSUMO_IA.percentualMaximo / 100));
  if (usadas >= tetoSeguro) {
    throw new Error(
      'Limite de segurança da IA atingido para ' + modelo + ' (' + usadas + '/' + tetoSeguro + '). ' +
      'O Board bloqueou novas chamadas para preservar a cota gratuita. Tente novamente após o reinício diário.'
    );
  }
}

function consumoIaGarantirEstrutura_() {
  const planilha = SpreadsheetApp.openById(APP.spreadsheetId);
  let aba = planilha.getSheetByName(CONSUMO_IA.aba);
  if (!aba) aba = planilha.insertSheet(CONSUMO_IA.aba);

  const colunas = CONSUMO_IA.colunas;
  const cabecalhoAtual = aba.getLastColumn()
    ? aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), colunas.length)).getDisplayValues()[0]
    : [];
  const precisaCabecalho = colunas.some(function(nome, indice) {
    return String(cabecalhoAtual[indice] || '').trim() !== nome;
  });
  if (precisaCabecalho) {
    aba.getRange(1, 1, 1, colunas.length).setValues([colunas]);
    aba.getRange(1, 1, 1, colunas.length)
      .setFontWeight('bold')
      .setBackground('#111827')
      .setFontColor('#ffffff');
    aba.setFrozenRows(1);
  }
  return aba;
}

function registrarConsumoIa_(modelo, operacao, statusHttp, corpoResposta, erro, iniciadoEm) {
  try {
    let uso = {};
    try {
      const resposta = typeof corpoResposta === 'string'
        ? JSON.parse(corpoResposta || '{}')
        : (corpoResposta || {});
      uso = resposta.usageMetadata || resposta.usage_metadata || {};
    } catch (erroJson) {}

    const agora = new Date();
    const status = Number(statusHttp || 0);
    const mensagemErro = String(erro || consumoIaExtrairErro_(corpoResposta) || '').slice(0, 500);
    const linha = [
      Utilities.getUuid(),
      agora,
      Utilities.formatDate(agora, CONSUMO_IA.fusoLimite, 'yyyy-MM-dd'),
      String(modelo || 'modelo-nao-identificado'),
      String(operacao || 'NAO_IDENTIFICADA'),
      status,
      status >= 200 && status < 300 ? 'SIM' : 'NAO',
      Number(uso.promptTokenCount || uso.prompt_token_count || 0),
      Number(uso.candidatesTokenCount || uso.candidates_token_count || 0),
      Number(uso.totalTokenCount || uso.total_token_count || 0),
      iniciadoEm ? Math.max(0, Date.now() - Number(iniciadoEm)) : 0,
      mensagemErro
    ];

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      consumoIaGarantirEstrutura_().appendRow(linha);
    } finally {
      lock.releaseLock();
    }
  } catch (erroRegistro) {
    console.warn('Não foi possível registrar o consumo da IA: ' + String(erroRegistro));
  }
}

function consumoIaExtrairErro_(corpo) {
  try {
    const json = typeof corpo === 'string' ? JSON.parse(corpo || '{}') : (corpo || {});
    return String((json.error || {}).message || '');
  } catch (erro) {
    return '';
  }
}

/**
 * Diagnóstico mínimo para confirmar a conexão sem executar auditoria,
 * transcrição ou formalização. Faz uma única chamada e limita a resposta a
 * oito tokens. O mesmo bloqueio de cota gratuita usado pelo Board é aplicado.
 */
function TESTAR_IA_GRATUITA_CONTROLADO() {
  const chave = obterSegredo_('GEMINI_API_KEY');
  if (!chave) throw new Error('Configure a chave Gemini antes do teste.');
  const modelo = consumoIaModeloTextoGratuito_();
  consumoIaValidarAntes_(modelo);
  const inicio = Date.now();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent';
  const resposta = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': chave },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Responda somente com a palavra OK.' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8 }
    }),
    muteHttpExceptions: true
  });
  const status = resposta.getResponseCode();
  const corpo = resposta.getContentText();
  registrarConsumoIa_(modelo, 'TESTE_CONTROLADO', status, corpo, '', inicio);
  if (status < 200 || status >= 300) {
    throw new Error('Teste controlado não concluído (HTTP ' + status + '): ' + consumoIaExtrairErro_(corpo));
  }
  const json = JSON.parse(corpo || '{}');
  const partes = (((json.candidates || [])[0] || {}).content || {}).parts || [];
  const texto = partes.map(function(parte) { return parte.text || ''; }).join('').trim();
  const uso = json.usageMetadata || {};
  return {
    sucesso: /^OK[.!]?$/i.test(texto),
    resposta: texto,
    modelo: modelo,
    inputTokens: Number(uso.promptTokenCount || 0),
    outputTokens: Number(uso.candidatesTokenCount || 0),
    totalTokens: Number(uso.totalTokenCount || 0),
    mensagem: 'Teste mínimo concluído sem gerar documento ou análise completa.'
  };
}

function DIAGNOSTICAR_ULTIMO_CONSUMO_IA() {
  const aba = consumoIaGarantirEstrutura_();
  const ultimaLinha = aba.getLastRow();
  const retorno = {
    ultimaLinha: ultimaLinha,
    valores: ultimaLinha > 1 ? aba.getRange(ultimaLinha, 1, 1, CONSUMO_IA.colunas.length).getValues()[0] : [],
    exibicao: ultimaLinha > 1 ? aba.getRange(ultimaLinha, 1, 1, CONSUMO_IA.colunas.length).getDisplayValues()[0] : []
  };
  console.log(JSON.stringify(retorno));
  return retorno;
}

function carregarDadosConsumoIa() {
  const aba = consumoIaGarantirEstrutura_();
  const hojePt = Utilities.formatDate(new Date(), CONSUMO_IA.fusoLimite, 'yyyy-MM-dd');
  const valores = aba.getLastRow() > 1
    ? aba.getRange(2, 1, aba.getLastRow() - 1, CONSUMO_IA.colunas.length).getValues()
    : [];
  const indices = {};
  CONSUMO_IA.colunas.forEach(function(nome, indice) { indices[nome] = indice; });
  const agregados = {};

  Object.keys(CONSUMO_IA.limites).forEach(function(modelo) {
    agregados[modelo] = consumoIaModeloVazio_(modelo);
  });

  valores.forEach(function(linha) {
    if (consumoIaDiaChave_(linha[indices.DATA_DIA_PT]) !== hojePt) return;
    const modelo = String(linha[indices.MODELO] || 'modelo-nao-identificado');
    if (!agregados[modelo]) agregados[modelo] = consumoIaModeloVazio_(modelo);
    const item = agregados[modelo];
    item.requisicoes++;
    if (String(linha[indices.SUCESSO] || '').toUpperCase() === 'SIM') item.sucessos++;
    else item.erros++;
    item.inputTokens += Number(linha[indices.INPUT_TOKENS] || 0);
    item.outputTokens += Number(linha[indices.OUTPUT_TOKENS] || 0);
    item.totalTokens += Number(linha[indices.TOTAL_TOKENS] || 0);
  });

  const modelos = Object.keys(agregados).map(function(nome) {
    const item = agregados[nome];
    const limite = CONSUMO_IA.limites[nome] || { rpm: null, tpm: null, rpd: null };
    item.rpm = limite.rpm;
    item.tpm = limite.tpm;
    item.rpd = limite.rpd;
    item.saldoEstimado = limite.rpd === null ? null : Math.max(0, limite.rpd - item.requisicoes);
    item.percentual = limite.rpd ? Math.round(item.requisicoes / limite.rpd * 1000) / 10 : null;
    item.classificacao = consumoIaClassificar_(item.percentual);
    return item;
  }).sort(function(a, b) {
    if (b.requisicoes !== a.requisicoes) return b.requisicoes - a.requisicoes;
    return a.modelo.localeCompare(b.modelo);
  });

  const resumo = modelos.reduce(function(total, item) {
    total.requisicoes += item.requisicoes;
    total.sucessos += item.sucessos;
    total.erros += item.erros;
    total.totalTokens += item.totalTokens;
    return total;
  }, { requisicoes: 0, sucessos: 0, erros: 0, totalTokens: 0 });

  const historico = valores.slice(-50).reverse().map(function(linha) {
    const data = linha[indices.DATA_HORA];
    return {
      dataHora: data instanceof Date
        ? Utilities.formatDate(data, CONSUMO_IA.fusoExibicao, 'dd/MM/yyyy HH:mm:ss')
        : String(data || ''),
      modelo: String(linha[indices.MODELO] || ''),
      operacao: String(linha[indices.OPERACAO] || ''),
      statusHttp: Number(linha[indices.STATUS_HTTP] || 0),
      sucesso: String(linha[indices.SUCESSO] || '').toUpperCase() === 'SIM',
      totalTokens: Number(linha[indices.TOTAL_TOKENS] || 0),
      erro: String(linha[indices.ERRO] || '')
    };
  });

  return JSON.parse(JSON.stringify({
    resumo: resumo,
    modelos: modelos,
    historico: historico,
    diaReferencia: hojePt,
    ultimaAtualizacao: Utilities.formatDate(new Date(), CONSUMO_IA.fusoExibicao, 'dd/MM/yyyy HH:mm:ss'),
    reinicio: '00:00 no horário do Pacífico (normalmente 04:00 ou 05:00 em Brasília)',
    limiteSeguranca: CONSUMO_IA.percentualMaximo + '% do limite diário gratuito configurado',
    modoGratuito: CONSUMO_IA.modoSomenteGratuito,
    modeloTexto: CONSUMO_IA.modelosTextoGratuitos.join(' → '),
    modeloAudio: CONSUMO_IA.modelosAudioGratuitos.join(' → '),
    urlOficial: 'https://aistudio.google.com/rate-limit',
    observacao: 'Estimativa baseada somente nas chamadas feitas por este Board desde a ativação do controle. O Google AI Studio é a fonte oficial do projeto e pode levar alguns minutos para atualizar.',
    automacaoLigacoes: typeof obterStatusAutomacaoLigacoesV3 === 'function'
      ? obterStatusAutomacaoLigacoesV3()
      : null
  }));
}

function consumoIaModeloVazio_(modelo) {
  return {
    modelo: modelo,
    requisicoes: 0,
    sucessos: 0,
    erros: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

function consumoIaClassificar_(percentual) {
  if (percentual === null) return { texto: 'SEM LIMITE CONFIGURADO', classe: 'warning' };
  if (percentual >= 100) return { texto: 'ESGOTADO', classe: 'danger' };
  if (percentual >= 90) return { texto: 'CRÍTICO', classe: 'danger' };
  if (percentual >= 70) return { texto: 'ATENÇÃO', classe: 'warning' };
  return { texto: 'DISPONÍVEL', classe: 'success' };
}
