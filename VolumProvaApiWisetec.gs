/**
 * Prova minima da API RD Station CRM, sem alterar o CRM nem o Board.
 *
 * Executar apenas pelo editor autenticado do Apps Script:
 * VOLUM_PROVA_API_RD_WISETEC()
 *
 * Depende das funcoes existentes no Board:
 *   obterIntegracaoCliente_, obterSegredo_, requisicaoJson_, APP.
 * O resultado sao contagens e marcadores, nunca texto comercial ou token.
 */
function VOLUM_PROVA_API_RD_WISETEC() {
  const idCliente = 'CLI-20260803131300-C4455D17';
  const dealId = '6acc888b98976f0023dc583f';

  const integracao = obterIntegracaoCliente_(idCliente, 'RD_STATION');
  if (!integracao || String(integracao.ATIVO || '').toUpperCase() !== 'SIM') {
    throw new Error('Integracao RD da Wisetec nao esta ativa no cadastro.');
  }

  const token = obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO);
  if (!token) {
    throw new Error('Credencial RD nao encontrada nas propriedades protegidas.');
  }

  function getRd_(caminho, parametros) {
    const query = Object.keys(parametros || {}).concat(['token']).map(function(k) {
      const v = k === 'token' ? token : parametros[k];
      return encodeURIComponent(k) + '=' + encodeURIComponent(v);
    }).join('&');
    try {
      return requisicaoJson_(APP.rdBaseUrl + caminho + '?' + query, {
        method: 'get', headers: { Accept: 'application/json' }
      });
    } catch (e) {
      // Nao retornar URL, corpo remoto nem outros dados potencialmente privados.
      const m = String((e || {}).message || '').match(/HTTP\s+(\d{3})/);
      throw new Error('RD indisponivel para consulta ' + caminho +
        ' (' + (m ? 'HTTP ' + m[1] : 'falha de acesso') + ').');
    }
  }

  function listar_(caminho, campo, filtro) {
    const itens = [];
    let completo = false;
    for (let pagina = 1; pagina <= 5; pagina++) {
      const r = getRd_(caminho, Object.assign({
        deal_id: dealId, page: pagina, limit: 200
      }, filtro || {}));
      if (!r || !Array.isArray(r[campo])) {
        throw new Error('Resposta inesperada de ' + caminho + ': lista ausente.');
      }
      const paginaItens = r[campo];
      paginaItens.forEach(function(item) {
        if (String(item.deal_id || (item.deal || {}).id || '').toLowerCase() === dealId) {
          itens.push(item);
        }
      });
      const haMais = typeof r.has_more === 'boolean' ?
        r.has_more : paginaItens.length === 200;
      if (!haMais) { completo = true; break; }
    }
    return { itens: itens, completo: completo };
  }

  const deal = getRd_('/deals/' + dealId, {});
  const negociacao = deal && deal.deal ? deal.deal : deal;
  if (String((negociacao || {}).id || (negociacao || {})._id || '') !== dealId) {
    throw new Error('RD nao confirmou a identidade da negociacao.');
  }

  const anotacoes = listar_('/activities', 'activities', { type: 'note' });
  const tarefas = listar_('/tasks', 'tasks');
  const contar = function(items, campo, re) {
    return items.filter(function(item) {
      return re.test(String(item[campo] || ''));
    }).length;
  };
  const resumo = {
    sucesso: true,
    modo: 'SOMENTE_LEITURA',
    negociacaoEncontrada: true,
    anotacoes: anotacoes.itens.length,
    anotacoesComTexto: anotacoes.itens.filter(function(n) {
      return Boolean(String(n.text || '').trim());
    }).length,
    anotacoesCompletas: anotacoes.completo,
    tarefas: tarefas.itens.length,
    tarefasConcluidas: tarefas.itens.filter(function(t) { return t.done === true; }).length,
    tarefasCompletas: tarefas.completo,
    sinais: {
      desmarcouOuReagendou: contar(anotacoes.itens, 'text', /desmarc|cancel|reagend/i),
      naoAtendeu: contar(anotacoes.itens, 'text', /n[aã]o atendeu|n[aã]o atende/i),
      recoveryDia1Ligacao3: contar(tarefas.itens, 'subject', /recovery\s*dia\s*1\s*liga(?:ç|c)[aã]o\s*3/i)
    }
  };
  console.log(JSON.stringify(resumo));
  return resumo;
}
