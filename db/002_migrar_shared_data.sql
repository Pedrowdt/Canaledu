-- MIGRAÇÃO USANDO CTE (Evita erro de tabela temporária)
WITH _legado AS (
  select coalesce(pecas,'[]'::jsonb) as pecas, coalesce(programas,'[]'::jsonb) as programas
    from public.shared_data where id = 'workspace'
),
-- 1. INSERÇÃO DE PEÇAS
ins_pecas AS (
  insert into public.pecas
    (code, descricao, tempo, midia, type, categoria, validade, dias, h_ini, h_fim, freq, obs, posicao, ordem)
  select
    j->>'code',
    coalesce(j->>'descricao',''),
    coalesce(nullif(j->>'tempo',''),'00:00:00'),
    coalesce(nullif(j->>'midia',''),'0OMN'),
    coalesce(nullif(j->>'type',''),'ECHE'),
    
    -- MAPEAMENTO SEGURO DE CATEGORIAS (Trata espaços e variações)
    case 
      when lower(j->>'categoria') in ('chamada_quente', 'chamada quente') then 'CHAMADA_QUENTE'::peca_categoria
      when lower(j->>'categoria') in ('rcom') then 'RCOM'::peca_categoria
      when lower(j->>'categoria') in ('rpol') then 'RPOL'::peca_categoria
      when lower(j->>'categoria') in ('intgov', 'interprogramas gov') then 'INTGOV'::peca_categoria
      when lower(j->>'categoria') in ('manut', 'manuts', 'manuts faixas', 'manuts infantis') then 'MANUT'::peca_categoria
      when lower(j->>'categoria') in ('bussola') then 'BUSSOLA'::peca_categoria
      when lower(j->>'categoria') in ('auto') then 'AUTO'::peca_categoria
      else 'OUTROS'::peca_categoria 
    end,
    
    -- TRATAMENTO DE DATAS (Excel, DD/MM/YY, YYYY-MM-DD ou Textos aleatórios)
    CASE
      WHEN j->>'validade' ~ '^\d+$' THEN ('1899-12-30'::date + (j->>'validade')::int)
      WHEN j->>'validade' ~ '^\d{2}/\d{2}/\d{2}$' THEN to_date(j->>'validade', 'DD/MM/YY')
      WHEN j->>'validade' ~ '^\d{4}-\d{2}-\d{2}' THEN to_date(substring(j->>'validade' from '^\d{4}-\d{2}-\d{2}'), 'YYYY-MM-DD')
      ELSE NULL
    END,
    
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
    obs       = excluded.obs
  returning 1
),
-- 2. INSERÇÃO DE PROGRAMAS
ins_programas AS (
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
    assinatura = coalesce(excluded.assinatura, public.programas.assinatura)
  returning 1
)
-- 3. SINCRONIZA O ESPELHO (shared_data)
SELECT public.fn_sync_shared_data();
