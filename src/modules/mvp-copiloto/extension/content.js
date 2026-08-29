/**
 * Content script da extensão "Julia AI Companion" (MVP).
 * Ponte entre a página do app Julia (window.postMessage) e o service worker,
 * que é quem fala com o ChatGPT. Nenhum token trafega para a página.
 */
const REQ = 'JULIA_COPILOT_REQ';
const RES = 'JULIA_COPILOT_RES';
const VERSION = '0.2.0';

function reply(payload) {
  try {
    window.postMessage({ source: RES, ...payload }, window.location.origin);
  } catch {
    window.postMessage({ source: RES, ...payload }, '*');
  }
}

// Marcador para diagnóstico rápido (o app não depende dele).
try {
  document.documentElement.setAttribute('data-julia-companion', VERSION);
} catch {
  /* noop */
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.source !== REQ) return;

  const { id, action, payload } = msg;

  if (action === 'PING') {
    reply({ id, type: 'PONG', version: VERSION });
    return;
  }

  if (action === 'SESSION') {
    chrome.runtime.sendMessage({ action: 'SESSION' }, (res) => {
      if (chrome.runtime.lastError) {
        reply({ id, type: 'ERROR', error: chrome.runtime.lastError.message });
        return;
      }
      reply({ id, type: 'SESSION', session: res?.session ?? null });
    });
    return;
  }

  if (action === 'ASK') {
    const port = chrome.runtime.connect({ name: 'julia-copilot-ask' });
    port.onMessage.addListener((res) => {
      if (res.type === 'DELTA') reply({ id, type: 'DELTA', text: res.text });
      else if (res.type === 'DONE') {
        reply({ id, type: 'DONE', text: res.text });
        port.disconnect();
      } else if (res.type === 'ERROR') {
        reply({ id, type: 'ERROR', error: res.error });
        port.disconnect();
      }
    });
    port.postMessage({ action: 'ASK', prompt: payload?.prompt, model: payload?.model });
  }
});
