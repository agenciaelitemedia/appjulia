/**
 * Service worker da extensão "Julia AI Companion" (MVP).
 * Único componente que enxerga o accessToken da sessão web do ChatGPT.
 * Ele nunca devolve o token para a página — só status e o texto da resposta.
 */
const ORIGIN = 'https://chatgpt.com';

async function getSession() {
  try {
    const res = await fetch(`${ORIGIN}/api/auth/session`, { credentials: 'include' });
    if (!res.ok) return { loggedIn: false, email: null, plan: null, hasAccessToken: false };
    const data = await res.json();
    const token = data?.accessToken || null;
    return {
      loggedIn: !!data?.user,
      email: data?.user?.email ?? null,
      plan: data?.user?.planType ?? data?.accountPlan ?? null,
      hasAccessToken: !!token,
    };
  } catch (e) {
    return { loggedIn: false, email: null, plan: null, hasAccessToken: false };
  }
}

async function getAccessToken() {
  const res = await fetch(`${ORIGIN}/api/auth/session`, { credentials: 'include' });
  if (!res.ok) throw new Error('Não foi possível ler a sessão do ChatGPT. Faça login em chatgpt.com.');
  const data = await res.json();
  if (!data?.accessToken) throw new Error('Sessão do ChatGPT sem token. Faça login novamente em chatgpt.com.');
  return data.accessToken;
}

function uuid() {
  return crypto.randomUUID();
}

/** Envia o prompt ao endpoint de conversa do ChatGPT web e faz streaming SSE. */
async function ask({ prompt, model }, onDelta) {
  const token = await getAccessToken();

  const res = await fetch(`${ORIGIN}/backend-api/conversation`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      action: 'next',
      model: model || 'gpt-4o',
      messages: [
        {
          id: uuid(),
          author: { role: 'user' },
          content: { content_type: 'text', parts: [prompt] },
        },
      ],
      parent_message_id: uuid(),
      history_and_training_disabled: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ChatGPT respondeu ${res.status}. ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const parts2 = json?.message?.content?.parts;
        if (Array.isArray(parts2) && typeof parts2[0] === 'string' && parts2[0].length >= text.length) {
          text = parts2[0];
          onDelta(text);
        }
      } catch {
        // linhas de keep-alive / metadados ignoradas
      }
    }
  }

  return text;
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
