import { describe, it, expect } from 'vitest';
import { buildRoteiroFromPrograms } from '../../src/core/roteiroBuilder.js';
import { catalogFromCadastro } from '../../src/core/pecasCatalog.js';

describe('RoteiroBuilder - Transições e Vinhetas Multi-Emissora (Fase 2)', () => {
  it('Canal Gov: insere vh_vai_comecar no início, vh_voltamos_ja e vh_voltamos_com entre blocos, e vh_realizacao no fim', () => {
    const programs = [
      { code: 'G11883', descricao: 'GPRO BRASIL EM DIA - T01 EP01 - BL 01', tempo: '00:15:00', type: 'GPRO' },
      { code: 'G11883_2', descricao: 'GPRO BRASIL EM DIA - T01 EP01 - BL 02', tempo: '00:15:00', type: 'GPRO' },
    ];

    const pecasGov = [
      { code: 'GV01', type: 'GVNH', descricao: 'VH VAI COMECAR BRASIL EM DIA', funcao: 'vh_vai_comecar', programaRelacionado: 'BRASIL EM DIA', tempo: '00:00:05', ativo: true },
      { code: 'GV02', type: 'GVNH', descricao: 'VH VOLTAMOS JA BRASIL EM DIA', funcao: 'vh_voltamos_ja', programaRelacionado: 'BRASIL EM DIA', tempo: '00:00:05', ativo: true },
      { code: 'GV03', type: 'GVNH', descricao: 'VH VOLTAMOS COM BRASIL EM DIA', funcao: 'vh_voltamos_com', programaRelacionado: 'BRASIL EM DIA', tempo: '00:00:05', ativo: true },
      { code: 'GV04', type: 'GVNH', descricao: 'VH REALIZACAO CANAL GOV', funcao: 'vh_realizacao', tempo: '00:00:05', ativo: true }, // genérica
      { code: 'GV05', type: 'GVNH', descricao: 'VH CLASSIFICACAO LIVRE GOV', funcao: 'classificacao_indicativa', tempo: '00:00:06', ativo: true },
    ];

    const catalogo = catalogFromCadastro({ pecas: pecasGov, programas: programs });
    const roteiro = buildRoteiroFromPrograms(programs, {}, {}, [], catalogo, 21600);

    const codes = roteiro.map(r => r.code);

    // 1. Início: vh_vai_comecar (GV01) e classificação do catálogo (GV05)
    expect(codes[0]).toBe('GV01');
    expect(codes[1]).toBe('GV05');
    expect(codes[2]).toBe('G11883'); // Bloco 1

    // 2. Entre blocos do mesmo episódio: GV02 (voltamos já) -> breaks -> GV03 (voltamos com)
    expect(codes[3]).toBe('GV02');
    expect(codes[4]).toBe('__BREAK__');
    expect(codes[5]).toBe('__BREAK__');
    expect(codes[6]).toBe('GV03');
    expect(codes[7]).toBe('G11883_2'); // Bloco 2

    // 3. Fim do programa: GV04 (realização genérica)
    expect(codes).toContain('GV04');
  });

  it('TV Brasil Internacional: insere vh_voltamos_ja na saída do intervalo e vh_voltamos_com no retorno', () => {
    const programs = [
      { code: 'IP01', descricao: 'IPRO SEM CENSURA - BL 01', tempo: '00:20:00', type: 'IPRO' },
      { code: 'IP02', descricao: 'IPRO SEM CENSURA - BL 02', tempo: '00:20:00', type: 'IPRO' },
    ];

    const pecasInter = [
      { code: 'i3010', type: 'VH', descricao: 'VH VOLTAMOS JA SEM CENSURA', funcao: 'vh_voltamos_ja', programaRelacionado: 'SEM CENSURA', tempo: '00:00:05', ativo: true },
      { code: 'i3011', type: 'VH', descricao: 'VH VOLTAMOS COM SEM CENSURA', funcao: 'vh_voltamos_com', programaRelacionado: 'SEM CENSURA', tempo: '00:00:05', ativo: true },
    ];

    const catalogo = catalogFromCadastro({ pecas: pecasInter, programas: programs });
    const roteiro = buildRoteiroFromPrograms(programs, {}, {}, [], catalogo, 21600);

    const codes = roteiro.map(r => r.code);
    expect(codes).toContain('i3010');
    expect(codes).toContain('i3011');
    const idxJa = codes.indexOf('i3010');
    const idxCom = codes.indexOf('i3011');
    expect(idxJa).toBeLessThan(idxCom);
  });

  it('Canal Educação (retrocompatibilidade): sem voltamos_ja/com, mantém vhAssistindo antes e depois dos breaks', () => {
    const programs = [
      { code: 'P01', descricao: 'PGM PALALOOS - BL 01', tempo: '00:15:00', type: 'RPRO' },
      { code: 'P02', descricao: 'PGM PALALOOS - BL 02', tempo: '00:15:00', type: 'RPRO' },
    ];

    const pecasEdu = [
      { code: '90001', type: 'EVNH', descricao: 'VH VC ESTA ASSISTINDO PALALOOS', tempo: '00:00:05', ativo: true },
    ];

    const catalogo = catalogFromCadastro({ pecas: pecasEdu, programas: programs });
    const roteiro = buildRoteiroFromPrograms(programs, {}, {}, [], catalogo, 21600);

    const codes = roteiro.map(r => r.code);
    const ocorrenciasAss = codes.filter(c => c === '90001');
    // Deve aparecer 2 vezes (antes do break e depois do break)
    expect(ocorrenciasAss).toHaveLength(2);
  });
});
