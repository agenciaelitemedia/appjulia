---
name: LÍDIA desativada (revisar)
description: LÍDIA desligada em 2026-09-11; aba removida do painel do chat, arquivos mantidos, decisão pendente de revisão
type: constraint
---

A LÍDIA (copiloto de atendimento) está **desativada** desde 2026-09-11, por decisão do usuário.

- Flag: `LIDIA_ENABLED = false` em `src/modules/lidia/access.ts` — `isLidiaAllowed` sempre retorna `false`.
- A aba "LÍDIA" não aparece em `ChatRightBar.tsx`; quem tinha `chat_rightbar_tab = 'lidia'` cai em "Contato" (`WhatsAppDataContext.tsx`).
- **Arquivos mantidos**: `src/modules/lidia/**` e a Edge Function `lidia-copilot` continuam no projeto/publicados, sem chamadas da interface.

**Pendência de revisão**: decidir depois se a LÍDIA volta (basta `LIDIA_ENABLED = true`) ou se os arquivos e a Edge Function são removidos de vez.

**Why:** o usuário pediu desativação temporária, não exclusão. Não reativar a aba nem apagar os arquivos sem pedido explícito.
