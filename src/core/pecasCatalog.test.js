import { describe, it, expect } from 'vitest';
import {
  isPecaVigente, isPecaDoDia, isPecaNaJanela, selectPecasDoDia,
  buildVhMaps, pecasFixasFromCadastro, catalogFromCadastro, somaTempo,
} from './pecasCatalog.js';

const ref = new Date('2026-08-05T12:00:00');

describe('vigência e janelas do cadastro', () => {
  it('sem validade a peça é sempre vigente', () => {
    expect(isPecaVigente({ code: 'A' }, ref)).toBe(true);
  });
  it('validade passada invalida a peça', () => {
    expect(isPecaVigente({ validade: '2026-08-04' }, ref)).toBe(false);
    expect(isPecaVigente({ validade: '2026-08-05' }, ref)).toBe(true);
  });
  it('dias vazios valem para todos os dias', () => {
    expect(isPecaDoDia({ dias: [] }, 3)).toBe(true);
    expect(isPecaDoDia({ dias: ['qua'] }, 3)).toBe(true);
    expect(isPecaDoDia({ dias: ['qua'] }, 4)).toBe(false);
  });
  it('janela que atravessa a madrugada', () => {
    const p = { hIni: '22:00', hFim: '02:00' };
    expect(isPecaNaJanela(p, 23 * 3600)).toBe(true);
    expect(isPecaNaJanela(p, 1 * 3600)).toBe(true);
    expect(isPecaNaJanela(p, 12 * 3600)).toBe(false);
  });
  it('selectPecasDoDia combina validade, dia, janela e categoria', () => {
    const pecas = [
      { code: '1', categoria: 'RCOM', dias: ['qua'], hIni: '10:00', hFim: '14:00' },
      { code: '2', categoria: 'RCOM', dias: ['qui'] },
      { code: '3', categoria: 'RPOL', validade: '2026-01-01' },
      { code: '4', categoria: 'RCOM', ativo: false },
    ];
    const out = selectPecasDoDia(pecas, { dow: 3, sec: 12 * 3600, categoria: 'RCOM', ref });
    expect(out.map((p) => p.code)).toEqual(['1']);
  });
});

describe('mapas de vinhetas derivados do cadastro', () => {
  const pecas = [
    { code: '85283', descricao: 'VH CLASSIFICAÇAO INDICATIVA LIVRE', tempo: '00:00:06', type: 'EVNH' },
    { code: '90001', descricao: 'VH A SEGUIR SCIENTIA', tempo: '00:00:05', type: 'EVNH' },
    { code: '90002', descricao: 'VH VC ESTA ASSISTINDO SCIENTIA', tempo: '00:00:05', type: 'EVNH' },
    { code: '90003', descricao: 'VH DAQUI A POUCO SCIENTIA', tempo: '00:00:05', type: 'EVNH' },
    { code: '70001', descricao: 'CHAMADA QUALQUER', tempo: '00:00:30', type: 'ECHE' },
  ];
  it('classifica cada VH pelo prefixo cadastrado', () => {
    const maps = buildVhMaps(pecas, ref);
    expect(maps.classificacao.code).toBe('85283');
    expect(maps.seguir[0].keywords).toEqual(['SCIENTIA']);
    expect(maps.assistindo).toHaveLength(1);
    expect(maps.daquiAPouco).toHaveLength(1);
  });
  it('peças fixas vêm ordenadas', () => {
    const fixas = pecasFixasFromCadastro([
      { code: 'B', descricao: 'b', posicao: 'inicio', ordem: 2 },
      { code: 'A', descricao: 'a', posicao: 'inicio', ordem: 1 },
      { code: 'C', descricao: 'c' },
    ], ref);
    expect(fixas.map((f) => f.code)).toEqual(['A', 'B']);
  });
  it('catalogFromCadastro monta a entrada do builder', () => {
    const cat = catalogFromCadastro({ pecas, programas: [{ code: 'P1', descricao: 'SCIENTIA' }], ref });
    expect(cat.vhSeguirMap).toHaveLength(1);
    expect(cat.programas).toHaveLength(1);
  });
  it('somaTempo soma durações', () => {
    expect(somaTempo([{ tempo: '00:00:30' }, { tempo: '00:01:00' }])).toBe(90);
  });
});
