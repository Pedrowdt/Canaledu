// Incidente real de produção (2026-09-04): fn_salvar_pecas/fn_salvar_programas
// existiam no banco (003/006/007 aplicadas), mas a Data API (PostgREST)
// devolvia PGRST202 ("could not find the function") — o cache de schema
// do PostgREST não tinha sido avisado da mudança. Corrigido rodando
// `notify pgrst, 'reload schema';` depois de recriar as funções; este
// teste trava esse passo nas migrações que redefinem essas funções, para
// não se repetir num próximo reset/nova instalação.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function sql(nome) {
  return readFileSync(new URL(`../../db/${nome}`, import.meta.url), 'utf8').toLowerCase();
}

describe('notify pgrst — cache de schema do PostgREST recarregado após redefinir fn_salvar_*', () => {
  it('006_pecas_one_way.sql (redefine fn_salvar_pecas/fn_salvar_programas) avisa o PostgREST', () => {
    expect(sql('006_pecas_one_way.sql')).toContain("notify pgrst, 'reload schema'");
  });

  it('007_funcao_peca.sql (redefine fn_salvar_pecas/fn_salvar_programas de novo) avisa o PostgREST', () => {
    expect(sql('007_funcao_peca.sql')).toContain("notify pgrst, 'reload schema'");
  });

  it('006_pecas_one_way.sql fecha a concessão implícita de EXECUTE a PUBLIC/anon', () => {
    const s = sql('006_pecas_one_way.sql');
    expect(s).toContain('revoke execute on function public.fn_salvar_pecas(jsonb, text[])');
    expect(s).toContain('from public, anon');
  });
});
