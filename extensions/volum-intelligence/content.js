(() => {
  const extract = () => {
    const match = location.href.match(/\/app\/deals\/([0-9a-f]{24})(?:[/?#]|$)/i);
    if (match) chrome.runtime.sendMessage({ type: 'VOLUM_DEAL_ID', url: location.href });
  };
  extract();
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; extract(); }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();