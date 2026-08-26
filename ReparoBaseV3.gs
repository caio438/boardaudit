/**
 * DIAGNÓSTICO E REPARO CONTROLADO — BOARD DE AUDITORIAS VOLUM
 *
 * Nenhuma função de reparo é executada pelo instalador.
 * Sempre rode primeiro DIAGNOSTICAR_BASE_AUDITORIA_V3.
 * As funções de escrita exigem uma frase de confirmação e criam backups.
 */

var reparoV4PontuacaoClientesCache_ = null;

function AAA_VALIDAR_BASE_POS_REPARO() {
  const estruturas = [
    ['CLIENTES', 'ID_CLIENTE'], ['INTERACOES', 'ID_INTERACAO'], ['TRANSCRICOES', 'ID_TRANSCRICAO'],
    ['AUDITORIAS', 'ID_AUDITORIA'], ['FORMALIZACOES_REUNIAO', 'ID_FORMALIZACAO'],
    ['REUNIOES_CALENDARIO', 'ID_REUNIAO'], ['ENTREGAS_MENSAIS', 'ID_ENTREGA']
  ];
  const resultado = {};
  estruturas.forEach(item => {
    const linhas = reparoV3Ler_(item[0]).filter(registro => String(registro[item[1]] || '').trim());
    const vistos = {};
    linhas.forEach(registro => { const chave = String(registro[item[1]]); vistos[chave] = (vistos[chave] || 0) + 1; });
    resultado[item[0]] = { registros: linhas.length, chavesDuplicadas: Object.keys(vistos).filter(chave => vistos[chave] > 1).length };
  });
  const nomes = {};
  reparoV3Ler_('CLIENTES').filter(item => item.ID_CLIENTE).forEach(item => {
    const chave = reparoV3Normalizar_(item.NOME_CLIENTE);
    if (chave) nomes[chave] = (nomes[chave] || 0) + 1;
  });
  resultado.CLIENTES.nomesDuplicados = Object.keys(nomes).filter(chave => nomes[chave] > 1).length;
  console.log(JSON.stringify(resultado));
  return resultado;
}

function DIAGNOSTICAR_BASE_AUDITORIA_V3() {
  const clientes = reparoV3Ler_('CLIENTES');
  const interacoes = reparoV3Ler_('INTERACOES');
  const transcricoes = reparoV3Ler_('TRANSCRICOES');
  const auditorias = reparoV3Ler_('AUDITORIAS');
  const modelos = reparoV3Ler_('MODELOS_AUDITORIA');

  const grupos = {};
  clientes.forEach(item => {
    if (!item.ID_CLIENTE) return;
    const chave = reparoV3Normalizar_(item.NOME_CLIENTE);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({ idCliente: item.ID_CLIENTE, nomeCliente: item.NOME_CLIENTE, status: item.STATUS || '' });
  });
  const duplicados = Object.keys(grupos).filter(chave => chave && grupos[chave].length > 1).map(chave => ({
    nomeNormalizado: chave,
    quantidade: grupos[chave].length,
    registros: grupos[chave],
    idCanonicoSugerido: reparoV3EscolherCanonico_(grupos[chave].map(item => item.idCliente))
  }));

  const deslocadas = interacoes.filter(reparoV3InteracaoLegada_).map(item => ({
    idInteracao: item.ID_INTERACAO,
    fonte: item.FONTE,
    titulo: item.TITULO,
    valorColunaM: reparoV3TipoValorM_(item.STATUS_TRANSCRICAO),
    statusColunaN: item.STATUS_AUDITORIA || '',
    valorColunaO: item.IMPORTADO_EM || ''
  }));

  const statusTranscricoes = {};
  transcricoes.forEach(item => {
    const status = String(item.STATUS || 'SEM_STATUS');
    statusTranscricoes[status] = (statusTranscricoes[status] || 0) + 1;
  });

  return {
    geradoEm: new Date().toISOString(),
    somenteLeitura: true,
    totais: {
      clientes: clientes.filter(item => item.ID_CLIENTE).length,
      gruposDuplicados: duplicados.length,
      registrosDuplicados: duplicados.reduce((soma, grupo) => soma + grupo.quantidade - 1, 0),
      interacoes: interacoes.filter(item => item.ID_INTERACAO).length,
      interacoesLegadasDeslocadas: deslocadas.length,
      transcricoes: transcricoes.filter(item => item.ID_TRANSCRICAO).length,
      auditorias: auditorias.filter(item => item.ID_AUDITORIA).length,
      modelos: modelos.filter(item => item.ID_MODELO).length
    },
    duplicados: duplicados,
    interacoesDeslocadas: deslocadas,
    statusTranscricoes: statusTranscricoes,
    proximosPassos: [
      'Execute REPARAR_INTERACOES_LEGADAS_V3 somente após revisar interacoesDeslocadas.',
      'Execute CONSOLIDAR_CLIENTES_DUPLICADOS_V3 separadamente para cada nome duplicado.',
      'Confirme a criação das abas BACKUP antes de continuar.'
    ]
  };
}

