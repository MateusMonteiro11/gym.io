// Local manual fixture only. No migrations, JWT simulation, session RPCs or Push.
// node supabase/testing/seed-manual-workout.mjs <runtime|context.json> [--cleanup]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const PROJECT = 'gymio-workout-push-local'
const WORKOUT = 'V3.2-B Test Workout'
const DESCRIPTION = 'Synthetic local workout for V3.2-B manual notification testing'
const CATEGORY = 'V3.2 Manual Test'
const SECTION = 'Teste de notificações'
const EXERCISES = [
  { nome: 'Supino reto - V3.2 Test', series: 2, repeticoes: 8, carga: 20, descanso_segundos: 15, ordem: 1 },
  { nome: 'Crucifixo - V3.2 Test', series: 2, repeticoes: 10, carga: 10, descanso_segundos: 15, ordem: 2 },
]
const check = (condition, message) => { if (!condition) throw new Error(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const literal = (value) => "'" + String(value).replace(/'/g, "''") + "'"
const samePath = (left, right) => path.relative(left, right) === ''

export function localUrl(value, protocol, port) {
  const url = new URL(value)
  check(url.protocol === protocol && ['127.0.0.1', 'localhost'].includes(url.hostname)
    && url.port === port && !url.search && !url.hash,
  `Only the isolated local ${protocol} port ${port} is allowed`)
  return url
}

export function loadRuntime(input) {
  check(typeof input === 'string' && !/^[a-z]+:\/\//i.test(input), 'Supply a local runtime directory or context.json')
  const supplied = fs.realpathSync(path.resolve(input))
  const contextFile = fs.statSync(supplied).isDirectory() ? path.join(supplied, 'context.json') : supplied
  check(path.basename(contextFile) === 'context.json', 'Expected context.json')
  const context = readJson(contextFile)
  check(context.project === PROJECT && String(context.port) === '55441', 'Unexpected project or API port')
  check(typeof context.root === 'string' && path.isAbsolute(context.root), 'Runtime root must be absolute')
  const root = fs.realpathSync(context.root)
  check(samePath(path.dirname(root), fs.realpathSync(os.tmpdir()))
    && /^gymio-workout-push-[a-f0-9]{32}$/.test(path.basename(root)), 'Runtime is outside the expected temporary directory')
  check(samePath(fs.realpathSync(path.dirname(contextFile)), root), 'Context does not belong to this runtime')
  for (const name of ['context.json', '.owner', 'status.json', 'users.json']) {
    check(samePath(path.dirname(fs.realpathSync(path.join(root, name))), root), 'Runtime file escapes its directory')
  }
  check(fs.readFileSync(path.join(root, '.owner'), 'utf8').trim() === PROJECT, 'Runtime .owner mismatch')
  const status = readJson(path.join(root, 'status.json'))
  const api = localUrl(status.API_URL ?? status.api_url, 'http:', '55441')
  check(!api.username && !api.password && api.pathname === '/', 'Unexpected API URL')
  const db = localUrl(status.DB_URL ?? status.db_url, 'postgresql:', '55442')
  check(db.pathname === '/postgres', 'Unexpected local database')
  const users = readJson(path.join(root, 'users.json'))
  const user = users?.[0]
  check(user && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id), 'User A UUID missing or invalid')
  check(typeof user.email === 'string' && /^[^@\s]+@local\.invalid$/.test(user.email), 'User A must use @local.invalid')
  const anon = status.ANON_KEY ?? status.anon_key
  check(typeof anon === 'string' && anon.length > 0, 'Local anon key missing')
  return { root, user, anon, api: api.origin }
}

function verifyContainers(runtime) {
  // Docker must also be local; fixed container names alone do not prove this.
  const options = { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
  const context = execFileSync('docker', ['context', 'show'], options).trim()
  const host = process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT ? process.env.DOCKER_HOST
    : execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}', context], options).trim()
  check(/^npipe:\/+\.\/pipe\//.test(host) || /^unix:\/\/\/[^\r\n]+$/.test(host), 'Remote Docker endpoints are refused')
  for (const [name, internalPort, hostPort] of [
    [`supabase_db_${PROJECT}`, '5432/tcp', '55442'],
    [`supabase_kong_${PROJECT}`, '8000/tcp', '55441'],
  ]) {
    const template = '{"running":{{json .State.Running}},"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}}}'
    const info = JSON.parse(execFileSync('docker', ['inspect', '--format', template, name], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }))
    check(info.running && info.labels['com.supabase.cli.project'] === PROJECT
      && info.labels['com.docker.compose.project'] === PROJECT, 'Local container project mismatch')
    check(samePath(fs.realpathSync(info.labels['com.supabase.cli.workdir']), runtime.root), 'Container belongs to another runtime')
    const ports = info.ports[internalPort]
    check(ports?.length && ports.every((entry) => entry.HostPort === hostPort), 'Unexpected local container port')
  }
}

function sql(input) {
  try {
    return execFileSync('docker', ['exec', '-i', `supabase_db_${PROJECT}`, 'psql', '-U', 'postgres', '-d', 'postgres',
      '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', timeout: 20000, stdio: 'pipe', maxBuffer: 1024 * 1024 }).trim()
  } catch (error) {
    // Never print subprocess diagnostics, runtime credentials or request headers.
    const reason = String(error.stderr ?? '').match(/ERROR:\s+manual fixture: ([^\r\n]+)/)?.[1]
    throw new Error(reason ?? 'Local PostgreSQL operation failed; no transaction was committed')
  }
}

export function fixtureSql(user, cleanup = false) {
  return `begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
select pg_advisory_xact_lock(hashtextextended('${PROJECT}:manual-fixture', 0));
do $manual_fixture$
declare
  uid uuid := ${literal(user.id)}::uuid;
  expected_email text := ${literal(user.email)};
  cleanup boolean := ${cleanup};
  workout_id bigint; category_id bigint; section_id bigint; exercise_id bigint;
  exercise_ids bigint[] := '{}'; item_ids bigint[] := '{}'; item_id bigint;
  total integer; expected record; existing public.treinos; actual public.exercicios;
  dependency record; referenced boolean; result jsonb;
begin
  perform 1 from auth.users a join public.usuarios u on u.id_usuario = a.id
    where a.id = uid and a.email = expected_email and u.email = expected_email
      and a.email ~ '^[^@[:space:]]+@local\\.invalid$' for key share of a, u;
  if not found then raise exception 'manual fixture: user A missing or email mismatch'; end if;
  if exists (select 1 from pg_class where oid in ('public.treinos'::regclass,
    'public.secoes_treino'::regclass, 'public.treinos_exercicios'::regclass, 'public.exercicios'::regclass)
    and not relrowsecurity) then raise exception 'manual fixture: RLS must remain enabled'; end if;

  perform 1 from public.treinos where nome = ${literal(WORKOUT)} and id_usuario = uid for update;
  select count(*), min(id_treino) into total, workout_id from public.treinos where nome = ${literal(WORKOUT)} and id_usuario = uid;
  if total > 1 then raise exception 'manual fixture: duplicate workout names for user A'; end if;
  if cleanup and workout_id is null then
    perform set_config('gymio.manual_fixture_result', 'null', true);
    return;
  end if;
  if workout_id is not null then
    select * into existing from public.treinos where id_treino = workout_id;
    if existing.descricao is distinct from ${literal(DESCRIPTION)} or existing.publico is distinct from false
      or existing.tipo is distinct from 'usuario' or existing.tipo_treino is distinct from 'usuario' then
      raise exception 'manual fixture: existing workout structure differs';
    end if;
  end if;

  perform 1 from public.categorias_musculares where nome = ${literal(CATEGORY)} for update;
  select count(*), min(id_categoria) into total, category_id from public.categorias_musculares where nome = ${literal(CATEGORY)};
  if total > 1 then raise exception 'manual fixture: ambiguous synthetic category'; end if;
  if category_id is null then
    if workout_id is not null then raise exception 'manual fixture: existing category missing'; end if;
    insert into public.categorias_musculares(nome) values (${literal(CATEGORY)}) returning id_categoria into category_id;
  end if;
  for expected in select * from jsonb_to_recordset(${literal(JSON.stringify(EXERCISES))}::jsonb)
    as x(nome text, series bigint, repeticoes bigint, carga bigint, descanso_segundos bigint, ordem integer)
  loop
    perform 1 from public.exercicios where nome = expected.nome for update;
    select count(*), min(id_exercicio) into total, exercise_id from public.exercicios where nome = expected.nome;
    if total > 1 then raise exception 'manual fixture: ambiguous synthetic exercise'; end if;
    if exercise_id is null then
      if workout_id is not null then raise exception 'manual fixture: existing exercise missing'; end if;
      insert into public.exercicios(nome, descricao, id_categoria, criado_por_usuario)
        values (expected.nome, ${literal(DESCRIPTION)}, category_id, uid) returning id_exercicio into exercise_id;
    end if;
    select * into actual from public.exercicios where id_exercicio = exercise_id;
    if actual.criado_por_usuario is distinct from uid or actual.id_categoria is distinct from category_id
      or actual.descricao is distinct from ${literal(DESCRIPTION)} or actual.url_video is not null or actual.url_imagem is not null then
      raise exception 'manual fixture: existing exercise structure or owner differs';
    end if;
    exercise_ids := array_append(exercise_ids, exercise_id);
  end loop;

  if workout_id is null then
    insert into public.treinos(nome, descricao, publico, id_usuario, tipo, tipo_treino)
      values (${literal(WORKOUT)}, ${literal(DESCRIPTION)}, false, uid, 'usuario', 'usuario') returning id_treino into workout_id;
    insert into public.secoes_treino(id_treino, nome, ordem, descricao)
      values (workout_id, ${literal(SECTION)}, 1, ${literal(DESCRIPTION)}) returning id_secao into section_id;
    for expected in select * from jsonb_to_recordset(${literal(JSON.stringify(EXERCISES))}::jsonb)
      as x(nome text, series bigint, repeticoes bigint, carga bigint, descanso_segundos bigint, ordem integer)
    loop
      insert into public.treinos_exercicios(id_treino, id_secao, id_exercicio, series, repeticoes, carga, descanso_segundos, ordem)
        values (workout_id, section_id, exercise_ids[expected.ordem], expected.series, expected.repeticoes,
          expected.carga, expected.descanso_segundos, expected.ordem::text) returning id_treino_exercicio into item_id;
    end loop;
  end if;

  perform 1 from public.secoes_treino where id_treino = workout_id for update;
  select count(*), min(id_secao) into total, section_id from public.secoes_treino where id_treino = workout_id;
  if total <> 1 or not exists (select 1 from public.secoes_treino where id_secao = section_id
    and nome = ${literal(SECTION)} and ordem = 1 and descricao = ${literal(DESCRIPTION)}) then
    raise exception 'manual fixture: existing section structure differs';
  end if;
  perform 1 from public.treinos_exercicios where id_treino = workout_id or id_secao = section_id for update;
  select count(*) into total from public.treinos_exercicios where id_treino = workout_id or id_secao = section_id;
  if total <> 2 then raise exception 'manual fixture: existing workout item count differs'; end if;
  for expected in select * from jsonb_to_recordset(${literal(JSON.stringify(EXERCISES))}::jsonb)
    as x(nome text, series bigint, repeticoes bigint, carga bigint, descanso_segundos bigint, ordem integer)
  loop
    select count(*), min(id_treino_exercicio) into total, item_id from public.treinos_exercicios
      where id_treino = workout_id and id_secao = section_id and id_exercicio = exercise_ids[expected.ordem]
        and series = expected.series and repeticoes = expected.repeticoes and carga = expected.carga
        and descanso_segundos = expected.descanso_segundos and ordem = expected.ordem::text;
    if total <> 1 then raise exception 'manual fixture: existing workout prescription differs'; end if;
    item_ids := array_append(item_ids, item_id);
  end loop;
  select jsonb_build_object('user', uid, 'email', expected_email, 'id_treino', workout_id::text,
    'workout', ${literal(WORKOUT)}, 'section', jsonb_build_object('id', section_id::text, 'name', ${literal(SECTION)}),
    'exercises', jsonb_agg(jsonb_build_object('id', e.id_exercicio::text, 'name', e.nome,
      'id_treino_exercicio', t.id_treino_exercicio::text, 'series', t.series, 'reps', t.repeticoes,
      'rest', t.descanso_segundos) order by t.ordem::integer)) into result
    from public.treinos_exercicios t join public.exercicios e using (id_exercicio) where t.id_treino = workout_id;

  if cleanup then
    if exists (select 1 from public.treino_sessoes where id_treino = workout_id) then
      raise exception 'manual fixture: cleanup refused; workout has a session';
    end if;
    if exists (select 1 from public.historico_treinos where id_treino = workout_id)
      or exists (select 1 from public.historico_exercicios where id_treino_exercicio = any(item_ids)) then
      raise exception 'manual fixture: cleanup refused; workout has history';
    end if;
    -- Fail closed on any additional FK surface, including cascading dependencies.
    for dependency in
      select c.conrelid, c.confrelid, string_agg(format('child.%I = parent.%I', ca.attname, pa.attname), ' and ' order by k.n) as predicate
      from pg_constraint c cross join lateral unnest(c.conkey, c.confkey) with ordinality k(child_col, parent_col, n)
      join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = k.child_col
      join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = k.parent_col
      where c.contype = 'f' and c.confrelid in ('public.treinos'::regclass, 'public.secoes_treino'::regclass, 'public.treinos_exercicios'::regclass)
        and not (c.conrelid = 'public.secoes_treino'::regclass and c.confrelid = 'public.treinos'::regclass)
        and not (c.conrelid = 'public.treinos_exercicios'::regclass and c.confrelid in ('public.treinos'::regclass, 'public.secoes_treino'::regclass))
      group by c.oid, c.conrelid, c.confrelid
    loop
      execute format('select exists(select 1 from %s child join %s parent on %s where parent.%I = any($1))',
        dependency.conrelid::regclass, dependency.confrelid::regclass, dependency.predicate,
        case dependency.confrelid when 'public.treinos'::regclass then 'id_treino'
          when 'public.secoes_treino'::regclass then 'id_secao' else 'id_treino_exercicio' end)
        into referenced using case dependency.confrelid when 'public.treinos'::regclass then array[workout_id]
          when 'public.secoes_treino'::regclass then array[section_id] else item_ids end;
      if referenced then raise exception 'manual fixture: cleanup refused; additional dependent records exist'; end if;
    end loop;
    delete from public.treinos_exercicios where id_treino_exercicio = any(item_ids) and id_treino = workout_id;
    delete from public.secoes_treino where id_secao = section_id and id_treino = workout_id;
    delete from public.treinos where id_treino = workout_id and id_usuario = uid;
    -- Check every FK, so a shared exercise/category is preserved rather than cascaded.
    foreach exercise_id in array exercise_ids
    loop
      referenced := false;
      for dependency in
        select c.conrelid, string_agg(format('child.%I = parent.%I', ca.attname, pa.attname), ' and ' order by k.n) as predicate
        from pg_constraint c cross join lateral unnest(c.conkey, c.confkey) with ordinality k(child_col, parent_col, n)
        join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = k.child_col
        join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = k.parent_col
        where c.contype = 'f' and c.confrelid = 'public.exercicios'::regclass group by c.oid, c.conrelid
      loop
        execute format('select exists(select 1 from %s child join public.exercicios parent on %s where parent.id_exercicio = $1)',
          dependency.conrelid::regclass, dependency.predicate) into referenced using exercise_id;
        exit when referenced;
      end loop;
      if not referenced then delete from public.exercicios where id_exercicio = exercise_id and criado_por_usuario = uid; end if;
    end loop;
    referenced := false;
    for dependency in
      select c.conrelid, string_agg(format('child.%I = parent.%I', ca.attname, pa.attname), ' and ' order by k.n) as predicate
      from pg_constraint c cross join lateral unnest(c.conkey, c.confkey) with ordinality k(child_col, parent_col, n)
      join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = k.child_col
      join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = k.parent_col
      where c.contype = 'f' and c.confrelid = 'public.categorias_musculares'::regclass group by c.oid, c.conrelid
    loop
      execute format('select exists(select 1 from %s child join public.categorias_musculares parent on %s where parent.id_categoria = $1)',
        dependency.conrelid::regclass, dependency.predicate) into referenced using category_id;
      exit when referenced;
    end loop;
    if not referenced then delete from public.categorias_musculares where id_categoria = category_id and nome = ${literal(CATEGORY)}; end if;
  end if;
  -- Transaction-local result transport only; no request/JWT GUCs are set.
  perform set_config('gymio.manual_fixture_result', result::text, true);
end
$manual_fixture$;
select current_setting('gymio.manual_fixture_result');
commit;`
}

async function request(runtime, resource, jwt, body) {
  const url = new URL(resource, runtime.api)
  check(url.origin === runtime.api, 'Remote HTTP request refused')
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', redirect: 'error',
    headers: { apikey: runtime.anon, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) })
  let data; try { data = await response.json() } catch { data = null }
  return { status: response.status, data }
}

async function authenticatedUser(runtime) {
  let jwt = runtime.user.jwt
  let auth = jwt ? await request(runtime, '/auth/v1/user', jwt) : null
  if (auth?.status !== 200) {
    check(typeof runtime.user.password === 'string', 'User A requires a valid local token or existing password')
    const login = await request(runtime, '/auth/v1/token?grant_type=password', null,
      { email: runtime.user.email, password: runtime.user.password })
    check(login.status === 200 && login.data?.access_token, 'Authentication of existing local user A failed')
    jwt = login.data.access_token
    auth = await request(runtime, '/auth/v1/user', jwt)
  }
  check(auth.status === 200 && auth.data?.id === runtime.user.id && auth.data?.email === runtime.user.email,
    'Authenticated local identity does not match user A')
  return jwt
}

async function validateDataApi(runtime, jwt, fixture) {
  const queries = [
    ['treinos', { id_treino: `eq.${fixture.id_treino}`, select: 'id_treino,nome,id_usuario,publico,tipo,tipo_treino,secoes_treino(id_secao,nome,treinos_exercicios(id_treino_exercicio,exercicios(id_exercicio,nome)))' }, 1],
    ['secoes_treino', { id_secao: `eq.${fixture.section.id}`, select: 'id_secao,nome,id_treino' }, 1],
    ['treinos_exercicios', { id_treino: `eq.${fixture.id_treino}`, select: 'id_treino_exercicio,id_exercicio,series,repeticoes,carga,descanso_segundos,ordem', order: 'ordem.asc' }, 2],
    ['exercicios', { id_exercicio: `in.(${fixture.exercises.map((e) => e.id).join(',')})`, select: 'id_exercicio,nome' }, 2],
  ]
  for (const [table, filters, count] of queries) {
    const resource = `/rest/v1/${table}?${new URLSearchParams(filters)}`
    const result = await request(runtime, resource, jwt)
    check(result.status === 200 && Array.isArray(result.data) && result.data.length === count, `Authenticated Data API visibility failed: ${table}`)
    if (table === 'treinos') {
      const row = result.data[0]
      check(row.id_usuario === runtime.user.id && row.nome === WORKOUT && row.publico === false
        && row.tipo === 'usuario' && row.tipo_treino === 'usuario'
        && row.secoes_treino?.length === 1 && row.secoes_treino[0].nome === SECTION
        && row.secoes_treino[0].treinos_exercicios?.length === 2
        && row.secoes_treino[0].treinos_exercicios.every((item) => fixture.exercises.some((e) =>
          e.id_treino_exercicio === String(item.id_treino_exercicio) && e.id === String(item.exercicios?.id_exercicio)
          && e.name === item.exercicios?.nome)), 'Frontend nested workout read differs')
    }
    if (table === 'treinos_exercicios') {
      check(result.data.every((item, index) => String(item.id_exercicio) === fixture.exercises[index].id
        && String(item.id_treino_exercicio) === fixture.exercises[index].id_treino_exercicio
        && item.series === 2 && item.repeticoes === EXERCISES[index].repeticoes
        && item.carga === EXERCISES[index].carga && item.descanso_segundos === 15
        && item.ordem === String(index + 1)), 'Authenticated prescription differs')
    }
    // Exercises are intentionally globally readable in the existing baseline.
    // Private workout/section/item rows must still be invisible to anon.
    if (table !== 'exercicios') {
      const anonymous = await request(runtime, resource)
      check((anonymous.status === 200 && Array.isArray(anonymous.data) && anonymous.data.length === 0)
        || [401, 403].includes(anonymous.status), `Anonymous fixture read was not blocked: ${table}`)
    }
  }
}

export async function run(input, cleanup = false) {
  const runtime = loadRuntime(input)
  verifyContainers(runtime)
  // Verify the DB identity before any authentication or fixture writes.
  const valid = sql(`begin read only; select exists(select 1 from auth.users a join public.usuarios u on u.id_usuario=a.id
    where a.id=${literal(runtime.user.id)}::uuid and a.email=${literal(runtime.user.email)} and u.email=a.email); commit;`)
  check(valid === 't', 'User A must exist in auth.users and public.usuarios with matching local email')
  const jwt = cleanup ? null : await authenticatedUser(runtime)
  const output = sql(fixtureSql(runtime.user, cleanup))
  const fixture = JSON.parse(output.split(/\r?\n/).findLast((line) => line.startsWith('{') || line === 'null'))
  if (!cleanup) await validateDataApi(runtime, jwt, fixture)
  console.log(cleanup ? 'MANUAL_WORKOUT_FIXTURE_CLEANED' : 'MANUAL_WORKOUT_FIXTURE_READY')
  console.log(`user: ${runtime.user.id} — ${runtime.user.email}`)
  if (fixture) {
    console.log(`workout: ${fixture.workout} — id_treino ${fixture.id_treino}`)
    console.log(`section: ${fixture.section.name} — ${fixture.section.id}`)
    for (const exercise of fixture.exercises) console.log(`- ${exercise.name} — id ${exercise.id} — ${exercise.series}x${exercise.reps} — rest ${exercise.rest}s`)
  }
  return fixture
}

if (process.argv[1] && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const cleanup = args.includes('--cleanup')
  const inputs = args.filter((arg) => arg !== '--cleanup')
  try {
    check(inputs.length === 1 && args.length === (cleanup ? 2 : 1)
      && !inputs[0].startsWith('--'), 'Usage: node supabase/testing/seed-manual-workout.mjs <runtime|context.json> [--cleanup]')
    await run(inputs[0], cleanup)
  } catch (error) {
    // System/network exceptions can contain paths or headers; allow only our errors.
    const message = error?.constructor === Error ? error.message : 'Local fixture preparation failed'
    console.error(`MANUAL_WORKOUT_FIXTURE_FAILED: ${message}`)
    process.exitCode = 1
  }
}
