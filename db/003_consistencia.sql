-- =====================================================
-- CONSISTÊNCIA MULTIUSUÁRIO — PEÇAS E PROGRAMAS (CORRIGIDO PARA SUPABASE)
-- =====================================================

-- 1. Versão por linha
alter table public.pecas     add column if not exists row_version integer not null default 1;
alter table public.programas add column if not exists row_version integer not null default 1;

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at  := now();
  new.row_version := coalesce(old.row_version, 0) + 1;
  return new;
end $$;

-- 2. Helpers tolerantes
create or replace function public.fn_uid() returns uuid
language plpgsql stable as $$
begin return auth.uid(); exception when others then return null; end $$;

create or replace function public.fn_categoria_safe(t text) returns peca_categoria
language plpgsql immutable as $$
begin return coalesce(nullif(t, ''), 'OUTROS')::peca_categoria;
exception when others then return 'OUTROS'::peca_categoria; end $$;

create or replace function public.fn_posicao_safe(t text) returns peca_posicao_fixa
language plpgsql immutable as $$
begin return nullif(t, '')::peca_posicao_fixa;
exception when others then return null; end $$;

create or replace function public.fn_assinatura_safe(t text) returns faixa_assinatura
language plpgsql immutable as $$
begin return nullif(lower(t), '')::faixa_assinatura;
exception when others then return null; end $$;

-- 3. Gravação por DELTA com detecção de conflito
create or replace function public.fn_salvar_pecas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  r          jsonb;
  v_code     text;
  v_expected integer;
  v_current  integer;
  conflitos  jsonb := '[]'::jsonb;
  aplicados  integer := 0;
  removidos  integer := 0;
begin
  for r in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
    v_code := btrim(coalesce(r->>'code', ''));
    continue when v_code = '';

    v_expected := nullif(r->>'row_version', '')::integer;
    select row_version into v_current from public.pecas where code = v_code;

    if v_current is not null and v_expected is not null and v_current <> v_expected then
      conflitos := conflitos || jsonb_build_object('code', v_code, 'esperado', v_expected, 'atual', v_current);
      continue;
    end if;

    insert into public.pecas (code, descricao, tempo, midia, type, categoria, validade, dias,
                              h_ini, h_fim, freq, obs, posicao, ordem, ativo, created_by, updated_by)
    values (
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
      public.fn_uid(), public.fn_uid()
    )
    on conflict (code) do update set
      descricao = excluded.descricao, tempo = excluded.tempo, midia = excluded.midia, type = excluded.type,
      categoria = excluded.categoria, validade = excluded.validade, dias = excluded.dias,
      h_ini = excluded.h_ini, h_fim = excluded.h_fim, freq = excluded.freq, obs = excluded.obs,
      posicao = excluded.posicao, ordem = excluded.ordem, ativo = excluded.ativo, updated_by = public.fn_uid();

    aplicados := aplicados + 1;
  end loop;

  if coalesce(array_length(p_deletes, 1), 0) > 0 then
    with removidas as (delete from public.pecas where code = any(p_deletes) returning 1)
    select count(*) into removidos from removidas;
  end if;

  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

create or replace function public.fn_salvar_programas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  r          jsonb;
  v_code     text;
  v_expected integer;
  v_current  integer;
  conflitos  jsonb := '[]'::jsonb;
  aplicados  integer := 0;
  removidos  integer := 0;
begin
  for r in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
    v_code := btrim(coalesce(r->>'code', ''));
    continue when v_code = '';

    v_expected := nullif(r->>'row_version', '')::integer;
    select row_version into v_current from public.programas where code = v_code;

    if v_current is not null and v_expected is not null and v_current <> v_expected then
      conflitos := conflitos || jsonb_build_object('code', v_code, 'esperado', v_expected, 'atual', v_current);
      continue;
    end if;

    insert into public.programas (code, descricao, tempo, midia, type, assinatura, ativo, created_by, updated_by)
    values (
      v_code,
      coalesce(r->>'descricao', ''),
      coalesce(nullif(r->>'tempo', ''), '00:00:00'),
      coalesce(nullif(r->>'midia', ''), '0OMN'),
      coalesce(nullif(r->>'type', ''), 'RPRO'),
      public.fn_assinatura_safe(r->>'assinatura'),
      coalesce((r->>'ativo')::boolean, true),
      public.fn_uid(), public.fn_uid()
    )
    on conflict (code) do update set
      descricao = excluded.descricao, tempo = excluded.tempo, midia = excluded.midia, type = excluded.type,
      assinatura = excluded.assinatura, ativo = excluded.ativo, updated_by = public.fn_uid();

    aplicados := aplicados + 1;
  end loop;

  if coalesce(array_length(p_deletes, 1), 0) > 0 then
    with removidos_cte as (delete from public.programas where code = any(p_deletes) returning 1)
    select count(*) into removidos from removidos_cte;
  end if;

  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

grant execute on function public.fn_salvar_pecas(jsonb, text[])     to authenticated;
grant execute on function public.fn_salvar_programas(jsonb, text[]) to authenticated;
grant execute on function public.fn_uid() to authenticated;

-- 4. Espelho: CORRIGIDO para usar set_config (PL/pgSQL) em vez de SET na declaração.
create or replace function public.fn_sync_shared_pecas()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.mirror', 'on', true);
  insert into public.shared_data (id) values ('workspace') on conflict (id) do nothing;
  update public.shared_data set
    pecas = coalesce((select jsonb_agg(to_jsonb(v) - 'ativo' order by v.categoria, v.code)
                        from public.v_pecas_roteiro v), '[]'::jsonb),
    updated_at = now()
  where id = 'workspace';
end;
$$;

create or replace function public.fn_sync_shared_programas()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.mirror', 'on', true);
  insert into public.shared_data (id) values ('workspace') on conflict (id) do nothing;
  update public.shared_data set
    programas = coalesce((select jsonb_agg(to_jsonb(v) - 'ativo' order by v.code)
                            from public.v_programas_roteiro v), '[]'::jsonb),
    updated_at = now()
  where id = 'workspace';
end;
$$;

create or replace function public.tg_shared_data_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.mirror', true), '') = 'on' then
    return new;
  end if;
  -- Cadastro relacional é a fonte da verdade: ninguém sobrescreve o espelho.
  if exists (select 1 from public.pecas) then
    new.pecas := old.pecas;
  end if;
  if exists (select 1 from public.programas) then
    new.programas := old.programas;
  end if;
  return new;
end $$;

drop trigger if exists shared_data_guard on public.shared_data;
create trigger shared_data_guard before update on public.shared_data
  for each row execute function public.tg_shared_data_guard();

select public.fn_sync_shared_data();
