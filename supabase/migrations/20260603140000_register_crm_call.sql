-- Registra una llamada CRM: incrementa total_calls y deja rastro en activity_logs.
CREATE OR REPLACE FUNCTION public.register_crm_call(client_phone_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_digits text;
  v_client_phone text;
BEGIN
  v_agent_id := auth.uid();
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

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
  'Incrementa total_calls del cliente e inserta activity_logs tipo call. Usado al pulsar Llamar en el CRM.';

REVOKE ALL ON FUNCTION public.register_crm_call(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_crm_call(text) TO authenticated;
