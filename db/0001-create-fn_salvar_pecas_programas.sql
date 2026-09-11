-- Funções temporárias para salvar peças e programas
-- Aplicar este script no Supabase → SQL Editor → New query → Run

-- Função para salvar peças no cadastro
CREATE OR REPLACE FUNCTION fn_salvar_pecas(
    p_pecas JSONB,
    p_updated_by UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE shared_data
    SET pecas = p_pecas,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = 'workspace';
END;
$$ LANGUAGE plpgsql;

-- Função para salvar programas no cadastro
CREATE OR REPLACE FUNCTION fn_salvar_programas(
    p_programas JSONB,
    p_updated_by UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE shared_data
    SET programas = p_programas,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE id = 'workspace';
END;
$$ LANGUAGE plpgsql;