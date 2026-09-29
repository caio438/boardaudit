/**
 * Controlled SDR batch publication helpers.
 * Selects the most recent eligible API4COM/RD calls and publishes one item per
 * independent authenticated request so a single failure never blocks the batch.
 */
function OPS_SDR_LISTAR_RECENTES_PARA_PUBLICAR(limite, somenteTranscritas) {
  const config = audV3ConfigAutomacaoLigacoes_();
  const max = Math.min(20, Math.max(1, Number(limite || 20)));
  const pitches = audV3Ler_('PITCHES');
  const transcricoes = {};
  audV3Ler_('TRANSCRICOES').forEach(function(item) {
    if (item.ID_INTERACAO && String(item.STATUS || '').toUpperCase() === 'CONCLUIDA' && String(item.CONTEUDO || '').trim().length >= 20) {
      transcricoes[String(item.ID_INTERACAO)] = item;
    }
  });
  const publicadas = {};
  audV3Ler_('AUDITORIAS').forEach(function(item) {
    if (item.ID_INTERACAO && String(item.RD_STATUS || '').toUpperCase() === 'PUBLICADA') {
      publicadas[String(item.ID_INTERACAO)] = true;
    }
  });

  const candidatas = audV3Ler_('INTERACOES').filter(function(item) {
    const id = String(item.ID_INTERACAO || '');
    const idCliente = String(item.ID_CLIENTE || '');
    return String(item.ID_EXTERNO || '').indexOf('RD_TASK_') === 0 &&
      String(item.URL_GRAVACAO || '').trim() &&
      Number(item.DURACAO_SEGUNDOS || 0) > Number(config.duracaoSegundos || 105) &&
      idCliente &&
      !publicadas[id] &&
      (!somenteTranscritas || Boolean(transcricoes[id])) &&
      Boolean(audV3PitchAtualAutomatico_(idCliente, 'SDR', pitches));
  }).sort(function(a, b) {
    const da = new Date(a.DATA_INTERACAO || a.ATUALIZADO_EM || 0).getTime() || 0;
    const db = new Date(b.DATA_INTERACAO || b.ATUALIZADO_EM || 0).getTime() || 0;
    return db - da || String(b.ID_INTERACAO || '').localeCompare(String(a.ID_INTERACAO || ''));
  }).slice(0, max);

  return {
    sucesso: true,
    limite: max,
    total: candidatas.length,
    alvos: candidatas.map(function(item) {
      const tr = transcricoes[String(item.ID_INTERACAO || '')] || null;
      return {
        idInteracao: String(item.ID_INTERACAO || ''),
        idCliente: String(item.ID_CLIENTE || ''),
        responsavel: String(item.COLABORADOR || item.VENDEDOR || ''),
        lead: String(item.LEAD || ''),
        dataInteracao: audV3DataIso_(item.DATA_INTERACAO),
        duracaoSegundos: Number(item.DURACAO_SEGUNDOS || 0),
        transcrita: Boolean(tr),
        idTranscricao: tr ? String(tr.ID_TRANSCRICAO || '') : ''
      };
    })
  };
}

function OPS_SDR_PUBLICAR_INTERACAO(idInteracao) {
  const alvo = String(idInteracao || '').trim();
  if (!alvo) throw new Error('ID da interacao SDR nao informado.');

  const interacao = audV3Localizar_('INTERACOES', 'ID_INTERACAO', alvo);
  if (!interacao) throw new Error('Interacao SDR nao encontrada: ' + alvo);
  if (String(interacao.ID_EXTERNO || '').indexOf('RD_TASK_') !== 0) {
    throw new Error('A interacao informada nao pertence ao fluxo SDR de ligacoes RD/API4COM.');
  }

  const pitch = audV3PitchAtualAutomatico_(interacao.ID_CLIENTE, 'SDR');
  if (!pitch) throw new Error('Nenhum pitch atual SDR foi definido para o cliente.');

  let transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', alvo);
  let idAlvoPublicacao = alvo;
  if (!transcricao || String(transcricao.STATUS || '').toUpperCase() !== 'CONCLUIDA' || String(transcricao.CONTEUDO || '').trim().length < 20) {
    const transcrita = transcreverAudioMp3V4({
      idCliente: String(interacao.ID_CLIENTE || ''),
      funcao: 'SDR',
      titulo: interacao.OPORTUNIDADE || interacao.TITULO || 'Ligacao concluida',
      colaborador: interacao.COLABORADOR || interacao.VENDEDOR || '',
      lead: interacao.LEAD || '',
      dataInteracao: serializarDataSomenteDia_(interacao.DATA_INTERACAO),
      urlAudio: interacao.URL_GRAVACAO
    });
    idAlvoPublicacao = String((transcrita || {}).idInteracao || alvo);
    transcricao = audV3Localizar_('TRANSCRICOES', 'ID_INTERACAO', idAlvoPublicacao);
    if (!transcricao) throw new Error('A transcricao nao foi persistida para a interacao.');
  }

  return OPS_AUDITAR_PUBLICAR_TRANSCRICAO(
    String(transcricao.ID_TRANSCRICAO || idAlvoPublicacao)
  );
}

function OPS_SDR_PUBLICAR_INTERACAO_SEGURO(idInteracao) {
  const alvo = String(idInteracao || '').trim();
  try {
    const resultado = OPS_SDR_PUBLICAR_INTERACAO(alvo);
    return {
      sucesso: true,
      classificacao: 'PUBLICADA',
      idInteracaoSolicitada: alvo,
      resultado: resultado
    };
  } catch (erro) {
    const mensagem = String(erro && erro.message ? erro.message : erro);
    let classificacao = 'ERRO_AUDITORIA';
    if (/negociacao|vincul/i.test(mensagem)) classificacao = 'AGUARDANDO_VINCULO';
    else if (/inconsistencias factuais|gate|BLOQUEAD/i.test(mensagem)) classificacao = 'REVISAO_HUMANA';
    else if (/pitch atual SDR|pitch atual/i.test(mensagem)) classificacao = 'SEM_PITCH';
    else if (/transcri|audio|grava/i.test(mensagem)) classificacao = 'ERRO_TRANSCRICAO';
    else if (/integracao RD|token do RD|responsavel.*RD|usuario VOLUM/i.test(mensagem)) classificacao = 'ERRO_RD_CONFIG';
    else if (/RD nao confirmou|publica/i.test(mensagem)) classificacao = 'ERRO_RD';

    return {
      sucesso: false,
      classificacao: classificacao,
      idInteracaoSolicitada: alvo,
      erro: mensagem
    };
  }
}
