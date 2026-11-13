-- =============================================================
-- 017_personalizacao_visual_emissora.sql
-- Suporte completo à identidade visual (cor_primaria e logo_url)
-- no cadastro e atualização de emissoras pelo Painel de Administração.
-- =============================================================
begin;

-- 1. Garante que as colunas existam na tabela emissoras
alter table public.emissoras
  add column if not exists cor_primaria text default '#0066cc',
  add column if not exists logo_url text;

-- 2. Atualiza fn_admin_criar_emissora para aceitar p_logo_url opcional
create or replace function public.fn_admin_criar_emissora(
  p_nome text,
  p_slug text default null,
  p_cor text default '#0066cc',
  p_logo_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_emissora_id uuid;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Apenas usuários autenticados podem criar emissoras.';
  end if;

  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'O nome da emissora é obrigatório.';
  end if;

  v_slug := coalesce(nullif(trim(p_slug), ''), lower(regexp_replace(trim(p_nome), '[^a-zA-Z0-9]+', '-', 'g')));

  insert into public.emissoras (nome, slug, cor_primaria, logo_url, ativo)
  values (trim(p_nome), v_slug, coalesce(nullif(trim(p_cor), ''), '#0066cc'), nullif(trim(p_logo_url), ''), true)
  returning id into v_emissora_id;

  -- Vincula o criador como admin da nova emissora
  insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
  values (auth.uid(), v_emissora_id, 'admin', true)
  on conflict (usuario_id, emissora_id) do update
  set papel = 'admin', ativo = true, updated_at = now();

  -- Instala tipos de peças padrão se a tabela tipos_pecas existir
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tipos_pecas') then
    insert into public.tipos_pecas (emissora_id, codigo, nome, eh_interprograma, ordem, ativo)
    values
      (v_emissora_id, 'CHAMADA_QUENTE', 'Chamada Quente', false, 1, true),
      (v_emissora_id, 'INTERPROGRAMA', 'Interprograma', true, 2, true),
      (v_emissora_id, 'VINHETA', 'Vinheta', false, 3, true),
      (v_emissora_id, 'PROGRAMAETE', 'Programete', true, 4, true),
      (v_emissora_id, 'OUTROS', 'Outros', false, 5, true)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'emissora_id', v_emissora_id,
    'nome', trim(p_nome),
    'slug', v_slug,
    'cor_primaria', coalesce(nullif(trim(p_cor), ''), '#0066cc'),
    'logo_url', nullif(trim(p_logo_url), '')
  );
end;
$$;

grant execute on function public.fn_admin_criar_emissora(text, text, text, text) to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
