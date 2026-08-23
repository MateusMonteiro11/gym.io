-- Gym.io workout session persistence V1 - EXPAND.
--
-- EXPAND preserves the legacy historical writer while adding the V2 boundary:
--   * authenticated can read its own session rows, but cannot write them directly.
--   * legacy authenticated writes to historico_treinos/historico_exercicios remain
--     available until the separate CONTRACT migration is intentionally applied.
--   * every mutation goes through a public RPC owned by a dedicated NOLOGIN,
--     NOBYPASSRLS role.
--   * implementation functions are SECURITY INVOKER in gymio_private.
--   * anon/authenticated have neither USAGE on gymio_private nor EXECUTE on its
--     functions.
--
-- This migration intentionally does not implement offline queues, event replay,
-- multi-device conflict resolution, or Web Push. The revision argument is only
-- an optimistic concurrency guard against duplicate/stale UI transitions.

-- -----------------------------------------------------------------------------
-- 1. Least-privilege execution role and private schema
-- -----------------------------------------------------------------------------

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'gymio_workout_executor'
  ) then
    create role gymio_workout_executor
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;
end
$migration$;

do $role_attributes$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles as r
    where r.rolname = 'gymio_workout_executor'
      and not r.rolsuper
      and not r.rolinherit
      and not r.rolcreaterole
      and not r.rolcreatedb
      and not r.rolcanlogin
      and not r.rolreplication
      and not r.rolbypassrls
  ) then
    raise exception 'existing gymio_workout_executor has unsafe attributes';
  end if;
end
$role_attributes$;

