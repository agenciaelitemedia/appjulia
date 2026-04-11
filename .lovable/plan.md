

## Plano: Corrigir timestamps inválidos na sincronização de contatos

### Problema Raiz

A sincronização de contatos falha com o erro `"time zone displacement out of range"` porque **todos os timestamps estão sendo gerados incorretamente**.

Na linha 793-794 do `WhatsAppDataContext.tsx`, o código faz:
```typescript
last_message_at: c.wa_lastMsgTimestamp
  ? new Date(c.wa_lastMsgTimestamp * 1000).toISOString()
  : null,
```

O campo `wa_lastMsgTimestamp` da UaZapi já vem em **milissegundos** (ex: `1775917236000`), mas o código multiplica por 1000 novamente, gerando datas no ano 58217 (ex: `+058217-04-19T18:50:00.000Z`). Isso causa erro 400 em **todos** os upserts de contatos, resultando em zero contatos salvos e, consequentemente, zero mensagens visíveis no chat.

### Correção

1. **`src/contexts/WhatsAppDataContext.tsx`** (syncContacts, ~linha 793):
   - Detectar se o timestamp é em segundos ou milissegundos (se < 10^12, é segundos; senão é ms)
   - Aplicar a conversão correta:
     ```typescript
     const ts = c.wa_lastMsgTimestamp;
     const msTs = ts > 1e12 ? ts : ts * 1000;
     const date = new Date(msTs);
     // Validar se a data é razoável (entre 2020 e 2030)
     last_message_at: (date.getFullYear() > 2000 && date.getFullYear() < 2100)
       ? date.toISOString()
       : null
     ```

2. **`supabase/functions/uazapi-chat-webhook/index.ts`** (mesma lógica):
   - Aplicar a mesma proteção no webhook para timestamps recebidos, garantindo que `messageTimestamp` seja tratado corretamente (pode vir em segundos ou ms dependendo do evento)

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/WhatsAppDataContext.tsx` | Corrigir conversão de timestamp no syncContacts |
| `supabase/functions/uazapi-chat-webhook/index.ts` | Adicionar validação de timestamp |

