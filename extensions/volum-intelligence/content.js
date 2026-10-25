(() => {
  const dealPattern = /\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i;
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
  addButton();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; }
    addButton();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();