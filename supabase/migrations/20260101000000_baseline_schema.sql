--
-- PostgreSQL database dump
--

\restrict gdfLfcfSeWz94M3sXWY3Xs3gUSzGNJZIK46phThM66wi1Eipp8IeGcBTzf6oclm

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: activity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_type AS ENUM (
    'call',
    'comment',
    'system'
);


--
-- Name: lead_status_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_status_type AS ENUM (
    'Call Again',
    'Potential',
    'Follow-Up',
    'Voicemail',
    'No Answer',
    'Wrong Number',
    'Wrong Info',
    'No registration',
    'Profiled',
    'Not Workeable',
    'New',
    'Nan',
    'FTD',
    'No Money <3 Days',
    'No Money >3 Days',
    'No interested',
    'Answer and hang up'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'Admin',
    'Manager',
    'Assistant',
    'Agent',
    'Affiliate'
);


--
-- Name: check_client_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_client_access(target_phone text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_user_role text;
  current_user_affiliate text;
  client_owner_id uuid;
  client_affiliate_name text;
BEGIN
  -- 1. Obtener el rol y el alias de la afiliadora del usuario autenticado
  SELECT role::text, affiliate_name INTO current_user_role, current_user_affiliate 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  -- 2. Si es Admin, CRM o Assistant, dar acceso total inmediato
  IF current_user_role IN ('Admin', 'CRM', 'Assistant') THEN
    RETURN true;
  END IF;
  
  -- 3. Obtener el asesor y la afiliadora asignada al cliente en cuestión
  SELECT owner_id, affiliate INTO client_owner_id, client_affiliate_name 
  FROM public.clients 
  WHERE phone = target_phone;
  
  -- 4. Regla para Agentes (Asesores)
  IF current_user_role = 'Agent' AND client_owner_id = current_user_id THEN
    RETURN true;
  END IF;
  
  -- 5. Regla para Afiliadoras
  IF current_user_role = 'Affiliate' AND client_affiliate_name = current_user_all_affiliate THEN
    -- Corrección menor por claridad de variable interna
  END IF;
  
  -- Ajuste de coincidencia directo para evitar fallas tipográficas:
  IF current_user_role = 'Affiliate' AND client_affiliate_name = current_user_affiliate THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: check_crm_duplicates_v2(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_crm_duplicates_v2(digit_keys text[]) RETURNS TABLE(existing_phone text, first_name text, last_name text, lead_status text, affiliate text, email text, owner_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION check_crm_duplicates_v2(digit_keys text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_crm_duplicates_v2(digit_keys text[]) IS 'Detecta teléfonos existentes en clients sin filtro RLS por asesor. Solo Admin/Affiliate. Usado en importación masiva.';


--
-- Name: create_affiliate_with_user(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_affiliate_with_user(company_name text, user_email text, user_password text, user_first_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_user_id UUID := gen_random_uuid();
BEGIN
    -- 1. Validar estrictamente que quien ejecuta sea un Administrador
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'Admin' THEN
        RAISE EXCEPTION 'Acceso denegado. Solo los Administradores pueden registrar afiliadoras.';
    END IF;

    -- 2. Insertar la empresa
    INSERT INTO public.affiliates (name)
    VALUES (company_name);

    -- 3. Insertar el usuario
    INSERT INTO auth.users (
        instance_id, id, email, encrypted_password, 
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, 
        aud, role, created_at, updated_at
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        LOWER(user_email),
        crypt(user_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('first_name', user_first_name, 'role', 'Affiliate', 'affiliate_name', company_name),
        'authenticated',
        'authenticated',
        now(),
        now()
    );

    -- 4. Insertar la identidad
    INSERT INTO auth.identities (
        id, 
        user_id, 
        identity_data, 
        provider, 
        provider_id, -- <--- DEBE SER EL CORREO PARA EVITAR EL ERROR 500
        last_sign_in_at, 
        created_at, 
        updated_at
    )
    VALUES (
        gen_random_uuid(), -- ID de la identidad
        new_user_id, -- Vinculado al usuario
        jsonb_build_object('sub', new_user_id, 'email', LOWER(user_email), 'email_verified', true),
        'email',
        LOWER(user_email), -- <--- AQUÍ ESTÁ LA CORRECCIÓN EXACTA
        now(),
        now(),
        now()
    );
END;
$$;


--
-- Name: create_agent_with_user(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_agent_with_user(user_email text, user_password text, user_first_name text, user_last_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'auth'
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


--
-- Name: FUNCTION create_agent_with_user(user_email text, user_password text, user_first_name text, user_last_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_agent_with_user(user_email text, user_password text, user_first_name text, user_last_name text) IS 'Crea cuenta Auth + profiles.role = Agent. Requiere caller Admin. Usado por User Management en el CRM.';


--
-- Name: create_agent_with_user(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_agent_with_user(user_email text, user_password text, user_first_name text, user_last_name text DEFAULT NULL::text, user_pbx_extension text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'auth'
    AS $$
DECLARE
  caller_role text;
  new_user_id uuid;
  trimmed_email text;
  trimmed_first text;
  trimmed_last text;
  trimmed_pbx text;
BEGIN
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
  trimmed_pbx := nullif(
    regexp_replace(trim(coalesce(user_pbx_extension, '')), '[^0-9]', '', 'g'),
    ''
  );

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

  INSERT INTO public.profiles (id, email, first_name, last_name, role, pbx_extension)
  VALUES (
    new_user_id,
    trimmed_email,
    trimmed_first,
    trimmed_last,
    'Agent',
    trimmed_pbx
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = 'Agent',
    pbx_extension = EXCLUDED.pbx_extension;

  PERFORM public.fix_user_tokens(new_user_id);
END;
$$;


--
-- Name: FUNCTION create_agent_with_user(user_email text, user_password text, user_first_name text, user_last_name text, user_pbx_extension text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_agent_with_user(user_email text, user_password text, user_first_name text, user_last_name text, user_pbx_extension text) IS 'Crea cuenta Auth + profiles.role = Agent. Requiere caller Admin. Usado por User Management en el CRM.';


--
-- Name: crm_auth_affiliate_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_auth_affiliate_name() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT nullif(trim(p.affiliate_name), '')
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;


--
-- Name: FUNCTION crm_auth_affiliate_name(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.crm_auth_affiliate_name() IS 'Nombre de afiliado vinculado al perfil (rol Affiliate).';


--
-- Name: crm_auth_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_auth_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;


--
-- Name: FUNCTION crm_auth_role(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.crm_auth_role() IS 'Devuelve profiles.role del usuario autenticado (auth.uid()). Usado por políticas RLS.';


--
-- Name: crm_can_access_appointment(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_can_access_appointment(p_client_phone text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION crm_can_access_appointment(p_client_phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.crm_can_access_appointment(p_client_phone text) IS 'True si el caller puede gestionar citas del cliente (Afiliadora excluida).';


--
-- Name: crm_can_access_client(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_can_access_client(p_phone text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION crm_can_access_client(p_phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.crm_can_access_client(p_phone text) IS 'True si el caller puede leer/escribir sobre el cliente identificado por phone.';


--
-- Name: crm_on_appointment_deleted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_on_appointment_deleted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION crm_on_appointment_deleted(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.crm_on_appointment_deleted() IS 'Registra en activity_logs cuando se elimina una cita. Usa OLD.client_phone para evitar violaciones NOT NULL.';


--
-- Name: delete_activity_log(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_activity_log(p_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION delete_activity_log(p_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_activity_log(p_id bigint) IS 'Elimina una entrada de activity_logs. Requiere caller Admin.';


--
-- Name: fix_user_tokens(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fix_user_tokens(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE auth.users 
    SET 
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = ''
    WHERE id = target_user_id;
END;
$$;


--
-- Name: handle_appointment_duration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_appointment_duration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Si el frontend no envía fecha de fin, le sumamos 30 minutos a la de inicio por defecto
    IF NEW.ends_at IS NULL THEN
        NEW.ends_at := NEW.starts_at + INTERVAL '30 minutes';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: handle_client_assignment_metadata(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_client_assignment_metadata() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. CASO: CLIENTE NUEVO (INSERT)
    IF (TG_OP = 'INSERT') THEN
        IF NEW.owner_id IS NOT NULL THEN
            NEW.last_assignment := NOW();
            NEW.previous_owner_id := NEW.owner_id; -- Si nunca se ha reasignado, pone el actual
        END IF;
    END IF;

    -- 2. CASO: EDICIÓN / REASIGNACIÓN (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        -- Detectar si el asesor cambió
        IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
            NEW.last_assignment := NOW(); -- Last assignment: Fecha de Asignación actual
            
            IF OLD.owner_id IS NULL THEN
                NEW.previous_owner_id := NEW.owner_id; -- Si no tenía antes, pone el actual
            ELSE
                NEW.previous_owner_id := OLD.owner_id; -- Si ya se reasignó, guarda el anterior
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: handle_client_metadata_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_client_metadata_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 1. CASO: CLIENTE NUEVO (INSERT)
    IF (TG_OP = 'INSERT') THEN
        -- Asignación inicial si nace con asesor
        IF NEW.owner_id IS NOT NULL THEN
            NEW.last_assignment := NOW();
            NEW.previous_owner_id := NEW.owner_id;
        END IF;
        -- Estado inicial predeterminado
        NEW.previous_lead_status := NEW.lead_status;
    END IF;

    -- 2. CASO: EDICIÓN / REASIGNACIÓN O CAMBIO DE ESTADO (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        -- Control de Asesoría (Dueño)
        IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
            NEW.last_assignment := NOW();
            IF OLD.owner_id IS NULL THEN
                NEW.previous_owner_id := NEW.owner_id;
            ELSE
                NEW.previous_owner_id := OLD.owner_id;
            END IF;
        END IF;

        -- CONTROL DE ESTADO: Si cambia el lead_status, guarda el viejo en previous_lead_status
        IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
            NEW.previous_lead_status := OLD.lead_status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: handle_delete_affiliate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_delete_affiliate() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Encontrar el usuario responsable con rol Affiliate asociado a la empresa que se va a borrar
    SELECT id INTO target_user_id 
    FROM public.profiles 
    WHERE affiliate_name = OLD.name AND role = 'Affiliate';

    -- Si el usuario existe, se borra directamente de auth.users
    -- Nota: Al borrar de auth.users, el motor de Supabase borra en cascada 
    -- automáticamente sus identidades y su fila en public.profiles
    IF target_user_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = target_user_id;
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    incoming_role TEXT;
    final_enum_role public.user_role;
BEGIN
    -- Corrección automatizada del bug de tokens de Supabase
    UPDATE auth.users 
    SET 
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = ''
    WHERE id = NEW.id;

    -- Capturar el rol del metadato y pasarlo a minúsculas para estandarizar
    incoming_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'agent'));

    -- Mapeo inteligente y seguro para el ENUM
    IF incoming_role IN ('manager', 'crm') THEN
        final_enum_role := 'Manager'::public.user_role;
    ELSIF incoming_role IN ('assistant', 'asistente') THEN
        final_enum_role := 'Assistant'::public.user_role;
    ELSIF incoming_role = 'admin' THEN
        final_enum_role := 'Admin'::public.user_role;
    ELSIF incoming_role = 'affiliate' THEN
        final_enum_role := 'Affiliate'::public.user_role;
    ELSE
        final_enum_role := 'Agent'::public.user_role;
    END IF;

    -- Insertar en la tabla profiles con el ENUM perfectamente resuelto
    INSERT INTO public.profiles (id, first_name, email, role, affiliate_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      NEW.email,
      final_enum_role, 
      NEW.raw_user_meta_data->>'affiliate_name'
    );
    
    RETURN NEW;
END;
$$;


--
-- Name: log_appointment_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_appointment_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- 🛡️ Bloque seguro con captura de excepciones
    BEGIN
        INSERT INTO activity_logs (client_phone, text, type, created_at)
        VALUES (
            OLD.client_phone, 
            'Cita eliminada o cancelada del sistema.', 
            'system', 
            NOW()
        );
    EXCEPTION 
        -- Si ocurre una violación de llave foránea (el cliente se está borrando), la ignoramos
        WHEN foreign_key_violation THEN
            NULL; -- No hace nada, permite que la transacción continúe limpiamente
    END;

    RETURN OLD;
END;
$$;


--
-- Name: log_appointment_audit_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_appointment_audit_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    BEGIN
        INSERT INTO activity_logs (client_phone, text, type, created_at)
        VALUES (
            OLD.client_phone, 
            'Cita eliminada o cancelada del sistema.', 
            'system', 
            NOW()
        );
    EXCEPTION 
        -- Si el cliente ya fue eliminado por el borrado masivo, ignoramos el log silenciosamente
        WHEN foreign_key_violation THEN
            NULL; 
    END;

    RETURN OLD;
END;
$$;


--
-- Name: log_client_system_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_client_system_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    agent_name_old TEXT;
    agent_name_new TEXT;
    log_text TEXT;
    current_agent_id UUID;
BEGIN
    -- Capturar el ID del usuario que está haciendo el cambio en Supabase
    current_agent_id := auth.uid();

    -- 1. CASO: CLIENTE NUEVO (INSERT)
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_logs (client_phone, agent_id, type, text)
        VALUES (NEW.phone, current_agent_id, 'comment', '⚙️ [SISTEMA] Cliente creado en la plataforma.');
        RETURN NEW;
    END IF;

    -- 2. CASO: EDICIÓN (UPDATE)
    IF (TG_OP = 'UPDATE') THEN
        log_text := '';

        -- Detectar cambio de Estado (Lead Status)
        IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
            log_text := log_text || '🔄 [ESTADO] Cambiado de "' || OLD.lead_status || '" a "' || NEW.lead_status || '". ';
        END IF;

        -- Detectar cambio de Asesor (Owner / Asignación)
        IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
            IF OLD.owner_id IS NULL THEN
                SELECT first_name || ' ' || COALESCE(last_name, '') INTO agent_name_new FROM public.profiles WHERE id = NEW.owner_id;
                log_text := log_text || '👤 [ASIGNACIÓN] Cliente asignado al asesor: ' || COALESCE(agent_name_new, 'Desconocido') || '. ';
            ELSIF NEW.owner_id IS NULL THEN
                log_text := log_text || '👤 [ASIGNACIÓN] Se retiró el asesor asignado. ';
            ELSE
                SELECT first_name || ' ' || COALESCE(last_name, '') INTO agent_name_old FROM public.profiles WHERE id = OLD.owner_id;
                SELECT first_name || ' ' || COALESCE(last_name, '') INTO agent_name_new FROM public.profiles WHERE id = NEW.owner_id;
                log_text := log_text || '🔀 [REASIGNACIÓN] Cliente reasignado de "' || COALESCE(agent_name_old, 'Anterior') || '" a "' || COALESCE(agent_name_new, 'Nuevo') || '". ';
            END IF;
        END IF;

        -- Si hubo algún cambio registrado, lo insertamos en el historial
        IF log_text <> '' THEN
            INSERT INTO public.activity_logs (client_phone, agent_id, type, text)
            VALUES (NEW.phone, current_agent_id, 'comment', log_text);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: register_crm_call(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_crm_call(client_phone_param text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION register_crm_call(client_phone_param text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.register_crm_call(client_phone_param text) IS 'Incrementa total_calls, actualiza last_contacted e inserta activity_logs. Valida cartera para Agentes.';


--
-- Name: update_activity_log(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_activity_log(p_id bigint, p_text text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION update_activity_log(p_id bigint, p_text text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_activity_log(p_id bigint, p_text text) IS 'Actualiza el texto de activity_logs. Requiere caller Admin.';


--
-- Name: update_affiliate_with_user(bigint, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_affiliate_with_user(affiliate_id bigint, company_name text, user_email text, user_first_name text, user_password text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    old_company_name TEXT;
    target_user_id UUID;
BEGIN
    -- 1. Validar estrictamente que quien ejecuta sea un Administrador
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'Admin' THEN
        RAISE EXCEPTION 'Acceso denegado. Solo los Administradores pueden actualizar afiliadoras.';
    END IF;

    -- 2. Obtener el nombre actual de la empresa antes de actualizarla
    SELECT name INTO old_company_name FROM public.affiliates WHERE id = affiliate_id;
    
    IF old_company_name IS NULL THEN
        RAISE EXCEPTION 'Afiliadora no encontrada.';
    END IF;

    -- 3. Encontrar el ID del usuario de tipo Affiliate vinculado a esta empresa
    SELECT id INTO target_user_id 
    FROM public.profiles 
    WHERE affiliate_name = old_company_name AND role = 'Affiliate'
    LIMIT 1;

    -- 4. Actualizar la empresa (El cambio de nombre se propagará a la tabla profiles por ON UPDATE CASCADE)
    UPDATE public.affiliates 
    SET name = company_name 
    WHERE id = affiliate_id;

    -- 5. Si encontramos un usuario administrador o responsable vinculado, actualizamos sus credenciales
    IF target_user_id IS NOT NULL THEN
        -- Actualizar la tabla central de autenticación de Supabase
        UPDATE auth.users
        SET 
            email = user_email,
            raw_user_meta_data = raw_user_meta_data || jsonb_build_object('first_name', user_first_name, 'affiliate_name', company_name),
            updated_at = now()
        WHERE id = target_user_id;

        -- Si el administrador escribió una nueva contraseña (no está vacía), se encripta y actualiza
        IF user_password IS NOT NULL AND user_password != '' THEN
            UPDATE auth.users
            SET encrypted_password = crypt(user_password, gen_salt('bf'))
            WHERE id = target_user_id;
        END IF;

        -- Forzar la actualización manual en los perfiles públicos por consistencia inmediata
        UPDATE public.profiles
        SET 
            first_name = user_first_name,
            email = user_email
        WHERE id = target_user_id;
    END IF;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id bigint NOT NULL,
    client_phone text NOT NULL,
    agent_id uuid,
    type public.activity_type DEFAULT 'comment'::public.activity_type NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: affiliates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliates (
    id bigint NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: affiliates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.affiliates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.affiliates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_phone text NOT NULL,
    title text NOT NULL,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.appointments REPLICA IDENTITY FULL;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    phone text NOT NULL,
    created_on timestamp with time zone DEFAULT now(),
    tp_account text,
    first_name text NOT NULL,
    last_name text,
    country text,
    affiliate text,
    owner_id uuid,
    lead_status public.lead_status_type DEFAULT 'New'::public.lead_status_type NOT NULL,
    last_assignment timestamp with time zone,
    last_contacted timestamp with time zone,
    total_calls integer DEFAULT 0 NOT NULL,
    previous_lead_status public.lead_status_type,
    previous_owner_id uuid,
    email text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    role public.user_role DEFAULT 'Agent'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    affiliate_name text,
    pbx_extension text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['Admin'::public.user_role, 'Agent'::public.user_role, 'Affiliate'::public.user_role, 'Manager'::public.user_role, 'Assistant'::public.user_role])))
);


--
-- Name: COLUMN profiles.pbx_extension; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.pbx_extension IS 'Extensión numérica en la central telefónica (IRIS PBX) del miembro del equipo.';


--
-- Name: secure_clients; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.secure_clients WITH (security_invoker='true') AS
 SELECT c.first_name,
    c.last_name,
    c.country,
    c.affiliate,
    c.tp_account,
    c.phone,
    c.email,
    c.lead_status,
    c.owner_id,
    COALESCE(NULLIF(TRIM(BOTH FROM concat_ws(' '::text, o.first_name, o.last_name)), ''::text), o.email) AS owner_name,
    c.total_calls,
    c.previous_lead_status,
    c.previous_owner_id,
    COALESCE(NULLIF(TRIM(BOTH FROM concat_ws(' '::text, po.first_name, po.last_name)), ''::text), po.email) AS previous_owner_name,
    c.created_on,
    c.last_assignment,
    c.last_contacted,
    c.updated_at
   FROM ((public.clients c
     LEFT JOIN public.profiles o ON ((o.id = c.owner_id)))
     LEFT JOIN public.profiles po ON ((po.id = c.previous_owner_id)));


--
-- Name: VIEW secure_clients; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.secure_clients IS 'Vista de lectura del CRM; respeta RLS de public.clients vía security_invoker.';


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: affiliates affiliates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_name_key UNIQUE (name);


--
-- Name: affiliates affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: clients clients_phone_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_phone_unique UNIQUE (phone);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (phone);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: idx_clients_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_affiliate ON public.clients USING btree (affiliate);


--
-- Name: idx_clients_created_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_created_on ON public.clients USING btree (created_on DESC NULLS LAST);


--
-- Name: idx_clients_owner_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_owner_created ON public.clients USING btree (owner_id, created_on DESC NULLS LAST);


--
-- Name: idx_clients_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_owner_id ON public.clients USING btree (owner_id);


--
-- Name: idx_clients_tp_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_tp_account ON public.clients USING btree (tp_account);


--
-- Name: appointments appointments_delete_activity_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER appointments_delete_activity_log AFTER DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.crm_on_appointment_deleted();


--
-- Name: appointments trigger_appointment_duration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_appointment_duration BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_duration();


--
-- Name: clients trigger_client_assignment_metadata; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_client_assignment_metadata BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_client_metadata_changes();


--
-- Name: clients trigger_client_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_client_audit_log AFTER INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_client_system_changes();


--
-- Name: affiliates trigger_delete_affiliate_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_delete_affiliate_user BEFORE DELETE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.handle_delete_affiliate();


--
-- Name: activity_logs activity_logs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_client_phone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_client_phone_fkey FOREIGN KEY (client_phone) REFERENCES public.clients(phone) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: appointments appointments_client_phone_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_phone_fkey FOREIGN KEY (client_phone) REFERENCES public.clients(phone) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: appointments appointments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: clients clients_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: clients clients_previous_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_previous_owner_id_fkey FOREIGN KEY (previous_owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_affiliate_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_affiliate_name_fkey FOREIGN KEY (affiliate_name) REFERENCES public.affiliates(name) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: clients Admin and Affiliate can update clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and Affiliate can update clients" ON public.clients FOR UPDATE TO authenticated USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Admin'::public.user_role) OR ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Affiliate'::public.user_role) AND (affiliate = ( SELECT profiles.affiliate_name
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))))));


--
-- Name: affiliates Admins tienen control total sobre affiliates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins tienen control total sobre affiliates" ON public.affiliates TO authenticated USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Admin'::public.user_role)) WITH CHECK ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Admin'::public.user_role));


--
-- Name: affiliates Lectura de affiliates para todos los autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lectura de affiliates para todos los autenticados" ON public.affiliates FOR SELECT TO authenticated USING (true);


--
-- Name: clients Permitir a Agentes actualizar estados de sus clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir a Agentes actualizar estados de sus clientes" ON public.clients FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) AND (( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Agent'::public.user_role))) WITH CHECK (((owner_id = auth.uid()) AND (( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Agent'::public.user_role)));


--
-- Name: profiles Permitir a los Admins actualizar perfiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir a los Admins actualizar perfiles" ON public.profiles FOR UPDATE TO authenticated USING ((( SELECT profiles_1.role
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'Admin'::public.user_role));


--
-- Name: profiles Permitir a los Admins eliminar perfiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir a los Admins eliminar perfiles" ON public.profiles FOR DELETE TO authenticated USING ((( SELECT profiles_1.role
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'Admin'::public.user_role));


--
-- Name: profiles Permitir a los Admins insertar perfiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir a los Admins insertar perfiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((( SELECT profiles_1.role
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'Admin'::public.user_role));


--
-- Name: clients Permitir actualización en clients según rol; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir actualización en clients según rol" ON public.clients FOR UPDATE TO authenticated USING (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['Admin'::public.user_role, 'Manager'::public.user_role, 'Assistant'::public.user_role])) OR (owner_id = auth.uid()) OR ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Affiliate'::public.user_role) AND ((affiliate = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (affiliate = ( SELECT profiles.affiliate_name
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))))))) WITH CHECK (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['Admin'::public.user_role, 'Manager'::public.user_role, 'Assistant'::public.user_role])) OR (owner_id = auth.uid()) OR ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Affiliate'::public.user_role) AND ((affiliate = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (affiliate = ( SELECT profiles.affiliate_name
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))))));


--
-- Name: clients Permitir borrado masivo solo a Administradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir borrado masivo solo a Administradores" ON public.clients FOR DELETE TO authenticated USING ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Admin'::public.user_role));


--
-- Name: clients Permitir inserción en clients según rol; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inserción en clients según rol" ON public.clients FOR INSERT TO authenticated WITH CHECK (((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['Admin'::public.user_role, 'Manager'::public.user_role, 'Assistant'::public.user_role, 'Agent'::public.user_role])) OR ((( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'Affiliate'::public.user_role) AND ((affiliate = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (affiliate = ( SELECT profiles.affiliate_name
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))))));


--
-- Name: profiles Permitir lectura de perfiles a usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir lectura de perfiles a usuarios autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Profiles are readable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are readable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs activity_logs_delete_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_delete_admin_only ON public.activity_logs FOR DELETE TO authenticated USING ((public.crm_auth_role() = 'Admin'::text));


--
-- Name: activity_logs activity_logs_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_insert_scoped ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (((agent_id = auth.uid()) AND (public.crm_auth_role() = ANY (ARRAY['Admin'::text, 'Agent'::text, 'Assistant'::text])) AND public.crm_can_access_client(client_phone)));


--
-- Name: activity_logs activity_logs_insert_secured_v6; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_insert_secured_v6 ON public.activity_logs FOR INSERT TO authenticated WITH CHECK ((client_phone IN ( SELECT clients.phone
   FROM public.clients
  WHERE ((( SELECT profiles.role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = ANY (ARRAY['Admin'::public.user_role, 'Manager'::public.user_role, 'Assistant'::public.user_role])) OR (clients.owner_id = auth.uid()) OR ((clients.affiliate = ( SELECT profiles.email
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (clients.affiliate = ( SELECT profiles.affiliate_name
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: activity_logs activity_logs_select_chained_v4; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_select_chained_v4 ON public.activity_logs FOR SELECT TO authenticated USING ((client_phone IN ( SELECT clients.phone
   FROM public.clients)));


--
-- Name: activity_logs activity_logs_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_select_scoped ON public.activity_logs FOR SELECT TO authenticated USING (public.crm_can_access_client(client_phone));


--
-- Name: activity_logs activity_logs_update_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_update_admin_only ON public.activity_logs FOR UPDATE TO authenticated USING ((public.crm_auth_role() = 'Admin'::text)) WITH CHECK ((public.crm_auth_role() = 'Admin'::text));


--
-- Name: affiliates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments appointments_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_delete_scoped ON public.appointments FOR DELETE TO authenticated USING (((public.crm_auth_role() = ANY (ARRAY['Admin'::text, 'Manager'::text, 'Assistant'::text, 'Agent'::text])) AND public.crm_can_access_appointment(client_phone)));


--
-- Name: appointments appointments_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_insert_scoped ON public.appointments FOR INSERT TO authenticated WITH CHECK (((public.crm_auth_role() = ANY (ARRAY['Admin'::text, 'Manager'::text, 'Assistant'::text, 'Agent'::text])) AND ((created_by IS NULL) OR (created_by = auth.uid())) AND public.crm_can_access_appointment(client_phone)));


--
-- Name: appointments appointments_insert_secured_v4; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_insert_secured_v4 ON public.appointments FOR INSERT TO authenticated WITH CHECK ((client_phone IN ( SELECT clients.phone
   FROM public.clients
  WHERE ((( SELECT profiles.role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = ANY (ARRAY['Admin'::public.user_role, 'Manager'::public.user_role, 'Assistant'::public.user_role])) OR (clients.owner_id = auth.uid())))));


--
-- Name: appointments appointments_select_chained_v3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_select_chained_v3 ON public.appointments FOR SELECT TO authenticated USING ((client_phone IN ( SELECT clients.phone
   FROM public.clients)));


--
-- Name: appointments appointments_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_select_scoped ON public.appointments FOR SELECT TO authenticated USING (public.crm_can_access_appointment(client_phone));


--
-- Name: appointments appointments_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appointments_update_scoped ON public.appointments FOR UPDATE TO authenticated USING (public.crm_can_access_appointment(client_phone)) WITH CHECK (((public.crm_auth_role() = ANY (ARRAY['Admin'::text, 'Manager'::text, 'Assistant'::text, 'Agent'::text])) AND public.crm_can_access_appointment(client_phone)));


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clients clients_delete_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_delete_admin_only ON public.clients FOR DELETE TO authenticated USING ((public.crm_auth_role() = 'Admin'::text));


--
-- Name: clients clients_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_insert_scoped ON public.clients FOR INSERT TO authenticated WITH CHECK (((public.crm_auth_role() = 'Admin'::text) OR ((public.crm_auth_role() = 'Affiliate'::text) AND (NOT (affiliate IS DISTINCT FROM public.crm_auth_affiliate_name())) AND (public.crm_auth_affiliate_name() IS NOT NULL))));


--
-- Name: clients clients_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_select_scoped ON public.clients FOR SELECT TO authenticated USING (((( SELECT public.crm_auth_role() AS crm_auth_role) = ANY (ARRAY['Admin'::text, 'Manager'::text])) OR ((( SELECT public.crm_auth_role() AS crm_auth_role) = 'Assistant'::text) AND (owner_id IS NOT NULL)) OR ((( SELECT public.crm_auth_role() AS crm_auth_role) = 'Agent'::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR ((( SELECT public.crm_auth_role() AS crm_auth_role) = 'Affiliate'::text) AND (NOT (affiliate IS DISTINCT FROM ( SELECT public.crm_auth_affiliate_name() AS crm_auth_affiliate_name))) AND (( SELECT public.crm_auth_affiliate_name() AS crm_auth_affiliate_name) IS NOT NULL))));


--
-- Name: clients clients_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_update_scoped ON public.clients FOR UPDATE TO authenticated USING (((public.crm_auth_role() = ANY (ARRAY['Admin'::text, 'Manager'::text, 'Assistant'::text])) OR ((public.crm_auth_role() = 'Agent'::text) AND (owner_id = auth.uid())) OR ((public.crm_auth_role() = 'Affiliate'::text) AND (NOT (affiliate IS DISTINCT FROM public.crm_auth_affiliate_name())) AND (public.crm_auth_affiliate_name() IS NOT NULL)))) WITH CHECK (((public.crm_auth_role() = ANY (ARRAY['Admin'::text, 'Manager'::text, 'Assistant'::text])) OR ((public.crm_auth_role() = 'Agent'::text) AND (owner_id = auth.uid())) OR ((public.crm_auth_role() = 'Affiliate'::text) AND (NOT (affiliate IS DISTINCT FROM public.crm_auth_affiliate_name())) AND (public.crm_auth_affiliate_name() IS NOT NULL))));


--
-- Name: activity_logs policy_activity_logs_select_unified; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY policy_activity_logs_select_unified ON public.activity_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.phone = activity_logs.client_phone) AND ((( SELECT (profiles.role)::text AS role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = ANY (ARRAY['Admin'::text, 'CRM'::text, 'Manager'::text, 'Assistant'::text])) OR ((( SELECT (profiles.role)::text AS role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = 'Agent'::text) AND (c.owner_id = auth.uid())) OR ((( SELECT (profiles.role)::text AS role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = 'Affiliate'::text) AND (c.affiliate = ( SELECT profiles.affiliate_name
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))));


--
-- Name: appointments policy_appointments_select_unified; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY policy_appointments_select_unified ON public.appointments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.phone = appointments.client_phone) AND ((( SELECT (profiles.role)::text AS role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = ANY (ARRAY['Admin'::text, 'CRM'::text, 'Manager'::text, 'Assistant'::text])) OR ((( SELECT (profiles.role)::text AS role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = 'Agent'::text) AND (c.owner_id = auth.uid())) OR ((( SELECT (profiles.role)::text AS role
           FROM public.profiles
          WHERE (profiles.id = auth.uid())) = 'Affiliate'::text) AND (c.affiliate = ( SELECT profiles.affiliate_name
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict gdfLfcfSeWz94M3sXWY3Xs3gUSzGNJZIK46phThM66wi1Eipp8IeGcBTzf6oclm

