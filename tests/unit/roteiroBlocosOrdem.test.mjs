// Ordenação resiliente de blocos em buildRoteiroFromPrograms():
// blocos de um mesmo programa/episódio que chegam fora de ordem física
// (ex.: BL 02 antes de BL 01 no CSV do Notion) devem sair em ordem 1, 2, ...
// no roteiro, com VH A SEGUIR / CLASSIFICAÇÃO / VC ESTÁ ASSISTINDO nos
// lugares certos.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildRoteiroFromPrograms } from '../../src/core/roteiroBuilder.js';
import { getBlockNumber, sortBlocks, baseProgramTitle } from '../../src/core/normalize.js';
import { baseProgramTitle as baseProgramTitleCatalog } from '../../src/core/pecasCatalog.js';

const bl = (code, descricao, tempo = '00:10:00') => ({ code, descricao, tempo, midia: '0OMN', type: 'RPRO' });

const VH_SEGUIR = { code: 'VS-TESTE', descricao: 'VH A SEGUIR TESTE', tempo: '00:00:05', midia: '0OMN', type: 'EVNH', keywords: ['TESTE'] };
const VH_ASSIST = { code: 'VA-TESTE', descricao: 'VH VC ESTA ASSISTINDO TESTE', tempo: '00:00:04', midia: '0OMN', type: 'EVNH', keywords: ['TESTE'] };
const catalogo = { vhSeguirMap: [VH_SEGUIR], vhAssistindoMap: [VH_ASSIST] };
// Assinatura desligada para o teste focar em bloco/vinhetas.
const regras = {
  vhAssinaturaInfantil: { ativo: false },
  vhAssinaturaJovem: { ativo: false },
  vhAssinaturaAdulto: { ativo: false },
};
const codes = (roteiro) => roteiro.map((i) => i.code);

describe('getBlockNumber', () => {
  it('extrai o número com/sem zero à esquerda e ignora texto após o bloco', () => {
    expect(getBlockNumber('PGM TESTE - T01 EP01 - BL 01')).toBe(1);
    expect(getBlockNumber('PGM TESTE - T01 EP01 - BL 1')).toBe(1);
    expect(getBlockNumber('PGM TESTE - T01 EP01 - BL02')).toBe(2);
    expect(getBlockNumber('PGM TESTE - BL 01 (REPRISE)')).toBe(1);
    expect(getBlockNumber('PGM TESTE - bl 10')).toBe(10);
  });
  it('assume 1 quando não há indicação de bloco', () => {
    expect(getBlockNumber('PGM TESTE - T01 EP01')).toBe(1);
    expect(getBlockNumber('')).toBe(1);
    expect(getBlockNumber(undefined)).toBe(1);
  });
});

describe('baseProgramTitle — bloco seguido de observações', () => {
  it.each([baseProgramTitle, baseProgramTitleCatalog])('remove "BL 01 (REPRISE)" mesmo sem EP', (fn) => {
    expect(fn('PGM TESTE - BL 01 (REPRISE)')).toBe('TESTE');
    expect(fn('PGM TESTE BL1 (REPRISE)')).toBe('TESTE');
    expect(fn('PGM TESTE - BL 02')).toBe('TESTE');
    expect(fn('PGM TESTE - T01 EP01 - BL 01 (REPRISE)')).toBe('TESTE');
  });
});

describe('sortBlocks', () => {
  it('não muta a entrada e mantém episódios agrupados (ordem da 1ª aparição), blocos crescentes', () => {
    const input = [
      bl('a', 'PGM TESTE - T01 EP01 - BL 02'),
      bl('b', 'PGM TESTE - T01 EP02 - BL 01'),
      bl('c', 'PGM TESTE - T01 EP01 - BL 01'),
      bl('d', 'PGM TESTE - T01 EP02 - BL 02'),
    ];
    const copia = [...input];
    expect(sortBlocks(input).map((b) => b.code)).toEqual(['c', 'a', 'b', 'd']);
    expect(input).toEqual(copia);
  });
});

