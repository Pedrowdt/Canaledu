import { describe, it, expect, beforeEach } from 'vitest';
import SemanaUtils from '../../src/core/semanaUtils.js';

describe('Sincronização entre Semana da Grade e Semana do Roteiro', () => {
  beforeEach(() => {
    // Limpa estado simulado
  });

  it('permite alinhar numeração da semana entre Roteiro e Grade (ex: Semana 45 na EBC vs 46 no ISO)', () => {
    const dataRef = new Date('2026-11-13T12:00:00Z'); // Sexta-feira

    // Sem override: o ISO padrão é 46
    const resumoPadrao = SemanaUtils.obterResumoSemana(dataRef, 0);
    expect(resumoPadrao.numeroSemana).toBe(46);
    expect(resumoPadrao.dataInicio).toBe('2026-11-09');
    expect(resumoPadrao.dataFim).toBe('2026-11-15');

    // Com override para a numeração EBC (Semana 45 para 09 a 15/11)
    const resumoEBC = SemanaUtils.obterResumoSemana(dataRef, 0, 45);
    expect(resumoEBC.numeroSemana).toBe(45);
    expect(resumoEBC.rotuloCompleto).toBe('Semana 45 (09/11 a 15/11/2026)');
    expect(resumoEBC.periodoFormatado).toBe('09/11 a 15/11/2026');
  });

  it('detecta número de semana a partir de presets e arquivos de importação', () => {
    const presetNome = 'Grade Oficial TV Brasil — Semana 45 Completa (24h)';
    const num = SemanaUtils.extrairNumeroSemanaDoTexto(presetNome);
    expect(num).toBe(45);

    const arquivoSemana44 = 'ALTERAÇÃO_1_GRADE_TV_BRASIL_DE_02_A_08_DE_NOVEMBRO_DE_2026_-_SEMANA_44.pdf';
    expect(SemanaUtils.extrairNumeroSemanaDoTexto(arquivoSemana44)).toBe(44);
  });

  it('gera datas diárias para exibição no cabeçalho dos dias da grade', () => {
    const dataRef = '2026-11-09'; // Segunda
    const datas = SemanaUtils.obterDatasDaSemana(dataRef, 0);

    const rotulos = datas.map(d => SemanaUtils.formatarDiaMes(d));
    expect(rotulos).toEqual([
      '09/11', // Segunda
      '10/11', // Terça
      '11/11', // Quarta
      '12/11', // Quinta
      '13/11', // Sexta
      '14/11', // Sábado
      '15/11'  // Domingo
    ]);
  });
});
