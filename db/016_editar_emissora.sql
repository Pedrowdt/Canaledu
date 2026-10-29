-- =============================================================================
-- Migration 016: Edição de Dados da Emissora (Painel Admin)
-- Permite que administradores atualizem nome, cor e logo da sua emissora.
-- =============================================================================

begin;

-- Garante que as colunas visuais existam na tabela emissoras
alter table public.emissoras add column if not exists cor_primaria text default '#0066cc';
alter table public.emissoras add column if not exists logo_url text;

-- -----------------------------------------------------------------------------
-- 1. RPC para buscar os dados completos da emissora para edição
-- -----------------------------------------------------------------------------
create or replace function public.fn_admin_obter_emissora(
  p_emissora_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_dados jsonb;
begin
  if not public.fn_usuario_eh_admin_emissora(p_emissora_id) then
    raise exception 'Acesso negado: apenas administradores podem consultar esta emissora.';
  end if;

  select jsonb_build_object(
    'id', id,
    'nome', nome,
    'slug', slug,
    'cor_primaria', coalesce(cor_primaria, '#0066cc'),
    'logo_url', logo_url,
    'ativo', ativo
  )
  into v_dados
  from public.emissoras
  where id = p_emissora_id;

  return v_dados;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. RPC para salvar as alterações da emissora
-- -----------------------------------------------------------------------------
create or replace function public.fn_admin_atualizar_emissora(
  p_emissora_id uuid,
  p_nome text,
  p_cor text default null,
  p_logo_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_nome_limpo text;
  v_cor_limpa text;
begin
  -- Trava de segurança: só quem tem papel 'admin' nesta emissora específica
  if not public.fn_usuario_eh_admin_emissora(p_emissora_id) then
    raise exception 'Acesso negado: apenas administradores podem editar esta emissora.';
  end if;

  v_nome_limpo := trim(coalesce(p_nome, ''));
  if v_nome_limpo = '' then
    raise exception 'O nome da emissora é obrigatório.';
  end if;

  v_cor_limpa := trim(coalesce(p_cor, '#0066cc'));

  update public.emissoras
  set nome = v_nome_limpo,
      cor_primaria = v_cor_limpa,
      logo_url = nullif(trim(p_logo_url), ''),
      updated_at = now()
  where id = p_emissora_id;

  return jsonb_build_object(
    'ok', true,
    'id', p_emissora_id,
    'nome', v_nome_limpo,
    'cor', v_cor_limpa
  );
end;
$$;

grant execute on function public.fn_admin_obter_emissora(uuid) to authenticated, service_role;
grant execute on function public.fn_admin_atualizar_emissora(uuid, text, text, text) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
