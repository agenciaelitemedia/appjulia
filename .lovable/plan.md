## Diagnóstico

Confirmei no banco que existe o caso real:

| Phone | Nome | Origem |
|---|---|---|
| `553488860163` (12 díg) | Mário Castro | Veio do WhatsApp (UaZapi sem o 9º dígito) |
| `5534988860163` (13 díg) | mario castro | Cadastrado manualmente no CRM Builder |

**Causa raiz**: Para DDDs ≥ 30 (interior), o WhatsApp historicamente armazena o JID **sem o 9º dígito** (`55 + DDD + 8 dígitos`), enquanto o usuário ao cadastrar manualmente digita o número real **com o 9** (`55 + DDD + 9 + 8 dígitos`). A função `normalizePhone` do webhook (`uazapi-chat-webhook`) só remove caracteres não-numéricos — não aplica regra brasileira do 9º dígito. O mesmo acontece no `ContactPicker` (cadastro manual) e no `useChatContactConversationStatus` (lookup pelo DealCard).

Resultado: dois `chat_contacts` distintos para a mesma pessoa, dois cards no CRM, ícone WhatsApp âmbar aparecendo no card "real" porque a busca por `5534988860163` não acha a conversa que está sob `553488860163`.

---

## Estratégia

Criar uma **única função canônica** de normalização BR e aplicá-la em **todos** os pontos de leitura/escrita de `chat_contacts.phone`. A regra:

- Pega só dígitos
- Remove `0` de longa distância e prefixo internacional duplicado
- Se DDI=55 e tem `55 + DDD + 9 dígitos` (13 total) e o 1º dígito do número local é `9` → mantém
- Se DDI=55 e tem `55 + DDD + 8 dígitos` (12 total) e o 1º dígito local é `6/7/8/9` (celular) → **insere o 9** após o DDD ⇒ vira 13 dígitos
- Caso contrário (fixo, internacional, etc.) mantém como está

⚠️ **Decisão de armazenamento**: usar sempre **13 dígitos com o 9** como forma canônica em `chat_contacts.phone`. Motivo: é o número real do telefone, compatível com discador (Api4Com adiciona `0+DDD+número`), e o WhatsApp Business API moderno aceita ambos. O webhook do UaZapi continua recebendo o JID de 12 díg, mas antes de gravar/buscar contato aplica a normalização → grava sempre 13.

---

## Etapas de Implementação

### 1. Criar utilitário canônico compartilhado
**Arquivo novo**: `src/lib/phoneNormalize.ts`
```ts
export function normalizeBrPhone(raw: string): string {
  let d = (raw || '').replace(/@.*/, '').replace(/\D/g, '');
  if (!d) return '';
  // Remove 0 de longa distância se vier "055..."
  if (d.startsWith('055')) d = d.slice(1);
  // Aplica regra do 9º dígito apenas para BR (DDI 55)
  if (d.startsWith('55') && d.length === 12) {
    const ddd = d.slice(2, 4);
    const first = d[4];
    if (['6','7','8','9'].includes(first)) {
      d = '55' + ddd + '9' + d.slice(4);
    }
  }
  return d;
}
```
Espelhar em `supabase/functions/_shared/phone-normalize.ts` (mesma lógica em Deno) para reuso nas edge functions.

### 2. Aplicar no frontend
- **`src/pages/crm-builder/components/deals/ContactPicker.tsx`**:
  - Em `fullPhone` e `checkDuplicate`: passar `ddi + phoneDigits` por `normalizeBrPhone()` antes de comparar/inserir.
  - No `INSERT` em `chat_contacts`: gravar `phone: normalizeBrPhone(ddi + phoneDigits)`.
  - Na busca `OR ilike`: além do termo digitado, também buscar pela versão normalizada (cobre busca por número parcial).
- **`src/pages/crm-builder/hooks/useChatContactConversationStatus.ts`**:
  - Substituir o `normalize` local por `normalizeBrPhone`.
  - Na consulta a `chat_contacts`, fazer `.in('phone', [norm13, norm12])` (busca tolerante: compatibilidade com registros antigos ainda em 12 díg que não foram migrados).
- **`src/pages/contatos/components/EditContactDialog.tsx`**: aplicar `normalizeBrPhone` no `update`.

### 3. Aplicar nas Edge Functions (escritas)
Pontos identificados que gravam `chat_contacts.phone`:
- `supabase/functions/uazapi-chat-webhook/index.ts` (linhas 329, 448, 803, 823, 978) — substituir `normalizePhone` pela versão BR-aware (mantendo o nome para não quebrar chamadas existentes, só estendendo o corpo).
- `supabase/functions/meta-webhook/index.ts`, `waba-send/index.ts`, `instagram-webhook/index.ts`, `chat-public-api/index.ts`, `webchat-api/index.ts`, `chat-contacts-enrich/index.ts`, `uazapi-history-import/index.ts`, `uazapi-history-processor/index.ts`, `uazapi-history-resume/index.ts`, `uazapi-chat-backfill/index.ts`, `chat-scheduler/index.ts`, `chat-campaign-dispatcher/index.ts` — auditoria e aplicação onde houver `INSERT`/`UPSERT`/lookup por `phone`.
- `supabase/functions/_shared/whatsapp-profile.ts` — normalizar antes de bater no UaZapi.

