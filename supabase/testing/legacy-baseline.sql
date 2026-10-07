-- Reconstructed support fixture from catalog metadata read on 2026-10-07.
-- NOT a historical migration. No production rows, Auth triggers or CONTRACT.
-- Run only on the isolated local Supabase stack, before EXPAND + Memory.
begin;
create table public.categorias_musculares (
  "id_categoria" bigint generated always as identity not null,
  "nome" character varying default ''::character varying not null,
  primary key (id_categoria)
);
create table public."exercicios" (
  "id_exercicio" bigint generated always as identity not null,
  "nome" character varying default ''::character varying not null,
  "descricao" character varying default ''::character varying,
  "url_video" character varying,
  "url_imagem" character varying,
  "id_categoria" bigint,
  "criado_por_usuario" uuid
);
create table public."historico_exercicios" (
  "id_historico_exercicio" bigint generated always as identity not null,
  "id_historico" bigint not null,
  "id_exercicio" bigint not null,
  "id_treino_exercicio" bigint,
  "serie" smallint not null,
  "carga_utilizada" numeric(10,2),
  "repeticoes_feitas" smallint,
  "concluido" boolean default true,
  "criado_em" timestamp without time zone default now()
);
create table public."historico_treinos" (
  "id_historico" bigint generated always as identity not null,
  "id_usuario" uuid not null,
  "id_treino" bigint not null,
  "data_execucao" timestamp without time zone default now(),
  "duracao_segundos" integer default 0,
  "total_exercicios" integer default 0,
  "total_series" integer default 0,
  "observacoes" text
);
create table public."secoes_treino" (
  "id_secao" bigint generated always as identity not null,
  "id_treino" bigint not null,
  "nome" character varying not null,
  "ordem" integer default 1,
  "criado_em" timestamp without time zone default now(),
  "descricao" text
);
create table public."treinos" (
  "id_treino" bigint generated always as identity not null,
  "nome" character varying default ''::character varying not null,
  "descricao" character varying default ''::character varying,
  "publico" boolean default false,
  "criado_em" timestamp without time zone default (now() AT TIME ZONE 'utc'::text),
  "id_usuario" uuid,
  "tipo_treino" character varying(20) default 'usuario'::character varying,
  "tipo" character varying(20) default 'usuario'::character varying
);
create table public."treinos_exercicios" (
  "id_treino_exercicio" bigint generated always as identity not null,
  "series" bigint not null,
  "repeticoes" bigint,
  "carga" bigint,
  "descanso_segundos" bigint,
  "ordem" character varying,
  "id_treino" bigint,
  "id_exercicio" bigint,
  "id_secao" bigint
);
create table public."usuarios" (
  "id_usuario" uuid not null,
  "nome" character varying(100) not null,
  "email" character varying(150) not null,
  "senha_hash" text,
  "foto_perfil" text,
  "criado_em" timestamp without time zone default now(),
  "status" character varying
);
alter table public."exercicios" add constraint "exercicios_pkey" PRIMARY KEY (id_exercicio);
alter table public."historico_exercicios" add constraint "historico_exercicios_pkey" PRIMARY KEY (id_historico_exercicio);
alter table public."historico_treinos" add constraint "historico_treinos_pkey" PRIMARY KEY (id_historico);
alter table public."secoes_treino" add constraint "secoes_treino_pkey" PRIMARY KEY (id_secao);
alter table public."treinos" add constraint "treinos_pkey" PRIMARY KEY (id_treino);
alter table public."treinos" add constraint "treinos_tipo_check" CHECK (((tipo)::text = ANY ((ARRAY['usuario'::character varying, 'sistema'::character varying])::text[])));
alter table public."treinos_exercicios" add constraint "treinos_exercicios_pkey" PRIMARY KEY (id_treino_exercicio);
alter table public."usuarios" add constraint "usuarios_email_key" UNIQUE (email);
alter table public."usuarios" add constraint "usuarios_pkey" PRIMARY KEY (id_usuario);
alter table public."exercicios" add constraint "exercicios_criado_por_usuario_fkey" FOREIGN KEY (criado_por_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;
alter table public."exercicios" add constraint "exercicios_id_categoria_fkey" FOREIGN KEY (id_categoria) REFERENCES categorias_musculares(id_categoria);
alter table public."historico_exercicios" add constraint "historico_exercicios_id_exercicio_fkey" FOREIGN KEY (id_exercicio) REFERENCES exercicios(id_exercicio);
alter table public."historico_exercicios" add constraint "historico_exercicios_id_historico_fkey" FOREIGN KEY (id_historico) REFERENCES historico_treinos(id_historico) ON DELETE CASCADE;
alter table public."historico_exercicios" add constraint "historico_exercicios_id_treino_exercicio_fkey" FOREIGN KEY (id_treino_exercicio) REFERENCES treinos_exercicios(id_treino_exercicio);
alter table public."historico_treinos" add constraint "historico_treinos_id_treino_fkey" FOREIGN KEY (id_treino) REFERENCES treinos(id_treino);
alter table public."historico_treinos" add constraint "historico_treinos_id_usuario_fkey" FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario);
alter table public."secoes_treino" add constraint "fk_secao_treino" FOREIGN KEY (id_treino) REFERENCES treinos(id_treino) ON DELETE CASCADE;
alter table public."treinos" add constraint "treinos_id_usuario_fkey" FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE;
alter table public."treinos_exercicios" add constraint "fk_treino_exercicio_secao" FOREIGN KEY (id_secao) REFERENCES secoes_treino(id_secao) ON DELETE CASCADE;
alter table public."treinos_exercicios" add constraint "treinos_exercicios_id_exercicio_fkey" FOREIGN KEY (id_exercicio) REFERENCES exercicios(id_exercicio) ON DELETE CASCADE;
alter table public."treinos_exercicios" add constraint "treinos_exercicios_id_treino_fkey" FOREIGN KEY (id_treino) REFERENCES treinos(id_treino) ON DELETE CASCADE;
alter table public."exercicios" enable row level security;
alter table public."historico_exercicios" enable row level security;
alter table public."historico_treinos" enable row level security;
alter table public."secoes_treino" enable row level security;
alter table public."treinos" enable row level security;
alter table public."treinos_exercicios" enable row level security;
alter table public."usuarios" enable row level security;
create policy "Usuarios visualizam exercicios" on public."exercicios" as PERMISSIVE for SELECT to public using (true);
create policy "usuarios podem atualizar exercicios do proprio historico" on public."historico_exercicios" as PERMISSIVE for UPDATE to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM historico_treinos ht
  WHERE ((ht.id_historico = historico_exercicios.id_historico) AND (ht.id_usuario = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM historico_treinos ht
  WHERE ((ht.id_historico = historico_exercicios.id_historico) AND (ht.id_usuario = auth.uid())))));
