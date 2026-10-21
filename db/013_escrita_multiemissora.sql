-- =====================================================
-- 013_escrita_multiemissora.sql
-- Isolamento de leitura/escrita por emissora.
-- Pré-requisitos: migrations 009, 010, 011 e 012 aplicadas.
-- Esta migration não substitui nem renumera migrations já aplicadas.
-- =====================================================

begin;

-- 1) Troca a unicidade global de code por unicidade dentro da emissora.
-- Remove tanto constraints quanto índices únicos isolados cuja coluna seja apenas `code`.
do $$
declare
  c record;
  i record;
begin
  -- Remove constraints UNIQUE em 'code'
  for c in
    select con.conname, rel.relname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join lateral (
        select array_agg(att.attname order by key.ordinality) as cols
          from unnest(con.conkey) with ordinality as key(attnum, ordinality)
          join pg_attribute att on att.attrelid = rel.oid and att.attnum = key.attnum
      ) x on true
     where ns.nspname = 'public'
       and rel.relname in ('pecas', 'programas')
       and con.contype in ('u', 'p')
       and con.conname <> 'pecas_pkey'
       and con.conname <> 'programas_pkey'
       and x.cols = array['code']::name[]
  loop
    execute format('alter table public.%I drop constraint if exists %I', c.relname, c.conname);
  end loop;

  -- Remove índices UNIQUE criados diretamente (sem constraint)
  for i in
    select cls.relname as idx_name, tab.relname as tbl_name
      from pg_index idx
      join pg_class cls on cls.oid = idx.indexrelid
      join pg_class tab on tab.oid = idx.indrelid
      join pg_namespace ns on ns.oid = tab.relnamespace
      join lateral (
        select array_agg(att.attname order by key.ordinality) as cols
          from unnest(idx.indkey) with ordinality as key(attnum, ordinality)
          join pg_attribute att on att.attrelid = tab.oid and att.attnum = key.attnum
      ) x on true
     where ns.nspname = 'public'
       and tab.relname in ('pecas', 'programas')
       and idx.indisunique = true
       and idx.indisprimary = false
       and x.cols = array['code']::name[]
  loop
    execute format('drop index if exists public.%I', i.idx_name);
  end loop;

  -- Dropar especificamente por nome caso tenha sido criado manualmente
  execute 'drop index if exists public.pecas_code_legacy_uidx';
  execute 'drop index if exists public.programas_code_legacy_uidx';
  execute 'drop index if exists public.pecas_code_unico';
  execute 'drop index if exists public.programas_code_unico';
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pecas'::regclass
       and conname = 'pecas_emissora_code_key'
  ) then
    alter table public.pecas
      add constraint pecas_emissora_code_key unique (emissora_id, code);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.programas'::regclass
       and conname = 'programas_emissora_code_key'
  ) then
    alter table public.programas
      add constraint programas_emissora_code_key unique (emissora_id, code);
  end if;
end $$;

-- 2) RLS: só lê peças/programas de emissoras com vínculo ativo.
-- A função auxiliar foi criada na migration 012.
drop policy if exists pecas_select on public.pecas;
create policy pecas_select on public.pecas
  for select to authenticated
  using (public.fn_usuario_tem_acesso_emissora(emissora_id));

drop policy if exists programas_select on public.programas;
create policy programas_select on public.programas
  for select to authenticated
  using (public.fn_usuario_tem_acesso_emissora(emissora_id));

-- Views PostgreSQL normalmente executam com os privilégios do dono.
-- security_invoker faz a leitura das views respeitar o RLS do usuário.
alter view public.v_pecas_roteiro set (security_invoker = true);
alter view public.v_programas_roteiro set (security_invoker = true);

