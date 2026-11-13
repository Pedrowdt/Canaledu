import { describe, it, expect } from 'vitest';
import SemanaUtils from '../../src/core/semanaUtils.js';

describe('SemanaUtils — Cálculo de Semanas e Períodos', () => {
  it('calcula semana ISO corretamente para datas de Novembro de 2026', () => {
    // 02/11/2026 = Segunda-feira da Semana 45 ISO
    const iso45 = SemanaUtils.calcularSemanaISO(new Date(2026, 10, 2));
    expect(iso45.semana).toBe(45);
    expect(iso45.ano).toBe(2026);

    // 09/11/2026 = Segunda-feira da Semana 46 ISO
    const iso46 = SemanaUtils.calcularSemanaISO(new Date(2026, 10, 9));
    expect(iso46.semana).toBe(46);
    expect(iso46.ano).toBe(2026);

    // 13/11/2026 = Sexta-feira da Semana 46 ISO
    const iso13 = SemanaUtils.calcularSemanaISO(new Date(2026, 10, 13));
    expect(iso13.semana).toBe(46);
  });

  it('obterSegundaFeira retorna segunda-feira mesmo se passar domingo ou sábado', () => {
    // Domingo 15/11/2026 pertence à semana que iniciou em Seg 09/11/2026
    const seg = SemanaUtils.obterSegundaFeira(new Date(2026, 10, 15));
    expect(SemanaUtils.formatarDataISO(seg)).toBe('2026-11-09');

    // Sábado 14/11/2026
    const seg2 = SemanaUtils.obterSegundaFeira(new Date(2026, 10, 14));
    expect(SemanaUtils.formatarDataISO(seg2)).toBe('2026-11-09');
  });

  it('obterDatasDaSemana retorna 7 dias consecutivos de Segunda a Domingo', () => {
    const datas = SemanaUtils.obterDatasDaSemana(new Date(2026, 10, 13), 0);
    expect(datas).toHaveLength(7);
    expect(SemanaUtils.formatarDataISO(datas[0])).toBe('2026-11-09'); // Seg
    expect(SemanaUtils.formatarDataISO(datas[6])).toBe('2026-11-15'); // Dom
  });

  it('obterResumoSemana formata rótulos padrão e aceita override manual da emissora', () => {
    const dataRef = new Date(2026, 10, 13); // 13/11/2026

    // Sem override: usa ISO (Semana 46)
    const resumoISO = SemanaUtils.obterResumoSemana(dataRef, 0);
    expect(resumoISO.numeroSemana).toBe(46);
    expect(resumoISO.rotuloCurto).toBe('Semana 46');
    expect(resumoISO.periodoFormatado).toBe('09/11 a 15/11/2026');
    expect(resumoISO.rotuloCompleto).toBe('Semana 46 (09/11 a 15/11/2026)');

    // Com override manual (ex.: EBC chamando a semana de 09 a 15/11 de Semana 45)
    const resumoManual = SemanaUtils.obterResumoSemana(dataRef, 0, 45);
    expect(resumoManual.numeroSemana).toBe(45);
    expect(resumoManual.numeroSemanaISO).toBe(46);
    expect(resumoManual.rotuloCurto).toBe('Semana 45');
    expect(resumoManual.rotuloCompleto).toBe('Semana 45 (09/11 a 15/11/2026)');
  });

  it('extrairNumeroSemanaDoTexto detecta semana em nomes de arquivos e títulos', () => {
    expect(SemanaUtils.extrairNumeroSemanaDoTexto('GRADE_TV_BRASIL_SEMANA_45_1.xlsx')).toBe(45);
    expect(SemanaUtils.extrairNumeroSemanaDoTexto('ALTERAÇÃO 1 - SEMANA 44')).toBe(44);
    expect(SemanaUtils.extrairNumeroSemanaDoTexto('Semana 46 (16/11 a 22/11)')).toBe(46);
    expect(SemanaUtils.extrairNumeroSemanaDoTexto('Arquivo_Sem_Semana.xlsx')).toBeNull();
  });
});