describe('buildRoteiroFromPrograms — blocos fora de ordem (CSV do Notion)', () => {
  const fora = [
    bl('B2', 'PGM TESTE - T01 EP01 - BL 02'),
    bl('B1', 'PGM TESTE - T01 EP01 - BL 01'),
  ];

  it('coloca o BL 01 antes do BL 02', () => {
    const roteiro = buildRoteiroFromPrograms(fora, regras, {}, [], catalogo);
    const c = codes(roteiro);
    expect(c.indexOf('B1')).toBeGreaterThanOrEqual(0);
    expect(c.indexOf('B1')).toBeLessThan(c.indexOf('B2'));
  });

  it('posiciona as vinhetas como se a entrada já estivesse em ordem', () => {
    const roteiro = buildRoteiroFromPrograms(fora, regras, {}, [], catalogo);
    expect(codes(roteiro)).toEqual([
      'VS-TESTE',   // A SEGUIR antes do 1º bloco (BL 01)
      '85283',      // classificação só antes do BL 01 (não antes de BL 02)
      'B1',
      'VA-TESTE',   // VC ESTÁ ASSISTINDO ao redor do break entre blocos do mesmo episódio
      '__BREAK__',
      '__BREAK__',
      'VA-TESTE',
      'B2',
    ]);
  });

  it('gera o mesmo roteiro com a entrada em ordem e fora de ordem', () => {
    const emOrdem = buildRoteiroFromPrograms([...fora].reverse(), regras, {}, [], catalogo);
    const invertido = buildRoteiroFromPrograms(fora, regras, {}, [], catalogo);
    expect(codes(invertido)).toEqual(codes(emOrdem));
  });

  it('não coloca VC ESTÁ ASSISTINDO entre episódios diferentes, mesmo com blocos intercalados', () => {
    const roteiro = buildRoteiroFromPrograms([
      bl('E1B2', 'PGM TESTE - T01 EP01 - BL 02'),
      bl('E2B1', 'PGM TESTE - T01 EP02 - BL 01'),
      bl('E1B1', 'PGM TESTE - T01 EP01 - BL 01'),
      bl('E2B2', 'PGM TESTE - T01 EP02 - BL 02'),
    ], regras, {}, [], catalogo);
    const c = codes(roteiro);
    // EP01 completo (BL01, BL02), depois EP02 completo (BL01, BL02)
    expect(c.filter((x) => /^E\dB\d$/.test(x))).toEqual(['E1B1', 'E1B2', 'E2B1', 'E2B2']);
    // entre EP01 BL02 e EP02 BL01: só breaks (sem vinheta VA)
    const entre = c.slice(c.indexOf('E1B2') + 1, c.indexOf('E2B1'));
    expect(entre).not.toContain('VA-TESTE');
    expect(entre.filter((x) => x === '__BREAK__')).toHaveLength(2);
    // entre BL01 e BL02 do mesmo episódio: VA antes e depois do break
    const dentro = c.slice(c.indexOf('E1B1') + 1, c.indexOf('E1B2'));
    expect(dentro).toEqual(['VA-TESTE', '__BREAK__', '__BREAK__', 'VA-TESTE']);
  });

  it('não coloca classificação indicativa antes de BL 2 (sem zero), igual a BL 02', () => {
    const roteiro = buildRoteiroFromPrograms([
      bl('B1', 'PGM TESTE - T01 EP01 - BL 1'),
      bl('B2', 'PGM TESTE - T01 EP01 - BL 2'),
    ], regras, {}, [], catalogo);
    const c = codes(roteiro);
    expect(c.filter((x) => x === '85283')).toHaveLength(1);
    expect(c.indexOf('85283')).toBeLessThan(c.indexOf('B1'));
    expect(c.slice(c.indexOf('B1'))).not.toContain('85283');
  });

  it('funciona com "BL 1" vs "BL 01" e observação após o bloco', () => {
    const roteiro = buildRoteiroFromPrograms([
      bl('B2', 'PGM TESTE - T01 EP01 - BL 2'),
      bl('B1', 'PGM TESTE - T01 EP01 - BL 01 (REPRISE)'),
    ], regras, {}, [], catalogo);
    const c = codes(roteiro);
    expect(c.indexOf('B1')).toBeLessThan(c.indexOf('B2'));
    expect(c[0]).toBe('VS-TESTE');
  });
});

