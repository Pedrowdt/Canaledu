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


  it('extrai temporada, episódio, subtítulo, reprise e MAM da planilha real do Canal Educação', () => {
    const fixturePath = path.join(__dirname, '../fixtures/grade-canal-educacao-semana-23-29-nov-2026.json');
    const rawRows = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const result = GradeImportador.parseGradeMatriz(rawRows, { versao: '23 A 29 DE NOVEMBRO' });
    const items = Object.values(result.dias).flat();
    const episodiosEstruturados = items.filter(item => item.episodioInfo?.temporada != null && item.episodioInfo?.episodioNumero != null);
    const adolescentes = items.find(item => item.program.title === 'ADOLESCENTES E O MUNDO DIGITAL');

    expect(episodiosEstruturados.length).toBeGreaterThan(100);
    expect(adolescentes.episodioInfo).toMatchObject({
      temporada: 1,
      episodioNumero: 3,
      titulo: 'CLIMA ESCOLAR E SAÚDE MENTAL'
    });
    const previa = GradeImportador.prepararPreviaImportacao(result, [
      { code: 'ADOLESCENTES01', descricao: 'PGM ADOLESCENTES E O MUNDO DIGITAL', tempo: '00:26:00' }
    ]);
    const blocoImportado = Object.values(previa.slotsPorDia).flat()
      .find(slot => slot.program?.title === 'ADOLESCENTES E O MUNDO DIGITAL');
    expect(blocoImportado.program).toMatchObject({
      code: 'ADOLESCENTES01', tempo: '00:26:00', catalogoEncontrado: true
    });
    expect(blocoImportado.episodio).toMatchObject({
      temporada: 1, episodioNumero: 3, titulo: 'CLIMA ESCOLAR E SAÚDE MENTAL'
    });
    expect(items.some(item => item.tipoExibicao === 'reprise')).toBe(true);
    expect(items.some(item => /MAM/i.test(item.origemMam || ''))).toBe(true);
  });

  it('vincula código e duração oficiais ao registro de episódio correspondente no acervo', () => {
    const grade = {
      dias: {
        1: [{
          time: '06:00:00',
          duration: '00:30:00',
          program: { title: 'ADOLESCENTES E O MUNDO DIGITAL' },
          episodioInfo: {
            titulo: 'CLIMA ESCOLAR E SAÚDE MENTAL',
            temporada: 1,
            episodioNumero: 3
          }
        }]
      }
    };
    const acervo = [
      { code: 'ADOMUN', descricao: 'ADOLESCENTES E O MUNDO DIGITAL', programaTitulo: 'ADOLESCENTES E O MUNDO DIGITAL', tempo: '00:26:00' },
      { code: 'ADOMUN_T01EP03', descricao: 'T 01 EP 03 - CLIMA ESCOLAR E SAÚDE MENTAL', programaTitulo: 'ADOLESCENTES E O MUNDO DIGITAL', temporada: 1, episodio: 3, tempo: '00:22:30' }
    ];

    const previa = GradeImportador.prepararPreviaImportacao(grade, acervo, { desmembrarFaixas: false });
    const bloco = previa.slotsPorDia[1][0];

    expect(bloco.program).toMatchObject({
      title: 'ADOLESCENTES E O MUNDO DIGITAL',
      code: 'ADOMUN_T01EP03',
      tempo: '00:22:30',
      catalogoEncontrado: true,
      temporada: 1,
      episodioNumero: 3
    });
    expect(bloco.episodio).toMatchObject({
      temporada: 1,
      episodioNumero: 3,
      codigo: 'ADOMUN_T01EP03',
      titulo: 'CLIMA ESCOLAR E SAÚDE MENTAL'
    });
    // A duração oficial fica no vínculo do programa; a duração da faixa importada não muda.
    expect(bloco.duration).toBe('00:30:00');
    expect(previa.totalNovosProgramas).toBe(0);
  });

  it('encontra o programa pela descrição quando o acervo não usa o campo title', () => {
    const grade = { dias: { 1: [{ time: '06:00:00', duration: '00:30:00', program: { title: "LUPITA NO PLANETA DE GENTE GRANDE 13'" } }] } };
    const previa = GradeImportador.prepararPreviaImportacao(grade, [
      { code: 'LUPITA01', descricao: 'PGM LUPITA NO PLANETA DE GENTE GRANDE', tempo: '00:13:00' }
    ], { desmembrarFaixas: false });
    expect(previa.slotsPorDia[1][0].program.code).toBe('LUPITA01');
    expect(previa.slotsPorDia[1][0].program.tempo).toBe('00:13:00');
    expect(previa.totalNovosProgramas).toBe(0);
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
