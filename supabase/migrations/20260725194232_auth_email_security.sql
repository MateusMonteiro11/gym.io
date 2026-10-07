-- Gym.o auth email security migration
-- Safe adoption: no data deletion, no backfill, no column drops.
-- Profile creation moves to auth.users email confirmation trigger.
-- Existing users, treinos and relations remain untouched.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_nome text;
BEGIN
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id_usuario = NEW.id) THEN
    RETURN NEW;
  END IF;

  profile_nome := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'nome', '')), '');

  IF profile_nome IS NULL THEN
    profile_nome := split_part(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.usuarios (id_usuario, nome, email, status)
  VALUES (NEW.id, profile_nome, NEW.email, 'ativo');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_email_confirmed();

CREATE OR REPLACE FUNCTION public.criar_treinos_padrao(novo_usuario uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  treino_modelo RECORD;
  novo_treino_id bigint;
  secao_modelo RECORD;
  nova_secao_id bigint;
  exercicio_modelo RECORD;
BEGIN
  FOR treino_modelo IN
    SELECT *
    FROM public.treinos
    WHERE tipo_treino = 'sistema'
      AND id_usuario IS NULL
  LOOP
    INSERT INTO public.treinos (
      nome,
      descricao,
      publico,
      criado_em,
      tipo,
      tipo_treino,
      id_usuario
    )
    VALUES (
      treino_modelo.nome,
      treino_modelo.descricao,
      false,
      NOW() AT TIME ZONE 'utc',
      'sistema',
      'usuario',
      novo_usuario
    )
    RETURNING id_treino INTO novo_treino_id;

    FOR secao_modelo IN
      SELECT *
      FROM public.secoes_treino
      WHERE id_treino = treino_modelo.id_treino
      ORDER BY ordem
    LOOP
      INSERT INTO public.secoes_treino (
        id_treino,
        nome,
        descricao,
        ordem
      )
      VALUES (
        novo_treino_id,
        secao_modelo.nome,
        secao_modelo.descricao,
        secao_modelo.ordem
      )
      RETURNING id_secao INTO nova_secao_id;

      FOR exercicio_modelo IN
        SELECT *
        FROM public.treinos_exercicios
        WHERE id_secao = secao_modelo.id_secao
        ORDER BY ordem
      LOOP
        INSERT INTO public.treinos_exercicios (
          id_treino,
          id_secao,
          id_exercicio,
          series,
          repeticoes,
          carga,
          descanso_segundos,
          ordem
        )
        VALUES (
          novo_treino_id,
          nova_secao_id,
          exercicio_modelo.id_exercicio,
          exercicio_modelo.series,
          exercicio_modelo.repeticoes,
          exercicio_modelo.carga,
          exercicio_modelo.descanso_segundos,
          exercicio_modelo.ordem
        );
      END LOOP;
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_criar_treinos_usuario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  PERFORM public.criar_treinos_padrao(NEW.id_usuario);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_treinos_padrao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_treinos_padrao(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.criar_treinos_padrao(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.criar_treinos_padrao(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.trigger_criar_treinos_usuario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_criar_treinos_usuario() FROM anon;
REVOKE ALL ON FUNCTION public.trigger_criar_treinos_usuario() FROM authenticated;

DROP POLICY IF EXISTS "Permitir cadastro de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir leitura de usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Only authenticated users on registration" ON public.usuarios;

COMMIT;