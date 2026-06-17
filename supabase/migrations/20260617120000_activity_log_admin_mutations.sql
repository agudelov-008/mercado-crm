-- =============================================================================
-- RPC: update_activity_log / delete_activity_log (solo Admin)
-- =============================================================================
-- Bypass RLS de forma controlada para editar/eliminar entradas del historial.
-- Evita DELETE/UPDATE directos bloqueados cuando faltan políticas RLS en remoto.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_activity_log(p_id public.activity_logs.id%TYPE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_role := public.crm_auth_role();
  IF v_role IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar actividades';
  END IF;

  DELETE FROM public.activity_logs AS al
  WHERE al.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Actividad no encontrada';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_activity_log(
  p_id public.activity_logs.id%TYPE,
  p_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_trimmed text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_role := public.crm_auth_role();
  IF v_role IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Solo administradores pueden editar actividades';
  END IF;

  v_trimmed := nullif(trim(coalesce(p_text, '')), '');
  IF v_trimmed IS NULL THEN
    RAISE EXCEPTION 'El comentario no puede estar vacío';
  END IF;

  UPDATE public.activity_logs AS al
  SET text = v_trimmed
  WHERE al.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Actividad no encontrada';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.delete_activity_log(public.activity_logs.id%TYPE) IS
  'Elimina una entrada de activity_logs. Requiere caller Admin.';

COMMENT ON FUNCTION public.update_activity_log(public.activity_logs.id%TYPE, text) IS
  'Actualiza el texto de activity_logs. Requiere caller Admin.';

REVOKE ALL ON FUNCTION public.delete_activity_log(public.activity_logs.id%TYPE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_activity_log(public.activity_logs.id%TYPE, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.delete_activity_log(public.activity_logs.id%TYPE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_activity_log(public.activity_logs.id%TYPE, text) TO authenticated;

-- Políticas RLS (idempotente) por si la migración consolidada no se aplicó en remoto.
DROP POLICY IF EXISTS activity_logs_update_admin_only ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_delete_admin_only ON public.activity_logs;

CREATE POLICY activity_logs_update_admin_only
  ON public.activity_logs
  FOR UPDATE
  TO authenticated
  USING (public.crm_auth_role() = 'Admin')
  WITH CHECK (public.crm_auth_role() = 'Admin');

CREATE POLICY activity_logs_delete_admin_only
  ON public.activity_logs
  FOR DELETE
  TO authenticated
  USING (public.crm_auth_role() = 'Admin');