/**
 * Varredura somente leitura com as mesmas chaves usadas pelo reparo V4.
 * Permite medir o que seria consolidado sem alterar ou excluir nenhuma linha.
 */
function DIAGNOSTICAR_DUPLICIDADES_ESTRUTURAIS_V4() {
  const ss = reparoV3Planilha_();
  const abas = {
    clientes: reparoV4DiagnosticarAba_(ss, 'CLIENTES', 'ID_CLIENTE', reparoV4ChaveCliente_),
    interacoes: reparoV4DiagnosticarAba_(ss, 'INTERACOES', 'ID_INTERACAO', item => {
      const externo = String(item.ID_EXTERNO || '').trim();
      return externo ? String(item.FONTE || '').toUpperCase() + '|' + externo : '';
    }),
    transcricoes: reparoV4DiagnosticarAba_(ss, 'TRANSCRICOES', 'ID_TRANSCRICAO', item => {
      const id = String(item.ID_INTERACAO || '').trim();
      return id ? id + '|' + String(item.FONTE || '').toUpperCase() : '';
    }),
    formalizacoes: reparoV4DiagnosticarAba_(ss, 'FORMALIZACOES_REUNIAO', 'ID_FORMALIZACAO', item => {
      const id = String(item.ID_TRANSCRICAO || '').trim();
      return id ? 'TRA|' + id : (String(item.ID_INTERACAO || '').trim() ? 'INT|' + String(item.ID_INTERACAO) : '');
    }),
    entregas: reparoV4DiagnosticarAba_(ss, 'ENTREGAS_MENSAIS', 'ID_ENTREGA', item => {
      const regra = String(item.ID_REGRA || '').trim();
      if (!regra) return '';
      return [item.ID_CLIENTE, reparoV4Periodo_(item.PERIODO), regra, Number(item.ORDEM_MES || 1)].join('|');
    })
  };
  const resumo = Object.keys(abas).reduce((total, nome) => {
    total.gruposDuplicados += abas[nome].gruposDuplicados;
    total.linhasExcedentes += abas[nome].linhasExcedentes;
    return total;
  }, { gruposDuplicados: 0, linhasExcedentes: 0 });
  const resultado = { geradoEm: new Date().toISOString(), somenteLeitura: true, resumo: resumo, abas: abas };
  console.log(JSON.stringify(resultado));
  return resultado;
}

function reparoV4DiagnosticarAba_(ss, nomeAba, campoId, criarChave) {
  const aba = ss.getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return { registros: 0, gruposDuplicados: 0, linhasExcedentes: 0, exemplos: [] };
  const dados = aba.getDataRange().getDisplayValues();
  const cabecalhos = dados[0].map(String);
  const grupos = {};
  let registros = 0;
  dados.slice(1).forEach(linha => {
    const item = reparoV3ObjetoLinha_(cabecalhos, linha);
    if (!String(item[campoId] || '').trim()) return;
    registros++;
    const chave = String(criarChave(item) || '').trim();
    if (!chave) return;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(String(item[campoId]));
  });
  const duplicados = Object.keys(grupos).filter(chave => grupos[chave].length > 1);
  return {
    registros: registros,
    gruposDuplicados: duplicados.length,
    linhasExcedentes: duplicados.reduce((total, chave) => total + grupos[chave].length - 1, 0),
    exemplos: duplicados.slice(0, 10).map(chave => ({ chave: chave, quantidade: grupos[chave].length }))
  };
}

