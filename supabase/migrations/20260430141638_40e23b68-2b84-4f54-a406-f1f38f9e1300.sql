
ALTER TABLE public.phone_config ALTER COLUMN api4com_domain DROP NOT NULL;
ALTER TABLE public.phone_config ALTER COLUMN api4com_token DROP NOT NULL;
ALTER TABLE public.phone_config ALTER COLUMN sip_domain DROP NOT NULL;