-- 3) Versões multiemissora das funções de gravação.
-- A assinatura nova exige os 3 argumentos para evitar ambiguidade no
-- PostgREST com a assinatura legada de dois argumentos.
create or replace function public.fn_salvar_pecas(
  p_upserts jsonb,
  p_deletes text[],
  p_emissora_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r          jsonb;
  v_code     text;
  v_expected integer;
  v_current  integer;
  conflitos  jsonb := '[]'::jsonb;
  aplicados  integer := 0;
  removidos  integer := 0;
  v_uid      uuid;
begin
  v_uid := public.fn_uid();
  if v_uid is null then
    raise exception 'É preciso estar autenticado para gravar o cadastro.' using errcode = '42501';
  end if;
  if p_emissora_id is null
     or not public.fn_usuario_tem_acesso_emissora(p_emissora_id) then
    raise exception 'Usuário sem acesso ativo à emissora solicitada.' using errcode = '42501';
  end if;

  perform set_config('app.cadastro_scope', 'cadastro', true);

  for r in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
    v_code := btrim(coalesce(r->>'code', ''));
    continue when v_code = '';

    v_expected := nullif(r->>'row_version', '')::integer;
    select p.row_version into v_current
      from public.pecas p
     where p.emissora_id = p_emissora_id and p.code = v_code
     for update;

    if v_current is not null and v_expected is not null and v_current <> v_expected then
      conflitos := conflitos || jsonb_build_object(
        'code', v_code, 'esperado', v_expected, 'atual', v_current
      );
      continue;
    end if;

    insert into public.pecas (
      emissora_id, code, descricao, tempo, midia, type, categoria, validade, dias,
      h_ini, h_fim, freq, obs, posicao, ordem, ativo, funcao,
      programa_relacionado, created_by, updated_by
    ) values (
      p_emissora_id,
      v_code,
      coalesce(r->>'descricao', ''),
      coalesce(nullif(r->>'tempo', ''), '00:00:00'),
      coalesce(nullif(r->>'midia', ''), '0OMN'),
      coalesce(nullif(r->>'type', ''), 'ECHE'),
      public.fn_categoria_safe(r->>'categoria'),
      nullif(r->>'validade', '')::date,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(r->'dias', '[]'::jsonb)) x), '{}'::text[]),
      nullif(r->>'h_ini', ''),
      nullif(r->>'h_fim', ''),
      nullif(r->>'freq', ''),
      coalesce(r->>'obs', ''),
      public.fn_posicao_safe(r->>'posicao'),
      coalesce((r->>'ordem')::integer, 0),
      coalesce((r->>'ativo')::boolean, true),
      public.fn_funcao_safe(r->>'funcao'),
      nullif(r->>'programa_relacionado', ''),
      v_uid, v_uid
    )
    on conflict (emissora_id, code) do update set
      descricao = excluded.descricao,
      tempo = excluded.tempo,
      midia = excluded.midia,
      type = excluded.type,
      categoria = excluded.categoria,
      validade = excluded.validade,
      dias = excluded.dias,
      h_ini = excluded.h_ini,
      h_fim = excluded.h_fim,
      freq = excluded.freq,
      obs = excluded.obs,
      posicao = excluded.posicao,
      ordem = excluded.ordem,
      ativo = excluded.ativo,
      funcao = excluded.funcao,
      programa_relacionado = excluded.programa_relacionado,
      updated_by = v_uid;

    aplicados := aplicados + 1;
  end loop;

  if coalesce(array_length(p_deletes, 1), 0) > 0 then
    with removidas as (
      delete from public.pecas
       where emissora_id = p_emissora_id and code = any(p_deletes)
       returning 1
    ) select count(*) into removidos from removidas;
  end if;

  perform set_config('app.cadastro_scope', '', true);
  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

