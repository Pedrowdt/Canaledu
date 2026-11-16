-- =============================================================
-- 020_superusuarios.sql
-- Cria o conceito de Superusuário (Superadmin) com acesso irrestrito
-- e automático a todas as emissoras do sistema (atuais e futuras).
-- =============================================================

begin;

-- 1. Permite o papel 'superadmin' na tabela usuarios_emissoras
alter table public.usuarios_emissoras
  drop constraint if exists usuarios_emissoras_papel_check;

alter table public.usuarios_emissoras
  add constraint usuarios_emissoras_papel_check
  check (papel in ('superadmin', 'admin', 'operador', 'leitor'));

-- 2. Tabela de superadministradores globais
create table if not exists public.superadmins (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.superadmins enable row level security;

drop policy if exists superadmins_select_auth on public.superadmins;
create policy superadmins_select_auth on public.superadmins
  for select to authenticated
  using (true);

revoke all on public.superadmins from public, anon, authenticated;
grant select on public.superadmins to authenticated;
grant all on public.superadmins to service_role;

-- 3. Função auxiliar para verificar se um usuário é superadmin
create or replace function public.fn_usuario_eh_superadmin(
  p_usuario_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.superadmins s
    where s.usuario_id = coalesce(p_usuario_id, auth.uid())
  ) or exists (
    select 1
    from public.usuarios_emissoras ue
    where ue.usuario_id = coalesce(p_usuario_id, auth.uid())
      and ue.papel = 'superadmin'
      and ue.ativo = true
  );
$$;

grant execute on function public.fn_usuario_eh_superadmin(uuid)
  to authenticated, service_role;

-- 4. Atualiza fn_usuario_tem_acesso_emissora para contemplar superadmin
create or replace function public.fn_usuario_tem_acesso_emissora(
  p_emissora_id uuid
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.emissoras e
    where e.id = p_emissora_id and e.ativo
      and (
        public.fn_usuario_eh_superadmin(auth.uid())
        or exists (
          select 1
          from public.usuarios_emissoras ue
          where ue.usuario_id = auth.uid()
            and ue.emissora_id = p_emissora_id
            and ue.ativo
        )
      )
  );
$$;

-- 5. Atualiza fn_usuario_eh_admin_emissora para contemplar superadmin
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
    from public.emissoras e
    where e.id = p_emissora_id and e.ativo
      and (
        public.fn_usuario_eh_superadmin(auth.uid())
        or exists (
          select 1
          from public.usuarios_emissoras ue
          where ue.usuario_id = auth.uid()
            and ue.emissora_id = p_emissora_id
            and ue.papel in ('admin', 'superadmin')
            and ue.ativo
        )
      )
  );
$$;

-- 6. RPC: Promover usuário a Superusuário por e-mail e vincular a todas as emissoras
create or replace function public.fn_admin_adicionar_superadmin(
  p_email text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_target_user_id uuid;
  v_email_limpo text;
  v_total_emissoras int := 0;
  v_ja_tem_superadmin boolean;
begin
  if auth.uid() is null then
    raise exception 'Apenas usuários autenticados podem gerenciar superusuários.';
  end if;

  -- Se já existem superadmins cadastrados, somente outro superadmin pode adicionar
  select exists (select 1 from public.superadmins) into v_ja_tem_superadmin;
  if v_ja_tem_superadmin and not public.fn_usuario_eh_superadmin(auth.uid()) then
    raise exception 'Acesso negado: apenas um superusuário pode promover outro usuário a superusuário.';
  end if;

  v_email_limpo := lower(trim(p_email));
  if coalesce(v_email_limpo, '') = '' then
    raise exception 'O e-mail do usuário é obrigatório.';
  end if;

  select id into v_target_user_id
  from auth.users
  where lower(email) = v_email_limpo
  limit 1;

  if v_target_user_id is null then
    return jsonb_build_object(
      'ok', false,
      'erro', 'usuario_nao_encontrado',
      'mensagem', 'Nenhum usuário com o e-mail ' || v_email_limpo || ' foi encontrado no sistema. O usuário precisa criar a conta antes de ser promovido.'
    );
  end if;

  -- Insere na tabela de superadmins
  insert into public.superadmins (usuario_id, criado_por, created_at)
  values (v_target_user_id, auth.uid(), now())
  on conflict (usuario_id) do nothing;

  -- Vincula o superusuário a todas as emissoras ativas do sistema
  insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo, updated_at)
  select v_target_user_id, e.id, 'superadmin', true, now()
  from public.emissoras e
  where e.ativo = true
  on conflict (usuario_id, emissora_id) do update
  set papel = 'superadmin', ativo = true, updated_at = now();

  get diagnostics v_total_emissoras = row_count;

  return jsonb_build_object(
    'ok', true,
    'usuario_id', v_target_user_id,
    'email', v_email_limpo,
    'total_emissoras_vinculadas', v_total_emissoras
  );
end;
$$;

