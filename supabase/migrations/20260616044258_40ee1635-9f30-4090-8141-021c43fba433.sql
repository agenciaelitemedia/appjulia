ALTER TABLE public.quick_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_size bigint,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS link_title text,
  ADD COLUMN IF NOT EXISTS link_description text,
  ADD COLUMN IF NOT EXISTS link_image text;

ALTER TABLE public.quick_messages
  ALTER COLUMN message_text DROP NOT NULL;

ALTER TABLE public.quick_messages
  DROP CONSTRAINT IF EXISTS quick_messages_kind_check;
ALTER TABLE public.quick_messages
  ADD CONSTRAINT quick_messages_kind_check
  CHECK (kind IN ('text','image','video','audio','document','link'));