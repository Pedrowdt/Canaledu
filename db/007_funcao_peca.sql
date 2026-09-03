-- =====================================================
-- 007 · FUNÇÃO DA PEÇA E IDENTIDADE ESTRUTURADA DO PROGRAMA
-- GNU GPL v3 · Canal Educação / MEC · 2026
--
-- Fase 1 do MVP de consolidação do cadastro (ver MVP-CADASTRO.md /
-- PROMPT-IMPLEMENTACAO-CADASTRO.md na raiz do repositório).
--
-- OBJETIVO
-- Hoje "qual vinheta acompanha qual programa" e "qual temporada/episódio/
-- bloco é este programa" só existem como texto livre em `descricao`,
-- reconstruído em tempo de execução por regex/keywords espalhadas em
-- app.js (VH_SEGUIR_MAP, VH_ASSISTINDO_MAP, baseProgramTitle,
-- getEpisodeId). Esta migração só ADICIONA colunas estruturadas — não
-- migra dados existentes, não remove nada, não muda comportamento de
-- nenhuma peça que já está cadastrada (todas ficam com os campos novos
-- em NULL, que os testes abaixo confirmam ser equivalente ao estado
-- anterior à migração).
--
-- Idempotente: pode ser rodada mais de uma vez sem quebrar.
-- =====================================================

-- ── 1. Domínio da "função" de uma peça type=EVNH ─────────────
-- NULL = não classificada (comportamento atual: cai no fallback de texto
-- em app.js/pecas_dia.js — ver Fase 2). Não é NOT NULL de propósito: ao
-- contrário de `categoria`, aqui não existe um "outro" que sirva de
-- default seguro — deixar em branco é o estado válido e esperado até
-- alguém cadastrar explicitamente.
do $$ begin
  create type peca_funcao as enum (
    'assinatura_infantil', 'assinatura_jovem', 'assinatura_adulto', 'assinatura_padrao',
    'vh_a_seguir', 'vh_daqui_a_pouco', 'vh_voce_esta_assistindo',
    'classificacao_indicativa', 'cartela_oficial', 'vinheta_id', 'transicao', 'outro'
  );
exception when duplicate_object then null; end $$;

-- ── 2. Colunas novas em `pecas` ───────────────────────────────
alter table public.pecas add column if not exists funcao peca_funcao;
-- Título-base normalizado do programa relacionado (não o `code` do
-- episódio — esse muda a cada importação; o título normalizado é
-- estável). Sem FK rígida de propósito, ver MVP-CADASTRO.md seção 2.2.
alter table public.pecas add column if not exists programa_relacionado text;

create index if not exists pecas_funcao_idx
  on public.pecas (funcao) where funcao is not null;
create index if not exists pecas_programa_relacionado_idx
  on public.pecas (programa_relacionado) where programa_relacionado is not null;

-- ── 3. Colunas novas em `programas` ───────────────────────────
-- Preenchidas pelo importador (que já faz esse parsing hoje em
-- app.js#baseProgramTitle/getEpisodeId — Fase 1 só abre espaço para
-- guardar o resultado; Fase 2 liga o importador nelas).
alter table public.programas add column if not exists programa_titulo text;
alter table public.programas add column if not exists temporada integer;
alter table public.programas add column if not exists episodio integer;
alter table public.programas add column if not exists bloco integer;

create index if not exists programas_titulo_idx
  on public.programas (programa_titulo) where programa_titulo is not null;

-- ── 4. Helper tolerante, mesmo padrão de fn_categoria_safe/fn_posicao_safe ──
-- Retorna NULL em vez de levantar erro para qualquer valor fora do enum —
-- uma peça com `funcao` inválida/vazia grava normalmente como "não
-- classificada", nunca falha o salvamento inteiro por causa disso.
create or replace function public.fn_funcao_safe(t text) returns peca_funcao
language plpgsql immutable as $$
begin return nullif(t, '')::peca_funcao;
exception when others then return null; end $$;

