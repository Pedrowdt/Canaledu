begin;

-- =====================================================
-- MIGRAÇÃO — leva o banco antigo (shared_data JSONB)
-- para as tabelas relacionais. Rodar UMA vez, depois
-- de 001_pecas_programas.sql. Reexecutar é seguro:
-- registros existentes são atualizados por "code".
-- =====================================================

-- Snapshot do JSONB legado ANTES de qualquer insert: os triggers de espelho
-- reescrevem shared_data conforme as tabelas são preenchidas.
create temporary table _legado on commit drop as
  select coalesce(pecas,'[]'::jsonb) as pecas, coalesce(programas,'[]'::jsonb) as programas
    from public.shared_data where id = 'workspace';

insert into public.pecas
  (code, descricao, tempo, midia, type, categoria, validade, dias, h_ini, h_fim, freq, obs, posicao, ordem)
select
  j->>'code',
  coalesce(j->>'descricao',''),
  coalesce(nullif(j->>'tempo',''),'00:00:00'),
  coalesce(nullif(j->>'midia',''),'0OMN'),
  coalesce(nullif(j->>'type',''),'ECHE'),
  case when (j->>'categoria') in
        ('CHAMADA_QUENTE','RCOM','RPOL','INTGOV','MANUT','BUSSOLA','AUTO')
       then (j->>'categoria')::peca_categoria else 'OUTROS'::peca_categoria end,
  nullif(j->>'validade','')::date,
  coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(j->'dias','[]'::jsonb)) x), '{}'),
  nullif(j->>'hIni',''),
  nullif(j->>'hFim',''),
  nullif(j->>'freq',''),
  coalesce(j->>'obs',''),
  case when (j->>'posicao') in ('inicio','fim','antes_programa','apos_assinatura')
       then (j->>'posicao')::peca_posicao_fixa else null end,
  coalesce((j->>'ordem')::int, 0)
from _legado s, jsonb_array_elements(s.pecas) j
where coalesce(j->>'code','') <> ''
on conflict (code) do update set
  descricao = excluded.descricao,
  tempo     = excluded.tempo,
  midia     = excluded.midia,
  type      = excluded.type,
  categoria = excluded.categoria,
  validade  = excluded.validade,
  dias      = excluded.dias,
  h_ini     = excluded.h_ini,
  h_fim     = excluded.h_fim,
  freq      = excluded.freq,
  obs       = excluded.obs;

insert into public.programas (code, descricao, tempo, midia, type, assinatura)
select
  j->>'code',
  coalesce(j->>'descricao',''),
  coalesce(nullif(j->>'tempo',''),'00:00:00'),
  coalesce(nullif(j->>'midia',''),'0OMN'),
  coalesce(nullif(j->>'type',''),'RPRO'),
  case lower(coalesce(j->'assinatura'->>0, j->>'assinatura',''))
    when 'infantil' then 'infantil'::faixa_assinatura
    when 'jovem'    then 'jovem'::faixa_assinatura
    when 'adulto'   then 'adulto'::faixa_assinatura
    else null end
from _legado s, jsonb_array_elements(s.programas) j
where coalesce(j->>'code','') <> ''
on conflict (code) do update set
  descricao  = excluded.descricao,
  tempo      = excluded.tempo,
  midia      = excluded.midia,
  type       = excluded.type,
  assinatura = coalesce(excluded.assinatura, public.programas.assinatura);

select public.fn_sync_shared_data();

commit;
