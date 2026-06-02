-- =============================================================================
-- RPC: create_agent_with_user
-- =============================================================================
-- Crea un usuario en Auth + perfil con rol 'Agent' (Asesor).
-- Misma familia que create_affiliate_with_user (afiliadoras).
--
-- Documentación completa: supabase/docs/provisioning-asesores.md
--
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_agent_with_user(
  user_email text,
  user_password text,
  user_first_name text,
  user_last_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  caller_role text;
  new_user_id uuid;
  trimmed_email text;
  trimmed_first text;
  trimmed_last text;
BEGIN
  -- Solo Admin puede crear asesores (igual que afiliadoras)
  SELECT p.role
  INTO caller_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF caller_role IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Solo administradores pueden crear asesores';
  END IF;

  trimmed_email := lower(trim(user_email));
  trimmed_first := nullif(trim(user_first_name), '');
  trimmed_last := nullif(trim(coalesce(user_last_name, '')), '');

  IF trimmed_email IS NULL OR trimmed_email = '' THEN
    RAISE EXCEPTION 'El correo electrónico es obligatorio';
  END IF;

  IF user_password IS NULL OR length(user_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres';
  END IF;

  IF trimmed_first IS NULL THEN
    RAISE EXCEPTION 'El nombre es obligatorio';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE lower(u.email) = trimmed_email
  ) THEN
    RAISE EXCEPTION 'Ya existe un usuario con el correo %', trimmed_email;
  END IF;

  new_user_id := gen_random_uuid();

  -- Usuario confirmado (sin correo de verificación)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    trimmed_email,
    extensions.crypt(user_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', trimmed_first,
      'last_name', coalesce(trimmed_last, ''),
      'role', 'Agent'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Perfil explícito (por si el trigger no asigna rol Agent)
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    new_user_id,
    trimmed_email,
    trimmed_first,
    trimmed_last,
    'Agent'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = 'Agent';

  -- Mismo parche que afiliadoras (evita tokens NULL en Auth)
  PERFORM public.fix_user_tokens(new_user_id);
END;
$$;

COMMENT ON FUNCTION public.create_agent_with_user(text, text, text, text) IS
  'Crea cuenta Auth + profiles.role = Agent. Requiere caller Admin. Usado por User Management en el CRM.';

REVOKE ALL ON FUNCTION public.create_agent_with_user(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_agent_with_user(text, text, text, text) TO authenticated;