function REPARAR_INTERACOES_LEGADAS_V3(confirmacao) {
  if (String(confirmacao || '') !== 'CRIAR BACKUP E REPARAR INTERACOES') {
    throw new Error('Confirmação inválida. Use exatamente: CRIAR BACKUP E REPARAR INTERACOES');
  }
  const ss = reparoV3Planilha_();
  const aba = ss.getSheetByName('INTERACOES');
  if (!aba) throw new Error('A aba INTERACOES não existe.');
  const backup = reparoV3BackupAba_(ss, aba, 'BACKUP_INTERACOES');
  const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const idx = reparoV3Indices_(cabecalhos);
  const quantidadeLinhas = Math.max(0, aba.getLastRow() - 1);
  if (!quantidadeLinhas) return { sucesso: true, reparadas: 0, backup: backup.getName(), mensagem: 'A aba não possui interações para reparar.' };
  const valores = aba.getRange(2, 1, quantidadeLinhas, aba.getLastColumn()).getValues();
  let reparadas = 0;

  valores.forEach(linha => {
    const item = reparoV3ObjetoLinha_(cabecalhos, linha);
    if (!reparoV3InteracaoLegada_(item)) return;
    const antigoM = item.STATUS_TRANSCRICAO;
    const antigoN = item.STATUS_AUDITORIA;
    const antigoO = item.IMPORTADO_EM;
    const antigoP = item.ATUALIZADO_EM;
    const convidados = reparoV3Convidados_(antigoM);
    if (!String(item.LEAD || '').trim() && convidados) linha[idx.LEAD] = convidados;
    if (idx.PARTICIPANTES_JSON !== undefined && /^\s*\[/.test(String(antigoM || ''))) {
      linha[idx.PARTICIPANTES_JSON] = String(antigoM);
    }
    linha[idx.STATUS_TRANSCRICAO] = reparoV3StatusTranscricao_(antigoM, antigoN);
    linha[idx.STATUS_AUDITORIA] = reparoV3StatusAuditoria_(antigoO);
    linha[idx.IMPORTADO_EM] = reparoV3DataValida_(antigoP) ? antigoP : new Date();
    linha[idx.ATUALIZADO_EM] = new Date();
    if (idx.SCHEMA_VERSAO !== undefined) linha[idx.SCHEMA_VERSAO] = '3.1.0';
    reparadas++;
  });

  if (valores.length) aba.getRange(2, 1, valores.length, valores[0].length).setValues(valores);
  SpreadsheetApp.flush();
  return { sucesso: true, reparadas: reparadas, backup: backup.getName(), mensagem: reparadas + ' interação(ões) realinhada(s).' };
}

function CONSOLIDAR_CLIENTES_DUPLICADOS_V3(nomeCliente, confirmacao) {
  if (String(confirmacao || '') !== 'CRIAR BACKUP E CONSOLIDAR CLIENTES') {
    throw new Error('Confirmação inválida. Use exatamente: CRIAR BACKUP E CONSOLIDAR CLIENTES');
  }
  const nomeNormalizado = reparoV3Normalizar_(nomeCliente);
  if (!nomeNormalizado) throw new Error('Informe o nome do cliente a consolidar.');
  const clientes = reparoV3Ler_('CLIENTES').filter(item =>
    item.ID_CLIENTE && reparoV3Normalizar_(item.NOME_CLIENTE) === nomeNormalizado
  );
  if (clientes.length < 2) return { sucesso: true, ignorada: true, mensagem: 'Não há duplicidade para esse nome.' };

  const ids = clientes.map(item => String(item.ID_CLIENTE));
  const idCanonico = reparoV3EscolherCanonico_(ids);
  const duplicados = ids.filter(id => id !== idCanonico);
  const ss = reparoV3Planilha_();
  const nomesAfetados = ['CLIENTES', 'PITCHES', 'INTEGRACOES_CLIENTES', 'INTERACOES', 'AUDITORIAS', 'RESUMO_TAREFAS_RD'];
  const backups = nomesAfetados.filter(nome => ss.getSheetByName(nome)).map(nome =>
    reparoV3BackupAba_(ss, ss.getSheetByName(nome), 'BACKUP_' + nome).getName()
  );

  reparoV3MesclarCadastroCanonico_(ss.getSheetByName('CLIENTES'), clientes, idCanonico);

  let referenciasAtualizadas = 0;
  nomesAfetados.filter(nome => nome !== 'CLIENTES').forEach(nome => {
    const aba = ss.getSheetByName(nome);
    if (!aba || aba.getLastRow() < 2) return;
    const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    const coluna = cabecalhos.indexOf('ID_CLIENTE');
    if (coluna < 0) return;
    const faixa = aba.getRange(2, coluna + 1, aba.getLastRow() - 1, 1);
    const valores = faixa.getValues();
    valores.forEach(linha => {
      if (duplicados.includes(String(linha[0] || ''))) {
        linha[0] = idCanonico;
        referenciasAtualizadas++;
      }
    });
    faixa.setValues(valores);
  });

  const abaClientes = ss.getSheetByName('CLIENTES');
  const cabecalhosClientes = abaClientes.getRange(1, 1, 1, abaClientes.getLastColumn()).getDisplayValues()[0];
  const colunaId = cabecalhosClientes.indexOf('ID_CLIENTE');
  const idsLinhas = abaClientes.getRange(2, colunaId + 1, abaClientes.getLastRow() - 1, 1).getDisplayValues();
  const linhasExcluir = [];
  idsLinhas.forEach((linha, indice) => { if (duplicados.includes(String(linha[0]))) linhasExcluir.push(indice + 2); });
  linhasExcluir.sort((a, b) => b - a).forEach(numero => abaClientes.deleteRow(numero));
  SpreadsheetApp.flush();

  return {
    sucesso: true,
    nomeCliente: nomeCliente,
    idCanonico: idCanonico,
    idsRemovidos: duplicados,
    referenciasAtualizadas: referenciasAtualizadas,
    linhasClientesRemovidas: linhasExcluir.length,
    backups: backups,
    mensagem: 'Clientes consolidados com backup. O ID canônico foi preservado em todas as referências.'
  };
}

/**
 * Consolidação completa da base 4.11.
 * Mantém o registro mais completo, migra todas as referências e cria backup
 * das abas alteradas antes de remover repetições.
 */
function REPARAR_DUPLICIDADES_ESTRUTURAIS_V4(confirmacao) {
  if (String(confirmacao || '') !== 'CRIAR BACKUP E REMOVER DUPLICIDADES V4') {
    throw new Error('Confirmação inválida. Use exatamente: CRIAR BACKUP E REMOVER DUPLICIDADES V4');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = reparoV3Planilha_();
    const afetadas = [
      'CLIENTES', 'INTERACOES', 'TRANSCRICOES', 'FORMALIZACOES_REUNIAO',
      'ENTREGAS_MENSAIS', 'PITCHES', 'MATERIAIS_CLIENTES', 'METAS_CLIENTES',
      'INTEGRACOES_CLIENTES', 'AUDITORIAS', 'RESUMO_TAREFAS_RD',
      'CLIENTE_IDENTIFICADORES', 'REUNIOES_CALENDARIO', 'REGRAS_ENTREGAS_CLIENTE',
      'DIARIO_CLIENTE', 'OTIMIZACOES_CLIENTE', 'EQUIPE_CLIENTE'
    ].filter(nome => ss.getSheetByName(nome));
    const backups = afetadas.map(nome =>
      reparoV3BackupAba_(ss, ss.getSheetByName(nome), 'BACKUP_V4_' + nome).getName()
    );
    const resumo = { clientes: 0, interacoes: 0, transcricoes: 0, formalizacoes: 0, entregas: 0, referencias: 0 };

    const mapaClientes = reparoV4ConsolidarAba_(ss, 'CLIENTES', 'ID_CLIENTE', reparoV4ChaveCliente_, reparoV4PontuarCliente_);
    resumo.clientes = Object.keys(mapaClientes).length;
    resumo.referencias += reparoV4AtualizarReferencias_(ss, afetadas.filter(nome => nome !== 'CLIENTES'), 'ID_CLIENTE', mapaClientes);

    const mapaInteracoes = reparoV4ConsolidarAba_(ss, 'INTERACOES', 'ID_INTERACAO', item => {
      const externo = String(item.ID_EXTERNO || '').trim();
      return externo ? String(item.FONTE || '').toUpperCase() + '|' + externo : '';
    }, reparoV4PontuarInteracao_);
    resumo.interacoes = Object.keys(mapaInteracoes).length;
    resumo.referencias += reparoV4AtualizarReferencias_(ss, ['TRANSCRICOES', 'AUDITORIAS', 'FORMALIZACOES_REUNIAO', 'REUNIOES_CALENDARIO'], 'ID_INTERACAO', mapaInteracoes);

    const mapaTranscricoes = reparoV4ConsolidarAba_(ss, 'TRANSCRICOES', 'ID_TRANSCRICAO', item => {
      const id = String(item.ID_INTERACAO || '').trim();
      return id ? id + '|' + String(item.FONTE || '').toUpperCase() : '';
    }, reparoV4PontuarTranscricao_);
    resumo.transcricoes = Object.keys(mapaTranscricoes).length;
    resumo.referencias += reparoV4AtualizarReferencias_(ss, ['AUDITORIAS', 'FORMALIZACOES_REUNIAO', 'REUNIOES_CALENDARIO'], 'ID_TRANSCRICAO', mapaTranscricoes);

    const mapaFormalizacoes = reparoV4ConsolidarAba_(ss, 'FORMALIZACOES_REUNIAO', 'ID_FORMALIZACAO', item => {
      const id = String(item.ID_TRANSCRICAO || '').trim();
      return id ? 'TRA|' + id : (String(item.ID_INTERACAO || '').trim() ? 'INT|' + String(item.ID_INTERACAO) : '');
    }, reparoV4PontuarFormalizacao_);
    resumo.formalizacoes = Object.keys(mapaFormalizacoes).length;
    resumo.referencias += reparoV4AtualizarReferencias_(ss, ['ENTREGAS_MENSAIS'], 'ID_FORMALIZACAO', mapaFormalizacoes);

    const mapaEntregas = reparoV4ConsolidarAba_(ss, 'ENTREGAS_MENSAIS', 'ID_ENTREGA', item => {
      const regra = String(item.ID_REGRA || '').trim();
      if (!regra) return '';
      return [item.ID_CLIENTE, reparoV4Periodo_(item.PERIODO), regra, Number(item.ORDEM_MES || 1)].join('|');
    }, reparoV4PontuarEntrega_);
    resumo.entregas = Object.keys(mapaEntregas).length;

    SpreadsheetApp.flush();
    if (typeof limparCachesDados_ === 'function') limparCachesDados_();
    if (typeof registrarLog_ === 'function') registrarLog_('BANCO', 'REPARO_DUPLICIDADES_V4', JSON.stringify(resumo));
    return { sucesso: true, resumo: resumo, backups: backups, mensagem: 'Duplicidades consolidadas com backup e referências preservadas.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Atalho administrativo para execução manual no editor do Apps Script.
 * Use somente depois de conferir o diagnóstico e autorizar a remoção.
 */
function EXECUTAR_REPARO_DUPLICIDADES_V4_CONFIRMADO() {
  return REPARAR_DUPLICIDADES_ESTRUTURAIS_V4('CRIAR BACKUP E REMOVER DUPLICIDADES V4');
}

function reparoV4ConsolidarAba_(ss, nomeAba, campoId, criarChave, pontuar) {
  const aba = ss.getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return {};
  const dados = aba.getDataRange().getValues();
  const cabecalhos = dados[0].map(String);
  const registros = dados.slice(1).map(linha => reparoV3ObjetoLinha_(cabecalhos, linha));
  const grupos = {};
  registros.forEach((item, indice) => {
    const chave = criarChave(item);
    if (!chave) return;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(indice);
  });
  const mapa = {};
  const excluir = [];
  Object.keys(grupos).forEach(chave => {
    const indices = grupos[chave];
    if (indices.length < 2) return;
    const canonico = indices.slice().sort((a, b) => pontuar(registros[b]) - pontuar(registros[a]) || a - b)[0];
    const idCanonico = String(registros[canonico][campoId] || '');
    indices.filter(indice => indice !== canonico).forEach(indice => {
      const idRemovido = String(registros[indice][campoId] || '');
      if (idRemovido && idCanonico) mapa[idRemovido] = idCanonico;
      cabecalhos.forEach((campo, coluna) => {
        if (campo && !String(dados[canonico + 1][coluna] == null ? '' : dados[canonico + 1][coluna]).trim() &&
            String(dados[indice + 1][coluna] == null ? '' : dados[indice + 1][coluna]).trim()) {
          dados[canonico + 1][coluna] = dados[indice + 1][coluna];
        }
      });
      excluir.push(indice + 2);
    });
  });
  if (excluir.length) {
    aba.getRange(2, 1, dados.length - 1, cabecalhos.length).setValues(dados.slice(1));
    excluir.sort((a, b) => b - a).forEach(linha => aba.deleteRow(linha));
  }
  return mapa;
}

function reparoV4AtualizarReferencias_(ss, nomesAbas, campo, mapa) {
  if (!Object.keys(mapa || {}).length) return 0;
  let total = 0;
  (nomesAbas || []).forEach(nome => {
    const aba = ss.getSheetByName(nome);
    if (!aba || aba.getLastRow() < 2) return;
    const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    const indice = cabecalhos.indexOf(campo);
    if (indice < 0) return;
    const faixa = aba.getRange(2, indice + 1, aba.getLastRow() - 1, 1);
    const valores = faixa.getValues();
    valores.forEach(linha => {
      const novo = mapa[String(linha[0] || '')];
      if (novo) { linha[0] = novo; total++; }
    });
    faixa.setValues(valores);
  });
  return total;
}

function reparoV4ChaveCliente_(item) {
  const chaveVolumberg = String(item.CHAVE_VOLUMBERG || '').trim();
  if (chaveVolumberg) return 'VOL|' + chaveVolumberg;
  let nome = reparoV3Normalizar_(item.NOME_CLIENTE).replace(/[^a-z0-9]/g, '');
  if (nome === 'liberadoapp') return 'VOL|liberado_app';
  if (nome === 'alfaplanos' || nome === 'alphaplanos') return 'VOL|alphaplanos';
  return nome ? 'NOME|' + nome : '';
}

function reparoV4PontuarCliente_(item) {
  const id = String(item.ID_CLIENTE || '');
  const referencias = ['PITCHES','MATERIAIS_CLIENTES','METAS_CLIENTES','INTEGRACOES_CLIENTES','INTERACOES','AUDITORIAS','FORMALIZACOES_REUNIAO','RESUMO_TAREFAS_RD','CLIENTE_IDENTIFICADORES','REUNIOES_CALENDARIO','REGRAS_ENTREGAS_CLIENTE','ENTREGAS_MENSAIS','DIARIO_CLIENTE','OTIMIZACOES_CLIENTE','EQUIPE_CLIENTE'];
  let pontos = /^CLI_VOL_/i.test(id) ? 0 : 100;
  pontos += String(item.CHAVE_VOLUMBERG || '').trim() ? 10 : 0;
  if (!reparoV4PontuacaoClientesCache_) {
    reparoV4PontuacaoClientesCache_ = {};
    referencias.forEach(nome => reparoV3Ler_(nome).forEach(registro => {
      const chave = String(registro.ID_CLIENTE || '');
      if (chave) reparoV4PontuacaoClientesCache_[chave] = (reparoV4PontuacaoClientesCache_[chave] || 0) + 1;
    }));
  }
  pontos += reparoV4PontuacaoClientesCache_[id] || 0;
  return pontos;
}

function reparoV4PontuarInteracao_(item) {
  return ['ID_CLIENTE','TITULO','DATA_INTERACAO','DURACAO_SEGUNDOS','URL_GRAVACAO','PARTICIPANTES_JSON','DESCRICAO_ORIGEM']
    .reduce((total, campo) => total + (String(item[campo] || '').trim() ? 2 : 0), 0) + (String(item.STATUS_TRANSCRICAO).toUpperCase() === 'CONCLUIDA' ? 20 : 0);
}
function reparoV4PontuarTranscricao_(item) { return String(item.CONTEUDO || '').length + (String(item.STATUS).toUpperCase() === 'CONCLUIDA' ? 100000 : 0); }
function reparoV4PontuarFormalizacao_(item) {
  const status = { PUBLICADA: 60, APROVADA: 50, CONCLUIDA: 40, PENDENTE_APROVACAO: 30, ERRO: 0 };
  return (status[String(item.STATUS || '').toUpperCase()] || 10) + String(item.RESULTADO_JSON || '').length + (item.COMUNIDADE_POST_URL ? 100 : 0) + (item.CIRCLE_POST_URL ? 100 : 0);
}
function reparoV4PontuarEntrega_(item) {
  const status = { PUBLICADA: 90, ENTREGUE: 80, REALIZADA: 70, AGENDADA: 60, PENDENTE_EVIDENCIA: 50, ATRASADA: 40, PREVISTA: 30 };
  return (status[String(item.STATUS || '').toUpperCase()] || 0) + ['ID_REUNIAO','ID_AUDITORIA','ID_FORMALIZACAO','LINK_DOCUMENTO','LINK_CIRCLE'].reduce((soma, campo) => soma + (String(item[campo] || '').trim() ? 20 : 0), 0);
}
function reparoV4Periodo_(valor) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (!isNaN(data.getTime())) return Utilities.formatDate(data, 'America/Sao_Paulo', 'yyyy-MM');
  return String(valor || '').slice(0, 7);
}

function reparoV3MesclarCadastroCanonico_(aba, clientes, idCanonico) {
  if (!aba || aba.getLastRow() < 2) return;
  const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const colunaId = cabecalhos.indexOf('ID_CLIENTE');
  const ids = aba.getRange(2, colunaId + 1, aba.getLastRow() - 1, 1).getDisplayValues();
  const posicao = ids.findIndex(linha => String(linha[0]) === String(idCanonico));
  if (posicao < 0) throw new Error('O cliente canônico não foi localizado para mesclagem.');
  const numeroLinha = posicao + 2;
  const linhaCanonica = aba.getRange(numeroLinha, 1, 1, cabecalhos.length).getValues()[0];
  cabecalhos.forEach((cabecalho, indice) => {
    if (!cabecalho || cabecalho === 'ID_CLIENTE' || cabecalho === 'CRIADO_EM') return;
    if (String(linhaCanonica[indice] || '').trim()) return;
    const fonte = clientes.find(item => String(item[cabecalho] || '').trim());
    if (fonte) linhaCanonica[indice] = fonte[cabecalho];
  });
  const indiceAtualizado = cabecalhos.indexOf('ATUALIZADO_EM');
  if (indiceAtualizado >= 0) linhaCanonica[indiceAtualizado] = new Date();
  aba.getRange(numeroLinha, 1, 1, cabecalhos.length).setValues([linhaCanonica]);
}

function reparoV3InteracaoLegada_(item) {
  const m = String(item.STATUS_TRANSCRICAO || '').trim();
  const n = String(item.STATUS_AUDITORIA || '').trim().toUpperCase();
  const o = String(item.IMPORTADO_EM || '').trim().toUpperCase();
  const mJson = /^\s*[\[{]/.test(m);
  const oPareceStatus = ['NAO_AUDITADA', 'PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'ERRO'].includes(o);
  const nPareceStatusTrans = ['PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'ERRO'].includes(n);
  return mJson || (oPareceStatus && nPareceStatusTrans);
}

function reparoV3StatusTranscricao_(m, n) {
  const atual = String(m || '').trim().toUpperCase();
  if (['PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'ERRO'].includes(atual)) return atual;
  const legado = String(n || '').trim().toUpperCase();
  return ['PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'ERRO'].includes(legado) ? legado : 'PENDENTE';
}

function reparoV3StatusAuditoria_(o) {
  const status = String(o || '').trim().toUpperCase();
  return ['NAO_AUDITADA', 'PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'ERRO'].includes(status) ? status : 'NAO_AUDITADA';
}

function reparoV3Convidados_(valor) {
  const texto = String(valor || '').trim();
  if (!/^\s*\[/.test(texto)) return '';
  try {
    const itens = JSON.parse(texto);
    if (!Array.isArray(itens)) return '';
    return itens.map(item => String(item.name || item.email || '').trim()).filter(Boolean).join(', ');
  } catch (erro) {
    return '';
  }
}

function reparoV3EscolherCanonico_(ids) {
  const referencias = ['PITCHES', 'INTEGRACOES_CLIENTES', 'INTERACOES', 'AUDITORIAS', 'RESUMO_TAREFAS_RD'];
  const pontos = {};
  ids.forEach(id => { pontos[id] = 0; });
  referencias.forEach(nome => {
    reparoV3Ler_(nome).forEach(item => {
      const id = String(item.ID_CLIENTE || '');
      if (Object.prototype.hasOwnProperty.call(pontos, id)) pontos[id]++;
    });
  });
  return ids.slice().sort((a, b) => pontos[b] - pontos[a] || String(a).localeCompare(String(b)))[0];
}

function reparoV3BackupAba_(ss, aba, prefixo) {
  const data = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd_HHmmss');
  let nome = (prefixo + '_' + data).slice(0, 95);
  let contador = 1;
  while (ss.getSheetByName(nome)) nome = (prefixo + '_' + data + '_' + contador++).slice(0, 99);
  const copia = aba.copyTo(ss).setName(nome);
  copia.setTabColor('#fbbc04');
  return copia;
}

function reparoV3Planilha_() {
  if (typeof APP === 'undefined' || !APP.spreadsheetId) throw new Error('APP.spreadsheetId não encontrado.');
  return SpreadsheetApp.openById(APP.spreadsheetId);
}

function reparoV3Ler_(nomeAba) {
  const aba = reparoV3Planilha_().getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return [];
  const dados = aba.getRange(1, 1, aba.getLastRow(), aba.getLastColumn()).getValues();
  const cabecalhos = dados.shift().map(String);
  return dados.map(linha => reparoV3ObjetoLinha_(cabecalhos, linha));
}

function reparoV3ObjetoLinha_(cabecalhos, linha) {
  const obj = {};
  cabecalhos.forEach((cabecalho, indice) => { if (cabecalho) obj[cabecalho] = linha[indice]; });
  return obj;
}

function reparoV3Indices_(cabecalhos) {
  const indices = {};
  cabecalhos.forEach((cabecalho, indice) => { if (cabecalho) indices[cabecalho] = indice; });
  ['LEAD', 'STATUS_TRANSCRICAO', 'STATUS_AUDITORIA', 'IMPORTADO_EM', 'ATUALIZADO_EM'].forEach(campo => {
    if (indices[campo] === undefined) throw new Error('Cabeçalho obrigatório ausente em INTERACOES: ' + campo);
  });
  return indices;
}

function reparoV3Normalizar_(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function reparoV3DataValida_(valor) {
  if (valor instanceof Date) return !isNaN(valor.getTime());
  const data = new Date(valor);
  return !isNaN(data.getTime());
}

function reparoV3TipoValorM_(valor) {
  const texto = String(valor || '').trim();
  if (/^\s*\[/.test(texto)) return 'JSON_CONVIDADOS_LEGADO';
  return texto || 'VAZIO';
}
