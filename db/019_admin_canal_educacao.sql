-- =============================================================
-- 019_admin_canal_educacao.sql
-- Vincula administradores do sistema como administradores do
-- Canal Educação (00000000-0000-0000-0000-000000000001),
-- permitindo listar a emissora e gerenciar sua equipe no Painel Admin.
-- =============================================================

begin;

-- 1. Promove os administradores existentes para também serem admins do Canal Educação
insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
select distinct ue.usuario_id, '00000000-0000-0000-0000-000000000001'::uuid, 'admin', true
from public.usuarios_emissoras ue
where ue.papel = 'admin' and ue.ativo = true
on conflict (usuario_id, emissora_id)
do update set papel = 'admin', ativo = true, updated_at = now();

-- 2. Fallback caso nenhum admin exista ainda (promove todos os operadores vinculados ao Canal Educação)
do $$
begin
  if not exists (
    select 1 from public.usuarios_emissoras
    where emissora_id = '00000000-0000-0000-0000-000000000001'::uuid and papel = 'admin'
  ) then
    update public.usuarios_emissoras
    set papel = 'admin', updated_at = now()
    where emissora_id = '00000000-0000-0000-0000-000000000001'::uuid;
  end if;
end;
$$;

-- 3. Atualiza fn_admin_listar_emissoras para que qualquer administrador
-- de emissora também tenha acesso de administração ao Canal Educação
create or replace function public.fn_admin_listar_emissoras()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_resultado jsonb;
  v_eh_admin_global boolean;
begin
  if auth.uid() is null then
    raise exception 'Apenas usuários autenticados podem listar emissoras.';
  end if;

  -- Se o usuário administra pelo menos uma emissora, assegura que ele é admin do Canal Educação
  select exists (
    select 1 from public.usuarios_emissoras
    where usuario_id = auth.uid() and papel = 'admin' and ativo = true
  ) into v_eh_admin_global;

  if v_eh_admin_global then
    insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
    values (auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid, 'admin', true)
    on conflict (usuario_id, emissora_id)
    do update set papel = 'admin', ativo = true;
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

grant execute on function public.fn_admin_listar_emissoras() to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
