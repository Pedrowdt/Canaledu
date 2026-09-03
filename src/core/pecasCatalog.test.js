import { describe, it, expect } from 'vitest';
import {
  isPecaVigente, isPecaDoDia, isPecaNaJanela, selectPecasDoDia,
  buildVhMaps, pecasFixasFromCadastro, catalogFromCadastro, somaTempo,
  matchVhDaquiForNext, baseProgramTitle, getEpisodeId, parseEpisodioInfo,
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

describe('matchVhDaquiForNext — VH "DAQUI A POUCO" do programa certo', () => {
  it('ignora a pontuação do título ao extrair keywords (vírgula não pode quebrar o match)', () => {
    const vhs = [
      { descricao: 'VH DAQUI A POUCO PORTUGUÊS DAQUI, PORTUGUÊS DE LÁ' },
      { descricao: 'VH DAQUI A POUCO OUTRO PROGRAMA' },
    ];
    const match = matchVhDaquiForNext('PORTUGUÊS DAQUI, PORTUGUÊS DE LÁ', vhs);
    expect(match).not.toBeNull();
    expect(match.descricao).toContain('PORTUGUÊS DAQUI');
  });

  it('escolhe a VH certa quando dois programas compartilham uma palavra comum', () => {
    const vhs = [
      { descricao: 'VH DAQUI A POUCO EDUCAÇÃO FINANCEIRA' },
      { descricao: 'VH DAQUI A POUCO EDUCAÇÃO INFANTIL BRASIL' },
    ];
    const match = matchVhDaquiForNext('EDUCAÇÃO INFANTIL BRASIL', vhs);
    expect(match.descricao).toBe('VH DAQUI A POUCO EDUCAÇÃO INFANTIL BRASIL');
  });

  it('não insere nada quando nenhuma VH cadastrada é específica o bastante', () => {
    const vhs = [
      { descricao: 'VH DAQUI A POUCO EDUCAÇÃO FINANCEIRA' },
      { descricao: 'VH DAQUI A POUCO ESCOLA DE TODOS' },
    ];
    expect(matchVhDaquiForNext('PALALOOS', vhs)).toBeNull();
  });

  it('sem VH cadastrada, não insere nada (sem fallback genérico)', () => {
    expect(matchVhDaquiForNext('SCIENTIA', [])).toBeNull();
  });
});

describe('baseProgramTitle/getEpisodeId/parseEpisodioInfo — identidade estruturada (MVP-CADASTRO.md, Fase 1)', () => {
  it('baseProgramTitle remove prefixo PGM, temporada/episódio e bloco', () => {
    expect(baseProgramTitle('PGM PALALOOS - T01 EP03 - BL02')).toBe('PALALOOS');
  });

  it('baseProgramTitle lida com a variante sem hífen antes de T/EP', () => {
    expect(baseProgramTitle('PGM SCIENTIA T01 EP16')).toBe('SCIENTIA');
  });

  it('baseProgramTitle remove parênteses e sufixo de minutagem da grade', () => {
    expect(baseProgramTitle('PALALOOS (reprise quarta 22h)')).toBe('PALALOOS');
    expect(baseProgramTitle("PALALOOS 10'")).toBe('PALALOOS');
  });

  it('baseProgramTitle é estável para string vazia/undefined', () => {
    expect(baseProgramTitle('')).toBe('');
    expect(baseProgramTitle(undefined)).toBe('');
  });

  it('getEpisodeId extrai o identificador combinado', () => {
    expect(getEpisodeId('PGM PALALOOS - T01 EP03 - BL02')).toBe('T01EP03');
    expect(getEpisodeId('SEM EPISODIO')).toBe('');
  });

  it('parseEpisodioInfo separa temporada/episódio/bloco em números', () => {
    expect(parseEpisodioInfo('PGM PALALOOS - T01 EP03 - BL02')).toEqual({ temporada: 1, episodio: 3, bloco: 2 });
  });

  it('parseEpisodioInfo devolve null (não 0) para partes ausentes', () => {
    expect(parseEpisodioInfo('PGM SEM PADRAO NENHUM')).toEqual({ temporada: null, episodio: null, bloco: null });
    expect(parseEpisodioInfo('PGM PALALOOS - T01 EP03')).toEqual({ temporada: 1, episodio: 3, bloco: null });
  });
});
