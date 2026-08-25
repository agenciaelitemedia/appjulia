---
name: Vínculo ligação ↔ contato
description: phone_call_logs e wavoip_call_logs gravam contact_phone_e164 + contact_id na origem; leitura do histórico nunca casa número por formato do provedor
type: feature
---

Provedores gravam telefones em formatos diferentes: Api4Com/3C+ usam formato nacional
(`0DDD9XXXXXXXX`), Wavoip usa `55DDD…` (12 ou 13 díg). Por isso o histórico de ligações
por contato NÃO deve casar `caller`/`called`/`from_number` diretamente.

Padrão oficial:
- `phone_call_logs` e `wavoip_call_logs` têm `contact_phone_e164` (canônico BR `55DDD…`)
  e `contact_id` (→ `chat_contacts`); wavoip também grava `conversation_id`.
- Gravação na origem via `supabase/functions/_shared/contact-link.ts`
  (`toCallCanonicalBr`, `pickCustomerNumber`, `resolveContactLink`, `attachCallContactLink`),
  usado em api4com-webhook/proxy, threecplus-webhook/proxy, wavoip-call-webhook e wavoip-sync-history.
  Falha na resolução nunca bloqueia o CDR (grava com `contact_id` nulo).
- Leitura (`useContactCallHistory`) filtra por `contact_id` OR `contact_phone_e164 in (variantes)`.
