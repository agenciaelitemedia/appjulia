# Julia AI Companion — extensão do MVP Copiloto Pro

Ponte local entre o app Julia (`/mvp-copiloto`) e a sessão web do ChatGPT Pro do
próprio usuário. Objetivo: validar a sistemática de "handshake via navegador"
sem chave de API e sem custo por token.

## Instalar (Chrome ou Edge)

1. Copie esta pasta (`extension/`) para um local fixo da máquina.
2. Abra `chrome://extensions` (ou `edge://extensions`) e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta.
4. Faça login em `https://chatgpt.com` na mesma janela do navegador.
5. Abra `/mvp-copiloto` no app Julia e clique em **Verificar**.

Se o app estiver em outro domínio, acrescente esse domínio em
`manifest.json → content_scripts.matches` e recarregue a extensão.

## Como funciona

```
Página /mvp-copiloto  ──postMessage──▶  content.js  ──port──▶  background.js  ──fetch──▶  chatgpt.com
        ◀── DELTA / DONE / ERROR ────────────────────────────────────────────────────────────
```

- `content.js` só repassa mensagens; não lê cookies nem token.
- `background.js` é o único que lê `GET /api/auth/session` e usa o
  `accessToken` em `POST /backend-api/conversation` (streaming SSE).
- O token **nunca** é enviado para a página nem para o backend da Julia.

## Protocolo

Requisições da página (`source: "JULIA_COPILOT_REQ"`):

| action    | payload                  | resposta                            |
| --------- | ------------------------ | ----------------------------------- |
| `PING`    | —                        | `PONG` + `version`                  |
| `SESSION` | —                        | `SESSION` + `{loggedIn, email, plan, hasAccessToken}` |
| `ASK`     | `{ prompt, model }`      | vários `DELTA`, depois `DONE` ou `ERROR` |

A fonte de verdade do protocolo está em `../lib/bridgeProtocol.ts`.

## Limitações do MVP

- Só ChatGPT; apenas contexto de texto (arquivos entram só como nome).
- Endpoints internos do ChatGPT não são públicos e podem mudar sem aviso;
  Cloudflare pode exigir novo login/captcha.
- Sem persistência da análise no banco.
- Verifique os termos de uso da OpenAI antes de qualquer uso em produção.
