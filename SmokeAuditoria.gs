/**
 * Smoke test controlado do pipeline de auditoria.
 *
 * Cria dados sintéticos, executa o mesmo fluxo de produção
 * (Gemini -> validação -> score -> aprovação -> Google Docs -> gate do RD)
 * e remove todos os registros/arquivo ao final.
 *
 * Não usa lead real e não possui vínculo com negociação do RD.
 */
function TESTE_SMOKE_AUDITORIA_AUTOMATICA() {
  const token = Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
  const agora = new Date();
  const idCliente = 'CLI-SMOKE-' + token;
  const idPitch = 'PIT-SMOKE-' + token;
  const idInteracao = 'INT-SMOKE-' + token;
  const idTranscricao = 'TRA-SMOKE-' + token;
  let idAuditoria = '';
  let idDocumento = '';
  let resultadoTeste = null;
  const errosLimpeza = [];

  const pitch = [
    'INTRODUÇÃO: Oi Bruno, aqui é Ana da Empresa Teste. Você pediu contato pelo nosso site. Sei que seu dia é corrido e vou precisar de só três minutos.',
    'PRIMEIRA FRASE DE QUALIFICAÇÃO: Antes de te contar sobre a solução, preciso confirmar algumas informações para direcionar a conversa.',
    'PERGUNTA DE SEGMENTO: Qual é o segmento da sua empresa?',
    'MOTIVO DO CONTATO: O que motivou seu contato hoje?',
    'VALIDAÇÃO DE LMV: Quantas pessoas trabalham na empresa?',
    'TRILHA LMV POSITIVO: Com mais de 10 colaboradores, faz sentido avançarmos para uma reunião com nosso especialista.',
    'MANEJO DE OBJEÇÃO: Entendo. A reunião dura 30 minutos e serve para avaliar se a solução faz sentido para sua operação.',
    'VALORIZAÇÃO DA REUNIÃO: Na reunião, nosso especialista vai entender seu cenário e mostrar a solução aplicada à sua necessidade.',
    'DUPLA ESCOLHA DE HORÁRIOS: Prefere terça às 10h ou quarta às 15h?',
    'CADÊNCIA DE NO-SHOW: Eu vou falar com você antes da reunião para confirmar se está tudo certo.',
    'ENCERRAMENTO PROFISSIONAL: Perfeito, ficou combinado terça às 10h. Obrigada pelo seu tempo e até a reunião.'
  ].join('\n');

  const transcricao = [
    'SDR Ana: Oi Bruno, aqui é Ana da Empresa Teste. Você pediu contato pelo nosso site. Sei que seu dia é corrido e vou precisar de só três minutos.',
    'Lead Bruno: Tudo bem, pode falar.',
    'SDR Ana: Antes de te contar sobre a solução, preciso confirmar algumas informações para direcionar a conversa.',
    'SDR Ana: Qual é o segmento da sua empresa?',
    'Lead Bruno: Somos uma indústria de móveis corporativos.',
    'SDR Ana: O que motivou seu contato hoje?',
    'Lead Bruno: Quero substituir nossas planilhas e melhorar o controle da operação.',
    'SDR Ana: Quantas pessoas trabalham na empresa?',
    'Lead Bruno: Temos 35 colaboradores.',
    'SDR Ana: Com mais de 10 colaboradores, faz sentido avançarmos para uma reunião com nosso especialista.',
    'Lead Bruno: Tenho pouco tempo e não sei se vale marcar uma reunião.',
    'SDR Ana: Entendo. A reunião dura 30 minutos e serve para avaliar se a solução faz sentido para sua operação.',
    'SDR Ana: Na reunião, nosso especialista vai entender seu cenário e mostrar a solução aplicada à sua necessidade.',
    'SDR Ana: Prefere terça às 10h ou quarta às 15h?',
    'Lead Bruno: Terça às 10h.',
    'SDR Ana: Eu vou falar com você antes da reunião para confirmar se está tudo certo.',
    'SDR Ana: Perfeito, ficou combinado terça às 10h. Obrigada pelo seu tempo e até a reunião.'
  ].join('\n');

  try {
    audV3Adicionar_('CLIENTES', {
      ID_CLIENTE: idCliente,
      NOME_CLIENTE: '[SMOKE TEST] Cliente Sintético',
      STATUS: 'ATIVO',
      REGRAS_CLIENTE: '',
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora
    });

    audV3Adicionar_('PITCHES', {
      ID_PITCH: idPitch,
      ID_CLIENTE: idCliente,
      TIPO_PITCH: 'SDR',
      NOME_VERSAO: '[SMOKE TEST] Pitch SDR',
      NUMERO_VERSAO: '1',
      CONTEUDO_PITCH: pitch,
      STATUS: 'ATIVO',
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora
    });

    audV3Adicionar_('INTERACOES', {
      ID_INTERACAO: idInteracao,
      ID_CLIENTE: idCliente,
      FONTE: 'SMOKE_TEST',
      ID_EXTERNO: 'SMOKE-' + token,
      TIPO_INTERACAO: 'LIGACAO',
      TITULO: '[SMOKE TEST] Empresa Teste - Bruno',
      NOME_ARQUIVO_ORIGEM: 'Empresa Teste-01-Ana.mp3',
      EMPRESA_ARQUIVO: 'Empresa Teste',
      NUMERO_CHAMADA: '01',
      COLABORADOR: 'Ana',
      VENDEDOR: 'Ana',
      LEAD: 'Bruno',
      FUNCAO: 'SDR',
      DATA_INTERACAO: agora,
      DURACAO_SEGUNDOS: 240,
      STATUS_TRANSCRICAO: 'CONCLUIDA',
      STATUS_AUDITORIA: 'NAO_AUDITADA',
      LINK_CRM: '',
      URL_GRAVACAO: '',
      IMPORTADO_EM: agora,
      ATUALIZADO_EM: agora,
      SCHEMA_VERSAO: AUDITORIA_V3.versao
    });

    audV3Adicionar_('TRANSCRICOES', {
      ID_TRANSCRICAO: idTranscricao,
      ID_INTERACAO: idInteracao,
      FONTE: 'SMOKE_TEST',
      IDIOMA: 'pt-BR',
      CONTEUDO: transcricao,
      TAMANHO_CARACTERES: transcricao.length,
      STATUS: 'CONCLUIDA',
      ERRO: '',
      IMPORTADO_EM: agora,
      ATUALIZADO_EM: agora
    });

    const resposta = executarAuditoriaV3({
      idCliente: idCliente,
      tipoAuditoria: 'SDR',
      idPitch: idPitch,
      idModelo: AUDITORIA_V3.modeloPadrao,
      idInteracao: idInteracao,
      nomeSdr: 'Ana',
      nomeLead: 'Bruno',
      nomeArquivoOrigem: 'Empresa Teste-01-Ana.mp3',
      evitarDuplicidade: false
    });

    const auditoriaFront = (resposta || {}).auditoria || {};
    idAuditoria = String(auditoriaFront.idAuditoria || '');
    const registro = idAuditoria
      ? audV3Localizar_('AUDITORIAS', 'ID_AUDITORIA', idAuditoria)
      : audV3Ler_('AUDITORIAS').filter(function(item) {
          return String(item.ID_INTERACAO || '') === idInteracao;
        }).slice(-1)[0];

    if (!registro) throw new Error('Smoke test: auditoria não foi persistida.');
    idAuditoria = String(registro.ID_AUDITORIA || idAuditoria);
    idDocumento = String(registro.ID_DOCUMENTO || '');

    const status = String(registro.STATUS || '').toUpperCase();
    const validacao = String(registro.VALIDACAO_STATUS || '').toUpperCase();
    const automacao = String(registro.AUTOMACAO_STATUS || '').toUpperCase();
    const rdStatus = String(registro.RD_STATUS || '').toUpperCase();
    const modeloIa = String(registro.MODELO_IA || '');
    const hashFonte = String(registro.HASH_FONTE || '');
    const resultadoJson = audV3ParseJson_(registro.RESULTADO_JSON || '{}', 'Smoke test: RESULTADO_JSON inválido.');

    if (status !== 'APROVADA') throw new Error('Smoke test: status final esperado APROVADA, recebido ' + status + '.');
    if (validacao !== 'VALIDADA') throw new Error('Smoke test: validação esperada VALIDADA, recebida ' + validacao + '.');
    if (automacao !== 'CONCLUIDA_AGUARDANDO_RD') throw new Error('Smoke test: automação esperada CONCLUIDA_AGUARDANDO_RD, recebida ' + automacao + '.');
    if (rdStatus !== 'AGUARDANDO_VINCULO') throw new Error('Smoke test: RD deveria aguardar vínculo, recebido ' + rdStatus + '.');
    if (!idDocumento) throw new Error('Smoke test: Google Docs não foi criado.');
    if (!modeloIa) throw new Error('Smoke test: modelo de IA usado não foi registrado.');
    if (!hashFonte || hashFonte.length < 32) throw new Error('Smoke test: hash da fonte não foi registrado.');

    const arquivoDoc = DriveApp.getFileById(idDocumento);
    if (!arquivoDoc || arquivoDoc.isTrashed()) throw new Error('Smoke test: documento criado não está acessível.');
    const documento = DocumentApp.openById(idDocumento);
    const textoDocumento = documento.getBody().getText();
    ['Resultado da Auditoria', 'Checklist de Adesão ao Script', 'Conclusão'].forEach(function(secao) {
      if (textoDocumento.indexOf(secao) < 0) {
        throw new Error('Smoke test: seção obrigatória ausente no Google Docs: ' + secao + '.');
      }
    });

    const score = resultadoJson && resultadoJson.pontuacao_calculada
      ? resultadoJson.pontuacao_calculada.score_5
      : registro.SCORE;

    if (score === null || score === '' || !isFinite(Number(score)) || Number(score) < 0 || Number(score) > 5) {
      throw new Error('Smoke test: score final inválido: ' + score + '.');
    }

    resultadoTeste = {
      sucesso: true,
      tipo: 'SDR',
      status: status,
      validacaoStatus: validacao,
      automacaoStatus: automacao,
      rdStatus: rdStatus,
      score: score,
      modeloIa: modeloIa,
      hashFonteRegistrado: true,
      documentoCriado: true,
      documentoEstruturaValidada: true,
      registrosSinteticos: {
        cliente: idCliente,
        pitch: idPitch,
        interacao: idInteracao,
        transcricao: idTranscricao,
        auditoria: idAuditoria
      }
    };
  } finally {
    try {
      const auditoriasTeste = audV3Ler_('AUDITORIAS').filter(function(item) {
        return String(item.ID_INTERACAO || '') === idInteracao ||
          (idAuditoria && String(item.ID_AUDITORIA || '') === idAuditoria);
      });
      auditoriasTeste.forEach(function(item) {
        const docId = String(item.ID_DOCUMENTO || '');
        if (docId) {
          try {
            DriveApp.getFileById(docId).setTrashed(true);
          } catch (erroDoc) {
            errosLimpeza.push('Doc ' + docId + ': ' + (erroDoc.message || erroDoc));
          }
        }
        smokeAuditoriaExcluirLinhas_('AUDITORIAS', 'ID_AUDITORIA', item.ID_AUDITORIA);
      });
    } catch (erroAuditoria) {
      errosLimpeza.push('AUDITORIAS: ' + (erroAuditoria.message || erroAuditoria));
    }

    [
      ['TRANSCRICOES', 'ID_TRANSCRICAO', idTranscricao],
      ['INTERACOES', 'ID_INTERACAO', idInteracao],
      ['PITCHES', 'ID_PITCH', idPitch],
      ['CLIENTES', 'ID_CLIENTE', idCliente]
    ].forEach(function(alvo) {
      try {
        smokeAuditoriaExcluirLinhas_(alvo[0], alvo[1], alvo[2]);
      } catch (erroLimpeza) {
        errosLimpeza.push(alvo[0] + ': ' + (erroLimpeza.message || erroLimpeza));
      }
    });
  }

  if (errosLimpeza.length) {
    throw new Error('Smoke test executou, mas a limpeza falhou: ' + errosLimpeza.join(' | '));
  }
  if (!resultadoTeste || !resultadoTeste.sucesso) {
    throw new Error('Smoke test não produziu resultado final válido.');
  }

  resultadoTeste.limpezaConcluida = true;
  resultadoTeste.documentoEnviadoParaLixeira = true;
  console.log(JSON.stringify(resultadoTeste));
  return resultadoTeste;
}

function smokeAuditoriaExcluirLinhas_(nomeAba, campo, valor) {
  if (!valor) return 0;
  const aba = audV3Planilha_().getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return 0;
  const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
  const indice = cabecalhos.indexOf(campo);
  if (indice < 0) return 0;
  const valores = aba.getRange(2, indice + 1, aba.getLastRow() - 1, 1).getDisplayValues();
  const linhas = [];
  valores.forEach(function(linha, posicao) {
    if (String(linha[0]) === String(valor)) linhas.push(posicao + 2);
  });
  linhas.sort(function(a, b) { return b - a; }).forEach(function(numeroLinha) {
    aba.deleteRow(numeroLinha);
  });
  return linhas.length;
}
