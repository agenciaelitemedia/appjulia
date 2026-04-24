DELETE FROM public.chat_messages WHERE contact_id IN (SELECT id FROM public.chat_contacts WHERE phone IN ('553488860163','553491633679'));
DELETE FROM public.chat_conversation_tags WHERE conversation_id IN (SELECT id FROM public.chat_conversations WHERE contact_id IN (SELECT id FROM public.chat_contacts WHERE phone IN ('553488860163','553491633679')));
DELETE FROM public.chat_conversation_history WHERE conversation_id IN (SELECT id FROM public.chat_conversations WHERE contact_id IN (SELECT id FROM public.chat_contacts WHERE phone IN ('553488860163','553491633679')));
DELETE FROM public.chat_conversations WHERE contact_id IN (SELECT id FROM public.chat_contacts WHERE phone IN ('553488860163','553491633679'));
DELETE FROM public.chat_contacts WHERE phone IN ('553488860163','553491633679');