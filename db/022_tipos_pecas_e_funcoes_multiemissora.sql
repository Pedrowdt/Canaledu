-- =====================================================
-- 022_tipos_pecas_e_funcoes_multiemissora.sql
--
-- 1. Expande o enum peca_funcao com as funções de vinheta mapeadas nos roteiros:
--    - vh_vai_comecar (TV Brasil / Internacional: antecede o início da atração)
--    - vh_voltamos_ja (Internacional / TV Brasil: saída para o intervalo)
--    - vh_voltamos_com (Internacional / TV Brasil: retorno do intervalo)
--    - vh_realizacao (Canal Gov: vinheta de realização governamental)
--    - vh_ainda_hoje (Canal Gov / Internacional: chamada/vinheta de atração do mesmo dia)
--
-- 2. Assegura o registro das emissoras oficiais EBC:
--    - TV Brasil (Rede) (slug: tv-brasil)
--    - TV Brasil Internacional (slug: tv-brasil-int)
--    - Canal Gov (slug: canal-gov)
--
-- 3. Popula a tabela tipos_pecas com os tipos específicos de cada emissora:
--    - Canal Gov: GPRO, GVNH, GCHM, GGV, GINS, LIVE
--    - TV Brasil: RPRO, CH, VH, PROMO, INTERPRO, CI, PROGRAMETE
--    - TV Brasil Internacional: IPRO, CH, VH, PROMO, INTERPRO, CI
--
-- 4. Cria a RPC fn_tipos_pecas_emissora(p_emissora_id uuid) para expor os tipos ativos à UI.
-- =====================================================

-- 1. Expansão do enum peca_funcao
alter type peca_funcao add value if not exists 'vh_vai_comecar';
alter type peca_funcao add value if not exists 'vh_voltamos_ja';
alter type peca_funcao add value if not exists 'vh_voltamos_com';
alter type peca_funcao add value if not exists 'vh_realizacao';
alter type peca_funcao add value if not exists 'vh_ainda_hoje';

-- Garante que colunas de tema e identidade existam
alter table public.emissoras
  add column if not exists cor_primaria text default '#0066cc',
  add column if not exists logo_url text;

-- 2. Cadastro e vinculação dos tipos específicos por emissora
do $$
declare
  v_rede_id  uuid;
  v_inter_id uuid;
  v_gov_id   uuid;
