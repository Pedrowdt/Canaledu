// pecas_dia.js é um script clássico (sem `import`/`export`); carregamos o
// código-fonte e extraímos as funções puras que interessam ao teste, seguindo
// o mesmo padrão usado em tests/unit/consistencia.test.mjs para pecas-repo.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../pecas_dia.js', import.meta.url), 'utf8');

function loadPure() {
  const g = { window: {} };
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const factory = new Function(
    'window',
    'globalThis',
    'localStorage',
    `${src}\nreturn {
      parsePecasDiaRows, validadeToISO, parseValidade, matchVhDaquiForNext,
      pecasDoDiaDoCadastro, isPecaVigenteEm, isPecaDoDiaSemana, foiLimpoManualmente,
    };`
  );
  const app = factory.call(g, g.window, g, localStorage);
  return { ...app, __localStorage: localStorage };
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

describe('pecasDoDiaDoCadastro — peças do dia auto-preenchidas a partir do cadastro', () => {
  // Quarta-feira (dow=3), para casar com dias:['qua'] nos exemplos abaixo.
  const QUARTA = new Date(2026, 7, 26); // 26/08/2026 é uma quarta

  it('inclui peça de categoria elegível sem restrição de dia/validade', () => {
    const { pecasDoDiaDoCadastro } = loadPure();
    const cadastro = [{ code: 'A1', descricao: 'Chamada X', categoria: 'CHAMADA_QUENTE', tempo: '00:00:30', type: 'ECHE' }];
    const out = pecasDoDiaDoCadastro(cadastro, QUARTA);
    expect(out).toHaveLength(1);
    expect(out[0].categoria).toBe('CHAMADA QUENTE'); // mapeado pro rótulo de seção do painel
    expect(out[0]._origemCadastro).toBe(true);
  });

  it('categorias fora da rotação diária (MANUT/BUSSOLA) ficam de fora', () => {
    const { pecasDoDiaDoCadastro } = loadPure();
    const cadastro = [
      { code: 'M1', descricao: 'Manutenção', categoria: 'MANUT' },
      { code: 'B1', descricao: 'Bússola', categoria: 'BUSSOLA' },
    ];
    expect(pecasDoDiaDoCadastro(cadastro, QUARTA)).toHaveLength(0);
  });

  it('peça inativa (ativo:false) nunca entra, mesmo elegível', () => {
    const { pecasDoDiaDoCadastro } = loadPure();
    const cadastro = [{ code: 'A1', categoria: 'RCOM', ativo: false }];
    expect(pecasDoDiaDoCadastro(cadastro, QUARTA)).toHaveLength(0);
  });

  it('respeita os dias cadastrados — só entra se hoje estiver na lista', () => {
    const { pecasDoDiaDoCadastro } = loadPure();
    const cadastro = [
      { code: 'SO_QUA', categoria: 'RPOL', dias: ['qua'] },
      { code: 'SO_SEG', categoria: 'RPOL', dias: ['seg'] },
    ];
    const out = pecasDoDiaDoCadastro(cadastro, QUARTA);
    expect(out.map(p => p.code)).toEqual(['SO_QUA']);
  });

  it('sem `dias` cadastrado, vale para todo dia', () => {
    const { pecasDoDiaDoCadastro } = loadPure();
    const cadastro = [{ code: 'TODO_DIA', categoria: 'RCOM', dias: [] }];
    expect(pecasDoDiaDoCadastro(cadastro, QUARTA)).toHaveLength(1);
  });

  it('respeita a validade (kill date) — peça vencida não entra', () => {
    const { pecasDoDiaDoCadastro } = loadPure();
    const cadastro = [
      { code: 'VENCIDA', categoria: 'RCOM', validade: '2026-08-01' },
      { code: 'VALIDA',  categoria: 'RCOM', validade: '2026-12-31' },
    ];
    const out = pecasDoDiaDoCadastro(cadastro, QUARTA);
    expect(out.map(p => p.code)).toEqual(['VALIDA']);
  });

  it('mapeia freq/máx do cadastro para qtd, default 1', () => {
    const { pecasDoDiaDoCadastro } = loadPure();
    const cadastro = [
      { code: 'COM_FREQ', categoria: 'RCOM', freq: '3' },
      { code: 'SEM_FREQ', categoria: 'RCOM' },
    ];
    const out = pecasDoDiaDoCadastro(cadastro, QUARTA);
    expect(out.find(p => p.code === 'COM_FREQ').qtd).toBe(3);
    expect(out.find(p => p.code === 'SEM_FREQ').qtd).toBe(1);
  });
});

describe('foiLimpoManualmente — "Limpar" não pode ser imediatamente desfeito pela auto-derivação', () => {
  it('sem nada gravado, não está limpo', () => {
    const { foiLimpoManualmente } = loadPure();
    expect(foiLimpoManualmente('2026-08-26')).toBe(false);
  });

  it('reconhece a marca gravada por clearPecasDia() para o dia certo, só para o dia certo', () => {
    const { foiLimpoManualmente, __localStorage } = loadPure();
    __localStorage.setItem('roteiroApp', JSON.stringify({ pecasDiaLimpo: { '2026-08-26': true } }));
    expect(foiLimpoManualmente('2026-08-26')).toBe(true);
    expect(foiLimpoManualmente('2026-08-27')).toBe(false);
  });
});
