/**
 * Service worker da extensão "Julia AI Companion" (MVP).
 *
 * v0.2.0 — mudança de estratégia:
 * O endpoint interno /backend-api/conversation exige tokens anti-bot (sentinel /
 * proof-of-work) gerados pela própria página; chamá-lo por fetch resulta em
 * 403 "Unusual activity has been detected from your device".
 * Agora a extensão automatiza a própria interface do chatgpt.com em uma aba:
 * digita o prompt, envia e lê a resposta do DOM enquanto ela é gerada.
 */
const ORIGIN = 'https://chatgpt.com';

async function getSession() {
  try {
    const res = await fetch(`${ORIGIN}/api/auth/session`, { credentials: 'include' });
    if (!res.ok) return { loggedIn: false, email: null, plan: null, hasAccessToken: false };
    const data = await res.json();
    return {
      loggedIn: !!data?.user,
      email: data?.user?.email ?? null,
      plan: data?.user?.planType ?? data?.accountPlan ?? null,
      hasAccessToken: !!data?.accessToken,
    };
  } catch {
    return { loggedIn: false, email: null, plan: null, hasAccessToken: false };
  }
}

/** Encontra (ou abre) uma aba do ChatGPT pronta para uso. */
async function ensureChatTab() {
  const tabs = await chrome.tabs.query({ url: [`${ORIGIN}/*`, 'https://chat.openai.com/*'] });
  let tab = tabs.find((t) => t.status === 'complete') || tabs[0];
  if (!tab) {
    tab = await chrome.tabs.create({ url: `${ORIGIN}/`, active: false });
  }
  // aguarda carregamento
  for (let i = 0; i < 60; i += 1) {
    const current = await chrome.tabs.get(tab.id);
    if (current.status === 'complete') return current;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('A aba do ChatGPT não terminou de carregar. Abra chatgpt.com e tente novamente.');
}

/** Roda dentro da página do chatgpt.com: digita, envia e observa a resposta. */
function driveChatGpt(prompt) {
  return new Promise((resolve, reject) => {
    const findComposer = () =>
      document.querySelector('div#prompt-textarea[contenteditable="true"]') ||
      document.querySelector('div.ProseMirror[contenteditable="true"]') ||
      document.querySelector('textarea#prompt-textarea') ||
      document.querySelector('textarea[data-testid="prompt-textarea"]');

    const composer = findComposer();
    if (!composer) {
      reject(new Error('Campo de mensagem do ChatGPT não encontrado. Abra uma conversa em chatgpt.com.'));
      return;
    }

    composer.focus();
    if (composer.tagName === 'TEXTAREA') {
      composer.value = prompt;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
    }

    const before = document.querySelectorAll('[data-message-author-role="assistant"]').length;

    setTimeout(() => {
      const sendBtn =
        document.querySelector('button[data-testid="send-button"]') ||
        document.querySelector('button#composer-submit-button');
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
      } else {
        composer.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
        );
      }

      let last = '';
      let stableSince = 0;
      const started = Date.now();

      const timer = setInterval(() => {
        const nodes = document.querySelectorAll('[data-message-author-role="assistant"]');
        const node = nodes.length > before ? nodes[nodes.length - 1] : null;
        const text = node ? (node.innerText || '').trim() : '';

        if (text && text !== last) {
          last = text;
          stableSince = Date.now();
          chrome.runtime.sendMessage({ type: 'JULIA_DELTA', text });
        }

        const generating =
          !!document.querySelector('button[data-testid="stop-button"]') ||
          !!document.querySelector('[data-testid="stop-button"]');

        if (last && !generating && stableSince && Date.now() - stableSince > 1500) {
          clearInterval(timer);
          resolve(last);
        }
        if (Date.now() - started > 180000) {
          clearInterval(timer);
          if (last) resolve(last);
          else reject(new Error('Tempo esgotado esperando a resposta do ChatGPT.'));
        }
      }, 600);
    }, 350);
  });
}

async function ask({ prompt }, onDelta) {
  const tab = await ensureChatTab();

  const relay = (msg, sender) => {
    if (msg?.type === 'JULIA_DELTA' && sender?.tab?.id === tab.id) onDelta(msg.text);
  };
  chrome.runtime.onMessage.addListener(relay);

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: driveChatGpt,
      args: [prompt],
    });
    const text = result?.result;
    if (!text) throw new Error('O ChatGPT não retornou texto. Confira a aba do ChatGPT.');
    return text;
  } finally {
    chrome.runtime.onMessage.removeListener(relay);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action === 'SESSION') {
    getSession().then((session) => sendResponse({ session }));
    return true;
  }
  return false;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'julia-copilot-ask') return;

  port.onMessage.addListener(async (msg) => {
    if (msg?.action !== 'ASK') return;
    try {
      const text = await ask(msg, (partial) => {
        try {
          port.postMessage({ type: 'DELTA', text: partial });
        } catch {
          /* porta fechada */
        }
      });
      port.postMessage({ type: 'DONE', text });
    } catch (e) {
      port.postMessage({ type: 'ERROR', error: e?.message || String(e) });
    }
  });
});
