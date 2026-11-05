-- =====================================================
-- 010_tipos_pecas.sql — Tipos de Peças Dinâmicos por Emissora
--
-- Substitui a rigidez dos enums fixos de categoria permitindo
-- que cada emissora configure suas próprias peças, siglas e regras.
-- =====================================================

create table if not exists public.tipos_pecas (
  id                uuid primary key default gen_random_uuid(),
  emissora_id       uuid not null references public.emissoras(id) on delete cascade,
  codigo            text not null,         -- Ex: 'CHAMADA_QUENTE', 'INTERPROGRAMA', 'PATROCINIO'
  nome              text not null,         -- Ex: 'Chamada Quente', 'Interprograma Educativo'
  descricao         text,
  sigla             text,                  -- Ex: 'CQ', 'INT', 'PAT'
  cor               text default '#64748b',-- Hex para badge na UI
  eh_interprograma  boolean not null default false,
  ordem             int not null default 0,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_emissora_tipo_codigo unique (emissora_id, codigo)
);

-- Habilita RLS
alter table public.tipos_pecas enable row level security;

-- Usuários autenticados podem visualizar tipos de peças ativos
drop policy if exists tipos_pecas_select_auth on public.tipos_pecas;
create policy tipos_pecas_select_auth on public.tipos_pecas
  for select to authenticated using (true);

-- Popula os tipos padrão para o Canal Educação (retrocompatibilidade com os tipos legados)
insert into public.tipos_pecas (emissora_id, codigo, nome, eh_interprograma, ordem, cor)
values
  ('00000000-0000-0000-0000-000000000001', 'CHAMADA_QUENTE', 'Chamada Quente', false, 1, '#ef4444'),
  ('00000000-0000-0000-0000-000000000001', 'INTERPROGRAMA', 'Interprograma', true, 2, '#3b82f6'),
  ('00000000-0000-0000-0000-000000000001', 'VINHETA', 'Vinheta', false, 3, '#8b5cf6'),
  ('00000000-0000-0000-0000-000000000001', 'PROGRAMAETE', 'Programete', true, 4, '#10b981'),
  ('00000000-0000-0000-0000-000000000001', 'OUTROS', 'Outros', false, 5, '#64748b')
on conflict (emissora_id, codigo) do nothing;

notify pgrst, 'reload schema';
