(() => {
  const dealPattern = /\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;
  const HISTORY_LIMIT = 30;
  const INLINE_ID = 'volum-intelligence-inline-shell';
  const extract = () => {
    const match = location.href.match(dealPattern);
    if (match) chrome.runtime.sendMessage({ type: 'VOLUM_DEAL_ID', url: location.href });
    return Boolean(match);
  };
  const addButton = () => {
    if (!extract() || document.getElementById('volum-intelligence-trigger')) return;
    const button = document.createElement('button');
    button.id = 'volum-intelligence-trigger';
    button.type = 'button';
    button.textContent = 'VOLUM · Auditar';
    button.setAttribute('aria-label', 'Abrir auditoria VOLUM');
    button.style.cssText = [
      'position:fixed','right:18px','bottom:22px','z-index:2147483647',
      'border:0','border-radius:999px','padding:12px 16px',
      'background:#161C3D','color:#fff','font:600 13px Arial,sans-serif',
      'box-shadow:0 4px 16px rgba(0,0,0,.24)','cursor:pointer'
    ].join(';');
    button.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'VOLUM_OPEN_PANEL' }));
    document.body.appendChild(button);
  };
  const closeInline = () => {
    const host = document.getElementById(INLINE_ID);
    if (host) host.remove();
  };
  const openInline = endpoint => {
    if (!extract() || !/^https:\/\/script\.google\.com\//i.test(String(endpoint || ''))) return;
    const old = document.getElementById(INLINE_ID);
    if (old) { old.remove(); return; }
    const dealId = (location.href.match(dealPattern) || [])[1];
    const url = new URL(endpoint);
    url.searchParams.set('volum_widget', '1');
    url.searchParams.set('dealId', dealId.toLowerCase());
    const host = document.createElement('section');
    host.id = INLINE_ID;
    host.setAttribute('aria-label', 'VOLUM Intelligence');
    host.style.cssText = [
      'position:fixed','top:0','right:0','bottom:0','z-index:2147483646',
      'width:min(430px,100vw)','margin:0','padding:0','border:0','outline:0',
      'border-radius:0','box-shadow:none','background:#080911','overflow:hidden'
    ].join(';');
    const frame = document.createElement('iframe');
    frame.src = url.toString();
    frame.title = 'VOLUM Intelligence';
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.style.cssText = 'display:block;width:100%;height:100%;margin:0;padding:0;border:0;outline:0;box-shadow:none;background:transparent;';
    host.appendChild(frame);
    document.body.appendChild(host);
  };
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const dateToIso = value => {
    const match = clean(value).match(/(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+às)?\s+(\d{2}):(\d{2})/);
    if (!match) return '';
    const year = match[3].length === 2 ? '20' + match[3] : match[3];
    // O RD exibe o horário local do CRM; conservar o texto e normalizar para UTC apenas no servidor.
    return year + '-' + match[2] + '-' + match[1] + 'T' + match[4] + ':' + match[5] + ':00';
  };
  const kind = text => {
    if (/^Negociação criada/i.test(text)) return 'NEGOCIACAO_CRIADA';
    if (/fez uma anotação/i.test(text)) return 'ANOTACAO';
    if (/criou a tarefa/i.test(text)) return 'TAREFA_CRIADA';
    if (/concluiu a tarefa/i.test(text)) return 'TAREFA_CONCLUIDA';
    if (/atualizou a tarefa/i.test(text)) return 'TAREFA_ATUALIZADA';
    if (/alterou a etapa/i.test(text)) return 'ETAPA_ALTERADA';
    if (/alterou /i.test(text)) return 'ALTERACAO';
    if (/abriu um WhatsApp Web/i.test(text)) return 'WHATSAPP_ABERTO';
    if (/enviou um e-mail/i.test(text)) return 'EMAIL_ENVIADO';
    if (/respondeu um email/i.test(text)) return 'EMAIL_RESPONDIDO';
    return 'OUTRO_VISUAL_RD';
  };
  async function readHistory() {
    const dealId = (location.href.match(dealPattern) || [])[1];
    const panel = document.querySelector('#dealTabsHistory-panel');
    if (!dealId || !panel) return { dealId: dealId || '', events: [], coverage: { available: false, complete: false, reason: 'ABA_HISTORICO_NAO_ABERTA' } };
    let pages = 0;
    while (pages < HISTORY_LIMIT) {
      const more = panel.querySelector('button');
      const all = Array.from(panel.querySelectorAll('button'));
      const button = all.find(node => clean(node.textContent) === 'Ver mais');
      if (!button || button.disabled) break;
      button.click();
      pages++;
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    const cards = Array.from(panel.querySelectorAll('ul[role="list"] > li'));
    const events = cards.map((card, index) => {
      const text = clean(card.innerText);
      if (!text || /Feche até 40% mais vendas/.test(text)) return null;
      const timestamps = text.match(/\d{2}\/\d{2}\/\d{2,4}(?:\s+às)?\s+\d{2}:\d{2}/g) || [];
      const dateText = timestamps[timestamps.length - 1] || '';
      const author = clean((text.match(/^(.+?)\s+(?:fez uma anotação|criou a tarefa|concluiu a tarefa|atualizou a tarefa|alterou |abriu um WhatsApp Web|enviou um e-mail|respondeu um email)/i) || [])[1]);
      const stage = clean((text.match(/na etapa (.+?) do funil/i) || [])[1]);
      return { source: 'RD_UI_HISTORY', uiIndex: index, dateText, dataLocal: dateToIso(dateText), author, stage, kind: kind(text), detail: text.slice(0, 6000) };
    }).filter(Boolean);
    return { dealId: dealId.toLowerCase(), events, coverage: { available: true, complete: !Array.from(panel.querySelectorAll('button')).some(node => clean(node.textContent) === 'Ver mais'), pagesLoaded: pages, totalVisual: events.length, origin: 'RD_UI_HISTORY' } };
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'VOLUM_OPEN_INLINE_WIDGET') {
      openInline(message.endpoint);
      sendResponse({ opened: Boolean(document.getElementById(INLINE_ID)) });
      return;
    }
    if (message && message.type === 'VOLUM_CLOSE_INLINE_WIDGET') {
      closeInline(); sendResponse({ closed: true }); return;
    }
    if (message && message.type === 'VOLUM_READ_RD_HISTORY') {
      readHistory().then(sendResponse).catch(error => sendResponse({ dealId: '', events: [], coverage: { available: false, complete: false, reason: 'FALHA_LEITURA_UI', detail: clean(error && error.message) } }));
      return true;
    }
  });
  addButton();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; }
    addButton();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