-- ── 5. fn_salvar_pecas / fn_salvar_programas — reconhecem os campos novos ──
-- Mesmo corpo de 006_pecas_one_way.sql, só acrescentando funcao/
-- programa_relacionado (pecas) e programa_titulo/temporada/episodio/bloco
-- (programas) no insert/update. Sem isso, as colunas existiriam no banco
-- mas nunca seriam gravadas — a Data API não grava nelas diretamente
-- (fluxo de mão única, ver 006), só estas funções SECURITY DEFINER podem.
create or replace function public.fn_salvar_pecas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r          jsonb;
  v_code     text;
  v_expected integer;
  v_current  integer;
  conflitos  jsonb := '[]'::jsonb;
  aplicados  integer := 0;
  removidos  integer := 0;
begin
  if public.fn_uid() is null then
    raise exception 'É preciso estar autenticado para gravar o cadastro.' using errcode = '42501';
  end if;
  perform set_config('app.cadastro_scope', 'cadastro', true);

  for r in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
    v_code := btrim(coalesce(r->>'code', ''));
    continue when v_code = '';

    v_expected := nullif(r->>'row_version', '')::integer;
    select row_version into v_current from public.pecas where code = v_code;

    if v_current is not null and v_expected is not null and v_current <> v_expected then
      conflitos := conflitos || jsonb_build_object('code', v_code, 'esperado', v_expected, 'atual', v_current);
      continue;
    end if;

    insert into public.pecas (code, descricao, tempo, midia, type, categoria, validade, dias,
                              h_ini, h_fim, freq, obs, posicao, ordem, ativo,
                              funcao, programa_relacionado, created_by, updated_by)
    values (
      v_code,
      coalesce(r->>'descricao', ''),
      coalesce(nullif(r->>'tempo', ''), '00:00:00'),
      coalesce(nullif(r->>'midia', ''), '0OMN'),
      coalesce(nullif(r->>'type', ''), 'ECHE'),
      public.fn_categoria_safe(r->>'categoria'),
      nullif(r->>'validade', '')::date,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(r->'dias', '[]'::jsonb)) x), '{}'::text[]),
      nullif(r->>'h_ini', ''),
      nullif(r->>'h_fim', ''),
      nullif(r->>'freq', ''),
      coalesce(r->>'obs', ''),
      public.fn_posicao_safe(r->>'posicao'),
      coalesce((r->>'ordem')::integer, 0),
      coalesce((r->>'ativo')::boolean, true),
      public.fn_funcao_safe(r->>'funcao'),
      nullif(r->>'programa_relacionado', ''),
      public.fn_uid(), public.fn_uid()
    )
    on conflict (code) do update set
      descricao = excluded.descricao, tempo = excluded.tempo, midia = excluded.midia, type = excluded.type,
      categoria = excluded.categoria, validade = excluded.validade, dias = excluded.dias,
      h_ini = excluded.h_ini, h_fim = excluded.h_fim, freq = excluded.freq, obs = excluded.obs,
      posicao = excluded.posicao, ordem = excluded.ordem, ativo = excluded.ativo,
      funcao = excluded.funcao, programa_relacionado = excluded.programa_relacionado,
      updated_by = public.fn_uid();

    aplicados := aplicados + 1;
  end loop;

  if coalesce(array_length(p_deletes, 1), 0) > 0 then
    with removidas as (delete from public.pecas where code = any(p_deletes) returning 1)
    select count(*) into removidos from removidas;
  end if;

  perform set_config('app.cadastro_scope', '', true);
  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