create policy "usuarios podem deletar exercicios do proprio historico" on public."historico_exercicios" as PERMISSIVE for DELETE to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM historico_treinos ht
  WHERE ((ht.id_historico = historico_exercicios.id_historico) AND (ht.id_usuario = auth.uid())))));
create policy "usuarios podem inserir exercicios no proprio historico" on public."historico_exercicios" as PERMISSIVE for INSERT to "anon","authenticated" with check ((EXISTS ( SELECT 1
   FROM historico_treinos ht
  WHERE ((ht.id_historico = historico_exercicios.id_historico) AND (ht.id_usuario = auth.uid())))));
create policy "usuarios podem ver exercicios do proprio historico" on public."historico_exercicios" as PERMISSIVE for SELECT to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM historico_treinos ht
  WHERE ((ht.id_historico = historico_exercicios.id_historico) AND (ht.id_usuario = auth.uid())))));
create policy "usuarios podem atualizar o proprio historico" on public."historico_treinos" as PERMISSIVE for UPDATE to "anon","authenticated" using ((auth.uid() = id_usuario)) with check ((auth.uid() = id_usuario));
create policy "usuarios podem criar o proprio historico" on public."historico_treinos" as PERMISSIVE for INSERT to "anon","authenticated" with check ((auth.uid() = id_usuario));
create policy "usuarios podem deletar o proprio historico" on public."historico_treinos" as PERMISSIVE for DELETE to "anon","authenticated" using ((auth.uid() = id_usuario));
create policy "usuarios podem ver o proprio historico" on public."historico_treinos" as PERMISSIVE for SELECT to "anon","authenticated" using ((auth.uid() = id_usuario));
create policy "Usuarios criam secoes" on public."secoes_treino" as PERMISSIVE for INSERT to "anon","authenticated" with check ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = secoes_treino.id_treino) AND ((treinos.tipo_treino)::text = 'usuario'::text) AND (treinos.id_usuario = auth.uid())))));
create policy "Usuarios editam secoes" on public."secoes_treino" as PERMISSIVE for UPDATE to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = secoes_treino.id_treino) AND ((treinos.tipo_treino)::text = 'usuario'::text) AND (treinos.id_usuario = auth.uid())))));
create policy "Usuarios removem secoes" on public."secoes_treino" as PERMISSIVE for DELETE to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = secoes_treino.id_treino) AND ((treinos.tipo_treino)::text = 'usuario'::text) AND (treinos.id_usuario = auth.uid())))));
create policy "Usuarios visualizam secoes" on public."secoes_treino" as PERMISSIVE for SELECT to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = secoes_treino.id_treino) AND (((treinos.tipo_treino)::text = 'sistema'::text) OR (treinos.id_usuario = auth.uid()))))));
create policy "Usuarios criam treinos pessoais" on public."treinos" as PERMISSIVE for INSERT to "anon","authenticated" with check ((((tipo_treino)::text = 'usuario'::text) AND (auth.uid() = id_usuario)));
create policy "Usuarios deletam treinos pessoais" on public."treinos" as PERMISSIVE for DELETE to "anon","authenticated" using ((((tipo_treino)::text = 'usuario'::text) AND (auth.uid() = id_usuario)));
create policy "Usuarios editam treinos pessoais" on public."treinos" as PERMISSIVE for UPDATE to "anon","authenticated" using ((((tipo_treino)::text = 'usuario'::text) AND (auth.uid() = id_usuario)));
create policy "Usuarios visualizam treinos" on public."treinos" as PERMISSIVE for SELECT to "anon","authenticated" using ((((tipo_treino)::text = 'sistema'::text) OR (auth.uid() = id_usuario)));
create policy "Usuarios adicionam exercicios" on public."treinos_exercicios" as PERMISSIVE for INSERT to "anon","authenticated" with check ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = treinos_exercicios.id_treino) AND ((treinos.tipo_treino)::text = 'usuario'::text) AND (treinos.id_usuario = auth.uid())))));
create policy "Usuarios editam exercicios" on public."treinos_exercicios" as PERMISSIVE for UPDATE to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = treinos_exercicios.id_treino) AND ((treinos.tipo_treino)::text = 'usuario'::text) AND (treinos.id_usuario = auth.uid())))));
create policy "Usuarios removem exercicios" on public."treinos_exercicios" as PERMISSIVE for DELETE to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = treinos_exercicios.id_treino) AND ((treinos.tipo_treino)::text = 'usuario'::text) AND (treinos.id_usuario = auth.uid())))));
create policy "Usuarios visualizam exercicios treino" on public."treinos_exercicios" as PERMISSIVE for SELECT to "anon","authenticated" using ((EXISTS ( SELECT 1
   FROM treinos
  WHERE ((treinos.id_treino = treinos_exercicios.id_treino) AND (((treinos.tipo_treino)::text = 'sistema'::text) OR (treinos.id_usuario = auth.uid()))))));
