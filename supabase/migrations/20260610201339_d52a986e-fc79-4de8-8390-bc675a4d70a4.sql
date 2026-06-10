ALTER TABLE public.support_settings
  ADD COLUMN IF NOT EXISTS protocol_auto_send boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS protocol_send_template text NOT NULL DEFAULT 'Olá {nome}! Seu chamado foi aberto. Protocolo: {protocolo}. Assunto: {assunto}.';