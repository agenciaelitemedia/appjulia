UPDATE public.chat_contacts 
SET channel_source = '04eee74a-79ca-4d0b-9b01-58b0253578e1',
    updated_at = now()
WHERE client_id = '272' 
  AND channel_source = '318ab17e-7c13-421c-86b5-b7fb108e728e'
  AND phone NOT IN (
    SELECT phone FROM public.chat_contacts 
    WHERE client_id = '272' 
      AND channel_source = '04eee74a-79ca-4d0b-9b01-58b0253578e1'
  );