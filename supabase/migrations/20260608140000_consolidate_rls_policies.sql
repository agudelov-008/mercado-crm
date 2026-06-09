-- =============================================================================
-- Consolidación de seguridad CRM: RLS, vista secure_clients y RPC de duplicados
-- =============================================================================
-- Idempotente: usa DROP … IF EXISTS antes de recrear funciones, políticas y vista.
-- Roles en profiles.role: Admin | Manager | Assistant | Agent | Affiliate
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Funciones auxiliares de autorización (SECURITY DEFINER, STABLE)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

COMMENT ON FUNCTION public.crm_auth_role() IS
  'Devuelve profiles.role del usuario autenticado (auth.uid()). Usado por políticas RLS.';

CREATE OR REPLACE FUNCTION public.crm_auth_affiliate_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(trim(p.affiliate_name), '')
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

COMMENT ON FUNCTION public.crm_auth_affiliate_name() IS
  'Nombre de afiliado vinculado al perfil (rol Affiliate).';

CREATE OR REPLACE FUNCTION public.crm_can_access_client(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.phone = p_phone
      AND (
        public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant')
        OR (
          public.crm_auth_role() = 'Agent'
          AND c.owner_id = auth.uid()
        )
        OR (
          public.crm_auth_role() = 'Affiliate'
          AND c.affiliate IS NOT DISTINCT FROM public.crm_auth_affiliate_name()
          AND public.crm_auth_affiliate_name() IS NOT NULL
        )
      )
  );
$$;

COMMENT ON FUNCTION public.crm_can_access_client(text) IS
  'True si el caller puede leer/escribir sobre el cliente identificado por phone.';

CREATE OR REPLACE FUNCTION public.crm_can_access_appointment(p_client_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.phone = p_client_phone
      AND (
        public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant')
        OR (
          public.crm_auth_role() = 'Agent'
          AND c.owner_id = auth.uid()
        )
      )
  );
$$;

COMMENT ON FUNCTION public.crm_can_access_appointment(text) IS
  'True si el caller puede gestionar citas del cliente (Afiliadora excluida).';

-- ---------------------------------------------------------------------------
-- 1. Vista secure_clients (security_invoker = hereda RLS de clients)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.secure_clients;

CREATE VIEW public.secure_clients
WITH (security_invoker = true)
AS
SELECT
  c.first_name,
  c.last_name,
  c.country,
  c.affiliate,
  c.tp_account,
  c.phone,
  c.email,
  c.lead_status,
  c.owner_id,
  COALESCE(
    nullif(trim(concat_ws(' ', o.first_name, o.last_name)), ''),
    o.email
  ) AS owner_name,
  c.total_calls,
  c.previous_lead_status,
  c.previous_owner_id,
  COALESCE(
    nullif(trim(concat_ws(' ', po.first_name, po.last_name)), ''),
    po.email
  ) AS previous_owner_name,
  c.created_on,
  c.last_assignment,
  c.last_contacted,
  c.updated_at
FROM public.clients AS c
LEFT JOIN public.profiles AS o ON o.id = c.owner_id
LEFT JOIN public.profiles AS po ON po.id = c.previous_owner_id;

COMMENT ON VIEW public.secure_clients IS
  'Vista de lectura del CRM; respeta RLS de public.clients vía security_invoker.';

GRANT SELECT ON public.secure_clients TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabla clients — habilitar RLS y políticas por rol
-- ---------------------------------------------------------------------------

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select_scoped ON public.clients;
DROP POLICY IF EXISTS clients_insert_scoped ON public.clients;
DROP POLICY IF EXISTS clients_update_scoped ON public.clients;
DROP POLICY IF EXISTS clients_delete_admin_only ON public.clients;

-- SELECT: Admin/Manager/Assistant → org completa; Agent → cartera; Affiliate → sus leads
CREATE POLICY clients_select_scoped
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant')
    OR (
      public.crm_auth_role() = 'Agent'
      AND owner_id = auth.uid()
    )
    OR (
      public.crm_auth_role() = 'Affiliate'
      AND affiliate IS NOT DISTINCT FROM public.crm_auth_affiliate_name()
      AND public.crm_auth_affiliate_name() IS NOT NULL
    )
  );

-- INSERT: Admin sin restricción; Affiliate solo con su affiliate_name
CREATE POLICY clients_insert_scoped
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.crm_auth_role() = 'Admin'
    OR (
      public.crm_auth_role() = 'Affiliate'
      AND affiliate IS NOT DISTINCT FROM public.crm_auth_affiliate_name()
      AND public.crm_auth_affiliate_name() IS NOT NULL
    )
  );

-- UPDATE: Admin/Manager/Assistant → cualquier fila; Agent → cartera propia;
--         Affiliate → filas de su afiliado (sin cambiar affiliate ajeno)
CREATE POLICY clients_update_scoped
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant')
    OR (
      public.crm_auth_role() = 'Agent'
      AND owner_id = auth.uid()
    )
    OR (
      public.crm_auth_role() = 'Affiliate'
      AND affiliate IS NOT DISTINCT FROM public.crm_auth_affiliate_name()
      AND public.crm_auth_affiliate_name() IS NOT NULL
    )
  )
  WITH CHECK (
    public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant')
    OR (
      public.crm_auth_role() = 'Agent'
      AND owner_id = auth.uid()
    )
    OR (
      public.crm_auth_role() = 'Affiliate'
      AND affiliate IS NOT DISTINCT FROM public.crm_auth_affiliate_name()
      AND public.crm_auth_affiliate_name() IS NOT NULL
    )
  );

