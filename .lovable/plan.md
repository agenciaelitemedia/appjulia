## Objetivo

Substituir o uso do relógio do navegador (`new Date().toISOString()`) por timestamp do servidor Postgres, sempre expresso no fuso `America/Sao_Paulo` (UTC-3), em todas as mensagens enviadas pelo chat (texto, mídia e notas internas).

## Por que

Hoje o `timestamp` gravado em `chat_messages` vem do relógio do navegador do remetente. Isso causa:
- Mensagens "no futuro" ou "no passado" quando o usuário tem hora/timezone errados na máquina.
- Divergência com `created_at` (que já é `now()` do servidor).
- Ordenação inconsistente entre clientes em fusos diferentes.

A solução padroniza tudo no relógio do servidor, formatado como `-03:00` (BRT).

## Como funciona

### 1. RPC de relógio do servidor (BRT)

Criar função SQL:

```sql
create or replace function public.server_now_brt()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select to_char(
    now() at time zone 'America/Sao_Paulo',
    'YYYY-MM-DD"T"HH24:MI:SS.MS'
  ) || '-03:00';
$$;
```

Retorna string ISO 8601 com offset fixo `-03:00`, ex.: `2026-05-22T11:43:07.812-03:00`. Postgres ainda armazena como `timestamptz` (UTC) na coluna; a string apenas garante que toda comparação/exibição parta do mesmo relógio canônico.

### 2. Helper de skew no frontend

Novo arquivo `src/lib/serverClock.ts`:

- Na primeira chamada, invoca a RPC, calcula `skew = serverEpoch - Date.now()` e cacheia.
- Re-sincroniza a cada 5 min ou sob demanda.
- Exporta `getServerNowBRT(): string` que retorna a string ISO `-03:00` derivada de `Date.now() + skew` (sem round-trip por mensagem).
- Fallback: se a RPC falhar, usa `new Date().toISOString()` (comportamento atual) para não bloquear envio.

### 3. Substituições em `src/contexts/WhatsAppDataContext.tsx`

Trocar as ocorrências de `new Date().toISOString()` usadas em envios por `getServerNowBRT()`:

- Linha 1215 — `tempMessage.timestamp` da nota interna
- Linha 1382 — `tempMessage.timestamp` de mensagem de texto
- Linha 1645 — `tempMessage.timestamp` de mídia
- Linha 2391 — fallback `p_last_at` do RPC

E garantir que o mesmo valor seja propagado para:
- `chat_messages.timestamp` no insert (já é `tempMessage.timestamp`)
- `last_message_at` no update do contato (já usa `tempMessage.timestamp`)

### 4. O que NÃO muda

- `created_at` continua sendo `now()` default do Postgres (auditoria).
- Webhooks de UaZapi/WABA continuam normalizando seu próprio `messageTimestamp` pela regra existente (`mem://technical/messaging/timestamp-normalization`). O servidor manda na hora do envio nosso; o provedor manda na hora da confirmação dele.
- Exibição na UI continua usando os helpers atuais (`parseDbTimestamp`, etc.) — a string `-03:00` é parseada corretamente por `new Date()`.

## Arquivos afetados

- **Migration nova**: cria `public.server_now_brt()`.
- **Novo**: `src/lib/serverClock.ts` (cache de skew + `getServerNowBRT`).
- **Editado**: `src/contexts/WhatsAppDataContext.tsx` (4 substituições + import).

## Riscos / mitigações

- **Round-trip de sincronização**: feito 1x na carga do contexto + a cada 5 min, não a cada mensagem. Latência de envio inalterada.
- **RPC indisponível**: fallback para `new Date().toISOString()` mantém o comportamento atual.
- **Ordenação retroativa**: mensagens antigas mantêm o timestamp gravado anteriormente; só as novas seguem o relógio do servidor.
