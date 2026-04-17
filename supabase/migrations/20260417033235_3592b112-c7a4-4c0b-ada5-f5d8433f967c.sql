ALTER TABLE public.chat_contacts 
  ADD COLUMN IF NOT EXISTS history_backfilled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_contacts_history_backfilled 
  ON public.chat_contacts(history_backfilled) 
  WHERE history_backfilled = false;