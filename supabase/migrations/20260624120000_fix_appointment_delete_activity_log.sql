-- Corrige el trigger de citas: al eliminar/reemplazar una cita debe usar OLD.client_phone
-- (no NEW, que es NULL en DELETE) al insertar en activity_logs.

DO $$
DECLARE
  trg record;
BEGIN
  FOR trg IN
    SELECT t.tgname
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_proc AS p ON p.oid = t.tgfoid
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname = 'appointments'
      AND NOT t.tgisinternal
      AND pg_get_functiondef(p.oid) ILIKE '%Cita eliminada o cancelada%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.appointments', trg.tgname);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_on_appointment_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_phone text;
BEGIN
  v_client_phone := nullif(trim(coalesce(OLD.client_phone, '')), '');

  IF v_client_phone IS NULL THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.activity_logs (client_phone, agent_id, text, type)
  VALUES (
    v_client_phone,
    COALESCE(auth.uid(), OLD.created_by),
    'Cita eliminada o cancelada del sistema.',
    'system'
  );

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.crm_on_appointment_deleted() IS
  'Registra en activity_logs cuando se elimina una cita. Usa OLD.client_phone para evitar violaciones NOT NULL.';

DROP TRIGGER IF EXISTS appointments_delete_activity_log ON public.appointments;

CREATE TRIGGER appointments_delete_activity_log
  AFTER DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_on_appointment_deleted();
