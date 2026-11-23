import { describe, it, expect, vi } from 'vitest';
import * as GradeEditorCore from '../../src/core/gradeEditorCore.js';
import fs from 'fs';
import path from 'path';

describe('Exportação Oficial PDF Semanal da Grade (Etapa 3.3)', () => {
  const root = path.resolve('.');
  const html = fs.readFileSync(path.join(root, 'grade-editor.html'), 'utf-8');
  const js = fs.readFileSync(path.join(root, 'grade-editor.js'), 'utf-8');

  describe('Motor de Montagem da Tabela Semanal (buildWeeklyTable com metadados)', () => {
    it('mantém compatibilidade com o formato compacto padrão quando incluirMetadados não é solicitado', () => {
      const day1 = GradeEditorCore.generateBaseSlots(20, 30);
      day1[0].program = { title: 'Caminhos da Reportagem', duration: '00:30:00' };
      day1[0].tipoExibicao = 'inedito';
      const blocksByDay = { 0: [], 1: day1, 2: [], 3: [], 4: [], 5: [], 6: [] };

      const table = GradeEditorCore.buildWeeklyTable(blocksByDay);
      expect(table.headers).toContain('Horário');
      expect(table.headers).toContain('Segunda');
      const row20 = table.rows.find(r => r[0] === '20:00');
      expect(row20[1]).toBe('Caminhos da Reportagem (00:30)');
      expect(row20[1]).not.toContain('[INÉDITO]');
    });

    it('enriquece células com tags [INÉDITO], episódios e faixa quando incluirMetadados=true', () => {
      const day1 = GradeEditorCore.generateBaseSlots(20, 30);
      day1[0].program = { title: 'Palaloos', duration: '00:30:00' };
      day1[0].tipoExibicao = 'inedito';
      day1[0].faixaOcupada = 'TV Brasil Animada';
      day1[0].episodio = {
        titulo: 'A Grande Corrida',
        temporada: 2,
        episodioNumero: 4,
        codigo: 'PAL_T02EP04'
      };

      const blocksByDay = { 0: [], 1: day1, 2: [], 3: [], 4: [], 5: [], 6: [] };
      const table = GradeEditorCore.buildWeeklyTable(blocksByDay, { incluirMetadados: true });

      const row20 = table.rows.find(r => r[0] === '20:00');
      const cellText = row20[1];
      expect(cellText).toContain('Palaloos (00:30)');
      expect(cellText).toContain('[INÉDITO]');
      expect(cellText).toContain('🎪 TV Brasil Animada');
      expect(cellText).toContain('📺 T02E04: A Grande Corrida');
    });

    it('identifica reprises com o dia e horário de origem na célula formatada', () => {
      const day3 = GradeEditorCore.generateBaseSlots(20, 30);
      day3[0].program = { title: 'Palaloos', duration: '00:30:00' };
      day3[0].tipoExibicao = 'reprise';
      day3[0].origemReprise = { diaSemana: 1, horario: '20:00:00' };
      day3[0].episodio = {
        titulo: 'A Grande Corrida',
        codigo: 'PAL_T02EP04'
      };

      const blocksByDay = { 0: [], 1: [], 2: [], 3: day3, 4: [], 5: [], 6: [] };
      const table = GradeEditorCore.buildWeeklyTable(blocksByDay, { incluirMetadados: true });

      const row20 = table.rows.find(r => r[0] === '20:00');
      const cellText = row20[3];
      expect(cellText).toContain('Palaloos (00:30)');
      expect(cellText).toContain('[REP Seg 20:00]');
      expect(cellText).toContain('📺 PAL_T02EP04: A Grande Corrida');
    });

    it('resgata metadados de recurrenceState quando não injetados diretamente no bloco', () => {
      const day5 = GradeEditorCore.generateBaseSlots(20, 30);
      day5[0].duration = '01:00:00'; day5[0].durationSec = 3600; day5[0].endTime = '21:00:00'; day5[0].program = { title: 'Sem Censura', duration: '01:00:00' };

      const recurrenceState = {
        slots: {
          '5_0': {
            tipoExibicao: 'inedito',
            faixaNome: 'Jornalismo & Debate',
            episodio: { titulo: 'Debate Especial 2026' }
          }
        }
      };

      const blocksByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: day5, 6: [] };
      const table = GradeEditorCore.buildWeeklyTable(blocksByDay, {
        incluirMetadados: true,
        recurrenceState
      });

      const row20 = table.rows.find(r => r[0] === '20:00');
      const cellText = row20[5];
      expect(cellText).toContain('Sem Censura (01:00)');
      expect(cellText).toContain('[INÉDITO]');
      expect(cellText).toContain('🎪 Jornalismo & Debate');
      expect(cellText).toContain('📺 Debate Especial 2026');
    });
  });

  describe('Cálculo de Resumo Executivo da Semana (calcularResumoExecutivoGrade)', () => {
    it('consolida horas, contagem de inéditos, reprises vinculadas e faixas', () => {
      const day1 = GradeEditorCore.generateBaseSlots(20, 30); // 20:00
      day1[0].program = { title: 'Prog A', duration: '00:30:00', durationSec: 1800 };
      day1[0].tipoExibicao = 'inedito';
      day1[0].episodio = { titulo: 'Ep 1' };
      day1[0].faixaOcupada = 'Faixa Manhã';

      const day3 = GradeEditorCore.generateBaseSlots(20, 30);
      day3[0].program = { title: 'Prog A', duration: '00:30:00', durationSec: 1800 };
      day3[0].tipoExibicao = 'reprise';
      day3[0].origemReprise = { diaSemana: 1, horario: '20:00:00' };

      const day5 = GradeEditorCore.generateBaseSlots(20, 30);
      day5[0].durationSec = 3600; day5[0].duration = '01:00:00'; day5[0].program = { title: 'Jornal', duration: '01:00:00' };
      day5[0].tipoExibicao = 'fixo';

      const blocksByDay = { 0: [], 1: [day1[0]], 2: [], 3: [day3[0]], 4: [], 5: [day5[0]], 6: [] };
      const resumo = GradeEditorCore.calcularResumoExecutivoGrade(blocksByDay);

      expect(resumo.totalSlots).toBe(3);
      expect(resumo.totalIneditos).toBe(1);
      expect(resumo.totalReprises).toBe(1);
      expect(resumo.reprisesVinculadas).toBe(1);
      expect(resumo.totalFixos).toBe(1);
      expect(resumo.horasProgramadas).toBe(2.0); // 30m + 30m + 60m = 2.0h
      expect(resumo.faixasIdentificadas).toContain('Faixa Manhã');
      expect(resumo.taxaVinculoReprises).toBe(100);
      expect(resumo.totalComEpisodio).toBe(1);
    });
  });

  describe('Estrutura e Configuração da Exportação PDF no grade-editor.js', () => {
    it('possui o botão de exportar PDF e estilos de impressão landscape no HTML', () => {
      expect(html).toContain('exportarGradePDF()');
      expect(html).toContain('size: A4 landscape');
      expect(html).toContain('@media print');
    });

    it('aplica branding dinâmico da emissora ativa no cabeçalho do PDF', () => {
      expect(js).toContain('function hexToRgb(hex)');
      expect(js).toContain("ativa?.cor_primaria || '#185FA5'");
      expect(js).toContain('doc.setFillColor(...corPrimariaRgb)');
      expect(js).toContain('GRADE SEMANAL DE PROGRAMAÇÃO');
    });

    it('inclui barra de legenda executiva com inéditos, reprises e faixas', () => {
      expect(js).toContain('LEGENDA:');
      expect(js).toContain('[INÉDITO] Estreia');
      expect(js).toContain('[REP] Reprise vinculada');
      expect(js).toContain('doc.autoTable');
      expect(js).toContain("showHead: 'everyPage'");
    });

    it('estiliza células condicionalmente com verde para inédito e roxo para reprise', () => {
      expect(js).toContain("text.includes('[INÉDITO]')");
      expect(js).toContain('data.cell.styles.fillColor = [240, 253, 244]');
      expect(js).toContain("text.includes('[REP')");
      expect(js).toContain('data.cell.styles.fillColor = [245, 243, 255]');
    });

    it('gera numeração de páginas executiva no rodapé em todas as laudas', () => {
      expect(js).toContain('const totalPages = doc.internal.getNumberOfPages()');
      expect(js).toContain('doc.setPage(i)');
      expect(js).toContain('Sistema RoteiroHub White-Label');
      expect(js).toContain("Página ${i} de ${totalPages}");
    });
  });
});
