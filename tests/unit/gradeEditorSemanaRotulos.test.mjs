import { describe, it, expect } from 'vitest';
import SemanaUtils from '../../src/core/semanaUtils.js';

describe('Rotulação de Semanas e Datas no Editor de Grade', () => {
  it('gera rótulos completos com datas para os 7 dias da semana', () => {
    const dataRef = new Date('2026-11-13T12:00:00Z');
    const resumo = SemanaUtils.obterResumoSemana(dataRef, 0, 45); // EBC Semana 45

    expect(resumo.numeroSemana).toBe(45);
    expect(resumo.rotuloCompleto).toBe('Semana 45 (09/11 a 15/11/2026)');

    const diasNomes = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const rotulosComData = diasNomes.map((nome, idx) => {
      const dataStr = SemanaUtils.formatarDiaMes(resumo.datas[idx]);
      return `${nome} (${dataStr})`;
    });

    expect(rotulosComData).toEqual([
      'Segunda (09/11)',
      'Terça (10/11)',
      'Quarta (11/11)',
      'Quinta (12/11)',
      'Sexta (13/11)',
      'Sábado (14/11)',
      'Domingo (15/11)'
    ]);
  });
});