-- DELETE: exclusivamente Admin
CREATE POLICY clients_delete_admin_only
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (public.crm_auth_role() = 'Admin');

-- ---------------------------------------------------------------------------
-- 3. RPC check_crm_duplicates_v2 (SECURITY DEFINER — bypass RLS en importación)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.check_crm_duplicates_v2(text[]);

CREATE OR REPLACE FUNCTION public.check_crm_duplicates_v2(digit_keys text[])
RETURNS TABLE (
  existing_phone text,
  first_name text,
  last_name text,
  lead_status text,
  affiliate text,
  email text,
  owner_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.crm_auth_role();

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('Admin', 'Affiliate') THEN
    RAISE EXCEPTION 'Solo Admin o Afiliadora pueden verificar duplicados globales';
  END IF;

  RETURN QUERY
  SELECT
    c.phone AS existing_phone,
    c.first_name,
    c.last_name,
    c.lead_status::text,
    c.affiliate,
    c.email,
    COALESCE(
      nullif(trim(concat_ws(' ', o.first_name, o.last_name)), ''),
      o.email
    ) AS owner_name
  FROM public.clients AS c
  LEFT JOIN public.profiles AS o ON o.id = c.owner_id
  WHERE regexp_replace(c.phone, '[^0-9]', '', 'g') = ANY (
    SELECT nullif(regexp_replace(trim(dk), '[^0-9]', '', 'g'), '')
    FROM unnest(coalesce(digit_keys, ARRAY[]::text[])) AS dk
    WHERE nullif(regexp_replace(trim(dk), '[^0-9]', '', 'g'), '') IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.check_crm_duplicates_v2(text[]) IS
  'Detecta teléfonos existentes en clients sin filtro RLS por asesor. Solo Admin/Affiliate. Usado en importación masiva.';

REVOKE ALL ON FUNCTION public.check_crm_duplicates_v2(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_crm_duplicates_v2(text[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tabla activity_logs — RLS alineado con acceso al cliente
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_select_scoped ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_insert_scoped ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_update_admin_only ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_delete_admin_only ON public.activity_logs;

CREATE POLICY activity_logs_select_scoped
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.crm_can_access_client(client_phone));

CREATE POLICY activity_logs_insert_scoped
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND public.crm_auth_role() IN ('Admin', 'Agent', 'Assistant')
    AND public.crm_can_access_client(client_phone)
  );

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

-- ---------------------------------------------------------------------------
-- 5. Tabla appointments — RLS por cartera de asesor / roles operativos
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_select_scoped ON public.appointments;
DROP POLICY IF EXISTS appointments_insert_scoped ON public.appointments;
DROP POLICY IF EXISTS appointments_update_scoped ON public.appointments;
DROP POLICY IF EXISTS appointments_delete_scoped ON public.appointments;

CREATE POLICY appointments_select_scoped
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.crm_can_access_appointment(client_phone));

CREATE POLICY appointments_insert_scoped
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant', 'Agent')
    AND (created_by IS NULL OR created_by = auth.uid())
    AND public.crm_can_access_appointment(client_phone)
  );

CREATE POLICY appointments_update_scoped
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (public.crm_can_access_appointment(client_phone))
  WITH CHECK (
    public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant', 'Agent')
    AND public.crm_can_access_appointment(client_phone)
  );

CREATE POLICY appointments_delete_scoped
  ON public.appointments
  FOR DELETE
  TO authenticated
  USING (
    public.crm_auth_role() IN ('Admin', 'Manager', 'Assistant', 'Agent')
    AND public.crm_can_access_appointment(client_phone)
  );

-- ---------------------------------------------------------------------------
-- 6. register_crm_call — refuerzo de pertenencia para Agentes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_crm_call(client_phone_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_role text;
  v_digits text;
  v_client_phone text;
BEGIN
  v_agent_id := auth.uid();
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_role := public.crm_auth_role();

  v_digits := nullif(
    regexp_replace(trim(coalesce(client_phone_param, '')), '[^0-9]', '', 'g'),
    ''
  );

  IF v_digits IS NULL THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;

  SELECT c.phone
  INTO v_client_phone
  FROM public.clients AS c
  WHERE regexp_replace(c.phone, '[^0-9]', '', 'g') = v_digits
  LIMIT 1;

  IF v_client_phone IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- Agentes solo pueden registrar llamadas sobre su cartera
  IF v_role = 'Agent' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clients AS c
      WHERE c.phone = v_client_phone
        AND c.owner_id = v_agent_id
    ) THEN
      RAISE EXCEPTION 'No autorizado para registrar llamada a este cliente';
    END IF;
  ELSIF v_role = 'Affiliate' THEN
    RAISE EXCEPTION 'Afiliadora no puede registrar llamadas';
  ELSIF v_role NOT IN ('Admin', 'Manager', 'Assistant', 'Agent') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.clients
  SET
    total_calls = COALESCE(total_calls, 0) + 1,
    last_contacted = now()
  WHERE phone = v_client_phone;

  INSERT INTO public.activity_logs (client_phone, agent_id, text, type)
  VALUES (v_client_phone, v_agent_id, 'Llamada desde CRM', 'call');
END;
$$;

COMMENT ON FUNCTION public.register_crm_call(text) IS
  'Incrementa total_calls, actualiza last_contacted e inserta activity_logs. Valida cartera para Agentes.';

REVOKE ALL ON FUNCTION public.register_crm_call(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_crm_call(text) TO authenticated;
