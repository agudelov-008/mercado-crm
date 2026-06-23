-- Asistente: solo lectura de clientes con asesor asignado (owner_id NOT NULL).
-- Admin y Manager conservan acceso a toda la organización.

DROP POLICY IF EXISTS clients_select_scoped ON public.clients;

CREATE POLICY clients_select_scoped
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.crm_auth_role() IN ('Admin', 'Manager')
    OR (
      public.crm_auth_role() = 'Assistant'
      AND owner_id IS NOT NULL
    )
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
