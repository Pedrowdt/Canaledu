-- =====================================================
-- ACTIVITY LOG — trilha de auditoria da equipe
-- Roteiro Canal Educação
--
-- Referenciada em canal-log.js (comentário de topo) desde que o módulo foi
-- criado, mas nunca tinha sido commitada — sem ela, CanalLog.registrar()
-- funcionava só em console + localStorage (nunca falha por causa disso,
-- é best-effort), e CanalLog.equipe() sempre devolvia [] silenciosamente.
--
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- =====================================================

create table if not exists public.activity_log (
  id           bigint generated always as identity primary key,
  workspace_id text not null default 'workspace',
  user_id      uuid references auth.users(id) on delete set null,
  user_email   text,
  tela         text not null,        -- 'roteiro' | 'cadastro' | ...
  evento       text not null,        -- 'cadastro_peca_salva', 'roteiro_sync_adiado', ...
  nivel        text not null default 'info' check (nivel in ('info', 'warn', 'error')),
  codes        text[] not null default '{}',   -- codes de peça/programa envolvidos, quando fizer sentido
  detalhe      jsonb not null default '{}'::jsonb,
  criado_em    timestamptz not null default now()
);

create index if not exists activity_log_criado_em_idx on public.activity_log (criado_em desc);
create index if not exists activity_log_workspace_idx on public.activity_log (workspace_id, criado_em desc);

grant select, insert on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
grant usage, select on sequence public.activity_log_id_seq to authenticated;

alter table public.activity_log enable row level security;

-- Qualquer pessoa autenticada da equipe lê tudo e grava seu próprio evento.
-- Sem UPDATE/DELETE por design: o log é um histórico, não um estado editável.
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select to authenticated using (true);

drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log
  for insert to authenticated with check (true);

-- Tempo real: a tela de log (se aberta) mostra novas entradas sem recarregar.
do $$ begin
  alter publication supabase_realtime add table public.activity_log;
exception when duplicate_object then null; end $$;
