-- =============================================================
-- 012_usuarios_emissoras.sql
-- Associa usuários autenticados a emissoras e oferece verificações
-- seguras de acesso para uso em migrations/fluxos posteriores.
--
-- Esta migration NÃO altera fn_salvar_pecas/fn_salvar_programas nem
-- habilita gravações multiemissora. Isso só deve ocorrer quando as funções
-- também verificarem a associação do usuário à emissora solicitada.
-- =============================================================

begin;

do $$
begin
  if not exists (
    select 1 from public.emissoras
    where id = '00000000-0000-0000-0000-000000000001'::uuid
  ) then
    raise exception
      'A emissora Canal Educação (00000000-0000-0000-0000-000000000001) não existe. Aplique 009_emissoras.sql antes de 012.';
  end if;
end;
$$;

create table if not exists public.usuarios_emissoras (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  emissora_id uuid not null references public.emissoras(id) on delete cascade,
  papel text not null default 'operador',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_emissoras_pkey primary key (usuario_id, emissora_id),
  constraint usuarios_emissoras_papel_check
    check (papel in ('admin', 'operador', 'leitor'))
);

-- Para bancos onde a tabela já foi criada parcialmente antes da migration.
alter table public.usuarios_emissoras
  add column if not exists papel text not null default 'operador';
alter table public.usuarios_emissoras
  add column if not exists ativo boolean not null default true;
alter table public.usuarios_emissoras
  add column if not exists created_at timestamptz not null default now();
alter table public.usuarios_emissoras
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.usuarios_emissoras'::regclass
      and conname = 'usuarios_emissoras_papel_check'
  ) then
    alter table public.usuarios_emissoras
      add constraint usuarios_emissoras_papel_check
      check (papel in ('admin', 'operador', 'leitor'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.usuarios_emissoras'::regclass
      and conname = 'usuarios_emissoras_usuario_id_fkey'
  ) then
    alter table public.usuarios_emissoras
      add constraint usuarios_emissoras_usuario_id_fkey
      foreign key (usuario_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.usuarios_emissoras'::regclass
      and conname = 'usuarios_emissoras_emissora_id_fkey'
  ) then
    alter table public.usuarios_emissoras
      add constraint usuarios_emissoras_emissora_id_fkey
      foreign key (emissora_id) references public.emissoras(id) on delete cascade;
  end if;
end;
$$;

create index if not exists idx_usuarios_emissoras_emissora_ativo
  on public.usuarios_emissoras (emissora_id, ativo);

-- Retrocompatibilidade: associa todos os usuários já cadastrados ao Canal
-- Educação como operadores, preservando o acesso operacional existente.
-- A concessão de outros papéis e o vínculo a outras emissoras ficam para
-- um fluxo administrativo controlado, não para esta migration automática.
insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
select u.id,
       '00000000-0000-0000-0000-000000000001'::uuid,
       'operador',
       true
from auth.users as u
on conflict (usuario_id, emissora_id) do nothing;

alter table public.usuarios_emissoras enable row level security;

drop policy if exists usuarios_emissoras_select_own
  on public.usuarios_emissoras;
create policy usuarios_emissoras_select_own
  on public.usuarios_emissoras
  for select
  to authenticated
  using (usuario_id = (select auth.uid()));

-- O cliente autenticado só pode consultar os próprios vínculos. Nenhuma
-- permissão direta de escrita é concedida; gestão de membros deve usar um
-- fluxo administrativo/servidor dedicado, que será definido numa etapa futura.
revoke all on public.usuarios_emissoras from public, anon, authenticated;
grant select on public.usuarios_emissoras to authenticated;
grant all on public.usuarios_emissoras to service_role;

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
    from public.usuarios_emissoras ue
    join public.emissoras e on e.id = ue.emissora_id
    where ue.usuario_id = auth.uid()
      and ue.emissora_id = p_emissora_id
      and ue.ativo
      and e.ativo
  );
$$;

create or replace function public.fn_usuario_papel_emissora(
  p_emissora_id uuid
) returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select ue.papel
  from public.usuarios_emissoras ue
  join public.emissoras e on e.id = ue.emissora_id
  where ue.usuario_id = auth.uid()
    and ue.emissora_id = p_emissora_id
    and ue.ativo
    and e.ativo
  limit 1;
$$;

revoke all on function public.fn_usuario_tem_acesso_emissora(uuid)
  from public, anon;
revoke all on function public.fn_usuario_papel_emissora(uuid)
  from public, anon;
grant execute on function public.fn_usuario_tem_acesso_emissora(uuid)
  to authenticated, service_role;
grant execute on function public.fn_usuario_papel_emissora(uuid)
  to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
