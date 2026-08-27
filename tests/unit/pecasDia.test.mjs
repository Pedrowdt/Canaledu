// pecas_dia.js é um script clássico (sem `import`/`export`); carregamos o
// código-fonte e extraímos as funções puras que interessam ao teste, seguindo
// o mesmo padrão usado em tests/unit/consistencia.test.mjs para pecas-repo.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas_dia.js', import.meta.url), 'utf8');

function loadPure() {
  const g = { window: {} };
  const factory = new Function(
    'window',
    'globalThis',
    `${src}\nreturn { parsePecasDiaRows, validadeToISO, parseValidade, matchVhDaquiForNext };`
  );
  return factory.call(g, g.window, g);
}

describe('import de Excel — validade sempre em ISO (bug: peça vencida nunca era detectada no Roteiro)', () => {
  it('serial de data do Excel vira AAAA-MM-DD, não mais DD/MM/YY', () => {
    const { parsePecasDiaRows } = loadPure();
    // 46238 (serial Excel) = 04/08/2026
    const rows = [
      ['CODE', 'DESCRIÇÃO', 'TEMPO', 'MÍDIA', 'TYPE', 'VALIDADE', 'OBS'],
      ['1001', 'PEÇA COM VALIDADE', 0.0007, '0OMN', 'ECHM', 46238, ''],
    ];
    const pecas = parsePecasDiaRows(rows);
    expect(pecas).toHaveLength(1);
    expect(pecas[0].validade).toBe('2026-08-04');
  });

  it('validade em texto livre (não é uma data) vira restrição em vez de ser tratada como data quebrada', () => {
    const { parsePecasDiaRows } = loadPure();
    const rows = [
      ['1002', 'PEÇA COM RESTRIÇÃO', 0.0007, '0OMN', 'ECHM', 'ATÉ NOVA ORDEM', ''],
    ];
    const pecas = parsePecasDiaRows(rows);
    expect(pecas[0].validade).toBe('ATÉ NOVA ORDEM');
    expect(pecas[0].restricao).toBe('ATÉ NOVA ORDEM');
  });

  it('validadeToISO/parseValidade aceitam DD/MM/AA digitado manualmente na planilha', () => {
    const { validadeToISO, parseValidade } = loadPure();
    expect(validadeToISO('04/08/26')).toBe('2026-08-04');
    expect(parseValidade('2026-08-04')).not.toBeNull();
  });
});

describe('matchVhDaquiForNext em pecas_dia.js — mesma regra de src/core/pecasCatalog.js', () => {
  it('pontuação no título não impede o casamento', () => {
    const { matchVhDaquiForNext } = loadPure();
    const vhs = [
      { descricao: 'VH DAQUI A POUCO PORTUGUÊS DAQUI, PORTUGUÊS DE LÁ' },
      { descricao: 'VH DAQUI A POUCO OUTRO PROGRAMA' },
    ];
    const match = matchVhDaquiForNext('PORTUGUÊS DAQUI, PORTUGUÊS DE LÁ', vhs);
    expect(match).not.toBeNull();
    expect(match.descricao).toContain('PORTUGUÊS DAQUI');
  });

  it('escolhe a VH certa mesmo quando dois programas compartilham uma palavra comum', () => {
    const { matchVhDaquiForNext } = loadPure();
    const vhs = [
      { descricao: 'VH DAQUI A POUCO EDUCAÇÃO FINANCEIRA' },
      { descricao: 'VH DAQUI A POUCO EDUCAÇÃO INFANTIL BRASIL' },
    ];
    const match = matchVhDaquiForNext('EDUCAÇÃO INFANTIL BRASIL', vhs);
    expect(match.descricao).toBe('VH DAQUI A POUCO EDUCAÇÃO INFANTIL BRASIL');
  });

  it('sem VH suficientemente específica, não insere nada (sem fallback genérico)', () => {
    const { matchVhDaquiForNext } = loadPure();
    const vhs = [{ descricao: 'VH DAQUI A POUCO ESCOLA DE TODOS' }];
    expect(matchVhDaquiForNext('PALALOOS', vhs)).toBeNull();
  });
});
