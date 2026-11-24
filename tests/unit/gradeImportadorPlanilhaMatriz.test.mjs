import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar módulo GradeImportador
import GradeImportador from '../../src/core/gradeImportador.js';

describe('GradeImportador — Matriz Semanal de Planilhas (Excel e CSV)', () => {
  it('deve exportar a função parseGradeMatriz', () => {
    expect(typeof GradeImportador.parseGradeMatriz).toBe('function');
  });

  it('deve parsear uma matriz semanal padrão com dias da semana e horários', () => {
    const rows = [
      ['PROGRAMAÇÃO SEMANAL DE TESTE'],
      ['HORA', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'],
      ['06:00', 'Jornal da Manhã\nT 01 EP 01', 'Jornal da Manhã\nT 01 EP 02', 'Jornal da Manhã\nT 01 EP 03', 'Jornal da Manhã\nT 01 EP 04', 'Jornal da Manhã\nT 01 EP 05', 'Agro Brasil', 'Missa'],
      ['06:30', 'Desenho Animado\nT 02 EP 01', 'Desenho Animado\nT 02 EP 02', 'Desenho Animado\nT 02 EP 03', 'Desenho Animado\nT 02 EP 04', 'Desenho Animado\nT 02 EP 05', 'Natureza', 'Infantil'],
      ['07:30', 'Documentário Brasil\n(Reprise)', 'Documentário Brasil', 'Documentário Brasil', 'Documentário Brasil', 'Documentário Brasil\n(Reprise)', 'Cinema', 'Esporte']
    ];

    const result = GradeImportador.parseGradeMatriz(rows, { versao: 'Teste Matriz', emissoraNome: 'Canal Teste' });

    expect(result).toBeDefined();
    expect(result.formato).toBe('matriz_semanal');
    expect(result.versao).toBe('Teste Matriz');
    expect(result.dias).toBeDefined();

    // Segunda-feira (dow = 1)
    const seg = result.dias[1];
    expect(seg.length).toBe(3);

    expect(seg[0].time).toBe('06:00:00');
    expect(seg[0].duration).toBe('00:30:00'); // 06:00 até 06:30
    expect(seg[0].program.title).toBe('Jornal da Manhã');
    expect(seg[0].episodio).toBe('T 01 EP 01');
    expect(seg[0].tipoExibicao).toBe('inedito');

    expect(seg[1].time).toBe('06:30:00');
    expect(seg[1].duration).toBe('01:00:00'); // 06:30 até 07:30
    expect(seg[1].program.title).toBe('Desenho Animado');
    expect(seg[1].episodio).toBe('T 02 EP 01');

    expect(seg[2].time).toBe('07:30:00');
    expect(seg[2].program.title).toBe('Documentário Brasil');
    expect(seg[2].tipoExibicao).toBe('reprise');
  });

  it('deve parsear com sucesso o arquivo real do Canal Educação (Sem_título_1.xlsx)', () => {
    const jsonPath = '/tmp/sem_titulo_rows.json';
    if (!fs.existsSync(jsonPath)) return; // Se não existir na máquina, pula

    const rawRows = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const result = GradeImportador.parseGradeMatriz(rawRows, { versao: '23 A 29 DE NOVEMBRO' });

    expect(result).toBeDefined();
    expect(result.dias).toBeDefined();

    // Todos os 7 dias devem ter atrações carregadas
    for (let dow = 0; dow < 7; dow++) {
      expect(result.dias[dow].length).toBeGreaterThan(40);
    }

    // Segunda-feira deve conter os programas do início da manhã
    const seg = result.dias[1];
    expect(seg[0].time).toBe('06:00:00');
    expect(seg[0].program.title).toBe('SEM DÚVIDA NENHUMA');
  });

  it('deve parsear com sucesso a planilha da TV Brasil (GRADE_TV_BRASIL_DE_09_A_15_DE_NOVEMBRO_DE_2026_-_SEMANA_45_1.xlsx)', () => {
    const jsonPath = '/tmp/tvbrasil_sem45_rows.json';
    if (!fs.existsSync(jsonPath)) return;

    const rawRows = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const result = GradeImportador.parseGradeMatriz(rawRows, { versao: 'SEMANA 45' });

    expect(result).toBeDefined();
    for (let dow = 0; dow < 7; dow++) {
      expect(result.dias[dow].length).toBeGreaterThan(15);
    }
  });

  it('deve permitir que parseCsvGrade detecte automaticamente o formato matriz semanal', () => {
    const matrixCsv = `HORA;SEGUNDA;TERÇA;QUARTA;QUINTA;SEXTA;SÁBADO;DOMINGO
06:00;Jornal Manhã;Jornal Manhã;Jornal Manhã;Jornal Manhã;Jornal Manhã;Agro;Missa
06:30;Desenho;Desenho;Desenho;Desenho;Desenho;Cultura;Educativo
07:00;Documentário;Documentário;Documentário;Documentário;Documentário;Filme;Show`;

    const result = GradeImportador.parseCsvGrade(matrixCsv, { versao: 'CSV Matriz' });
    expect(result).toBeDefined();
    expect(result.formato).toBe('matriz_semanal');
    expect(result.dias[1].length).toBe(3);
    expect(result.dias[1][0].program.title).toBe('Jornal Manhã');
  });

  it('deve continuar suportando CSV em lista tabular tradicional', () => {
    const tabularCsv = `dia;horario;duracao;programa;codigo;categoria;tipo
segunda;06:00;00:30;Jornalismo Manhã;JM01;Jornalismo;inedito
segunda;06:30;00:30;Infantil Animado;IA01;Infantil;inedito
terça;06:00;00:30;Jornalismo Manhã;JM01;Jornalismo;inedito`;

    const result = GradeImportador.parseCsvGrade(tabularCsv);
    expect(result).toBeDefined();
    expect(result.dias[1].length).toBe(2);
    expect(result.dias[2].length).toBe(1);
    expect(result.dias[1][0].program.title).toBe('Jornalismo Manhã');
  });

  it('deve retornar mensagem explicativa clara quando o formato não for reconhecido', () => {
    const invalidContent = `alguma;coisa;aleatoria
1;2;3
4;5;6`;

    expect(() => GradeImportador.parseCsvGrade(invalidContent)).toThrowError(
      /Formato de planilha não reconhecido\. A planilha deve estar no formato Matriz Semanal/i
    );
  });
});