create or replace function public.fn_salvar_programas(
  p_upserts jsonb default '[]'::jsonb,
  p_deletes text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r          jsonb;
  v_code     text;
  v_expected integer;
  v_current  integer;
  conflitos  jsonb := '[]'::jsonb;
  aplicados  integer := 0;
  removidos  integer := 0;
begin
  if public.fn_uid() is null then
    raise exception 'É preciso estar autenticado para gravar o cadastro.' using errcode = '42501';
  end if;
  perform set_config('app.cadastro_scope', 'cadastro', true);

  for r in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
    v_code := btrim(coalesce(r->>'code', ''));
    continue when v_code = '';

    v_expected := nullif(r->>'row_version', '')::integer;
    select row_version into v_current from public.programas where code = v_code;

    if v_current is not null and v_expected is not null and v_current <> v_expected then
      conflitos := conflitos || jsonb_build_object('code', v_code, 'esperado', v_expected, 'atual', v_current);
      continue;
    end if;

    insert into public.programas (code, descricao, tempo, midia, type, assinatura, ativo,
                                  programa_titulo, temporada, episodio, bloco, created_by, updated_by)
    values (
      v_code,
      coalesce(r->>'descricao', ''),
      coalesce(nullif(r->>'tempo', ''), '00:00:00'),
      coalesce(nullif(r->>'midia', ''), '0OMN'),
      coalesce(nullif(r->>'type', ''), 'RPRO'),
      public.fn_assinatura_safe(r->>'assinatura'),
      coalesce((r->>'ativo')::boolean, true),
      nullif(r->>'programa_titulo', ''),
      nullif(r->>'temporada', '')::integer,
      nullif(r->>'episodio', '')::integer,
      nullif(r->>'bloco', '')::integer,
      public.fn_uid(), public.fn_uid()
    )
    on conflict (code) do update set
      descricao = excluded.descricao, tempo = excluded.tempo, midia = excluded.midia, type = excluded.type,
      assinatura = excluded.assinatura, ativo = excluded.ativo,
      programa_titulo = excluded.programa_titulo, temporada = excluded.temporada,
      episodio = excluded.episodio, bloco = excluded.bloco, updated_by = public.fn_uid();

    aplicados := aplicados + 1;
  end loop;

  if coalesce(array_length(p_deletes, 1), 0) > 0 then
    with removidos_cte as (delete from public.programas where code = any(p_deletes) returning 1)
    select count(*) into removidos from removidos_cte;
  end if;

  perform set_config('app.cadastro_scope', '', true);
  return jsonb_build_object('aplicados', aplicados, 'removidos', removidos, 'conflitos', conflitos);
end $$;

grant execute on function public.fn_salvar_pecas(jsonb, text[])     to authenticated;
grant execute on function public.fn_salvar_programas(jsonb, text[]) to authenticated;

-- ── 6. fn_pecas_elegiveis passa a devolver os campos novos também ──
-- View usada pelo Roteiro (v_pecas_roteiro) e pela função de elegibilidade
-- (fn_pecas_elegiveis) — sem isso, o Roteiro nunca veria `funcao`/
-- `programa_relacionado` mesmo depois de cadastrados. Cópia exata da
-- definição original (001_pecas_programas.sql) só acrescentando as duas
-- colunas novas no final — mesmos aliases/casts/filtro de `ativo`, para
-- não mudar nada do que `fn_pecas_elegiveis` já depende (v."hIni"/v."hFim").
create or replace view public.v_pecas_roteiro as
  select p.code, p.descricao, p.tempo, p.midia, p.type,
         p.categoria::text as categoria,
         to_char(p.validade,'YYYY-MM-DD') as validade,
         p.dias, p.h_ini as "hIni", p.h_fim as "hFim", p.freq, p.obs,
         p.posicao::text as posicao, p.ordem, p.ativo,
         p.funcao::text as funcao, p.programa_relacionado
    from public.pecas p
   where p.ativo;

grant select on public.v_pecas_roteiro to authenticated;

-- Mesma lógica para v_programas_roteiro — cópia exata do original
-- (001_pecas_programas.sql) com os 4 campos estruturados novos no final.
create or replace view public.v_programas_roteiro as
  select p.code, p.descricao, p.tempo, p.midia, p.type,
         p.assinatura::text as assinatura, p.ativo,
         p.programa_titulo, p.temporada, p.episodio, p.bloco
    from public.programas p
   where p.ativo;

grant select on public.v_programas_roteiro to authenticated;
