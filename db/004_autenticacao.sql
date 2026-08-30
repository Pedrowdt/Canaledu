-- =====================================================
-- 004 · AUTENTICAÇÃO — fecha o acesso anônimo ao cadastro
-- GNU GPL v3 · Canal Educação / MEC · 2026
--
-- Referenciado em AUTENTICACAO.md desde a introdução da autenticação
-- única (auth.js / window.CanalAuth), mas nunca tinha sido commitado —
-- gap sinalizado em db/README.md. Só a autoria (created_by/updated_by)
-- já era coberta por 003_consistencia.sql/006_pecas_one_way.sql via
-- fn_uid(); o que faltava era garantir, de forma explícita e
-- reexecutável, que o papel `anon` (chamadas sem sessão logada) não
-- tem NENHUM privilégio herdado de uma configuração anterior do
-- projeto Supabase — a equipe é toda autenticada, não deveria existir
-- acesso público às tabelas de cadastro nem ao log de atividades.
--
-- Idempotente: pode ser rodado quantas vezes for preciso, inclusive em
-- bancos onde `anon` já não tinha nenhum grant (REVOKE de um privilégio
-- inexistente não é erro no Postgres).
-- =====================================================

-- ── 1. Cadastro relacional (fonte da verdade) ────────────────
revoke all privileges on public.pecas     from anon;
revoke all privileges on public.programas from anon;

-- ── 2. Log de atividades (auditoria da equipe — não é dado público) ──
revoke all privileges on public.activity_log   from anon;
revoke all privileges on public.log_atividades from anon;

-- ── 3. Espelho legado / dados por usuário (compatibilidade) ──
-- Podem não existir em instalações que já migraram totalmente para o
-- cadastro relacional — o "if exists" evita erro nesse caso.
do $$
begin
  if to_regclass('public.shared_data') is not null then
    execute 'revoke all privileges on public.shared_data from anon';
  end if;
  if to_regclass('public.user_data') is not null then
    execute 'revoke all privileges on public.user_data from anon';
  end if;
end $$;

-- ── 4. Sequences associadas (SELECT em sequence também vaza informação) ──
do $$
begin
  if to_regclass('public.activity_log_id_seq') is not null then
    execute 'revoke all privileges on sequence public.activity_log_id_seq from anon';
  end if;
  if to_regclass('public.log_atividades_id_seq') is not null then
    execute 'revoke all privileges on sequence public.log_atividades_id_seq from anon';
  end if;
end $$;

-- ── 5. Funções de gravação/leitura — anon não deve poder executá-las ──
do $$
begin
  if to_regprocedure('public.fn_salvar_pecas(jsonb, text[])') is not null then
    execute 'revoke execute on function public.fn_salvar_pecas(jsonb, text[]) from anon';
  end if;
  if to_regprocedure('public.fn_salvar_programas(jsonb, text[])') is not null then
    execute 'revoke execute on function public.fn_salvar_programas(jsonb, text[]) from anon';
  end if;
  if to_regprocedure('public.fn_pecas_elegiveis(integer, text, date)') is not null then
    execute 'revoke execute on function public.fn_pecas_elegiveis(integer, text, date) from anon';
  end if;
end $$;

-- Nada disso afeta `authenticated`/`service_role` — os GRANTs para essas
-- roles continuam exatamente como definidos em 001/003/006. O efeito
-- observável é só: uma chamada à Data API sem um JWT de sessão válido
-- (ou seja, usando implicitamente o papel `anon`) passa a receber
-- "permission denied" em vez de, na melhor das hipóteses, uma leitura
-- que nunca deveria ter sido possível.
