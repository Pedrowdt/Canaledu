-- =====================================================
-- LOG DE ATIVIDADES — auditoria multiusuário
-- Roteiro Canal Educação
--
-- Registra quem fez o quê (criar/editar/excluir peça ou
-- programa, conflitos de edição simultânea, sincronização
-- pulada por segurança) para dar visibilidade ao que antes
-- acontecia "em silêncio" e parecia perda de dados.
--
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- =====================================================

create table if not exists public.log_atividades (
  id           bigint generated always as identity primary key,
  workspace_id text not null default 'workspace',
  user_id      uuid references auth.users(id) on delete set null,
  user_email   text,
  acao         text not null,        -- 'criar' | 'editar' | 'excluir' | 'excluir_todos' |
                                      -- 'importar' | 'conflito' | 'sync_adiado' | 'sync_ok'
  entidade     text not null,        -- 'peca' | 'programa' | 'grade' | 'regras'
  codigo       text,                 -- code da peça/programa afetada, quando aplicável
  detalhes     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists log_atividades_created_idx on public.log_atividades (created_at desc);
create index if not exists log_atividades_workspace_idx on public.log_atividades (workspace_id, created_at desc);

grant select, insert on public.log_atividades to authenticated;
grant all on public.log_atividades to service_role;
grant usage, select on sequence public.log_atividades_id_seq to authenticated;

alter table public.log_atividades enable row level security;

-- Qualquer pessoa autenticada da equipe lê e grava seu próprio registro de log.
-- (Não há UPDATE/DELETE por design: o log é um histórico, não um estado editável.)
drop policy if exists log_atividades_select on public.log_atividades;
create policy log_atividades_select on public.log_atividades
  for select to authenticated using (true);

drop policy if exists log_atividades_insert on public.log_atividades;
create policy log_atividades_insert on public.log_atividades
  for insert to authenticated with check (true);

-- Tempo real: a tela de log (se aberta) mostra novas entradas sem recarregar.
do $$ begin
  alter publication supabase_realtime add table public.log_atividades;
exception when duplicate_object then null; end $$;