do $role_memberships$
begin
  if exists (
    select 1
    from pg_catalog.pg_auth_members as m
    join pg_catalog.pg_roles as granted_role on granted_role.oid = m.roleid
    join pg_catalog.pg_roles as member_role on member_role.oid = m.member
    where granted_role.rolname = 'gymio_workout_executor'
      and member_role.rolname in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a Data API role unexpectedly belongs to gymio_workout_executor';
  end if;
end
$role_memberships$;

create schema if not exists gymio_private authorization postgres;
alter schema gymio_private owner to postgres;

revoke all on schema gymio_private from public, anon, authenticated;
grant usage on schema gymio_private to gymio_workout_executor;
grant usage on schema public to gymio_workout_executor;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoke that
-- default for functions created by this migration role in the private schema.
alter default privileges in schema gymio_private
  revoke execute on functions from public;

-- PostgreSQL 17 grants the creating CREATEROLE principal an administrative
-- membership with INHERIT=false and SET=false. That managed membership is used
-- to create a separate SET-only grant for ownership transfer. The transient
-- grant is revoked by its explicit grantor before assertions run.
grant gymio_workout_executor to postgres
  with inherit false, set true
  granted by postgres;
grant create on schema public, gymio_private to gymio_workout_executor;

-- auth.uid() currently derives the user id exclusively from request GUCs. The
-- executor intentionally has no USAGE on auth, so the private implementation
-- uses the equivalent local helper without touching Auth schemas or tables.
create or replace function gymio_private.request_uid()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$function$;

alter function gymio_private.request_uid()
  owner to gymio_workout_executor;

set role gymio_workout_executor;
revoke all on function gymio_private.request_uid()
  from public, anon, authenticated, service_role;
reset role;

-- -----------------------------------------------------------------------------
-- 2. Defensive constraints on the workout definition used as session authority
-- -----------------------------------------------------------------------------

alter table public.treinos_exercicios
  add constraint treinos_exercicios_series_validas
    check (series between 1 and 32767),
  add constraint treinos_exercicios_repeticoes_validas
    check (repeticoes is null or repeticoes between 0 and 32767),
  add constraint treinos_exercicios_carga_valida
    check (carga is null or carga between 0 and 99999999),
  add constraint treinos_exercicios_descanso_valido
    check (descanso_segundos is null or descanso_segundos between 0 and 3600),
  add constraint treinos_exercicios_ordem_valida
    check (
      ordem is null
      or (
        length(btrim(ordem)) between 1 and 20
        and btrim(ordem) ~ '^[+-]?[0-9]+$'
      )
    );

alter table public.treinos_exercicios
  add constraint treinos_exercicios_id_treino_exercicio_id_treino_key
  unique (id_treino_exercicio, id_treino);

-- -----------------------------------------------------------------------------
-- 3. Durable session and completed-set tables
-- -----------------------------------------------------------------------------

create table public.treino_sessoes (
  id_sessao uuid primary key default gen_random_uuid(),
  id_usuario uuid not null
    references public.usuarios (id_usuario),
  id_treino bigint not null
    references public.treinos (id_treino),
  id_treino_exercicio_atual bigint,
  indice_exercicio_atual integer not null default 0,
  serie_atual smallint not null default 1,
  status text not null default 'ativa',
  fase text not null default 'execucao',
  descanso_padrao_segundos integer not null default 60,
  iniciada_em timestamptz not null default clock_timestamp(),
  pausada_em timestamptz,
  segundos_pausados integer not null default 0,
  descanso_iniciado_em timestamptz,
  descanso_termina_em timestamptz,
  finalizada_em timestamptz,
  atualizada_em timestamptz not null default clock_timestamp(),
  revisao bigint not null default 0,

  constraint treino_sessoes_id_sessao_id_treino_key
    unique (id_sessao, id_treino),
  constraint treino_sessoes_exercicio_do_treino_fkey
    foreign key (id_treino_exercicio_atual, id_treino)
    references public.treinos_exercicios (id_treino_exercicio, id_treino),
  constraint treino_sessoes_status_valido
    check (status in ('ativa', 'finalizada')),
  constraint treino_sessoes_fase_valida
    check (fase in ('execucao', 'descanso')),
  constraint treino_sessoes_indice_valido
    check (indice_exercicio_atual >= 0),
  constraint treino_sessoes_serie_valida
    check (serie_atual between 1 and 32767),
  constraint treino_sessoes_descanso_padrao_valido
    check (descanso_padrao_segundos between 0 and 3600),
  constraint treino_sessoes_segundos_pausados_validos
    check (segundos_pausados >= 0),
  constraint treino_sessoes_revisao_valida
    check (revisao >= 0),
  constraint treino_sessoes_ciclo_de_vida_consistente
    check (
      (
        status = 'ativa'
        and id_treino_exercicio_atual is not null
        and finalizada_em is null
      )
      or (
        status = 'finalizada'
        and id_treino_exercicio_atual is null
        and finalizada_em is not null
      )
    ),
  constraint treino_sessoes_pausa_consistente
    check (pausada_em is null or status = 'ativa'),
  constraint treino_sessoes_descanso_consistente
    check (
      (
        status = 'ativa'
        and fase = 'descanso'
        and descanso_iniciado_em is not null
        and descanso_termina_em is not null
        and descanso_termina_em >= descanso_iniciado_em
      )
      or (
        fase = 'execucao'
        and descanso_iniciado_em is null
        and descanso_termina_em is null
      )
    )
);

create unique index treino_sessoes_uma_ativa_por_usuario_idx
  on public.treino_sessoes (id_usuario)
  where status = 'ativa';

create index treino_sessoes_usuario_atualizada_idx
  on public.treino_sessoes (id_usuario, atualizada_em desc);

create index treino_sessoes_treino_idx
  on public.treino_sessoes (id_treino);

create index treino_sessoes_exercicio_atual_idx
  on public.treino_sessoes (id_treino_exercicio_atual, id_treino)
  where id_treino_exercicio_atual is not null;

create table public.treino_sessao_series (
  id_sessao_serie bigint generated always as identity primary key,
  id_sessao uuid not null,
  id_treino bigint not null,
  id_treino_exercicio bigint not null,
  serie smallint not null,
  carga_utilizada numeric(10, 2) not null,
  repeticoes_feitas smallint not null,
  concluida_em timestamptz not null default clock_timestamp(),

  constraint treino_sessao_series_sessao_treino_fkey
    foreign key (id_sessao, id_treino)
    references public.treino_sessoes (id_sessao, id_treino)
    on delete cascade,
  constraint treino_sessao_series_exercicio_treino_fkey
    foreign key (id_treino_exercicio, id_treino)
    references public.treinos_exercicios (id_treino_exercicio, id_treino),
  constraint treino_sessao_series_unica
    unique (id_sessao, id_treino_exercicio, serie),
  constraint treino_sessao_series_serie_valida
    check (serie between 1 and 32767),
  constraint treino_sessao_series_carga_valida
    check (carga_utilizada between 0 and 99999999.99),
  constraint treino_sessao_series_repeticoes_validas
    check (repeticoes_feitas between 0 and 32767)
);

create index treino_sessao_series_exercicio_treino_idx
  on public.treino_sessao_series (id_treino_exercicio, id_treino);

alter table public.historico_treinos
  add column id_sessao uuid,
  add constraint historico_treinos_id_sessao_key unique (id_sessao),
  add constraint historico_treinos_id_sessao_fkey
    foreign key (id_sessao)
    references public.treino_sessoes (id_sessao)
    on delete set null;

-- The durable execution domain must fit in the legacy final destination.
alter table public.historico_exercicios
  alter column carga_utilizada type numeric(10, 2);

create index historico_treinos_id_usuario_data_idx
  on public.historico_treinos (id_usuario, data_execucao desc);

create index secoes_treino_treino_ordem_idx
  on public.secoes_treino (id_treino, ordem, id_secao);

create index treinos_exercicios_treino_secao_idx
  on public.treinos_exercicios (
    id_treino,
    id_secao,
    id_treino_exercicio
  );

create index historico_treinos_id_treino_idx
  on public.historico_treinos (id_treino);

create index historico_exercicios_id_historico_idx
  on public.historico_exercicios (id_historico);

create index historico_exercicios_id_treino_exercicio_idx
  on public.historico_exercicios (id_treino_exercicio)
  where id_treino_exercicio is not null;

-- -----------------------------------------------------------------------------
-- 4. RLS and direct Data API privileges
-- -----------------------------------------------------------------------------

alter table public.treino_sessoes enable row level security;
alter table public.treino_sessao_series enable row level security;

create policy treino_sessoes_authenticated_select
  on public.treino_sessoes
  for select
  to authenticated
  using ((select auth.uid()) = id_usuario);

create policy treino_sessoes_executor_all
  on public.treino_sessoes
  for all
  to gymio_workout_executor
  using ((select gymio_private.request_uid()) = id_usuario)
  with check ((select gymio_private.request_uid()) = id_usuario);

create policy treino_sessao_series_authenticated_select
  on public.treino_sessao_series
  for select
  to authenticated
  using (
    id_sessao in (
      select s.id_sessao
      from public.treino_sessoes as s
      where s.id_usuario = (select auth.uid())
    )
  );

create policy treino_sessao_series_executor_all
  on public.treino_sessao_series
  for all
  to gymio_workout_executor
  using (
    id_sessao in (
      select s.id_sessao
      from public.treino_sessoes as s
      where s.id_usuario = (select gymio_private.request_uid())
    )
  )
  with check (
    id_sessao in (
      select s.id_sessao
      from public.treino_sessoes as s
      where s.id_usuario = (select gymio_private.request_uid())
    )
  );

-- Existing policies use auth.uid() and were created TO PUBLIC. Restrict their
-- role targets to the same Data API callers that can satisfy those predicates,
-- preserving V1 while ensuring the private executor never needs auth USAGE.
alter policy "Usuarios criam treinos pessoais"
  on public.treinos to anon, authenticated;
alter policy "Usuarios deletam treinos pessoais"
  on public.treinos to anon, authenticated;
alter policy "Usuarios editam treinos pessoais"
  on public.treinos to anon, authenticated;
alter policy "Usuarios visualizam treinos"
  on public.treinos to anon, authenticated;

alter policy "Usuarios criam secoes"
  on public.secoes_treino to anon, authenticated;
alter policy "Usuarios editam secoes"
  on public.secoes_treino to anon, authenticated;
alter policy "Usuarios removem secoes"
  on public.secoes_treino to anon, authenticated;
alter policy "Usuarios visualizam secoes"
  on public.secoes_treino to anon, authenticated;

alter policy "Usuarios adicionam exercicios"
  on public.treinos_exercicios to anon, authenticated;
alter policy "Usuarios editam exercicios"
  on public.treinos_exercicios to anon, authenticated;
alter policy "Usuarios removem exercicios"
  on public.treinos_exercicios to anon, authenticated;
alter policy "Usuarios visualizam exercicios treino"
  on public.treinos_exercicios to anon, authenticated;

alter policy "usuarios podem atualizar o proprio historico"
  on public.historico_treinos to anon, authenticated;
alter policy "usuarios podem criar o proprio historico"
  on public.historico_treinos to anon, authenticated;
alter policy "usuarios podem deletar o proprio historico"
  on public.historico_treinos to anon, authenticated;
alter policy "usuarios podem ver o proprio historico"
  on public.historico_treinos to anon, authenticated;

alter policy "usuarios podem atualizar exercicios do proprio historico"
  on public.historico_exercicios to anon, authenticated;
alter policy "usuarios podem deletar exercicios do proprio historico"
  on public.historico_exercicios to anon, authenticated;
alter policy "usuarios podem inserir exercicios no proprio historico"
  on public.historico_exercicios to anon, authenticated;
alter policy "usuarios podem ver exercicios do proprio historico"
  on public.historico_exercicios to anon, authenticated;

create policy treinos_executor_select
  on public.treinos
  for select
  to gymio_workout_executor
  using (
    tipo_treino = 'sistema'
    or id_usuario = (select gymio_private.request_uid())
  );

create policy secoes_treino_executor_select
  on public.secoes_treino
  for select
  to gymio_workout_executor
  using (
    exists (
      select 1
      from public.treinos as t
      where t.id_treino = secoes_treino.id_treino
        and (
          t.tipo_treino = 'sistema'
          or t.id_usuario = (select gymio_private.request_uid())
        )
    )
  );

create policy treinos_exercicios_executor_select
  on public.treinos_exercicios
  for select
  to gymio_workout_executor
  using (
    exists (
      select 1
      from public.treinos as t
      where t.id_treino = treinos_exercicios.id_treino
        and (
          t.tipo_treino = 'sistema'
          or t.id_usuario = (select gymio_private.request_uid())
        )
    )
  );

create policy historico_treinos_executor_select
  on public.historico_treinos
  for select
  to gymio_workout_executor
  using ((select gymio_private.request_uid()) = id_usuario);

create policy historico_treinos_executor_insert
  on public.historico_treinos
  for insert
  to gymio_workout_executor
  with check ((select gymio_private.request_uid()) = id_usuario);

create policy historico_exercicios_executor_select
  on public.historico_exercicios
  for select
  to gymio_workout_executor
  using (
    id_historico in (
      select h.id_historico
      from public.historico_treinos as h
      where h.id_usuario = (select gymio_private.request_uid())
    )
  );

create policy historico_exercicios_executor_insert
  on public.historico_exercicios
  for insert
  to gymio_workout_executor
  with check (
    id_historico in (
      select h.id_historico
      from public.historico_treinos as h
      where h.id_usuario = (select gymio_private.request_uid())
    )
  );

revoke all on table
  public.treino_sessoes,
  public.treino_sessao_series
from public, anon, authenticated;

grant select on table
  public.treino_sessoes,
  public.treino_sessao_series
to authenticated;

grant select on table
  public.treinos,
  public.secoes_treino,
  public.treinos_exercicios
to gymio_workout_executor;

grant select, insert, update, delete on table public.treino_sessoes
  to gymio_workout_executor;
grant select, insert on table public.treino_sessao_series
  to gymio_workout_executor;
grant select, insert on table
  public.historico_treinos,
  public.historico_exercicios
to gymio_workout_executor;

do $migration$
declare
  sequence_name text;
begin
  sequence_name := pg_get_serial_sequence(
    'public.treino_sessao_series',
    'id_sessao_serie'
  );

  if sequence_name is not null then
    execute format(
      'revoke all on sequence %s from public, anon, authenticated',
      sequence_name
    );
    execute format(
      'grant usage on sequence %s to gymio_workout_executor',
      sequence_name
    );
  end if;

  -- V1 keeps its existing sequence privileges. V2 needs only an additional
  -- executor grant for the transactional history materialization.
  foreach sequence_name in array array[
    pg_get_serial_sequence('public.historico_treinos', 'id_historico'),
    pg_get_serial_sequence('public.historico_exercicios', 'id_historico_exercicio')
  ]
  loop
    if sequence_name is not null then
      execute format(
        'grant usage on sequence %s to gymio_workout_executor',
        sequence_name
      );
    end if;
  end loop;
end
$migration$;

-- -----------------------------------------------------------------------------
-- 5. Private SECURITY INVOKER implementation
-- -----------------------------------------------------------------------------

create or replace function gymio_private.itens_ordenados_do_treino(
  p_id_treino bigint
)
returns table (
  indice integer,
  id_treino_exercicio bigint,
  series smallint,
  repeticoes integer,
  carga numeric,
  descanso_segundos integer
)
language sql
security invoker
set search_path = ''
as $function$
  select
    (row_number() over (
      order by
        coalesce(st.ordem, 0),
        st.id_secao,
        case
          when te.ordem is null then 0::numeric
          else btrim(te.ordem)::numeric
        end,
        te.id_treino_exercicio
    ) - 1)::integer as indice,
    te.id_treino_exercicio,
    te.series::smallint,
    coalesce(te.repeticoes, 0)::integer,
    coalesce(te.carga, 0)::numeric,
    case
      when te.descanso_segundos is null then null
      else least(3600, greatest(0, te.descanso_segundos))::integer
    end as descanso_segundos
  from public.treinos_exercicios as te
  join public.secoes_treino as st
    on st.id_secao = te.id_secao
   and st.id_treino = te.id_treino
  where te.id_treino = p_id_treino
    and te.id_exercicio is not null
    and te.series between 1 and 32767;
$function$;

alter function gymio_private.itens_ordenados_do_treino(bigint)
  owner to gymio_workout_executor;

create or replace function gymio_private.sessao_com_relogio(
  p_id_sessao uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select to_jsonb(s) || jsonb_build_object(
    'agora_servidor', clock_timestamp()
  )
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = (select gymio_private.request_uid());
$function$;

alter function gymio_private.sessao_com_relogio(uuid)
  owner to gymio_workout_executor;

create or replace function gymio_private.validar_revisao(
  p_revisao_atual bigint,
  p_revisao_esperada bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_revisao_esperada is null or p_revisao_esperada < 0 then
    raise exception using
      errcode = '22023',
      message = 'Revisao esperada invalida';
  end if;

  if p_revisao_atual <> p_revisao_esperada then
    raise exception using
      errcode = '40001',
      message = 'A sessao foi alterada; recarregue o estado duravel';
  end if;
end;
$function$;

alter function gymio_private.validar_revisao(bigint, bigint)
  owner to gymio_workout_executor;

create or replace function gymio_private.iniciar_treino_sessao(
  p_id_treino bigint,
  p_descanso_padrao_segundos integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_primeiro record;
  v_id_sessao uuid;
  v_existente public.treino_sessoes%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  if p_descanso_padrao_segundos is null
     or p_descanso_padrao_segundos not between 0 and 3600 then
    raise exception using errcode = '22023', message = 'Descanso padrao invalido';
  end if;

  if not exists (
    select 1
    from public.treinos as t
    where t.id_treino = p_id_treino
      and (
        t.id_usuario = v_uid
        or t.tipo_treino = 'sistema'
      )
  ) then
    raise exception using errcode = '42501', message = 'Treino indisponivel';
  end if;

  select *
  into v_primeiro
  from gymio_private.itens_ordenados_do_treino(p_id_treino)
  order by indice
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'Treino sem exercicios validos';
  end if;

  insert into public.treino_sessoes (
    id_usuario,
    id_treino,
    id_treino_exercicio_atual,
    indice_exercicio_atual,
    serie_atual,
    descanso_padrao_segundos
  )
  values (
    v_uid,
    p_id_treino,
    v_primeiro.id_treino_exercicio,
    v_primeiro.indice,
    1,
    p_descanso_padrao_segundos
  )
  on conflict (id_usuario) where status = 'ativa'
  do nothing
  returning id_sessao into v_id_sessao;

  if v_id_sessao is null then
    select *
    into v_existente
    from public.treino_sessoes as s
    where s.id_usuario = v_uid
      and s.status = 'ativa'
    for update;

    if v_existente.id_sessao is null then
      raise exception using errcode = '40001', message = 'Conflito ao iniciar sessao';
    end if;

    if v_existente.id_treino <> p_id_treino then
      raise exception using
        errcode = '23505',
        message = 'O usuario ja possui outra sessao ativa';
    end if;

    v_id_sessao := v_existente.id_sessao;
  end if;

  return gymio_private.sessao_com_relogio(v_id_sessao);
end;
$function$;

alter function gymio_private.iniciar_treino_sessao(bigint, integer)
  owner to gymio_workout_executor;

create or replace function gymio_private.validar_materializacao_final_treino_sessao(
  p_id_sessao uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_historico public.historico_treinos%rowtype;
  v_duracao integer;
  v_total_series integer;
  v_total_exercicios integer;
  v_series_historicas integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid;

  if not found or v_sessao.status <> 'finalizada' then
    raise exception using
      errcode = '55000',
      message = 'Estado de finalizacao inconsistente';
  end if;

  select *
  into v_historico
  from public.historico_treinos as h
  where h.id_sessao = p_id_sessao;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'Estado de finalizacao inconsistente';
  end if;

  v_duracao := greatest(
    0,
    floor(extract(epoch from (
      v_sessao.finalizada_em - v_sessao.iniciada_em
    )))::integer - v_sessao.segundos_pausados
  );

  select
    count(*)::integer,
    count(distinct te.id_exercicio)::integer
  into v_total_series, v_total_exercicios
  from public.treino_sessao_series as ss
  join public.treinos_exercicios as te
    on te.id_treino_exercicio = ss.id_treino_exercicio
   and te.id_treino = ss.id_treino
  where ss.id_sessao = p_id_sessao;

  select count(*)::integer
  into v_series_historicas
  from public.historico_exercicios as he
  where he.id_historico = v_historico.id_historico;

  if v_historico.id_usuario is distinct from v_sessao.id_usuario
     or v_historico.id_treino is distinct from v_sessao.id_treino
     or v_historico.data_execucao is distinct from
       (v_sessao.iniciada_em at time zone 'UTC')
     or v_historico.duracao_segundos is distinct from v_duracao
     or v_historico.total_exercicios is distinct from v_total_exercicios
     or v_historico.total_series is distinct from v_total_series
     or v_series_historicas is distinct from v_total_series
     or exists (
       select 1
       from public.treino_sessao_series as ss
       join public.treinos_exercicios as te
         on te.id_treino_exercicio = ss.id_treino_exercicio
        and te.id_treino = ss.id_treino
       where ss.id_sessao = p_id_sessao
         and not exists (
           select 1
           from public.historico_exercicios as he
           where he.id_historico = v_historico.id_historico
             and he.id_exercicio = te.id_exercicio
             and he.id_treino_exercicio = ss.id_treino_exercicio
             and he.serie = ss.serie
             and he.carga_utilizada is not distinct from ss.carga_utilizada
             and he.repeticoes_feitas is not distinct from ss.repeticoes_feitas
             and he.concluido is true
             and he.criado_em is not distinct from
               (ss.concluida_em at time zone 'UTC')
         )
     ) then
    raise exception using
      errcode = '55000',
      message = 'Estado de finalizacao inconsistente';
  end if;

  return v_historico.id_historico;
end;
$function$;

alter function gymio_private.validar_materializacao_final_treino_sessao(uuid)
  owner to gymio_workout_executor;

create or replace function gymio_private.materializar_finalizacao_treino_sessao(
  p_id_sessao uuid,
  p_agora timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_agora timestamptz := coalesce(p_agora, clock_timestamp());
  v_pausa_aberta integer := 0;
  v_pausas_total integer;
  v_duracao integer;
  v_total_series integer;
  v_total_exercicios integer;
  v_id_historico bigint;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sessao nao encontrada';
  end if;

  if v_sessao.status = 'finalizada' then
    perform gymio_private.validar_materializacao_final_treino_sessao(
      p_id_sessao
    );
    return gymio_private.sessao_com_relogio(p_id_sessao);
  end if;

  if v_sessao.status <> 'ativa' then
    raise exception using errcode = '55000', message = 'Sessao nao esta ativa';
  end if;

  if v_sessao.pausada_em is not null then
    v_pausa_aberta := greatest(
      0,
      floor(extract(epoch from (v_agora - v_sessao.pausada_em)))::integer
    );
  end if;

  v_pausas_total := v_sessao.segundos_pausados + v_pausa_aberta;
  v_duracao := greatest(
    0,
    floor(extract(epoch from (v_agora - v_sessao.iniciada_em)))::integer
      - v_pausas_total
  );

  select
    count(*)::integer,
    count(distinct te.id_exercicio)::integer
  into v_total_series, v_total_exercicios
  from public.treino_sessao_series as ss
  join public.treinos_exercicios as te
    on te.id_treino_exercicio = ss.id_treino_exercicio
   and te.id_treino = ss.id_treino
  where ss.id_sessao = p_id_sessao;

  select h.id_historico
  into v_id_historico
  from public.historico_treinos as h
  where h.id_sessao = p_id_sessao;

  if v_id_historico is not null then
    raise exception using
      errcode = '55000',
      message = 'Estado de finalizacao inconsistente';
  end if;

  begin
    insert into public.historico_treinos (
      id_usuario,
      id_treino,
      id_sessao,
      data_execucao,
      duracao_segundos,
      total_exercicios,
      total_series,
      observacoes
    )
    values (
      v_uid,
      v_sessao.id_treino,
      p_id_sessao,
      -- data_execucao represents when the executed workout started.
      v_sessao.iniciada_em at time zone 'UTC',
      v_duracao,
      v_total_exercicios,
      v_total_series,
      null
    )
    returning id_historico into v_id_historico;

    insert into public.historico_exercicios (
      id_historico,
      id_exercicio,
      id_treino_exercicio,
      serie,
      carga_utilizada,
      repeticoes_feitas,
      concluido,
      criado_em
    )
    select
      v_id_historico,
      te.id_exercicio,
      ss.id_treino_exercicio,
      ss.serie,
      ss.carga_utilizada,
      ss.repeticoes_feitas,
      true,
      ss.concluida_em at time zone 'UTC'
    from public.treino_sessao_series as ss
    join public.treinos_exercicios as te
      on te.id_treino_exercicio = ss.id_treino_exercicio
     and te.id_treino = ss.id_treino
    where ss.id_sessao = p_id_sessao
    order by ss.id_sessao_serie;
  exception
    when unique_violation then
      raise exception using
        errcode = '55000',
        message = 'Estado de finalizacao inconsistente';
  end;

  update public.treino_sessoes
  set
    status = 'finalizada',
    fase = 'execucao',
    id_treino_exercicio_atual = null,
    pausada_em = null,
    segundos_pausados = v_pausas_total,
    descanso_iniciado_em = null,
    descanso_termina_em = null,
    finalizada_em = v_agora,
    atualizada_em = v_agora,
    revisao = revisao + 1
  where id_sessao = p_id_sessao;

  perform gymio_private.validar_materializacao_final_treino_sessao(
    p_id_sessao
  );

  return gymio_private.sessao_com_relogio(p_id_sessao);
end;
$function$;

alter function gymio_private.materializar_finalizacao_treino_sessao(uuid, timestamptz)
  owner to gymio_workout_executor;

-- Client-facing finalization always validates a non-null expected revision.
-- The materializer above is private and is also used by transitions that already
-- hold the session lock and have validated the current durable state.
create or replace function gymio_private.finalizar_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  if p_revisao_esperada is null or p_revisao_esperada < 0 then
    raise exception using errcode = '22023', message = 'Revisao esperada invalida';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sessao nao encontrada';
  end if;

  -- A retry after an ambiguous successful commit returns the durable terminal
  -- state even though that successful commit incremented the revision.
  if v_sessao.status = 'finalizada' then
    perform gymio_private.validar_materializacao_final_treino_sessao(
      p_id_sessao
    );
    return gymio_private.sessao_com_relogio(p_id_sessao);
  end if;

  perform gymio_private.validar_revisao(
    v_sessao.revisao,
    p_revisao_esperada
  );

  return gymio_private.materializar_finalizacao_treino_sessao(
    p_id_sessao,
    clock_timestamp()
  );
end;
$function$;

alter function gymio_private.finalizar_treino_sessao(uuid, bigint)
  owner to gymio_workout_executor;

create or replace function gymio_private.concluir_treino_serie(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_carga_utilizada numeric default null,
  p_repeticoes_feitas integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_item record;
  v_proximo record;
  v_carga numeric(10, 2);
  v_repeticoes smallint;
  v_descanso integer;
  v_agora timestamptz := clock_timestamp();
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sessao nao encontrada';
  end if;

  if v_sessao.status <> 'ativa' then
    raise exception using errcode = '55000', message = 'Sessao nao esta ativa';
  end if;

  perform gymio_private.validar_revisao(
    v_sessao.revisao,
    p_revisao_esperada
  );

  if v_sessao.pausada_em is not null then
    raise exception using errcode = '55000', message = 'Sessao esta pausada';
  end if;

  if v_sessao.fase <> 'execucao' then
    raise exception using errcode = '55000', message = 'Descanso ainda esta ativo';
  end if;

  select *
  into v_item
  from gymio_private.itens_ordenados_do_treino(v_sessao.id_treino) as i
  where i.id_treino_exercicio = v_sessao.id_treino_exercicio_atual;

  if not found or v_item.indice <> v_sessao.indice_exercicio_atual then
    raise exception using errcode = '55000', message = 'Estrutura do treino mudou durante a sessao';
  end if;

  if v_sessao.serie_atual > v_item.series then
    raise exception using errcode = '23514', message = 'Serie atual excede a prescricao';
  end if;

  v_carga := coalesce(p_carga_utilizada, v_item.carga)::numeric(10, 2);
  v_repeticoes := coalesce(p_repeticoes_feitas, v_item.repeticoes)::smallint;

  if v_carga not between 0 and 99999999.99 then
    raise exception using errcode = '22003', message = 'Carga utilizada invalida';
  end if;

  if v_repeticoes not between 0 and 32767 then
    raise exception using errcode = '22003', message = 'Repeticoes feitas invalidas';
  end if;

  insert into public.treino_sessao_series (
    id_sessao,
    id_treino,
    id_treino_exercicio,
    serie,
    carga_utilizada,
    repeticoes_feitas,
    concluida_em
  )
  values (
    p_id_sessao,
    v_sessao.id_treino,
    v_sessao.id_treino_exercicio_atual,
    v_sessao.serie_atual,
    v_carga,
    v_repeticoes,
    v_agora
  );

  if v_sessao.serie_atual < v_item.series then
    v_descanso := least(
      3600,
      greatest(0, v_sessao.descanso_padrao_segundos)
    );

    update public.treino_sessoes
    set
      serie_atual = serie_atual + 1,
      fase = case when v_descanso = 0 then 'execucao' else 'descanso' end,
      descanso_iniciado_em = case when v_descanso = 0 then null else v_agora end,
      descanso_termina_em = case
        when v_descanso = 0 then null
        else v_agora + make_interval(secs => v_descanso)
      end,
      atualizada_em = v_agora,
      revisao = revisao + 1
    where id_sessao = p_id_sessao;

    return gymio_private.sessao_com_relogio(p_id_sessao);
  end if;

  select *
  into v_proximo
  from gymio_private.itens_ordenados_do_treino(v_sessao.id_treino) as i
  where i.indice = v_sessao.indice_exercicio_atual + 1;

  if found then
    update public.treino_sessoes
    set
      id_treino_exercicio_atual = v_proximo.id_treino_exercicio,
      indice_exercicio_atual = v_proximo.indice,
      serie_atual = 1,
      fase = 'execucao',
      descanso_iniciado_em = null,
      descanso_termina_em = null,
      atualizada_em = v_agora,
      revisao = revisao + 1
    where id_sessao = p_id_sessao;

    return gymio_private.sessao_com_relogio(p_id_sessao);
  end if;

  return gymio_private.materializar_finalizacao_treino_sessao(
    p_id_sessao,
    v_agora
  );
end;
$function$;

alter function gymio_private.concluir_treino_serie(uuid, bigint, numeric, integer)
  owner to gymio_workout_executor;

create or replace function gymio_private.definir_pausa_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_pausar boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_agora timestamptz := clock_timestamp();
  v_intervalo interval;
  v_segundos integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sessao nao encontrada';
  end if;

  if v_sessao.status <> 'ativa' then
    raise exception using errcode = '55000', message = 'Sessao nao esta ativa';
  end if;

  perform gymio_private.validar_revisao(
    v_sessao.revisao,
    p_revisao_esperada
  );

  if p_pausar and v_sessao.pausada_em is null then
    update public.treino_sessoes
    set
      pausada_em = v_agora,
      atualizada_em = v_agora,
      revisao = revisao + 1
    where id_sessao = p_id_sessao;
  elsif not p_pausar and v_sessao.pausada_em is not null then
    v_intervalo := greatest(
      interval '0 seconds',
      v_agora - v_sessao.pausada_em
    );
    v_segundos := greatest(0, floor(extract(epoch from v_intervalo))::integer);

    update public.treino_sessoes
    set
      pausada_em = null,
      segundos_pausados = segundos_pausados + v_segundos,
      descanso_iniciado_em = case
        when fase = 'descanso' then descanso_iniciado_em + v_intervalo
        else descanso_iniciado_em
      end,
      descanso_termina_em = case
        when fase = 'descanso' then descanso_termina_em + v_intervalo
        else descanso_termina_em
      end,
      atualizada_em = v_agora,
      revisao = revisao + 1
    where id_sessao = p_id_sessao;
  end if;

  return gymio_private.sessao_com_relogio(p_id_sessao);
end;
$function$;

alter function gymio_private.definir_pausa_treino_sessao(uuid, bigint, boolean)
  owner to gymio_workout_executor;

create or replace function gymio_private.encerrar_descanso_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_forcar boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_agora timestamptz := clock_timestamp();
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sessao nao encontrada';
  end if;

  if v_sessao.status <> 'ativa' or v_sessao.fase <> 'descanso' then
    raise exception using errcode = '55000', message = 'Nao ha descanso ativo';
  end if;

  perform gymio_private.validar_revisao(
    v_sessao.revisao,
    p_revisao_esperada
  );

  if v_sessao.pausada_em is not null then
    raise exception using errcode = '55000', message = 'Sessao esta pausada';
  end if;

  if not coalesce(p_forcar, false) and v_agora < v_sessao.descanso_termina_em then
    raise exception using errcode = '55000', message = 'Descanso ainda nao terminou';
  end if;

  update public.treino_sessoes
  set
    fase = 'execucao',
    descanso_iniciado_em = null,
    descanso_termina_em = null,
    atualizada_em = v_agora,
    revisao = revisao + 1
  where id_sessao = p_id_sessao;

  return gymio_private.sessao_com_relogio(p_id_sessao);
end;
$function$;

alter function gymio_private.encerrar_descanso_treino_sessao(uuid, bigint, boolean)
  owner to gymio_workout_executor;

create or replace function gymio_private.ajustar_descanso_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_delta_segundos integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_agora timestamptz := clock_timestamp();
  v_novo_fim timestamptz;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  if p_delta_segundos is null or p_delta_segundos not between -300 and 300 then
    raise exception using errcode = '22023', message = 'Ajuste de descanso invalido';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sessao nao encontrada';
  end if;

  if v_sessao.status <> 'ativa' or v_sessao.fase <> 'descanso' then
    raise exception using errcode = '55000', message = 'Nao ha descanso ativo';
  end if;

  perform gymio_private.validar_revisao(
    v_sessao.revisao,
    p_revisao_esperada
  );

  if v_sessao.pausada_em is not null then
    raise exception using errcode = '55000', message = 'Sessao esta pausada';
  end if;

  v_novo_fim := v_sessao.descanso_termina_em
    + make_interval(secs => p_delta_segundos);

  if v_novo_fim - v_agora > interval '3600 seconds' then
    raise exception using errcode = '22023', message = 'Descanso excede o limite';
  end if;

  update public.treino_sessoes
  set
    fase = case when v_novo_fim <= v_agora then 'execucao' else 'descanso' end,
    descanso_iniciado_em = case when v_novo_fim <= v_agora then null else descanso_iniciado_em end,
    descanso_termina_em = case when v_novo_fim <= v_agora then null else v_novo_fim end,
    atualizada_em = v_agora,
    revisao = revisao + 1
  where id_sessao = p_id_sessao;

  return gymio_private.sessao_com_relogio(p_id_sessao);
end;
$function$;

alter function gymio_private.ajustar_descanso_treino_sessao(uuid, bigint, integer)
  owner to gymio_workout_executor;

create or replace function gymio_private.avancar_exercicio_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_atual record;
  v_proximo record;
  v_agora timestamptz := clock_timestamp();
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Sessao nao encontrada';
  end if;

  if v_sessao.status <> 'ativa' then
    raise exception using errcode = '55000', message = 'Sessao nao esta ativa';
  end if;

  perform gymio_private.validar_revisao(
    v_sessao.revisao,
    p_revisao_esperada
  );

  if v_sessao.pausada_em is not null then
    raise exception using errcode = '55000', message = 'Sessao esta pausada';
  end if;

  select *
  into v_atual
  from gymio_private.itens_ordenados_do_treino(v_sessao.id_treino) as i
  where i.id_treino_exercicio = v_sessao.id_treino_exercicio_atual;

  if not found or v_atual.indice <> v_sessao.indice_exercicio_atual then
    raise exception using errcode = '55000', message = 'Estrutura do treino mudou durante a sessao';
  end if;

  select *
  into v_proximo
  from gymio_private.itens_ordenados_do_treino(v_sessao.id_treino) as i
  where i.indice = v_sessao.indice_exercicio_atual + 1;

  if not found then
    return gymio_private.materializar_finalizacao_treino_sessao(
      p_id_sessao,
      v_agora
    );
  end if;

  update public.treino_sessoes
  set
    id_treino_exercicio_atual = v_proximo.id_treino_exercicio,
    indice_exercicio_atual = v_proximo.indice,
    serie_atual = 1,
    fase = 'execucao',
    descanso_iniciado_em = null,
    descanso_termina_em = null,
    atualizada_em = v_agora,
    revisao = revisao + 1
  where id_sessao = p_id_sessao;

  return gymio_private.sessao_com_relogio(p_id_sessao);
end;
$function$;

alter function gymio_private.avancar_exercicio_treino_sessao(uuid, bigint)
  owner to gymio_workout_executor;

create or replace function gymio_private.cancelar_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_sessao public.treino_sessoes%rowtype;
  v_agora timestamptz := clock_timestamp();
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  select *
  into v_sessao
  from public.treino_sessoes as s
  where s.id_sessao = p_id_sessao
    and s.id_usuario = v_uid
  for update;

  if not found then
    return jsonb_build_object(
      'id_sessao', p_id_sessao,
      'status', 'cancelada',
      'descartada', true,
      'agora_servidor', v_agora
    );
  end if;

  if v_sessao.status = 'finalizada' then
    raise exception using errcode = '55000', message = 'Sessao finalizada nao pode ser cancelada';
  end if;

  perform gymio_private.validar_revisao(
    v_sessao.revisao,
    p_revisao_esperada
  );

  delete from public.treino_sessoes
  where id_sessao = p_id_sessao;

  return jsonb_build_object(
    'id_sessao', p_id_sessao,
    'status', 'cancelada',
    'descartada', true,
    'revisao', v_sessao.revisao + 1,
    'agora_servidor', v_agora
  );
end;
$function$;

alter function gymio_private.cancelar_treino_sessao(uuid, bigint)
  owner to gymio_workout_executor;

-- No private implementation is directly executable by Data API roles.
set role gymio_workout_executor;
revoke all on all functions in schema gymio_private
  from public, anon, authenticated, service_role;
reset role;

-- -----------------------------------------------------------------------------
-- 6. Public RPC facade -- SECURITY DEFINER is limited to the dedicated role
-- -----------------------------------------------------------------------------

create or replace function public.iniciar_treino_sessao(
  p_id_treino bigint,
  p_descanso_padrao_segundos integer default 60
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.iniciar_treino_sessao(
    p_id_treino,
    p_descanso_padrao_segundos
  );
$function$;

alter function public.iniciar_treino_sessao(bigint, integer)
  owner to gymio_workout_executor;

create or replace function public.concluir_treino_serie(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_carga_utilizada numeric default null,
  p_repeticoes_feitas integer default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.concluir_treino_serie(
    p_id_sessao,
    p_revisao_esperada,
    p_carga_utilizada,
    p_repeticoes_feitas
  );
$function$;

alter function public.concluir_treino_serie(uuid, bigint, numeric, integer)
  owner to gymio_workout_executor;

create or replace function public.definir_pausa_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_pausar boolean
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.definir_pausa_treino_sessao(
    p_id_sessao,
    p_revisao_esperada,
    p_pausar
  );
$function$;

alter function public.definir_pausa_treino_sessao(uuid, bigint, boolean)
  owner to gymio_workout_executor;

create or replace function public.encerrar_descanso_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_forcar boolean default false
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.encerrar_descanso_treino_sessao(
    p_id_sessao,
    p_revisao_esperada,
    p_forcar
  );
$function$;

alter function public.encerrar_descanso_treino_sessao(uuid, bigint, boolean)
  owner to gymio_workout_executor;

create or replace function public.ajustar_descanso_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint,
  p_delta_segundos integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.ajustar_descanso_treino_sessao(
    p_id_sessao,
    p_revisao_esperada,
    p_delta_segundos
  );
$function$;

alter function public.ajustar_descanso_treino_sessao(uuid, bigint, integer)
  owner to gymio_workout_executor;

create or replace function public.avancar_exercicio_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.avancar_exercicio_treino_sessao(
    p_id_sessao,
    p_revisao_esperada
  );
$function$;

alter function public.avancar_exercicio_treino_sessao(uuid, bigint)
  owner to gymio_workout_executor;

create or replace function public.finalizar_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.finalizar_treino_sessao(
    p_id_sessao,
    p_revisao_esperada
  );
$function$;

alter function public.finalizar_treino_sessao(uuid, bigint)
  owner to gymio_workout_executor;

create or replace function public.cancelar_treino_sessao(
  p_id_sessao uuid,
  p_revisao_esperada bigint
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select gymio_private.cancelar_treino_sessao(
    p_id_sessao,
    p_revisao_esperada
  );
$function$;

alter function public.cancelar_treino_sessao(uuid, bigint)
  owner to gymio_workout_executor;

set role gymio_workout_executor;

revoke all on function public.iniciar_treino_sessao(bigint, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.concluir_treino_serie(uuid, bigint, numeric, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.definir_pausa_treino_sessao(uuid, bigint, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.encerrar_descanso_treino_sessao(uuid, bigint, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.ajustar_descanso_treino_sessao(uuid, bigint, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.avancar_exercicio_treino_sessao(uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.finalizar_treino_sessao(uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.cancelar_treino_sessao(uuid, bigint)
  from public, anon, authenticated, service_role;

grant execute on function public.iniciar_treino_sessao(bigint, integer)
  to authenticated;
grant execute on function public.concluir_treino_serie(uuid, bigint, numeric, integer)
  to authenticated;
grant execute on function public.definir_pausa_treino_sessao(uuid, bigint, boolean)
  to authenticated;
grant execute on function public.encerrar_descanso_treino_sessao(uuid, bigint, boolean)
  to authenticated;
grant execute on function public.ajustar_descanso_treino_sessao(uuid, bigint, integer)
  to authenticated;
grant execute on function public.avancar_exercicio_treino_sessao(uuid, bigint)
  to authenticated;
grant execute on function public.finalizar_treino_sessao(uuid, bigint)
  to authenticated;
grant execute on function public.cancelar_treino_sessao(uuid, bigint)
  to authenticated;

reset role;

-- Remove the temporary ownership-transfer capabilities.
revoke create on schema public, gymio_private from gymio_workout_executor;

-- Reassert the private boundary after every object has been created.
revoke all on schema gymio_private from public, anon, authenticated;
set role gymio_workout_executor;
revoke all on all functions in schema gymio_private
  from public, anon, authenticated, service_role;
reset role;

revoke gymio_workout_executor from postgres
  granted by postgres;

-- -----------------------------------------------------------------------------
-- 7. Fail-closed catalog assertions
-- -----------------------------------------------------------------------------

do $assertions$
declare
  membership_problem text;
  ownership_problem text;
  auth_privilege_problem text;
  insecure_private_function text;
  invalid_private_function text;
  invalid_wrapper text;
  direct_dml text;
  unexpected_executor_privilege text;
  sequence_name text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles as r
    where r.rolname = 'gymio_workout_executor'
      and not r.rolsuper
      and not r.rolinherit
      and not r.rolcreaterole
      and not r.rolcreatedb
      and not r.rolcanlogin
      and not r.rolreplication
      and not r.rolbypassrls
  ) then
    raise exception 'gymio_workout_executor has unsafe role attributes';
  end if;

  select format('%I -> %I', member_role.rolname, granted_role.rolname)
  into membership_problem
  from pg_catalog.pg_auth_members as m
  join pg_catalog.pg_roles as granted_role on granted_role.oid = m.roleid
  join pg_catalog.pg_roles as member_role on member_role.oid = m.member
  where (
      granted_role.rolname = 'gymio_workout_executor'
      and (
        member_role.rolname <> 'postgres'
        or m.inherit_option
        or m.set_option
      )
    )
     or member_role.rolname = 'gymio_workout_executor'
  limit 1;

  if membership_problem is not null then
    raise exception 'unexpected executor role membership: %', membership_problem;
  end if;

  if pg_catalog.pg_get_userbyid((
    select n.nspowner
    from pg_catalog.pg_namespace as n
    where n.nspname = 'gymio_private'
  )) is distinct from 'postgres' then
    raise exception 'gymio_private must be owned by postgres';
  end if;

  if not has_schema_privilege('gymio_workout_executor', 'public', 'USAGE')
     or not has_schema_privilege('gymio_workout_executor', 'gymio_private', 'USAGE')
     or has_schema_privilege('gymio_workout_executor', 'public', 'CREATE')
     or has_schema_privilege('gymio_workout_executor', 'gymio_private', 'CREATE')
     or has_schema_privilege('gymio_workout_executor', 'auth', 'USAGE')
     or has_schema_privilege('gymio_workout_executor', 'auth', 'CREATE') then
    raise exception 'executor schema privileges violate the least-privilege boundary';
  end if;

  if has_schema_privilege('anon', 'gymio_private', 'USAGE')
     or has_schema_privilege('authenticated', 'gymio_private', 'USAGE')
     or has_schema_privilege('anon', 'gymio_private', 'CREATE')
     or has_schema_privilege('authenticated', 'gymio_private', 'CREATE') then
    raise exception 'anon/authenticated unexpectedly have USAGE on gymio_private';
  end if;

  select format('%I on auth.%I', privilege_name, c.relname)
  into auth_privilege_problem
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  cross join (values
    ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
  ) as privileges(privilege_name)
  where n.nspname = 'auth'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege(
      'gymio_workout_executor',
      c.oid,
      privilege_name
    )
  limit 1;

  if auth_privilege_problem is not null then
    raise exception 'executor unexpectedly accesses auth objects: %',
      auth_privilege_problem;
  end if;

  select c.oid::regclass::text
  into ownership_problem
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where pg_catalog.pg_get_userbyid(c.relowner) = 'gymio_workout_executor'
    and c.relkind in ('r', 'p', 'S')
    and n.nspname in ('public', 'gymio_private', 'auth')
  limit 1;

  if ownership_problem is not null then
    raise exception 'executor unexpectedly owns a table or sequence: %',
      ownership_problem;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'treino_sessoes',
        'treino_sessao_series'
      )
      and pg_catalog.pg_get_userbyid(c.relowner) <> 'postgres'
  ) then
    raise exception 'new session tables must be owned by postgres';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'treino_sessoes',
        'treino_sessao_series',
        'historico_treinos',
        'historico_exercicios'
      )
      and c.relrowsecurity
  ) <> 4 then
    raise exception 'RLS must be enabled on all session/history tables';
  end if;

  if (
    select count(*)
    from information_schema.columns as c
    where c.table_schema = 'public'
      and (
        (c.table_name = 'treino_sessao_series'
          and c.column_name = 'carga_utilizada')
        or (c.table_name = 'historico_exercicios'
          and c.column_name = 'carga_utilizada')
      )
      and c.data_type = 'numeric'
      and c.numeric_precision = 10
      and c.numeric_scale = 2
  ) <> 2 then
    raise exception 'executed and historical load domains must both be numeric(10,2)';
  end if;

  select p.oid::regprocedure::text
  into insecure_private_function
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'gymio_private'
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or has_function_privilege('service_role', p.oid, 'EXECUTE')
    )
  limit 1;

  if insecure_private_function is not null then
    raise exception 'private function is executable by a Data API role: %',
      insecure_private_function;
  end if;

  select p.oid::regprocedure::text
  into invalid_private_function
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'gymio_private'
    and (
      p.prosecdef
      or pg_catalog.pg_get_userbyid(p.proowner) <> 'gymio_workout_executor'
      or not (
        coalesce(p.proconfig, array[]::text[])
          @> array['search_path=""']::text[]
      )
      or pg_catalog.pg_get_functiondef(p.oid) ~ '\mauth\.'
    )
  limit 1;

  if invalid_private_function is not null then
    raise exception 'invalid private implementation boundary: %',
      invalid_private_function;
  end if;

  select expected.identity
  into invalid_wrapper
  from (values
    ('public.iniciar_treino_sessao(bigint,integer)'),
    ('public.concluir_treino_serie(uuid,bigint,numeric,integer)'),
    ('public.definir_pausa_treino_sessao(uuid,bigint,boolean)'),
    ('public.encerrar_descanso_treino_sessao(uuid,bigint,boolean)'),
    ('public.ajustar_descanso_treino_sessao(uuid,bigint,integer)'),
    ('public.avancar_exercicio_treino_sessao(uuid,bigint)'),
    ('public.finalizar_treino_sessao(uuid,bigint)'),
    ('public.cancelar_treino_sessao(uuid,bigint)')
  ) as expected(identity)
  left join pg_catalog.pg_proc as p
    on p.oid = to_regprocedure(expected.identity)
  where p.oid is null
     or not p.prosecdef
     or pg_catalog.pg_get_userbyid(p.proowner) <> 'gymio_workout_executor'
     or not (
       coalesce(p.proconfig, array[]::text[])
         @> array['search_path=""']::text[]
     )
  limit 1;

  if invalid_wrapper is not null then
    raise exception 'invalid SECURITY DEFINER wrapper: %', invalid_wrapper;
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and pg_catalog.pg_get_userbyid(p.proowner) = 'gymio_workout_executor'
      and p.proname = any (array[
        'iniciar_treino_sessao',
        'concluir_treino_serie',
        'definir_pausa_treino_sessao',
        'encerrar_descanso_treino_sessao',
        'ajustar_descanso_treino_sessao',
        'avancar_exercicio_treino_sessao',
        'finalizar_treino_sessao',
        'cancelar_treino_sessao'
      ])
  ) <> 8 then
    raise exception 'expected eight dedicated-owner SECURITY DEFINER RPCs';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'iniciar_treino_sessao',
        'concluir_treino_serie',
        'definir_pausa_treino_sessao',
        'encerrar_descanso_treino_sessao',
        'ajustar_descanso_treino_sessao',
        'avancar_exercicio_treino_sessao',
        'finalizar_treino_sessao',
        'cancelar_treino_sessao'
      ])
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('service_role', p.oid, 'EXECUTE')
        or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'public RPC EXECUTE grants do not match anon/authenticated boundary';
  end if;

  select format('%I on %I for %I', privilege_name, table_name, role_name)
  into direct_dml
  from (values ('anon'), ('authenticated')) as roles(role_name)
  cross join (values
    ('treino_sessoes'),
    ('treino_sessao_series')
  ) as tables(table_name)
  cross join (values
    ('INSERT'), ('UPDATE'), ('DELETE'),
    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
  ) as privileges(privilege_name)
  where has_table_privilege(
    role_name,
    format('public.%I', table_name),
    privilege_name
  )
  limit 1;

  if direct_dml is not null then
    raise exception 'direct Data API DML privilege remains: %', direct_dml;
  end if;

  if has_table_privilege('anon', 'public.treino_sessoes', 'SELECT')
     or has_table_privilege('anon', 'public.treino_sessao_series', 'SELECT')
     or not has_table_privilege(
       'authenticated',
       'public.treino_sessoes',
       'SELECT'
     )
     or not has_table_privilege(
       'authenticated',
       'public.treino_sessao_series',
       'SELECT'
     ) then
    raise exception 'new-table Data API SELECT boundary is invalid';
  end if;

  select format('%I on public.%I', privilege_name, table_name)
  into unexpected_executor_privilege
  from (values
    ('treino_sessoes'),
    ('treino_sessao_series'),
    ('treinos'),
    ('secoes_treino'),
    ('treinos_exercicios'),
    ('historico_treinos'),
    ('historico_exercicios')
  ) as tables(table_name)
  cross join (values
    ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
  ) as privileges(privilege_name)
  where has_table_privilege(
    'gymio_workout_executor',
    format('public.%I', table_name),
    privilege_name
  ) is distinct from exists (
    select 1
    from (values
      ('treino_sessoes', 'SELECT'),
      ('treino_sessoes', 'INSERT'),
      ('treino_sessoes', 'UPDATE'),
      ('treino_sessoes', 'DELETE'),
      ('treino_sessao_series', 'SELECT'),
      ('treino_sessao_series', 'INSERT'),
      ('treinos', 'SELECT'),
      ('secoes_treino', 'SELECT'),
      ('treinos_exercicios', 'SELECT'),
      ('historico_treinos', 'SELECT'),
      ('historico_treinos', 'INSERT'),
      ('historico_exercicios', 'SELECT'),
      ('historico_exercicios', 'INSERT')
    ) as expected(expected_table, expected_privilege)
    where expected.expected_table = tables.table_name
      and expected.expected_privilege = privileges.privilege_name
  )
  limit 1;

  if unexpected_executor_privilege is not null then
    raise exception 'executor table privileges do not match allowlist: %',
      unexpected_executor_privilege;
  end if;

  sequence_name := pg_get_serial_sequence(
    'public.treino_sessao_series',
    'id_sessao_serie'
  );

  if sequence_name is null
     or not has_sequence_privilege(
       'gymio_workout_executor', sequence_name, 'USAGE'
     )
     or has_sequence_privilege(
       'gymio_workout_executor', sequence_name, 'SELECT'
     )
     or has_sequence_privilege(
       'gymio_workout_executor', sequence_name, 'UPDATE'
     )
     or has_sequence_privilege('anon', sequence_name, 'USAGE')
     or has_sequence_privilege('authenticated', sequence_name, 'USAGE')
     or has_sequence_privilege('anon', sequence_name, 'SELECT')
     or has_sequence_privilege('authenticated', sequence_name, 'SELECT')
     or has_sequence_privilege('anon', sequence_name, 'UPDATE')
     or has_sequence_privilege('authenticated', sequence_name, 'UPDATE') then
    raise exception 'new identity sequence privileges violate the allowlist';
  end if;

  -- EXPAND must leave the currently deployed V1 writer operational.
  if not has_table_privilege(
       'authenticated', 'public.historico_treinos', 'SELECT'
     )
     or not has_table_privilege(
       'authenticated', 'public.historico_treinos', 'INSERT'
     )
     or not has_table_privilege(
       'authenticated', 'public.historico_treinos', 'UPDATE'
     )
     or not has_table_privilege(
       'authenticated', 'public.historico_exercicios', 'SELECT'
     )
     or not has_table_privilege(
       'authenticated', 'public.historico_exercicios', 'INSERT'
     ) then
    raise exception 'EXPAND broke required V1 history table privileges';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public'
      and p.tablename in ('historico_treinos', 'historico_exercicios')
      and 'authenticated' = any (p.roles)
      and p.cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) <> 8 then
    raise exception 'EXPAND broke the eight legacy history policies';
  end if;

  foreach sequence_name in array array[
    pg_get_serial_sequence('public.historico_treinos', 'id_historico'),
    pg_get_serial_sequence(
      'public.historico_exercicios',
      'id_historico_exercicio'
    )
  ]
  loop
    if sequence_name is null
       or not has_sequence_privilege(
         'authenticated', sequence_name, 'USAGE'
       ) then
      raise exception 'EXPAND broke a required V1 history sequence privilege';
    end if;
  end loop;
end
$assertions$;
