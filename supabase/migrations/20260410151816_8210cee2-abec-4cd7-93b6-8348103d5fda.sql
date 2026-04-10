
CREATE TABLE public.crm_internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number TEXT NOT NULL,
  cod_agent TEXT NOT NULL,
  note_text TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by contact
CREATE INDEX idx_crm_internal_notes_lookup 
  ON public.crm_internal_notes (whatsapp_number, cod_agent, created_at);

-- Enable RLS
ALTER TABLE public.crm_internal_notes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching project pattern)
CREATE POLICY "Allow all on crm_internal_notes"
  ON public.crm_internal_notes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
