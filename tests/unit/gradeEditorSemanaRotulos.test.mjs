import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
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

  it('navegação por data arbitrária (input de calendário) alinha corretamente para a segunda-feira correspondente', () => {
    // Usuário seleciona uma quarta-feira (25/11/2026) no calendário
    const resumo = SemanaUtils.obterResumoSemana('2026-11-25');
    expect(resumo.dataInicio).toBe('2026-11-23'); // Segunda-feira
    expect(resumo.dataFim).toBe('2026-11-29'); // Domingo
    expect(resumo.periodoFormatado).toBe('23/11 a 29/11/2026');
  });

  it('grade-editor.html possui o seletor de calendário e removeu a barra de legenda específica', () => {
    const html = fs.readFileSync(path.resolve('grade-editor.html'), 'utf-8');
    expect(html).toContain('id="input-semana-calendario"');
    expect(html).toContain('selecionarSemanaPorData');
    expect(html).toContain('navegarSemana');
    // A barra fixa de legenda foi removida para limpar a interface
    expect(html).not.toContain('id="grade-legend-bar"');
  });
});
