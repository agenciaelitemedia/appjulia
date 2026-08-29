# MVP Copiloto Pro — validar a extensão ponte com ChatGPT Pro

Objetivo: provar, numa rota isolada `/mvp-copiloto`, a sistemática do OpenClaw: autenticar pela sessão web do ChatGPT (sem chave de API), puxar o histórico de um lead, mandar para a conta Pro e receber em streaming uma análise do atendimento.

Tudo em pasta própria, sem tocar em nada do chat atual.

## O que o MVP faz

1. **Status da conexão** — cartão no topo mostra `● ChatGPT Pro conectado (e-mail / plano)` ou `Extensão não detectada` / `Não logado no ChatGPT`. Botão "Conectar" abre `chatgpt.com` em nova aba e re-checa ao voltar.
2. **Escolher o lead** — busca por telefone ou nome; lista as conversas recentes do escritório logado. Ao escolher, mostra prévia do histórico compilado (quantidade de mensagens, período, anexos citados).
3. **Analisar** — botão "Analisar atendimento" envia o contexto compilado para a conta Pro com um prompt jurídico fixo que devolve:
   - Resumo de como foi o atendimento
   - Do que se trata o caso
   - Se há caso jurídico válido (com justificativa e o que falta de prova)
   - Outros casos jurídicos possíveis identificados no relato
4. **Resultado** — texto renderizado em Markdown enquanto chega (streaming), com botões "Copiar" e "Baixar .md". Nada é gravado no banco neste MVP.

## A extensão "Julia Companion (MVP)"

Extensão Chrome não empacotada, com fonte no próprio repo, carregada via `chrome://extensions → Carregar sem compactação`. Ela é a ponte porque só ela tem os cookies de `chatgpt.com`.

```text
App Julia (/mvp-copiloto)                 Extensão                      chatgpt.com
   |  postMessage JULIA_COPILOT_*             |                              |
   |----------------------------------------->| content script -> background |
   |                                          |  fetch /api/auth/session ----|
   |                                          |  fetch /backend-api/conversation (SSE)
   |<---- eventos: status / delta / done / erro -------------------------------|
```

- `manifest.json` (MV3), host permission só para `https://chatgpt.com/*`, e o content script injetado apenas nas origens da Julia (localhost, `*.lovable.app`, domínios do escritório).
- Handshake: a página pede `PING` → extensão responde `PONG` com versão. Sem resposta em 1,5s = extensão ausente.
- `SESSION` → lê `https://chatgpt.com/api/auth/session` e devolve e-mail, plano e se há `accessToken` (o token **não** é entregue à página nem gravado em banco).
- `ASK` → a extensão faz o POST autenticado em `/backend-api/conversation` com `Authorization: Bearer <accessToken>` obtido dentro dela mesma, lê o SSE e repassa deltas de texto para a página.
- Nenhum cookie/token trafega para o Supabase ou para a Julia; o segredo fica na extensão.

## Compilador de contexto (no app, dados que já existem)

- `chat_conversations` + `chat_contacts` do `client_id` logado → nome, telefone, canal, fila.
- `chat_messages` da conversa (últimas 100, ordem cronológica) → texto, transcrições de áudio, notas internas, e nome do arquivo quando for mídia.
- Monta o bloco de texto no formato do doc `integracao-ia-pro-auth.md` (`=== CONTEXTO DO ATENDIMENTO ===`, histórico linha a linha com data/autor, lista de documentos anexados).

## Arquivos (todos novos, pasta própria)

```text
src/modules/mvp-copiloto/
  module.ts                     rota e metadados
  pages/MvpCopilotoPage.tsx     tela do MVP (3 blocos: status / lead / resultado)
  components/BridgeStatusCard.tsx
  components/LeadPicker.tsx
  components/ContextPreview.tsx
  components/AnalysisResult.tsx
  hooks/useCopilotBridge.ts     handshake, status e streaming via postMessage
  hooks/useMvpLeadSearch.ts     busca de conversas/contatos
  hooks/useMvpLeadContext.ts    compilação do histórico
  lib/bridgeProtocol.ts         tipos e nomes das mensagens (compartilhado com a extensão)
  lib/buildLeadContext.ts       formatação do contexto
  lib/prompts.ts                prompt da análise
  extend/db.ts                  reexporta supabase client
  extend/auth.ts                reexporta useAuth
  extension/
    manifest.json
    background.js               fetch de sessão + streaming SSE
    content.js                  ponte postMessage <-> background
    README.md                   como instalar em 4 passos
```

Única alteração fora da pasta: uma linha de `<Route path="/mvp-copiloto" ...>` em `src/App.tsx`. Sem entrada de menu e sem módulo de permissão (MVP acessado pela URL).

## Limitações conhecidas do MVP

- Só ChatGPT (Claude/Gemini ficam para depois) e só análise de texto — PDFs/imagens não são enviados, apenas citados pelo nome.
- Endpoints internos do ChatGPT não são públicos e podem mudar; o MVP existe justamente para medir essa estabilidade.
- Exige Chrome/Edge com a extensão carregada manualmente e o usuário logado no ChatGPT no mesmo navegador.

## Validação

1. Abrir `/mvp-copiloto` sem a extensão → mensagem "Extensão não detectada" com instruções.
2. Instalar a extensão, recarregar → status conectado com e-mail e plano.
3. Escolher um lead com conversa real → conferir a prévia do contexto.
4. Clicar em "Analisar atendimento" → texto chegando em streaming, com as quatro seções pedidas.
5. Conferir que `/chat` e o restante do sistema seguem intactos.