⚠️ Não vou alterar a lógica de **JID** enviada para o WhatsApp (UaZapi/Meta esperam o formato que eles deram). A normalização é apenas para a **chave de armazenamento** em `chat_contacts.phone`. Para enviar mensagem mantemos a tradução `13díg → 12díg` quando o provider exigir, via uma função `toWhatsappJid()` no mesmo utilitário.

### 4. Migração de dados (one-shot)
Migration SQL que:
1. Cria índice temporário/auxiliar para detectar pares.
2. Para cada par `(553488860163, 5534988860163)` no mesmo `client_id`:
   - Reaponta `chat_conversations.contact_id` do registro 12 díg → registro 13 díg (mais antigo permanece, ou o que tem mais conversas — vou usar **o mais antigo** como sobrevivente e atualizar o `phone` dele para 13 díg).
   - Reaponta `chat_messages` (via `conversation_id` já fica resolvido).
   - Reaponta `crm_deals.custom_fields.links.chat.contact_id` se existir.
   - `DELETE` do registro 12 díg órfão.
3. Atualiza todos os `chat_contacts.phone` brasileiros de 12 → 13 dígitos (regra do 9º).
4. Cria **constraint** `UNIQUE (client_id, phone)` se ainda não existir, para impedir nova duplicação.

Vou rodar a migration em modo dry-run primeiro (SELECT que mostra o que seria mudado) e só executar após eu validar o impacto. No caso atual, é só 1 par.

### 5. UX no `ContactPicker`
- Quando o usuário digitar 12 díg de celular BR e existir contato com 13 díg correspondente, o `checkDuplicate` agora vai detectar e oferecer "Usar contato existente".
- Adicionar um `helperText` discreto: "Detectamos que este número já existe sem o 9º dígito (formato WhatsApp). Vamos unificar."

### 6. Verificação
- Após a migration, recarregar o board do CRM Builder e confirmar que o card do Mário Castro agora aparece com o ícone WhatsApp **verde** (não âmbar), pois o `useChatContactConversationStatus` encontrará a conversa via o phone unificado.
- Validar no `/contatos` que só há **1** registro do Mário.

---

## Arquivos afetados (resumo)

**Novos:**
- `src/lib/phoneNormalize.ts`
- `supabase/functions/_shared/phone-normalize.ts`
- 1 migration SQL (unificação + UNIQUE constraint)

**Alterados (frontend):**
- `src/pages/crm-builder/components/deals/ContactPicker.tsx`
- `src/pages/crm-builder/hooks/useChatContactConversationStatus.ts`
- `src/pages/contatos/components/EditContactDialog.tsx`

**Alterados (edge functions)** — onde houver `chat_contacts` `INSERT`/`UPDATE`/lookup por phone:
- `uazapi-chat-webhook`, `meta-webhook`, `waba-send`, `instagram-webhook`, `chat-public-api`, `webchat-api`, `chat-contacts-enrich`, `uazapi-history-import/processor/resume`, `uazapi-chat-backfill`, `chat-scheduler`, `chat-campaign-dispatcher`, `_shared/whatsapp-profile`.

---

## Riscos & Mitigação

| Risco | Mitigação |
|---|---|
| Quebrar envio para WhatsApp se o provider não aceita 13 díg | Função `toWhatsappJid()` separada; `phone` armazenado é canônico mas o que vai pro provider é traduzido. UaZapi e Meta Graph aceitam ambos. |
| UNIQUE constraint falhar se existirem outros pares não detectados | Migration roda dedupe **antes** de criar a constraint; query inicial mostrou só 1 par no banco hoje. |
| Webhook receber mensagem do número antigo após a migration | Já resolvido: `useChatContactConversationStatus` faz `.in('phone', [norm13, norm12])` por compatibilidade, e o webhook normaliza para 13 díg antes de gravar — qualquer nova mensagem cai no contato correto. |
| Fixos com DDD≥30 (raro mas possível) | A regra só insere o 9 se o 1º dígito local for 6/7/8/9 (celular). Fixos começam com 2/3/4/5 — preservados. |
| Números internacionais (DDI≠55) | Lógica do 9º dígito só roda se prefixo for `55`. Outros DDIs são preservados como estão. |

---

## Pergunta para validar antes de começar

Posso assumir que o **registro mais antigo** (`553488860163`, criado 2026-04-25) deve ser o sobrevivente e ter seu phone atualizado para `5534988860163`? Isso preserva o histórico de conversas WhatsApp já vinculadas a ele. Ou prefere que eu mantenha o registro **manual** (13 díg) e migre as conversas para ele?

Recomendação: manter o **mais antigo** e só atualizar o `phone` para 13 díg — é a opção mais segura porque preserva toda a thread de mensagens já indexada por `contact_id`.