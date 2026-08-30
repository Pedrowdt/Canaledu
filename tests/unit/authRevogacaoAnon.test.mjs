// db/004_autenticacao.sql era referenciado em AUTENTICACAO.md/db/README.md
// mas nunca tinha sido commitado (gap de segurança sinalizado na revisão do
// projeto). Este teste é rápido (não sobe um Postgres) e só garante que o
// arquivo existe e tem a forma esperada; a validação de verdade (aplica
// contra um Postgres real via PGlite e confere idempotência) foi feita
// manualmente ao escrever o arquivo — ver db/testar-schema.mjs para o
// padrão de teste completo contra banco real, caso a suíte de `npm run
// test:db` seja estendida no futuro para incluir esta migração.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const path = new URL('../../db/004_autenticacao.sql', import.meta.url);

describe('db/004_autenticacao.sql — revogação de acesso anônimo (gap fechado)', () => {
  it('o arquivo existe (não é mais só uma referência em Markdown)', () => {
    expect(existsSync(path)).toBe(true);
  });

  it('revoga privilégios do papel anon nas tabelas de cadastro', () => {
    const sql = readFileSync(path, 'utf8').toLowerCase();
    expect(sql).toContain('revoke all privileges on public.pecas');
    expect(sql).toContain('revoke all privileges on public.programas');
    expect(sql).toContain('from anon');
  });

  it('não contém nenhum DROP TABLE/TRUNCATE — só revogação de privilégios', () => {
    const sql = readFileSync(path, 'utf8').toLowerCase();
    expect(sql).not.toMatch(/drop\s+table/);
    expect(sql).not.toMatch(/truncate/);
  });
});
