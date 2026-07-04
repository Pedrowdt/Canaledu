-- =====================================================
-- Roteiro Canal Educação — Schema Supabase
-- Cole este arquivo inteiro em: Supabase → SQL Editor → New query → Run
-- =====================================================

-- Tabela compartilhada: banco de peças, programas, grade e regras.
-- Uma única linha (id = 'workspace') vista/editada por toda a equipe.
create table if not exists shared_data (
  id                  text primary key,
  pecas               jsonb default '[]'::jsonb,
  programas           jsonb default '[]'::jsonb,
  grade               jsonb default '{}'::jsonb,
  grade_by_day        jsonb default '{}'::jsonb,
  grade_order         jsonb default '{}'::jsonb,
  grade_order_by_day  jsonb default '{}'::jsonb,
  regras              jsonb default '{}'::jsonb,
  updated_by          uuid,
  updated_at          timestamptz default now()
);

insert into shared_data (id) values ('workspace')
on conflict (id) do nothing;

-- Tabela por usuário: roteiro do dia e peças do dia de cada pessoa,
-- isolados — ninguém vê o roteiro de outro usuário.
create table if not exists user_data (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  roteiros    jsonb default '{}'::jsonb,
  pecas_dia   jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- ── Segurança (Row Level Security) ──
alter table shared_data enable row level security;
alter table user_data   enable row level security;

-- shared_data: qualquer usuário autenticado (da equipe) pode ler e gravar
drop policy if exists shared_data_select on shared_data;
create policy shared_data_select on shared_data
  for select using (auth.role() = 'authenticated');

drop policy if exists shared_data_update on shared_data;
create policy shared_data_update on shared_data
  for update using (auth.role() = 'authenticated');

drop policy if exists shared_data_insert on shared_data;
create policy shared_data_insert on shared_data
  for insert with check (auth.role() = 'authenticated');

-- user_data: cada usuário só enxerga e grava a própria linha
drop policy if exists user_data_select on user_data;
create policy user_data_select on user_data
  for select using (auth.uid() = user_id);

drop policy if exists user_data_update on user_data;
create policy user_data_update on user_data
  for update using (auth.uid() = user_id);

drop policy if exists user_data_insert on user_data;
create policy user_data_insert on user_data
  for insert with check (auth.uid() = user_id);

-- Habilita "tempo real" (Realtime) na tabela compartilhada, para que
-- a tela de outros usuários se atualize sozinha quando alguém edita
-- o banco de peças/programas/regras.
alter publication supabase_realtime add table shared_data;
