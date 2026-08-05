-- =====================================================
-- BANCO DE DADOS — PEÇAS E PROGRAMAS (relacional)
-- Roteiro Canal Educação
--
-- Cole no Supabase → SQL Editor → New query → Run.
-- Idempotente: pode rodar mais de uma vez sem quebrar.
--
-- Este schema é a FONTE DA VERDADE do cadastro. Um trigger
-- espelha tudo em shared_data.pecas / shared_data.programas
-- (JSONB), que é o que a tela de confecção de roteiros lê —
-- logo o roteiro é alimentado automaticamente pelo cadastro.
-- =====================================================

-- gen_random_uuid() é nativo do Postgres 13+ (não precisa de extensão).

-- ── Domínios ────────────────────────────────────────────────
do $$ begin
  create type peca_categoria as enum
    ('CHAMADA_QUENTE','RCOM','RPOL','INTGOV','MANUT','BUSSOLA','AUTO','OUTROS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type peca_posicao_fixa as enum
    ('inicio','fim','antes_programa','apos_assinatura');
exception when duplicate_object then null; end $$;

do $$ begin
  create type faixa_assinatura as enum ('infantil','jovem','adulto');
exception when duplicate_object then null; end $$;

-- ── PEÇAS ───────────────────────────────────────────────────
create table if not exists public.pecas (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  descricao    text not null,
  tempo        text not null default '00:00:00'
               check (tempo ~ '^\d{1,2}:[0-5]\d:[0-5]\d$'),
  midia        text not null default '0OMN',
  type         text not null default 'ECHE',
  categoria    peca_categoria not null default 'CHAMADA_QUENTE',
  validade     date,
  dias         text[] not null default '{}',            -- {seg,ter,...}
  h_ini        text check (h_ini ~ '^\d{2}:\d{2}$'),
  h_fim        text check (h_fim ~ '^\d{2}:\d{2}$'),
  freq         text,
  obs          text default '',
  posicao      peca_posicao_fixa,                        -- preenchido = peça fixa
  ordem        integer not null default 0,
  ativo        boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint pecas_code_unico unique (code)
);

create index if not exists pecas_categoria_idx on public.pecas (categoria);
create index if not exists pecas_type_idx      on public.pecas (type);
create index if not exists pecas_validade_idx  on public.pecas (validade);
create index if not exists pecas_posicao_idx   on public.pecas (posicao) where posicao is not null;
create index if not exists pecas_busca_idx     on public.pecas using gin (to_tsvector('portuguese', coalesce(descricao,'')));

-- ── PROGRAMAS ───────────────────────────────────────────────
create table if not exists public.programas (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  descricao    text not null,
  tempo        text not null default '00:00:00'
               check (tempo ~ '^\d{1,2}:[0-5]\d:[0-5]\d$'),
  midia        text not null default '0OMN',
  type         text not null default 'RPRO',
  assinatura   faixa_assinatura,     -- faixa usada na VH de assinatura
  ativo        boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint programas_code_unico unique (code)
);

create index if not exists programas_descricao_idx on public.programas using gin (to_tsvector('portuguese', coalesce(descricao,'')));

-- ── GRANTS (obrigatórios para a Data API alcançar as tabelas) ──
grant select, insert, update, delete on public.pecas     to authenticated;
grant select, insert, update, delete on public.programas to authenticated;
grant all on public.pecas     to service_role;
grant all on public.programas to service_role;

-- ── RLS: equipe autenticada lê e grava; anônimo não acessa ──
alter table public.pecas     enable row level security;
alter table public.programas enable row level security;

drop policy if exists pecas_select on public.pecas;
create policy pecas_select on public.pecas for select to authenticated using (true);
drop policy if exists pecas_insert on public.pecas;
create policy pecas_insert on public.pecas for insert to authenticated with check (true);
drop policy if exists pecas_update on public.pecas;
create policy pecas_update on public.pecas for update to authenticated using (true) with check (true);
drop policy if exists pecas_delete on public.pecas;
create policy pecas_delete on public.pecas for delete to authenticated using (true);

drop policy if exists programas_select on public.programas;
create policy programas_select on public.programas for select to authenticated using (true);
drop policy if exists programas_insert on public.programas;
create policy programas_insert on public.programas for insert to authenticated with check (true);
drop policy if exists programas_update on public.programas;
create policy programas_update on public.programas for update to authenticated using (true) with check (true);
drop policy if exists programas_delete on public.programas;
create policy programas_delete on public.programas for delete to authenticated using (true);

-- ── updated_at automático ───────────────────────────────────
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pecas_touch on public.pecas;
create trigger pecas_touch before update on public.pecas
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists programas_touch on public.programas;
create trigger programas_touch before update on public.programas
  for each row execute function public.tg_touch_updated_at();

-- =====================================================
-- ALIMENTAÇÃO DO ROTEIRO
-- =====================================================

-- Catálogo pronto para o roteiro (mesmas chaves usadas no front).
create or replace view public.v_pecas_roteiro as
  select p.code, p.descricao, p.tempo, p.midia, p.type,
         p.categoria::text as categoria,
         to_char(p.validade,'YYYY-MM-DD') as validade,
         p.dias, p.h_ini as "hIni", p.h_fim as "hFim", p.freq, p.obs,
         p.posicao::text as posicao, p.ordem, p.ativo
    from public.pecas p
   where p.ativo;

create or replace view public.v_programas_roteiro as
  select p.code, p.descricao, p.tempo, p.midia, p.type,
         p.assinatura::text as assinatura, p.ativo
    from public.programas p
   where p.ativo;

-- Peças elegíveis para um dia da semana e horário (regras do cadastro).
create or replace function public.fn_pecas_elegiveis(
  p_dow  integer default extract(dow from now())::int,
  p_hora text    default to_char(now(),'HH24:MI'),
  p_ref  date    default current_date
)
returns setof public.v_pecas_roteiro
language sql stable security invoker set search_path = public as $$
  with dia as (select (array['dom','seg','ter','qua','qui','sex','sab'])[p_dow + 1] as d)
  select v.* from public.v_pecas_roteiro v, dia
   where (v.validade is null or v.validade >= to_char(p_ref,'YYYY-MM-DD'))
     and (coalesce(array_length(v.dias,1),0) = 0 or dia.d = any (v.dias))
     and (
       (v."hIni" is null and v."hFim" is null)
       or (v."hIni" is not null and v."hFim" is not null and (
            (v."hIni" <= v."hFim" and p_hora between v."hIni" and v."hFim")
         or (v."hIni" >  v."hFim" and (p_hora >= v."hIni" or p_hora <= v."hFim"))))
       or (v."hIni" is not null and v."hFim" is null and p_hora >= v."hIni")
       or (v."hIni" is null and v."hFim" is not null and p_hora <= v."hFim")
     );
$$;

grant select on public.v_pecas_roteiro, public.v_programas_roteiro to authenticated;
grant execute on function public.fn_pecas_elegiveis(integer, text, date) to authenticated;

-- Espelho para shared_data (compatibilidade com a tela de roteiro atual).
-- Cada coluna é espelhada por uma função própria: o trigger de "pecas" nunca
-- reescreve "programas" e vice-versa (evita apagar dados durante a migração).
create or replace function public.fn_sync_shared_pecas()
returns void language sql security definer set search_path = public as $$
  insert into public.shared_data (id) values ('workspace')
  on conflict (id) do nothing;

  update public.shared_data set
    pecas = coalesce((
      select jsonb_agg(to_jsonb(v) - 'ativo' order by v.categoria, v.code)
        from public.v_pecas_roteiro v), '[]'::jsonb),
    updated_at = now()
  where id = 'workspace';
$$;

create or replace function public.fn_sync_shared_programas()
returns void language sql security definer set search_path = public as $$
  insert into public.shared_data (id) values ('workspace')
  on conflict (id) do nothing;

  update public.shared_data set
    programas = coalesce((
      select jsonb_agg(to_jsonb(v) - 'ativo' order by v.code)
        from public.v_programas_roteiro v), '[]'::jsonb),
    updated_at = now()
  where id = 'workspace';
$$;

-- Espelha as duas colunas de uma vez (uso manual / fim da migração).
create or replace function public.fn_sync_shared_data()
returns void language sql security definer set search_path = public as $$
  select public.fn_sync_shared_pecas();
  select public.fn_sync_shared_programas();
$$;

create or replace function public.tg_sync_shared_pecas()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.fn_sync_shared_pecas(); return null; end $$;

create or replace function public.tg_sync_shared_programas()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.fn_sync_shared_programas(); return null; end $$;

drop trigger if exists pecas_sync_shared on public.pecas;
create trigger pecas_sync_shared after insert or update or delete on public.pecas
  for each statement execute function public.tg_sync_shared_pecas();

drop trigger if exists programas_sync_shared on public.programas;
create trigger programas_sync_shared after insert or update or delete on public.programas
  for each statement execute function public.tg_sync_shared_programas();

grant execute on function public.fn_sync_shared_data() to authenticated;
grant execute on function public.fn_sync_shared_pecas() to authenticated;
grant execute on function public.fn_sync_shared_programas() to authenticated;

-- Realtime nas novas tabelas (ignora se já estiverem publicadas).
do $$ begin
  alter publication supabase_realtime add table public.pecas;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.programas;
exception when duplicate_object then null; end $$;