-- 7. RPC: Remover privilégio de superusuário
create or replace function public.fn_admin_remover_superadmin(
  p_email text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_target_user_id uuid;
  v_email_limpo text;
  v_total_superadmins int;
begin
  if not public.fn_usuario_eh_superadmin(auth.uid()) then
    raise exception 'Acesso negado: apenas um superusuário pode revogar privilégios de superusuário.';
  end if;

  v_email_limpo := lower(trim(p_email));

  select id into v_target_user_id
  from auth.users
  where lower(email) = v_email_limpo
  limit 1;

  if v_target_user_id is null then
    return jsonb_build_object('ok', false, 'erro', 'usuario_nao_encontrado');
  end if;

  -- Evita remover o último superusuário caso seja ele mesmo
  if v_target_user_id = auth.uid() then
    select count(*) into v_total_superadmins from public.superadmins;
    if v_total_superadmins <= 1 then
      raise exception 'Você não pode remover seu próprio privilégio sendo o único superusuário do sistema.';
    end if;
  end if;

  delete from public.superadmins where usuario_id = v_target_user_id;

  -- Rebaixa os vínculos de superadmin para admin normal
  update public.usuarios_emissoras
  set papel = 'admin', updated_at = now()
  where usuario_id = v_target_user_id and papel = 'superadmin';

  return jsonb_build_object('ok', true, 'email', v_email_limpo);
end;
$$;

-- 8. RPC: Listar superusuários cadastrados
create or replace function public.fn_admin_listar_superadmins()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_resultado jsonb;
begin
  if not public.fn_usuario_eh_superadmin(auth.uid()) then
    raise exception 'Acesso negado: apenas superusuários podem listar superusuários.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'usuario_id', s.usuario_id,
      'email', u.email,
      'created_at', s.created_at
    ) order by u.email asc
  ), '[]'::jsonb)
  into v_resultado
  from public.superadmins s
  join auth.users u on u.id = s.usuario_id;

  return v_resultado;
end;
$$;

-- 9. Atualiza fn_admin_listar_emissoras para listar todas para superadmins
create or replace function public.fn_admin_listar_emissoras()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_resultado jsonb;
  v_eh_superadmin boolean;
begin
  if auth.uid() is null then
    raise exception 'Apenas usuários autenticados podem listar emissoras.';
  end if;

  v_eh_superadmin := public.fn_usuario_eh_superadmin(auth.uid());

  if v_eh_superadmin then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'nome', e.nome,
        'slug', e.slug,
        'cor_primaria', coalesce(e.cor_primaria, '#0066cc'),
        'logo_url', e.logo_url,
        'ativo', e.ativo,
        'papel', 'superadmin',
        'total_membros', (
          select count(*) from public.usuarios_emissoras ue2 where ue2.emissora_id = e.id and ue2.ativo
        )
      ) order by e.nome asc
    ), '[]'::jsonb)
    into v_resultado
    from public.emissoras e
    where e.ativo = true;
  else
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
      and ue.papel in ('admin', 'superadmin')
      and ue.ativo = true
      and e.ativo = true;
  end if;

  return v_resultado;
end;
$$;

-- 10. Atualiza fn_admin_criar_emissora para vincular automaticamente superadmins
-- Remove assinatura legada de 3 argumentos para evitar ambiguidade
drop function if exists public.fn_admin_criar_emissora(text, text, text);

create or replace function public.fn_admin_criar_emissora(
  p_nome text,
  p_slug text default null,
  p_cor text default '#0066cc',
  p_logo_url text default null
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

  insert into public.emissoras (nome, slug, cor_primaria, logo_url, ativo)
  values (trim(p_nome), v_slug, coalesce(nullif(trim(p_cor), ''), '#0066cc'), nullif(trim(p_logo_url), ''), true)
  returning id into v_emissora_id;

  -- Vincula o criador como admin da nova emissora
  insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
  values (auth.uid(), v_emissora_id, case when public.fn_usuario_eh_superadmin(auth.uid()) then 'superadmin' else 'admin' end, true)
  on conflict (usuario_id, emissora_id) do update
  set papel = case when public.fn_usuario_eh_superadmin(auth.uid()) then 'superadmin' else 'admin' end, ativo = true, updated_at = now();

  -- Vincula automaticamente todos os superusuários do sistema à nova emissora
  insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
  select s.usuario_id, v_emissora_id, 'superadmin', true
  from public.superadmins s
  on conflict (usuario_id, emissora_id) do update
  set papel = 'superadmin', ativo = true, updated_at = now();

  -- Instala tipos de peças padrão se a tabela tipos_pecas existir
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

-- 11. Semeia os superadmins iniciais:
-- Promove o usuário autenticado atual (se houver) ou quem administra todas as emissoras
insert into public.superadmins (usuario_id, criado_por, created_at)
select distinct ue.usuario_id, ue.usuario_id, now()
from public.usuarios_emissoras ue
where ue.papel = 'admin' and ue.ativo = true
  and ue.usuario_id = auth.uid()
on conflict (usuario_id) do nothing;

-- Grants
grant execute on function public.fn_admin_adicionar_superadmin(text) to authenticated, service_role;
grant execute on function public.fn_admin_remover_superadmin(text) to authenticated, service_role;
grant execute on function public.fn_admin_listar_superadmins() to authenticated, service_role;
grant execute on function public.fn_admin_criar_emissora(text, text, text, text) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