create policy "Users can insert own profile" on public."usuarios" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = id_usuario));
create policy "Users can read own profile" on public."usuarios" as PERMISSIVE for SELECT to public using ((auth.uid() = id_usuario));
create policy "Users can update own profile" on public."usuarios" as PERMISSIVE for UPDATE to public using ((auth.uid() = id_usuario)) with check ((auth.uid() = id_usuario));
grant INSERT on public."usuarios" to "anon";
grant SELECT on public."usuarios" to "anon";
grant UPDATE on public."usuarios" to "anon";
grant DELETE on public."usuarios" to "anon";
grant TRUNCATE on public."usuarios" to "anon";
grant REFERENCES on public."usuarios" to "anon";
grant TRIGGER on public."usuarios" to "anon";
grant INSERT on public."usuarios" to "authenticated";
grant SELECT on public."usuarios" to "authenticated";
grant UPDATE on public."usuarios" to "authenticated";
grant DELETE on public."usuarios" to "authenticated";
grant TRUNCATE on public."usuarios" to "authenticated";
grant REFERENCES on public."usuarios" to "authenticated";
grant TRIGGER on public."usuarios" to "authenticated";
grant INSERT on public."usuarios" to "service_role";
grant SELECT on public."usuarios" to "service_role";
grant UPDATE on public."usuarios" to "service_role";
grant DELETE on public."usuarios" to "service_role";
grant TRUNCATE on public."usuarios" to "service_role";
grant REFERENCES on public."usuarios" to "service_role";
grant TRIGGER on public."usuarios" to "service_role";
grant INSERT on public."exercicios" to "anon";
grant SELECT on public."exercicios" to "anon";
grant UPDATE on public."exercicios" to "anon";
grant DELETE on public."exercicios" to "anon";
grant TRUNCATE on public."exercicios" to "anon";
grant REFERENCES on public."exercicios" to "anon";
grant TRIGGER on public."exercicios" to "anon";
grant INSERT on public."exercicios" to "authenticated";
grant SELECT on public."exercicios" to "authenticated";
grant UPDATE on public."exercicios" to "authenticated";
grant DELETE on public."exercicios" to "authenticated";
grant TRUNCATE on public."exercicios" to "authenticated";
grant REFERENCES on public."exercicios" to "authenticated";
grant TRIGGER on public."exercicios" to "authenticated";
grant INSERT on public."exercicios" to "service_role";
grant SELECT on public."exercicios" to "service_role";
grant UPDATE on public."exercicios" to "service_role";
grant DELETE on public."exercicios" to "service_role";
grant TRUNCATE on public."exercicios" to "service_role";
grant REFERENCES on public."exercicios" to "service_role";
grant TRIGGER on public."exercicios" to "service_role";
grant INSERT on public."treinos" to "anon";
grant SELECT on public."treinos" to "anon";
grant UPDATE on public."treinos" to "anon";
grant DELETE on public."treinos" to "anon";
grant TRUNCATE on public."treinos" to "anon";
grant REFERENCES on public."treinos" to "anon";
grant TRIGGER on public."treinos" to "anon";
grant INSERT on public."treinos" to "authenticated";
grant SELECT on public."treinos" to "authenticated";
grant UPDATE on public."treinos" to "authenticated";
grant DELETE on public."treinos" to "authenticated";
grant TRUNCATE on public."treinos" to "authenticated";
grant REFERENCES on public."treinos" to "authenticated";
grant TRIGGER on public."treinos" to "authenticated";
grant INSERT on public."treinos" to "service_role";
grant SELECT on public."treinos" to "service_role";
grant UPDATE on public."treinos" to "service_role";
grant DELETE on public."treinos" to "service_role";
grant TRUNCATE on public."treinos" to "service_role";
grant REFERENCES on public."treinos" to "service_role";
grant TRIGGER on public."treinos" to "service_role";
grant INSERT on public."secoes_treino" to "anon";
grant SELECT on public."secoes_treino" to "anon";
grant UPDATE on public."secoes_treino" to "anon";
grant DELETE on public."secoes_treino" to "anon";
grant TRUNCATE on public."secoes_treino" to "anon";
grant REFERENCES on public."secoes_treino" to "anon";
grant TRIGGER on public."secoes_treino" to "anon";
grant INSERT on public."secoes_treino" to "authenticated";
grant SELECT on public."secoes_treino" to "authenticated";
grant UPDATE on public."secoes_treino" to "authenticated";
grant DELETE on public."secoes_treino" to "authenticated";
grant TRUNCATE on public."secoes_treino" to "authenticated";
grant REFERENCES on public."secoes_treino" to "authenticated";
grant TRIGGER on public."secoes_treino" to "authenticated";
grant INSERT on public."secoes_treino" to "service_role";
grant SELECT on public."secoes_treino" to "service_role";
grant UPDATE on public."secoes_treino" to "service_role";
grant DELETE on public."secoes_treino" to "service_role";
grant TRUNCATE on public."secoes_treino" to "service_role";
grant REFERENCES on public."secoes_treino" to "service_role";
grant TRIGGER on public."secoes_treino" to "service_role";
grant INSERT on public."historico_exercicios" to "anon";
grant SELECT on public."historico_exercicios" to "anon";
grant UPDATE on public."historico_exercicios" to "anon";
grant DELETE on public."historico_exercicios" to "anon";
grant TRUNCATE on public."historico_exercicios" to "anon";
grant REFERENCES on public."historico_exercicios" to "anon";
grant TRIGGER on public."historico_exercicios" to "anon";
grant INSERT on public."historico_exercicios" to "authenticated";
grant SELECT on public."historico_exercicios" to "authenticated";
grant UPDATE on public."historico_exercicios" to "authenticated";
grant DELETE on public."historico_exercicios" to "authenticated";
grant TRUNCATE on public."historico_exercicios" to "authenticated";
grant REFERENCES on public."historico_exercicios" to "authenticated";
grant TRIGGER on public."historico_exercicios" to "authenticated";
grant INSERT on public."historico_exercicios" to "service_role";
grant SELECT on public."historico_exercicios" to "service_role";
grant UPDATE on public."historico_exercicios" to "service_role";
grant DELETE on public."historico_exercicios" to "service_role";
grant TRUNCATE on public."historico_exercicios" to "service_role";
grant REFERENCES on public."historico_exercicios" to "service_role";
grant TRIGGER on public."historico_exercicios" to "service_role";
grant INSERT on public."historico_treinos" to "anon";
grant SELECT on public."historico_treinos" to "anon";
grant UPDATE on public."historico_treinos" to "anon";
grant DELETE on public."historico_treinos" to "anon";
grant TRUNCATE on public."historico_treinos" to "anon";
grant REFERENCES on public."historico_treinos" to "anon";
grant TRIGGER on public."historico_treinos" to "anon";
grant INSERT on public."historico_treinos" to "authenticated";
grant SELECT on public."historico_treinos" to "authenticated";
grant UPDATE on public."historico_treinos" to "authenticated";
grant DELETE on public."historico_treinos" to "authenticated";
grant TRUNCATE on public."historico_treinos" to "authenticated";
grant REFERENCES on public."historico_treinos" to "authenticated";
grant TRIGGER on public."historico_treinos" to "authenticated";
grant INSERT on public."historico_treinos" to "service_role";
grant SELECT on public."historico_treinos" to "service_role";
grant UPDATE on public."historico_treinos" to "service_role";
grant DELETE on public."historico_treinos" to "service_role";
grant TRUNCATE on public."historico_treinos" to "service_role";
grant REFERENCES on public."historico_treinos" to "service_role";
grant TRIGGER on public."historico_treinos" to "service_role";
grant INSERT on public."treinos_exercicios" to "anon";
grant SELECT on public."treinos_exercicios" to "anon";
grant UPDATE on public."treinos_exercicios" to "anon";
grant DELETE on public."treinos_exercicios" to "anon";
grant TRUNCATE on public."treinos_exercicios" to "anon";
grant REFERENCES on public."treinos_exercicios" to "anon";
grant TRIGGER on public."treinos_exercicios" to "anon";
grant INSERT on public."treinos_exercicios" to "authenticated";
grant SELECT on public."treinos_exercicios" to "authenticated";
grant UPDATE on public."treinos_exercicios" to "authenticated";
grant DELETE on public."treinos_exercicios" to "authenticated";
grant TRUNCATE on public."treinos_exercicios" to "authenticated";
grant REFERENCES on public."treinos_exercicios" to "authenticated";
grant TRIGGER on public."treinos_exercicios" to "authenticated";
grant INSERT on public."treinos_exercicios" to "service_role";
grant SELECT on public."treinos_exercicios" to "service_role";
grant UPDATE on public."treinos_exercicios" to "service_role";
grant DELETE on public."treinos_exercicios" to "service_role";
grant TRUNCATE on public."treinos_exercicios" to "service_role";
grant REFERENCES on public."treinos_exercicios" to "service_role";
grant TRIGGER on public."treinos_exercicios" to "service_role";
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
commit;

