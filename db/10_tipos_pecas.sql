-- =====================================================
-- 010_tipos_pecas.sql — Tipos e Categorias Dinâmicas por Emissora
--
-- Substitui a rigidez do enum peca_categoria, permitindo que cada emissora
-- tenha suas próprias categorias, interprogramas e cores.
-- =====================================================

create table if not exists public.tipos_pecas (
  id               uuid primary key default gen_random_uuid(),
  emissora_id      uuid not null references public.emissoras(id) on delete cascade,
  codigo           text not null,
  nome             text not null,
  cor_texto        text default '#111827',
  cor_fundo        text default '#f3f4f6',
  cor_borda        text default '#e5e7eb',
  eh_interprograma boolean not null default false,
  ordem            int not null default 0,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint uq_emissora_tipo_codigo unique (emissora_id, codigo)
);

-- Índices
create index if not exists idx_tipos_pecas_emissora on public.tipos_pecas(emissora_id);
create index if not exists idx_tipos_pecas_codigo   on public.tipos_pecas(codigo);

-- RLS
alter table public.tipos_pecas enable row level security;

drop policy if exists tipos_pecas_select_auth on public.tipos_pecas;
create policy tipos_pecas_select_auth on public.tipos_pecas
  for select using (auth.role() = 'authenticated');

-- Popular categorias padrão do Canal Educação
insert into public.tipos_pecas (emissora_id, codigo, nome, cor_texto, cor_fundo, cor_borda, eh_interprograma, ordem)
values
  ('00000000-0000-0000-0000-000000000001', 'CHAMADA_QUENTE', 'Chamada quente', '#04342C', '#E1F5EE', '#1D9E75', false, 1),
  ('00000000-0000-0000-0000-000000000001', 'RCOM',           'Comercial',      '#2C2C2A', '#F1EFE8', '#888780', false, 2),
  ('00000000-0000-0000-0000-000000000001', 'RPOL',           'Político',       '#4A1B0C', '#FAECE7', '#D85A38', false, 3),
  ('00000000-0000-0000-0000-000000000001', 'INTGOV',         'Interprog gov',  '#085041', '#E1F5EE', '#1D9E75', true,  4),
  ('00000000-0000-0000-0000-000000000001', 'MANUT',          'Manutenção',     '#3B2706', '#FAF3E0', '#BA7517', false, 5),
  ('00000000-0000-0000-0000-000000000001', 'BUSSOLA',        'Bússola',        '#1E2A4A', '#EBF1FA', '#3B6CB5', false, 6),
  ('00000000-0000-0000-0000-000000000001', 'AUTO',           'Auto/instituc',  '#1E2A4A', '#EBF1FA', '#3B6CB5', false, 7),
  ('00000000-0000-0000-0000-000000000001', 'OUTROS',         'Outros',         '#2C2C2A', '#F1EFE8', '#888780', false, 8)
on conflict (emissora_id, codigo) do nothing;

notify pgrst, 'reload schema';
