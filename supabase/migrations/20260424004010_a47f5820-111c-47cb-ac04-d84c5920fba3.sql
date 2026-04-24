-- Add skipped_lid columns to history runs/items
ALTER TABLE public.uazapi_history_runs ADD COLUMN IF NOT EXISTS skipped_lid INT NOT NULL DEFAULT 0;
ALTER TABLE public.uazapi_history_items ADD COLUMN IF NOT EXISTS skipped_lid INT NOT NULL DEFAULT 0;

-- ============================================================
-- Sanitize existing LID-based contacts
-- For each chat_contacts row whose remote_jid contains '@lid':
--   1. find the most frequent real phone in chat_messages.raw_payload->>'sender_pn'
--   2. if a "good" contact (same phone, no @lid) already exists: move messages
--      and conversations to it, then delete the LID row
--   3. otherwise: rewrite phone/remote_jid in place; clear name/profile so it
--      gets re-enriched on next visit
--   4. mark unresolved cases for manual review
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  good_id UUID;
  real_phone TEXT;
BEGIN
  FOR rec IN
    SELECT id, client_id
      FROM public.chat_contacts
     WHERE remote_jid LIKE '%@lid%'
        OR phone ~ '^[0-9]{14,}$' AND remote_jid IS NULL  -- defensive
  LOOP
    -- Most frequent sender_pn for this contact's messages
    SELECT regexp_replace(split_part(cm.raw_payload->>'sender_pn', '@', 1), '\D', '', 'g')
      INTO real_phone
      FROM public.chat_messages cm
     WHERE cm.contact_id = rec.id
       AND cm.raw_payload->>'sender_pn' ~ '^[0-9]+@s\.whatsapp\.net'
     GROUP BY 1
     ORDER BY count(*) DESC
     LIMIT 1;

    IF real_phone IS NULL OR length(real_phone) < 8 OR length(real_phone) > 13 THEN
      -- Cannot resolve — flag for review and skip
      UPDATE public.chat_contacts
         SET history_backfilled = true
       WHERE id = rec.id;
      CONTINUE;
    END IF;

    -- Look for an existing "good" contact with this real phone
    SELECT id INTO good_id
      FROM public.chat_contacts
     WHERE client_id = rec.client_id
       AND phone = real_phone
       AND id <> rec.id
       AND (remote_jid IS NULL OR remote_jid NOT LIKE '%@lid%')
     LIMIT 1;

    IF good_id IS NOT NULL THEN
      -- Merge: move messages + conversations to the good contact, then delete LID row
      UPDATE public.chat_messages SET contact_id = good_id WHERE contact_id = rec.id;
      UPDATE public.chat_conversations SET contact_id = good_id WHERE contact_id = rec.id;
      DELETE FROM public.chat_contacts WHERE id = rec.id;
    ELSE
      -- Rewrite in place; clear name/profile to trigger enrichment
      UPDATE public.chat_contacts
         SET phone = real_phone,
             remote_jid = real_phone || '@s.whatsapp.net',
             name = CASE WHEN name = phone OR name ~ '^[0-9\s+\-()]+$' THEN real_phone ELSE name END,
             profile_fetched_at = NULL,
             history_backfilled = false
       WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;