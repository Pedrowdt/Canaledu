-- =====================================================
-- 014_user_data_multiemissora.sql
-- Particiona user_data por emissora (user_id + emissora_id)
-- =====================================================

alter table public.user_data 
  add column if not exists emissora_id uuid references public.emissoras(id);

update public.user_data 
set emissora_id = '00000000-0000-0000-0000-000000000001'::uuid 
where emissora_id is null;

alter table public.user_data 
  alter column emissora_id set not null;

alter table public.user_data 
  drop constraint if exists user_data_pkey;

alter table public.user_data 
  add constraint user_data_pkey primary key (user_id, emissora_id);

alter table public.user_data enable row level security;

drop policy if exists "user_data_select" on public.user_data;
drop policy if exists "user_data_all" on public.user_data;
drop policy if exists "user_data_insert" on public.user_data;
drop policy if exists "user_data_update" on public.user_data;

create policy "user_data_select" on public.user_data
  for select
  using (
    auth.uid() = user_id 
    and public.fn_usuario_tem_acesso_emissora(emissora_id)
  );

create policy "user_data_insert" on public.user_data
  for insert
  with check (
    auth.uid() = user_id 
    and public.fn_usuario_tem_acesso_emissora(emissora_id)
  );

create policy "user_data_update" on public.user_data
  for update
  using (
    auth.uid() = user_id 
    and public.fn_usuario_tem_acesso_emissora(emissora_id)
  )
  with check (
    auth.uid() = user_id 
    and public.fn_usuario_tem_acesso_emissora(emissora_id)
  );

notify pgrst, 'reload schema';
