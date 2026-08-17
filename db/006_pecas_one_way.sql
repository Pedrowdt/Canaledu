-- =====================================================
-- 006 · FLUXO DE MÃO ÚNICA (Cadastro -> Roteiro)
-- GNU GPL v3 · Canal Educação / MEC · 2026
--
-- (pedido como "004_pecas_one_way.sql"; renumerado para 006
--  porque 004_activity_log.sql e 005_log_atividades.sql já existem)
--
-- OBJETIVO
-- public.pecas e public.programas só podem ser alterados pela tela
-- "Peças e Programas", através das funções fn_salvar_pecas /
-- fn_salvar_programas. O Roteiro passa a ser SOMENTE LEITURA.
--
-- Defesa em profundidade:
--   1) REVOKE de INSERT/UPDATE/DELETE para `authenticated` (só SELECT);
--   2) RLS sem políticas de escrita;
--   3) funções de gravação SECURITY DEFINER marcam o escopo "cadastro";
--   4) trigger BEFORE INSERT/UPDATE/DELETE rejeita escrita fora do escopo
--      (mesmo padrão do shared_data_guard da migração 003).
-- =====================================================

-- ── 1. Privilégios: apenas leitura para a equipe ─────────────
revoke insert, update, delete on public.pecas     from authenticated;
revoke insert, update, delete on public.programas from authenticated;
grant  select                 on public.pecas     to authenticated;
grant  select                 on public.programas to authenticated;
grant  all                    on public.pecas     to service_role;
grant  all                    on public.programas to service_role;

-- ── 2. RLS: derruba as políticas de escrita ──────────────────
drop policy if exists pecas_insert     on public.pecas;
drop policy if exists pecas_update     on public.pecas;
drop policy if exists pecas_delete     on public.pecas;
drop policy if exists programas_insert on public.programas;
drop policy if exists programas_update on public.programas;
drop policy if exists programas_delete on public.programas;

-- leitura continua liberada para a equipe autenticada
drop policy if exists pecas_select on public.pecas;
create policy pecas_select on public.pecas for select to authenticated using (true);
drop policy if exists programas_select on public.programas;
create policy programas_select on public.programas for select to authenticated using (true);

-- ── 3. Guarda de escopo ──────────────────────────────────────
-- Só a porta oficial (as funções de gravação) liga app.cadastro_scope.
create or replace function public.tg_cadastro_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.cadastro_scope', true), '') = 'cadastro' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception
    'Escrita bloqueada em %: o cadastro só pode ser alterado pela tela "Peças e Programas" (fn_salvar_%).',
    tg_table_name, tg_table_name
    using errcode = '42501';
end $$;

drop trigger if exists pecas_one_way_guard on public.pecas;
create trigger pecas_one_way_guard
  before insert or update or delete on public.pecas
  for each row execute function public.tg_cadastro_guard();

drop trigger if exists programas_one_way_guard on public.programas;
create trigger programas_one_way_guard
  before insert or update or delete on public.programas
  for each row execute function public.tg_cadastro_guard();

-- ── 4. Únicas portas de escrita: SECURITY DEFINER + escopo ───
-- Reaproveita o corpo da migração 003, agora como SECURITY DEFINER e
-- abrindo o escopo "cadastro" apenas durante a própria transação.
create or replace function public.fn_salvar_pecas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
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
begin
  if public.fn_uid() is null then
    raise exception 'É preciso estar autenticado para gravar o cadastro.' using errcode = '42501';
  end if;
  perform set_config('app.cadastro_scope', 'cadastro', true);

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

  perform set_config('app.cadastro_scope', '', true);
  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

create or replace function public.fn_salvar_programas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
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
begin
  if public.fn_uid() is null then
    raise exception 'É preciso estar autenticado para gravar o cadastro.' using errcode = '42501';
  end if;
  perform set_config('app.cadastro_scope', 'cadastro', true);

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

  perform set_config('app.cadastro_scope', '', true);
  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

grant execute on function public.fn_salvar_pecas(jsonb, text[])     to authenticated;
grant execute on function public.fn_salvar_programas(jsonb, text[]) to authenticated;

-- ── 5. Espelho shared_data continua funcionando ──────────────
-- fn_sync_shared_pecas/programas são SECURITY DEFINER e não tocam
-- pecas/programas, apenas leem — nada a alterar.
