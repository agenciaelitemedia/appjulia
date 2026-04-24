---
name: contact-enrichment-policy
description: Política de enriquecimento de contato (nome/foto/lead_*) acontece SÓ no cadastro ou na 1ª mensagem se ainda sem avatar. Sem cron, sem TTL, sem batch automático.
type: feature
---
Enriquecimento de chat_contacts (UaZapi e WABA) ocorre **apenas**:
1. No INSERT de um contato novo (history-set e webhook em tempo real).
2. Na primeira mensagem recebida de um contato existente que ainda NÃO tem `avatar`.

Sem TTL, sem retry periódico, sem cron. A função `chat-contacts-enrich` segue existindo apenas para uso manual/admin.

UaZapi:
- Individuais: `fetchUazapiProfile` (POST /chat/details + fallback /chat/GetNameAndImageURL).
- Grupos: `fetchUazapiGroupProfile` (POST /group/info com pictureUrl=true) — roteado quando `phone` contém `@g.us`.

WABA (Meta Cloud API): só valida `wa_id` em /contacts; não devolve foto de terceiros. O nome do contato vem do payload em `contacts[0].profile.name` e já é gravado no upsert (campos `name` e `wa_name`).

Implementado em:
- supabase/functions/_shared/whatsapp-profile.ts (rota grupo + helpers)
- supabase/functions/uazapi-chat-webhook/index.ts (linhas ~1070, fire-and-forget)
- supabase/functions/meta-webhook/index.ts (linhas ~193, fire-and-forget; só roda se profile_fetched_at for null)
