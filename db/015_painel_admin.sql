-- =============================================================
-- 015_painel_admin.sql
-- Funções administrativas seguras para cadastro de emissoras e
-- gestão de membros/operadores (RPCs restritas a administradores).
-- =============================================================
begin;

-- Garante suporte a personalização visual da emissora
alter table public.emissoras
  add column if not exists cor_primaria text default '#0066cc';

-- 1. Helper: verifica se o usuário autenticado é admin de uma emissora
create or replace function public.fn_usuario_eh_admin_emissora(
  p_emissora_id uuid
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.usuarios_emissoras ue
    join public.emissoras e on e.id = ue.emissora_id
    where ue.usuario_id = auth.uid()
      and ue.emissora_id = p_emissora_id
      and ue.papel = 'admin'
      and ue.ativo
      and e.ativo
  );
$$;

grant execute on function public.fn_usuario_eh_admin_emissora(uuid)
  to authenticated, service_role;

-- 2. RPC: Criar nova emissora e vincular o criador como admin
create or replace function public.fn_admin_criar_emissora(
  p_nome text,
  p_slug text default null,
  p_cor text default '#0066cc'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_emissora_id uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Apenas usuários autenticados podem criar emissoras.';
  end if;

  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'O nome da emissora é obrigatório.';
  end if;

  v_slug := coalesce(nullif(trim(p_slug), ''), lower(regexp_replace(trim(p_nome), '[^a-zA-Z0-9]+', '-', 'g')));

  insert into public.emissoras (nome, slug, cor_primaria, ativo)
  values (trim(p_nome), v_slug, coalesce(p_cor, '#0066cc'), true)
  returning id into v_emissora_id;

  -- Vincula o criador como admin da nova emissora
  insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
  values (auth.uid(), v_emissora_id, 'admin', true)
  on conflict (usuario_id, emissora_id) do update
  set papel = 'admin', ativo = true, updated_at = now();

  -- Instala tipos de peças padrão se a tabela tipos_pecas existir (compatível com 010)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tipos_pecas') then
    insert into public.tipos_pecas (emissora_id, codigo, nome, eh_interprograma, ordem, ativo)
    values
      (v_emissora_id, 'CHAMADA_QUENTE', 'Chamada Quente', false, 1, true),
      (v_emissora_id, 'INTERPROGRAMA', 'Interprograma', true, 2, true),
      (v_emissora_id, 'VINHETA', 'Vinheta', false, 3, true),
      (v_emissora_id, 'PROGRAMAETE', 'Programete', true, 4, true),
      (v_emissora_id, 'OUTROS', 'Outros', false, 5, true)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'emissora_id', v_emissora_id,
    'nome', trim(p_nome),
    'slug', v_slug
  );
end;
$$;

-- 3. RPC: Listar membros de uma emissora (somente para admins dela)
create or replace function public.fn_admin_listar_membros(
  p_emissora_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_membros jsonb;
begin
  if not public.fn_usuario_eh_admin_emissora(p_emissora_id) then
    raise exception 'Acesso negado: apenas administradores podem listar membros desta emissora.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'usuario_id', ue.usuario_id,
      'email', u.email,
      'papel', ue.papel,
      'ativo', ue.ativo,
      'created_at', ue.created_at
    ) order by ue.papel asc, u.email asc
  ), '[]'::jsonb)
  into v_membros
  from public.usuarios_emissoras ue
  join auth.users u on u.id = ue.usuario_id
  where ue.emissora_id = p_emissora_id;

  return v_membros;
end;
$$;

-- 4. RPC: Adicionar ou atualizar membro por email (somente admins)
create or replace function public.fn_admin_salvar_membro(
  p_emissora_id uuid,
  p_email text,
  p_papel text default 'operador'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_target_user_id uuid;
  v_email_limpo text;
begin
  if not public.fn_usuario_eh_admin_emissora(p_emissora_id) then
    raise exception 'Acesso negado: apenas administradores podem gerenciar membros desta emissora.';
  end if;

  if p_papel not in ('admin', 'operador', 'leitor') then
    raise exception 'Papel inválido. Escolha admin, operador ou leitor.';
  end if;

  v_email_limpo := lower(trim(p_email));

  select id into v_target_user_id
  from auth.users
  where lower(email) = v_email_limpo
  limit 1;

  if v_target_user_id is null then
    return jsonb_build_object(
      'ok', false,
      'erro', 'usuario_nao_encontrado',
      'mensagem', 'Nenhum usuário com o e-mail ' || v_email_limpo || ' foi encontrado no sistema. Ele precisa criar uma conta antes de ser vinculado.'
    );
  end if;

  insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo, updated_at)
  values (v_target_user_id, p_emissora_id, p_papel, true, now())
  on conflict (usuario_id, emissora_id) do update
  set papel = p_papel, ativo = true, updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'usuario_id', v_target_user_id,
    'email', v_email_limpo,
    'papel', p_papel
  );
end;
$$;

-- 5. RPC: Remover/desativar membro de uma emissora
create or replace function public.fn_admin_remover_membro(
  p_emissora_id uuid,
  p_usuario_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_total_admins int;
begin
  if not public.fn_usuario_eh_admin_emissora(p_emissora_id) then
    raise exception 'Acesso negado: apenas administradores podem remover membros.';
  end if;

  -- Impede que o último admin remova a si mesmo
  if p_usuario_id = auth.uid() then
    select count(*) into v_total_admins
    from public.usuarios_emissoras
    where emissora_id = p_emissora_id and papel = 'admin' and ativo = true;

    if v_total_admins <= 1 then
      raise exception 'Você não pode remover seu próprio acesso sendo o único administrador da emissora.';
    end if;
  end if;

  delete from public.usuarios_emissoras
  where emissora_id = p_emissora_id and usuario_id = p_usuario_id;

  return jsonb_build_object('ok', true, 'removido', p_usuario_id);
end;
$$;

-- Grants
grant execute on function public.fn_admin_criar_emissora(text, text, text) to authenticated, service_role;
grant execute on function public.fn_admin_listar_membros(uuid) to authenticated, service_role;
grant execute on function public.fn_admin_salvar_membro(uuid, text, text) to authenticated, service_role;
grant execute on function public.fn_admin_remover_membro(uuid, uuid) to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