begin
  -- 2.1 TV Brasil (Rede)
  select id into v_rede_id from public.emissoras where slug = 'tv-brasil';
  if v_rede_id is null then
    insert into public.emissoras (id, nome, slug, cor_primaria, ativo)
    values ('00000000-0000-0000-0000-000000000002', 'TV Brasil', 'tv-brasil', '#10b981', true)
    on conflict (slug) do update set nome = excluded.nome
    returning id into v_rede_id;
  end if;

  -- 2.2 TV Brasil Internacional
  select id into v_inter_id from public.emissoras where slug = 'tv-brasil-int';
  if v_inter_id is null then
    insert into public.emissoras (id, nome, slug, cor_primaria, ativo)
    values ('00000000-0000-0000-0000-000000000003', 'TV Brasil Internacional', 'tv-brasil-int', '#f59e0b', true)
    on conflict (slug) do update set nome = excluded.nome
    returning id into v_inter_id;
  end if;

  -- 2.3 Canal Gov
  select id into v_gov_id from public.emissoras where slug = 'canal-gov';
  if v_gov_id is null then
    insert into public.emissoras (id, nome, slug, cor_primaria, ativo)
    values ('00000000-0000-0000-0000-000000000004', 'Canal Gov', 'canal-gov', '#0284c7', true)
    on conflict (slug) do update set nome = excluded.nome
    returning id into v_gov_id;
  end if;

  -- 3. Inserção / Atualização dos tipos na tabela tipos_pecas

  -- 3.1 Tipos para TV Brasil (Rede)
  if v_rede_id is not null then
    insert into public.tipos_pecas (emissora_id, codigo, nome, sigla, eh_interprograma, ordem, cor, ativo)
    values
      (v_rede_id, 'RPRO', 'Programa', 'PGM', false, 1, '#10b981', true),
      (v_rede_id, 'CH', 'Chamada', 'CH', false, 2, '#ef4444', true),
      (v_rede_id, 'VH', 'Vinheta', 'VH', false, 3, '#8b5cf6', true),
      (v_rede_id, 'PROMO', 'Promoção', 'PRM', false, 4, '#f59e0b', true),
      (v_rede_id, 'INTERPRO', 'Interprograma', 'INT', true, 5, '#3b82f6', true),
      (v_rede_id, 'CI', 'Classificação Indicativa', 'CI', false, 6, '#64748b', true),
      (v_rede_id, 'PROGRAMETE', 'Programete', 'PGT', true, 7, '#059669', true)
    on conflict (emissora_id, codigo) do update set
      nome = excluded.nome,
      sigla = excluded.sigla,
      eh_interprograma = excluded.eh_interprograma,
      ordem = excluded.ordem,
      cor = excluded.cor,
      ativo = true;
  end if;

  -- 3.2 Tipos para TV Brasil Internacional
  if v_inter_id is not null then
    insert into public.tipos_pecas (emissora_id, codigo, nome, sigla, eh_interprograma, ordem, cor, ativo)
    values
      (v_inter_id, 'IPRO', 'Programa Internacional', 'PGM', false, 1, '#f59e0b', true),
      (v_inter_id, 'CH', 'Chamada', 'CH', false, 2, '#ef4444', true),
      (v_inter_id, 'VH', 'Vinheta', 'VH', false, 3, '#8b5cf6', true),
      (v_inter_id, 'PROMO', 'Promoção', 'PRM', false, 4, '#06b6d4', true),
      (v_inter_id, 'INTERPRO', 'Interprograma', 'INT', true, 5, '#3b82f6', true),
      (v_inter_id, 'CI', 'Classificação Indicativa', 'CI', false, 6, '#64748b', true)
    on conflict (emissora_id, codigo) do update set
      nome = excluded.nome,
      sigla = excluded.sigla,
      eh_interprograma = excluded.eh_interprograma,
      ordem = excluded.ordem,
      cor = excluded.cor,
      ativo = true;
  end if;

  -- 3.3 Tipos para Canal Gov
  if v_gov_id is not null then
    insert into public.tipos_pecas (emissora_id, codigo, nome, sigla, eh_interprograma, ordem, cor, ativo)
    values
      (v_gov_id, 'GPRO', 'Programa Gov', 'PGM', false, 1, '#0284c7', true),
      (v_gov_id, 'GVNH', 'Vinheta Gov', 'VNH', false, 2, '#8b5cf6', true),
      (v_gov_id, 'GCHM', 'Chamada Gov', 'CHM', false, 3, '#ef4444', true),
      (v_gov_id, 'GGV', 'Governo Federal / Campanhas', 'GGV', true, 4, '#f59e0b', true),
      (v_gov_id, 'GINS', 'Institucional Gov', 'INS', true, 5, '#10b981', true),
      (v_gov_id, 'LIVE', 'Ao Vivo / Transmissão', 'VIV', false, 6, '#dc2626', true)
    on conflict (emissora_id, codigo) do update set
      nome = excluded.nome,
      sigla = excluded.sigla,
      eh_interprograma = excluded.eh_interprograma,
      ordem = excluded.ordem,
      cor = excluded.cor,
      ativo = true;
  end if;

end $$;

-- 4. Função para obter os tipos de peças configurados para uma emissora
create or replace function public.fn_tipos_pecas_emissora(p_emissora_id uuid)
returns table (
  codigo text,
  nome text,
  sigla text,
  cor text,
  eh_interprograma boolean,
  ordem int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_emissora_id is null then
    p_emissora_id := '00000000-0000-0000-0000-000000000001'::uuid;
  end if;

  return query
    select tp.codigo, tp.nome, tp.sigla, tp.cor, tp.eh_interprograma, tp.ordem
      from public.tipos_pecas tp
     where tp.emissora_id = p_emissora_id
       and tp.ativo = true
     order by tp.ordem asc, tp.nome asc;
end;
$$;

revoke execute on function public.fn_tipos_pecas_emissora(uuid) from public, anon;
grant execute on function public.fn_tipos_pecas_emissora(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