// ── app.js (script clássico): mesmas regras na réplica não-modular ──
const appSrc = readFileSync(new URL('../../app.js', import.meta.url), 'utf8').replace(/\ninit\(\);\s*$/, '\n');
function loadApp() {
  const g = { addEventListener() {}, removeEventListener() {} };
  g.window = g;
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const document = { querySelectorAll: () => [], getElementById: () => null };
  const factory = new Function('window', 'globalThis', 'localStorage', 'document', 'confirm',
    `${appSrc}\nreturn { getBlockNumber, sortBlocks, baseProgramTitle, buildRoteiroFromPrograms,
      __test_setVh: (seguir, assist) => { VH_SEGUIR_MAP.length = 0; VH_SEGUIR_MAP.push(seguir);
        VH_ASSISTINDO_MAP.length = 0; VH_ASSISTINDO_MAP.push(assist); },
      __test_setRegras: (v) => { Object.assign(REGRAS, v); },
      __test_setState: (v) => { Object.assign(state, v); } };`);
  return factory.call(g, g.window, g, ls, document, () => false);
}

describe('app.js — réplica não-modular', () => {
  const app = loadApp();

  it('getBlockNumber / baseProgramTitle iguais aos do módulo', () => {
    ['PGM TESTE - T01 EP01 - BL 01', 'PGM TESTE - BL 1', 'PGM TESTE - BL 02 (REPRISE)', 'PGM TESTE'].forEach((d) => {
      expect(app.getBlockNumber(d)).toBe(getBlockNumber(d));
      expect(app.baseProgramTitle(d)).toBe(baseProgramTitle(d));
    });
    expect(app.baseProgramTitle('PGM TESTE - BL 01 (REPRISE)')).toBe('TESTE');
  });

  it('buildRoteiroFromPrograms ordena BL 01 antes de BL 02 e mantém as vinhetas', () => {
    app.__test_setVh(VH_SEGUIR, VH_ASSIST);
    app.__test_setRegras({
      vhSeguirAtivo: true, vhAssistindoAtivo: true,
      vhClassificacao: { ativo: true },
      vhAssinaturaInfantil: { ativo: false }, vhAssinaturaJovem: { ativo: false }, vhAssinaturaAdulto: { ativo: false },
    });
    app.__test_setState({ programas: [], pecas: [] });
    const roteiro = app.buildRoteiroFromPrograms([
      bl('B2', 'PGM TESTE - T01 EP01 - BL 02'),
      bl('B1', 'PGM TESTE - T01 EP01 - BL 01'),
    ]).filter((i) => !i._gap);
    expect(codes(roteiro)).toEqual(['VS-TESTE', '85283', 'B1', 'VA-TESTE', '__BREAK__', '__BREAK__', 'VA-TESTE', 'B2']);
  });

  it('BL 2 (sem zero) também não recebe classificação', () => {
    app.__test_setVh(VH_SEGUIR, VH_ASSIST);
    app.__test_setState({ programas: [], pecas: [] });
    const c = codes(app.buildRoteiroFromPrograms([
      bl('B2', 'PGM TESTE - T01 EP01 - BL 2'),
      bl('B1', 'PGM TESTE - T01 EP01 - BL 1'),
    ]).filter((i) => !i._gap));
    expect(c.filter((x) => x === '85283')).toHaveLength(1);
    expect(c.indexOf('85283')).toBeLessThan(c.indexOf('B1'));
  });
});
