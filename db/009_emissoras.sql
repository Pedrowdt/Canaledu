-- =====================================================
-- 009_emissoras.sql — Suporte a Múltiplas Emissoras (White-Label)
--
-- Cria a tabela emissoras e insere o 'Canal Educação' com UUID determinístico
-- para garantir retrocompatibilidade total com a instalação em produção.
-- =====================================================

create table if not exists public.emissoras (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  logo_url    text,
  tema        jsonb default '{}'::jsonb,
  config      jsonb default '{}'::jsonb,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Habilita RLS
alter table public.emissoras enable row level security;

-- Usuários autenticados podem visualizar as emissoras ativas
drop policy if exists emissoras_select_auth on public.emissoras;
create policy emissoras_select_auth on public.emissoras
  for select using (auth.role() = 'authenticated');

-- Inserir Canal Educação com UUID determinístico fixo
insert into public.emissoras (id, nome, slug, tema, config, ativo)
values (
  '00000000-0000-0000-0000-000000000001',
  'Canal Educação',
  'canaledu',
  '{"primary": "#1a56db", "contrast": "#ffffff"}'::jsonb,
  '{"break_slots": ["chamada", "interprograma"]}'::jsonb,
  true
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
