ALTER TABLE public.crm_boards
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_key text;

ALTER TABLE public.crm_pipelines
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage_key text;

CREATE UNIQUE INDEX IF NOT EXISTS crm_boards_system_key_client_uniq
  ON public.crm_boards (client_id, system_key)
  WHERE system_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.crm_protect_system_board()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'O quadro do sistema (CRM da Julia) não pode ser excluído';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_system THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'O nome do quadro CRM da Julia não pode ser alterado';
    END IF;
    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived AND NEW.is_archived THEN
      RAISE EXCEPTION 'O quadro CRM da Julia não pode ser arquivado';
    END IF;
    NEW.is_system := OLD.is_system;
    NEW.system_key := OLD.system_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_protect_system_board ON public.crm_boards;
CREATE TRIGGER trg_crm_protect_system_board
BEFORE UPDATE OR DELETE ON public.crm_boards
FOR EACH ROW EXECUTE FUNCTION public.crm_protect_system_board();

CREATE OR REPLACE FUNCTION public.crm_protect_system_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'As etapas padrão da Julia não podem ser excluídas';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_system THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'As etapas padrão da Julia não podem ser renomeadas';
    END IF;
    IF NEW.position IS DISTINCT FROM OLD.position THEN
      RAISE EXCEPTION 'As etapas padrão da Julia não podem ser reordenadas';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT NEW.is_active THEN
      RAISE EXCEPTION 'As etapas padrão da Julia não podem ser desativadas';
    END IF;
    NEW.is_system := OLD.is_system;
    NEW.stage_key := OLD.stage_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_protect_system_pipeline ON public.crm_pipelines;
CREATE TRIGGER trg_crm_protect_system_pipeline
BEFORE UPDATE OR DELETE ON public.crm_pipelines
FOR EACH ROW EXECUTE FUNCTION public.crm_protect_system_pipeline();