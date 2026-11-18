-- =====================================================
-- 021_programas_faixa_ocupada.sql
-- Adiciona suporte ao campo 'faixa_ocupada' no cadastro de programas,
-- permitindo associar horários/faixas de programação (ex: "TV Brasil Animada",
-- "07:30 - 12:15", "Faixa das 16h") ao catálogo e integrá-lo à montagem da grade.
-- =====================================================

-- 1) Adiciona a coluna na tabela pública de programas
alter table public.programas
  add column if not exists faixa_ocupada text;

create index if not exists idx_programas_faixa_ocupada
  on public.programas (faixa_ocupada)
  where faixa_ocupada is not null;

-- 2) Atualiza a view v_programas_roteiro para expor a nova coluna
create or replace view public.v_programas_roteiro as
  select p.code, p.descricao, p.tempo, p.midia, p.type,
         p.assinatura::text as assinatura, p.ativo,
         p.programa_titulo, p.temporada, p.episodio, p.bloco,
         p.faixa_ocupada
    from public.programas p
   where p.ativo;

alter view public.v_programas_roteiro set (security_invoker = true);
grant select on public.v_programas_roteiro to authenticated, service_role;

-- 3) Atualiza a função fn_salvar_programas para persistir faixa_ocupada
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
      programa_titulo, temporada, episodio, bloco, faixa_ocupada, created_by, updated_by
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
      nullif(btrim(coalesce(r->>'faixa_ocupada', r->>'faixaOcupada', '')), ''),
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
      faixa_ocupada = excluded.faixa_ocupada,
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

-- 4) Mantém assinatura compatível de 2 argumentos apontando para Canal Educação legado
create or replace function public.fn_salvar_programas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
) returns jsonb
language sql security definer set search_path = public as $$
  select public.fn_salvar_programas(
    p_upserts, p_deletes, '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

revoke execute on function public.fn_salvar_programas(jsonb, text[], uuid) from public, anon;
revoke execute on function public.fn_salvar_programas(jsonb, text[]) from public, anon;
grant execute on function public.fn_salvar_programas(jsonb, text[], uuid) to authenticated, service_role;
grant execute on function public.fn_salvar_programas(jsonb, text[]) to authenticated, service_role;

-- 5) Notifica a Data API do PostgREST
notify pgrst, 'reload schema';
