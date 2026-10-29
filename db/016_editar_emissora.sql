-- =============================================================
-- 016_editar_emissora.sql
-- Listagem de emissoras para administração e atualização de dados
-- cadastrais, incluindo alteração segura de SLUG.
-- =============================================================
begin;

-- 1. RPC: Listar emissoras que o usuário autenticado administra
create or replace function public.fn_admin_listar_emissoras()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_resultado jsonb;
begin
  if auth.uid() is null then
    raise exception 'Apenas usuários autenticados podem listar emissoras.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'nome', e.nome,
      'slug', e.slug,
      'cor_primaria', coalesce(e.cor_primaria, '#0066cc'),
      'logo_url', e.logo_url,
      'ativo', e.ativo,
      'papel', ue.papel,
      'total_membros', (
        select count(*) from public.usuarios_emissoras ue2 where ue2.emissora_id = e.id and ue2.ativo
      )
    ) order by e.nome asc
  ), '[]'::jsonb)
  into v_resultado
  from public.emissoras e
  join public.usuarios_emissoras ue on ue.emissora_id = e.id
  where ue.usuario_id = auth.uid()
    and ue.papel = 'admin'
    and ue.ativo = true
    and e.ativo = true;

  return v_resultado;
end;
$$;

-- 2. RPC: Obter dados de uma emissora específica
create or replace function public.fn_admin_obter_emissora(
  p_emissora_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_emissora jsonb;
begin
  if not public.fn_usuario_eh_admin_emissora(p_emissora_id) then
    raise exception 'Acesso negado: apenas administradores podem visualizar esta emissora.';
  end if;

  select jsonb_build_object(
    'id', e.id,
    'nome', e.nome,
    'slug', e.slug,
    'cor_primaria', coalesce(e.cor_primaria, '#0066cc'),
    'logo_url', e.logo_url,
    'ativo', e.ativo
  )
  into v_emissora
  from public.emissoras e
  where e.id = p_emissora_id;

  return v_emissora;
end;
$$;

-- 3. RPC: Atualizar emissora (inclusive o SLUG)
create or replace function public.fn_admin_atualizar_emissora(
  p_emissora_id uuid,
  p_nome text,
  p_slug text default null,
  p_cor text default null,
  p_logo_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_slug text;
begin
  if not public.fn_usuario_eh_admin_emissora(p_emissora_id) then
    raise exception 'Acesso negado: apenas administradores podem editar esta emissora.';
  end if;

  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'O nome da emissora é obrigatório.';
  end if;

  -- Se slug foi informado, formata e valida
  if p_slug is not null and trim(p_slug) <> '' then
    v_slug := lower(trim(p_slug));
    v_slug := regexp_replace(v_slug, '[^a-z0-9_-]+', '-', 'g');
    v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');
  else
    -- Se não passou novo slug, mantém o atual
    select slug into v_slug from public.emissoras where id = p_emissora_id;
  end if;

  if trim(coalesce(v_slug, '')) = '' then
    raise exception 'O slug da emissora não pode ser vazio.';
  end if;

  -- Garante que o slug não colide com outra emissora
  if exists (
    select 1 from public.emissoras
    where slug = v_slug and id <> p_emissora_id
  ) then
    raise exception 'O slug "%" já está em uso por outra emissora.', v_slug;
  end if;

  update public.emissoras
  set nome = trim(p_nome),
      slug = v_slug,
      cor_primaria = coalesce(nullif(trim(p_cor), ''), cor_primaria, '#0066cc'),
      logo_url = nullif(trim(p_logo_url), '')
  where id = p_emissora_id;

  return jsonb_build_object(
    'ok', true,
    'id', p_emissora_id,
    'nome', trim(p_nome),
    'slug', v_slug,
    'cor_primaria', coalesce(nullif(trim(p_cor), ''), '#0066cc'),
    'logo_url', nullif(trim(p_logo_url), '')
  );
end;
$$;

grant execute on function public.fn_admin_listar_emissoras() to authenticated, service_role;
grant execute on function public.fn_admin_obter_emissora(uuid) to authenticated, service_role;
grant execute on function public.fn_admin_atualizar_emissora(uuid, text, text, text, text) to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
