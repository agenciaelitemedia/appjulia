-- Unificação de chat_contacts duplicados BR (12 vs 13 dígitos)
-- Estratégia: para cada par no mesmo client_id, sobrevivente = mais antigo.
-- Ordem segura para não violar UNIQUE(phone, client_id):
--   (a) reaponta conversas/CRM do duplicado para o sobrevivente
--   (b) remove duplicados
--   (c) só então atualiza phone do sobrevivente para 13 dígitos canônicos
DO $$
DECLARE
  pair RECORD;
  survivor_id uuid;
  duplicate_id uuid;
  canonical_phone text;
BEGIN
  FOR pair IN
    WITH br AS (
      SELECT id, client_id, phone, created_at
      FROM public.chat_contacts
      WHERE phone ~ '^55[1-9][1-9]'
        AND length(phone) IN (12, 13)
    ),
    norm AS (
      SELECT *,
        CASE
          WHEN length(phone) = 12 AND substring(phone, 5, 1) IN ('6','7','8','9')
            THEN substring(phone, 1, 4) || '9' || substring(phone, 5)
          ELSE phone
        END AS canonical
      FROM br
    )
    SELECT client_id, canonical, array_agg(id ORDER BY created_at ASC) AS ids,
           array_agg(phone ORDER BY created_at ASC) AS phones
    FROM norm
    GROUP BY client_id, canonical
    HAVING count(*) > 1
  LOOP
    survivor_id := pair.ids[1];
    canonical_phone := pair.canonical;

    -- (a + b) Para cada duplicado adicional, transfere referências e remove
    FOR i IN 2..array_length(pair.ids, 1) LOOP
      duplicate_id := pair.ids[i];

      UPDATE public.chat_conversations
         SET contact_id = survivor_id, updated_at = now()
       WHERE contact_id = duplicate_id;

      UPDATE public.crm_deals
         SET custom_fields = jsonb_set(
               custom_fields,
               '{links,chat,contact_id}',
               to_jsonb(survivor_id::text),
               false
             ),
             updated_at = now()
       WHERE (custom_fields #>> '{links,chat,contact_id}') = duplicate_id::text;

      DELETE FROM public.chat_contacts WHERE id = duplicate_id;
    END LOOP;

    -- (c) Agora pode atualizar o sobrevivente para o canônico sem violar UNIQUE
    UPDATE public.chat_contacts
       SET phone = canonical_phone, updated_at = now()
     WHERE id = survivor_id
       AND phone <> canonical_phone;
  END LOOP;
END $$;

-- Atualiza celulares BR 12 dígitos restantes (sem par duplicado) para 13 dígitos canônicos.
-- Faz em ordem segura: só altera quando o canônico ainda não existe para o mesmo client_id.
UPDATE public.chat_contacts cc
   SET phone = substring(cc.phone, 1, 4) || '9' || substring(cc.phone, 5),
       updated_at = now()
 WHERE cc.phone ~ '^55[1-9][1-9]'
   AND length(cc.phone) = 12
   AND substring(cc.phone, 5, 1) IN ('6','7','8','9')
   AND NOT EXISTS (
     SELECT 1 FROM public.chat_contacts c2
      WHERE c2.client_id = cc.client_id
        AND c2.phone = substring(cc.phone, 1, 4) || '9' || substring(cc.phone, 5)
   );
