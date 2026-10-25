const endpoint = document.getElementById('endpoint');
const state = document.getElementById('state');
chrome.storage.local.get('volumEndpoint').then(({ volumEndpoint }) => { endpoint.value = volumEndpoint || ''; });
document.getElementById('save').addEventListener('click', async () => {
  const value = endpoint.value.trim();
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/script\.google\.com$/i.test(url.hostname)) throw new Error('URL inválida');
    await chrome.storage.local.set({ volumEndpoint: value });
    state.textContent = 'Salvo neste navegador.';
  } catch (_) { state.textContent = 'Use a URL HTTPS da Web App privada do Apps Script.'; }
});