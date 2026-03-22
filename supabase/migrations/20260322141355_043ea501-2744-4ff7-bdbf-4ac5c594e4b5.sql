
-- phone_user_plans: replace user_id with cod_agent
ALTER TABLE public.phone_user_plans ADD COLUMN cod_agent text;
UPDATE public.phone_user_plans SET cod_agent = user_id::text WHERE cod_agent IS NULL;
ALTER TABLE public.phone_user_plans ALTER COLUMN cod_agent SET NOT NULL;
ALTER TABLE public.phone_user_plans DROP COLUMN user_id;

-- phone_extensions: replace user_id with cod_agent
ALTER TABLE public.phone_extensions ADD COLUMN cod_agent text;
UPDATE public.phone_extensions SET cod_agent = user_id::text WHERE cod_agent IS NULL;
ALTER TABLE public.phone_extensions ALTER COLUMN cod_agent SET NOT NULL;
ALTER TABLE public.phone_extensions DROP COLUMN user_id;