create or replace function public.fn_salvar_programas(
  p_upserts jsonb,
  p_deletes text[],
  p_emissora_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r          jsonb;
  v_code     text;
  v_expected integer;
  v_current  integer;
  conflitos  jsonb := '[]'::jsonb;
  aplicados  integer := 0;
  removidos  integer := 0;
  v_uid      uuid;
begin
  v_uid := public.fn_uid();
  if v_uid is null then
    raise exception 'É preciso estar autenticado para gravar o cadastro.' using errcode = '42501';
  end if;
  if p_emissora_id is null
     or not public.fn_usuario_tem_acesso_emissora(p_emissora_id) then
    raise exception 'Usuário sem acesso ativo à emissora solicitada.' using errcode = '42501';
  end if;

  perform set_config('app.cadastro_scope', 'cadastro', true);

  for r in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
    v_code := btrim(coalesce(r->>'code', ''));
    continue when v_code = '';

    v_expected := nullif(r->>'row_version', '')::integer;
    select p.row_version into v_current
      from public.programas p
     where p.emissora_id = p_emissora_id and p.code = v_code
     for update;

    if v_current is not null and v_expected is not null and v_current <> v_expected then
      conflitos := conflitos || jsonb_build_object(
        'code', v_code, 'esperado', v_expected, 'atual', v_current
      );
      continue;
    end if;

    insert into public.programas (
      emissora_id, code, descricao, tempo, midia, type, assinatura, ativo,
      programa_titulo, temporada, episodio, bloco, created_by, updated_by
    ) values (
      p_emissora_id,
      v_code,
      coalesce(r->>'descricao', ''),
      coalesce(nullif(r->>'tempo', ''), '00:00:00'),
      coalesce(nullif(r->>'midia', ''), '0OMN'),
      coalesce(nullif(r->>'type', ''), 'RPRO'),
      public.fn_assinatura_safe(r->>'assinatura'),
      coalesce((r->>'ativo')::boolean, true),
      nullif(r->>'programa_titulo', ''),
      nullif(r->>'temporada', '')::integer,
      nullif(r->>'episodio', '')::integer,
      nullif(r->>'bloco', '')::integer,
      v_uid, v_uid
    )
    on conflict (emissora_id, code) do update set
      descricao = excluded.descricao,
      tempo = excluded.tempo,
      midia = excluded.midia,
      type = excluded.type,
      assinatura = excluded.assinatura,
      ativo = excluded.ativo,
      programa_titulo = excluded.programa_titulo,
      temporada = excluded.temporada,
      episodio = excluded.episodio,
      bloco = excluded.bloco,
      updated_by = v_uid;

    aplicados := aplicados + 1;
  end loop;

  if coalesce(array_length(p_deletes, 1), 0) > 0 then
    with removidos_cte as (
      delete from public.programas
       where emissora_id = p_emissora_id and code = any(p_deletes)
       returning 1
    ) select count(*) into removidos from removidos_cte;
  end if;

  perform set_config('app.cadastro_scope', '', true);
  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

-- 4) Mantém as assinaturas antigas (2 argumentos) para o app existente.
-- O contrato legado continua apontando somente para Canal Educação.
create or replace function public.fn_salvar_pecas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
) returns jsonb
language sql security definer set search_path = public as $$
  select public.fn_salvar_pecas(
    p_upserts, p_deletes, '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

create or replace function public.fn_salvar_programas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
) returns jsonb
language sql security definer set search_path = public as $$
  select public.fn_salvar_programas(
    p_upserts, p_deletes, '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

revoke execute on function public.fn_salvar_pecas(jsonb, text[], uuid) from public, anon;
revoke execute on function public.fn_salvar_programas(jsonb, text[], uuid) from public, anon;
revoke execute on function public.fn_salvar_pecas(jsonb, text[]) from public, anon;
revoke execute on function public.fn_salvar_programas(jsonb, text[]) from public, anon;
grant execute on function public.fn_salvar_pecas(jsonb, text[], uuid) to authenticated, service_role;
grant execute on function public.fn_salvar_programas(jsonb, text[], uuid) to authenticated, service_role;
grant execute on function public.fn_salvar_pecas(jsonb, text[]) to authenticated, service_role;
grant execute on function public.fn_salvar_programas(jsonb, text[]) to authenticated, service_role;

-- 5) Os snapshots compartilhados existentes continuam representando
-- exclusivamente o Canal Educação, nunca uma mistura de emissoras.
create or replace function public.fn_sync_shared_pecas()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.mirror', 'on', true);
  insert into public.shared_data (id) values ('workspace') on conflict (id) do nothing;
  update public.shared_data set
    pecas = coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', p.code,
        'descricao', p.descricao,
        'tempo', p.tempo,
        'midia', p.midia,
        'type', p.type,
        'categoria', p.categoria::text,
        'validade', to_char(p.validade, 'YYYY-MM-DD'),
        'dias', p.dias,
        'hIni', p.h_ini,
        'hFim', p.h_fim,
        'freq', p.freq,
        'obs', p.obs,
        'posicao', p.posicao::text,
        'ordem', p.ordem,
        'funcao', p.funcao::text,
        'programa_relacionado', p.programa_relacionado
      ) order by p.categoria, p.code)
      from public.pecas p
      where p.emissora_id = '00000000-0000-0000-0000-000000000001'::uuid
        and p.ativo
    ), '[]'::jsonb),
    updated_at = now()
  where id = 'workspace';
end $$;

create or replace function public.fn_sync_shared_programas()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.mirror', 'on', true);
  insert into public.shared_data (id) values ('workspace') on conflict (id) do nothing;
  update public.shared_data set
    programas = coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', p.code,
        'descricao', p.descricao,
        'tempo', p.tempo,
        'midia', p.midia,
        'type', p.type,
        'assinatura', p.assinatura::text,
        'programa_titulo', p.programa_titulo,
        'temporada', p.temporada,
        'episodio', p.episodio,
        'bloco', p.bloco
      ) order by p.code)
      from public.programas p
      where p.emissora_id = '00000000-0000-0000-0000-000000000001'::uuid
        and p.ativo
    ), '[]'::jsonb),
    updated_at = now()
  where id = 'workspace';
end $$;

notify pgrst, 'reload schema';
commit;
