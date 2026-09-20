/**
 * QA temporário: teste controlado de ponta a ponta da Auditoria V5.
 * Cria somente dados sintéticos e remove tudo ao final.
 */
function EXECUTAR_TESTE_CONTROLADO_AUDITORIA_V5() {
  const tag = 'QA-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  const agora = new Date();
  const ids = {
    cliente: 'CLI-' + tag,
    pitch: 'PIT-' + tag,
    modelo: 'MOD-' + tag,
    interacao: 'INT-' + tag,
    transcricao: 'TRA-' + tag,
    auditoria: ''
  };
  let docId = '';
  const resultadoTeste = {
    tag: tag,
    iniciouEm: agora.toISOString(),
    sucesso: false,
    etapas: {}
  };

  try {
    if (typeof INSTALAR_AUDITORIA_V3 === 'function') INSTALAR_AUDITORIA_V3();
    if (typeof audRdEstr_ === 'function') audRdEstr_();

    const pitchTexto = [
      'Oi [lead], aqui é a Ana, eu sou especialista em sistemas de gestão para fábricas aqui da Empresa Teste.',
      'Posso tomar 3 minutos do seu tempo?',
      'Antes de te contar um pouco mais, eu preciso confirmar algumas perguntas para direcionar você para a solução mais adequada.',
      'Qual é o segmento da sua empresa?',
      'Quantos colaboradores vocês têm hoje?',
      'O projeto envolve pelo menos 10 usuários?',
      'O que motivou vocês a buscar um novo sistema agora?',
      'Com base nisso, o próximo passo é uma reunião com nosso consultor técnico.',
      'Tenho terça-feira às 10h ou quarta-feira às 15h. Qual horário funciona melhor?'
    ].join('\n');

    const transcricaoTexto = [
      'SDR: Oi Carlos, aqui é a Ana, eu sou especialista em sistemas de gestão para fábricas aqui da Empresa Teste.',
      'LEAD: Oi Ana, tudo bem?',
      'SDR: Posso tomar 3 minutos do seu tempo?',
      'LEAD: Pode sim.',
      'SDR: Antes de te contar um pouco mais, eu preciso confirmar algumas perguntas para direcionar você para a solução mais adequada.',
      'SDR: Qual é o segmento da sua empresa?',
      'LEAD: Somos uma indústria metalúrgica.',
      'SDR: Quantos colaboradores vocês têm hoje?',
      'LEAD: Aproximadamente 180 colaboradores.',
      'SDR: O projeto envolve pelo menos 10 usuários?',
      'LEAD: Sim, estimamos 25 usuários.',
      'SDR: O que motivou vocês a buscar um novo sistema agora?',
      'LEAD: Nosso ERP atual não acompanha o crescimento e temos muito retrabalho no PCP.',
      'SDR: Com base nisso, o próximo passo é uma reunião com nosso consultor técnico.',
      'SDR: Tenho terça-feira às 10h ou quarta-feira às 15h. Qual horário funciona melhor?',
      'LEAD: Terça-feira às 10h funciona.',
      'SDR: Perfeito, vou deixar a reunião agendada para terça-feira às 10h.',
      'LEAD: Combinado.'
    ].join('\n');

    audV3Adicionar_('CLIENTES', {
      ID_CLIENTE: ids.cliente,
      NOME_CLIENTE: '[QA] Cliente Auditoria Automática',
      TIPO_OPERACAO: 'INBOUND',
      PRODUTO_SERVICO: 'Sistema de gestão industrial',
      REGRAS_CLIENTE: 'Registro sintético criado exclusivamente para teste controlado.',
      STATUS: 'ATIVO',
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora
    });

    audV3Adicionar_('PITCHES', {
      ID_PITCH: ids.pitch,
      ID_CLIENTE: ids.cliente,
      TIPO_PITCH: 'SDR',
      NOME_VERSAO: '[QA] Pitch SDR E2E',
      NUMERO_VERSAO: '1',
      CONTEUDO_PITCH: pitchTexto,
      PITCH_ATUAL: 'SIM',
      STATUS: 'ATIVO',
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora
    });

    audV3Adicionar_('MODELOS_AUDITORIA', {
      ID_MODELO: ids.modelo,
      NOME_MODELO: '[QA] Modelo SDR V5',
      ID_CLIENTE: ids.cliente,
      TIPO_AUDITORIA: 'SDR',
      PROMPT_AUDITORIA: audV3PromptSistemaSdr_(),
      CRITERIOS_JSON: JSON.stringify(audV3CriteriosSdr_()),
      VERSAO_MODELO: '5.0.0-QA',
      STATUS: 'ATIVO',
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora
    });

    audV3Adicionar_('INTERACOES', {
      ID_INTERACAO: ids.interacao,
      FONTE: 'QA_CONTROLADO',
      ID_EXTERNO: tag,
      TIPO_INTERACAO: 'LIGACAO',
      ID_CLIENTE: ids.cliente,
      TITULO: '[QA] Ligação sintética de validação automática',
      OPORTUNIDADE: '[QA] Oportunidade sintética',
      LEAD: 'Carlos QA',
      VENDEDOR: 'Ana QA',
      COLABORADOR: 'Ana QA',
      FUNCAO: 'SDR',
      DATA_INTERACAO: agora,
      STATUS_TRANSCRICAO: 'CONCLUIDA',
      STATUS_AUDITORIA: 'NAO_AUDITADA',
      LINK_CRM: '',
      URL_GRAVACAO: '',
      IMPORTADO_EM: agora,
      ATUALIZADO_EM: agora,
      SCHEMA_VERSAO: AUDITORIA_V3.versao
    });

    audV3Adicionar_('TRANSCRICOES', {
      ID_TRANSCRICAO: ids.transcricao,
      ID_INTERACAO: ids.interacao,
      FONTE: 'QA_CONTROLADO',
      IDIOMA: 'pt-BR',
      CONTEUDO: transcricaoTexto,
      TAMANHO_CARACTERES: transcricaoTexto.length,
      STATUS: 'CONCLUIDA',
      ERRO: '',
      IMPORTADO_EM: agora,
      ATUALIZADO_EM: agora
    });

    resultadoTeste.etapas.dadosSinteticos = true;

    const resposta = executarAuditoriaV3({
      idCliente: ids.cliente,
      idPitch: ids.pitch,
      idInteracao: ids.interacao,
      idModelo: ids.modelo,
      tipoAuditoria: 'SDR',
      nomeSdr: 'Ana QA',
      evitarDuplicidade: false
    });

    const auditorias = audV3Ler_('AUDITORIAS')
      .filter(function(item) { return String(item.ID_INTERACAO || '') === ids.interacao; })
      .sort(function(a, b) { return String(a.SOLICITADO_EM || '').localeCompare(String(b.SOLICITADO_EM || '')); });
    const auditoria = auditorias[auditorias.length - 1];
    if (!auditoria) throw new Error('O fluxo não criou a auditoria sintética.');
    ids.auditoria = String(auditoria.ID_AUDITORIA || '');
    docId = String(auditoria.ID_DOCUMENTO || '');

    resultadoTeste.etapas.geracao = Boolean(resposta && resposta.sucesso);
    resultadoTeste.etapas.validacao = String(auditoria.VALIDACAO_STATUS || '').toUpperCase();
    resultadoTeste.etapas.aprovacao = String(auditoria.STATUS || '').toUpperCase();
    resultadoTeste.etapas.automacao = String(auditoria.AUTOMACAO_STATUS || '').toUpperCase();
    resultadoTeste.etapas.rd = String(auditoria.RD_STATUS || '').toUpperCase();
    resultadoTeste.etapas.hashFonte = Boolean(String(auditoria.HASH_FONTE || '').trim());
    resultadoTeste.etapas.modeloIa = String(auditoria.MODELO_IA || '');
    resultadoTeste.etapas.score = auditoria.SCORE;
    resultadoTeste.etapas.scorePercentual = auditoria.SCORE_PERCENTUAL;
    resultadoTeste.etapas.documentoCriado = Boolean(docId && String(auditoria.LINK_DOCUMENTO || '').trim());
    resultadoTeste.etapas.documentoUrl = String(auditoria.LINK_DOCUMENTO || '');

    if (resultadoTeste.etapas.validacao !== 'VALIDADA') {
      throw new Error('A auditoria não terminou VALIDADA: ' + resultadoTeste.etapas.validacao);
    }
    if (resultadoTeste.etapas.aprovacao !== 'APROVADA') {
      throw new Error('A auditoria não terminou APROVADA: ' + resultadoTeste.etapas.aprovacao);
    }
    if (!['CONCLUIDA', 'CONCLUIDA_AGUARDANDO_RD'].includes(resultadoTeste.etapas.automacao)) {
      throw new Error('Status inesperado da automação: ' + resultadoTeste.etapas.automacao);
    }
    if (resultadoTeste.etapas.rd !== 'AGUARDANDO_VINCULO') {
      throw new Error('O RD deveria ficar AGUARDANDO_VINCULO no teste controlado, mas ficou: ' + resultadoTeste.etapas.rd);
    }
    if (!resultadoTeste.etapas.hashFonte) throw new Error('HASH_FONTE não foi gravado.');
    if (!resultadoTeste.etapas.modeloIa) throw new Error('MODELO_IA não foi gravado.');
    if (!resultadoTeste.etapas.documentoCriado) throw new Error('Google Docs não foi criado automaticamente.');

    const doc = DocumentApp.openById(docId);
    const textoDoc = doc.getBody().getText();
    resultadoTeste.etapas.documentoTemResultado = textoDoc.indexOf('Resultado da Auditoria') >= 0;
    resultadoTeste.etapas.documentoTemChecklist = textoDoc.indexOf('Checklist') >= 0;
    resultadoTeste.etapas.documentoTemConclusao = textoDoc.indexOf('Conclusão') >= 0;
    if (!resultadoTeste.etapas.documentoTemResultado ||
        !resultadoTeste.etapas.documentoTemChecklist ||
        !resultadoTeste.etapas.documentoTemConclusao) {
      throw new Error('O documento criado não contém todas as seções esperadas.');
    }

    resultadoTeste.sucesso = true;
    resultadoTeste.mensagem = 'Teste E2E concluído: auditoria validada/aprovada, Doc criado e RD aguardando vínculo, sem publicação real.';
    return resultadoTeste;
  } catch (erro) {
    resultadoTeste.sucesso = false;
    resultadoTeste.erro = String(erro && erro.message ? erro.message : erro);
    throw new Error('QA_E2E_FALHOU|' + JSON.stringify(resultadoTeste));
  } finally {
    try {
      if (docId) DriveApp.getFileById(docId).setTrashed(true);
    } catch (erroDoc) {
      resultadoTeste.limpezaDocumentoErro = String(erroDoc && erroDoc.message ? erroDoc.message : erroDoc);
    }

    qaAuditoriaRemoverLinha_('AUDITORIAS', 'ID_AUDITORIA', ids.auditoria);
    qaAuditoriaRemoverLinha_('TRANSCRICOES', 'ID_TRANSCRICAO', ids.transcricao);
    qaAuditoriaRemoverLinha_('INTERACOES', 'ID_INTERACAO', ids.interacao);
    qaAuditoriaRemoverLinha_('MODELOS_AUDITORIA', 'ID_MODELO', ids.modelo);
    qaAuditoriaRemoverLinha_('PITCHES', 'ID_PITCH', ids.pitch);
    qaAuditoriaRemoverLinha_('CLIENTES', 'ID_CLIENTE', ids.cliente);
  }
}

function qaAuditoriaRemoverLinha_(nomeAba, campo, valor) {
  if (!valor) return false;
  const aba = audV3Planilha_().getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return false;
  const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const indiceCampo = cabecalhos.indexOf(campo);
  if (indiceCampo < 0) return false;
  const valores = aba.getRange(2, indiceCampo + 1, aba.getLastRow() - 1, 1).getDisplayValues();
  for (let i = valores.length - 1; i >= 0; i--) {
    if (String(valores[i][0] || '') === String(valor || '')) {
      aba.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}
