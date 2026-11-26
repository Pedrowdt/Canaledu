import { describe, it, expect } from 'vitest';
import GradeRecorrenciaCore from '../../src/core/gradeRecorrenciaCore.js';

describe('Filas de Episódios a partir do Acervo e Geração Semanal', () => {
  it('extrai episódios do acervo ordenados com temporada, número, código e tempo', () => {
    const acervo = [
      { code: 'EDU_02', descricao: 'ADOLESCENTES E O MUNDO DIGITAL T01 EP02 - REDES SOCIAIS', tempo: '00:26:00' },
      { code: 'EDU_01', descricao: 'ADOLESCENTES E O MUNDO DIGITAL T01 EP01 - SAUDE MENTAL', tempo: '00:26:00' },
      { code: 'EDU_03', descricao: 'ADOLESCENTES E O MUNDO DIGITAL T01 EP03 - FUTURO', tempo: '00:25:30' },
      { code: 'OUTRO_01', descricao: 'OUTRO PROGRAMA EP01', tempo: '00:15:00' }
    ];

    const programa = { title: 'ADOLESCENTES E O MUNDO DIGITAL', code: 'EDU_01' };
    const episodios = GradeRecorrenciaCore.extrairEpisodiosDoAcervo(programa, acervo);

    expect(episodios.length).toBe(3);
    expect(episodios[0].codigo).toBe('EDU_01');
    expect(episodios[0].episodioNumero).toBe(1);
    expect(episodios[0].ordem).toBe(1);
    expect(episodios[1].codigo).toBe('EDU_02');
    expect(episodios[1].episodioNumero).toBe(2);
    expect(episodios[2].codigo).toBe('EDU_03');
    expect(episodios[2].duracao).toBe('00:25:30');
  });

  it('gera nova semana a partir da anterior avançando inéditos e espelhando reprises', () => {
    const acervo = [
      { code: 'EDU_01', descricao: 'DOC EDUCATIVO T01 EP01', tempo: '00:26:00' },
      { code: 'EDU_02', descricao: 'DOC EDUCATIVO T01 EP02', tempo: '00:26:00' },
      { code: 'EDU_03', descricao: 'DOC EDUCATIVO T01 EP03', tempo: '00:26:00' }
    ];
    const fila = GradeRecorrenciaCore.extrairEpisodiosDoAcervo({ title: 'DOC EDUCATIVO', code: 'EDU_01' }, acervo);

    const gradeSemana1 = {
      1: [
        { id: 's1', time: '10:00', tipoExibicao: 'inedito', program: { code: 'EDU_01', title: 'DOC EDUCATIVO' } },
        { id: 's2', time: '12:00', tipoExibicao: 'fixo', isAoVivo: true, program: { code: 'AOVIVO_01', title: 'JORNAL AO VIVO' } }
      ],
      3: [
        { id: 's3', time: '16:00', tipoExibicao: 'reprise', mestreSlotId: 's1', program: { code: 'EDU_01', title: 'DOC EDUCATIVO' } }
      ]
    };

    // Gera Semana 2
    const semana2 = GradeRecorrenciaCore.gerarGradeSemanaComBaseAnterior({
      gradeSemanaAnterior: gradeSemana1,
      episodeQueues: { 'EDU_01': fila },
      cursoresIniciais: { 'EDU_01': 0 }
    });

    expect(semana2.resumo.totalSlots).toBe(3);
    expect(semana2.resumo.ineditosAvancados).toBe(1);
    expect(semana2.resumo.reprisesVinculadas).toBe(1);

    const segSemana2 = semana2.gradeNovaPorDia[1];
    expect(segSemana2[0].episodio.codigo).toBe('EDU_01');
    expect(segSemana2[0].episodio.titulo).toContain('EP01');

    // Ao vivo preserva flag e horário fixo
    expect(segSemana2[1].isAoVivo).toBe(true);
    expect(segSemana2[1].horarioFixo).toBe('12:00');

    // Reprise de quarta espelha episódio inédito
    const quaSemana2 = semana2.gradeNovaPorDia[3];
    expect(quaSemana2[0].episodio.codigo).toBe('EDU_01');
    expect(quaSemana2[0].episodio.isReprise).toBe(true);

    // Gera Semana 3 a partir da Semana 2 (cursor deve avançar para EP02)
    const semana3 = GradeRecorrenciaCore.gerarGradeSemanaComBaseAnterior({
      gradeSemanaAnterior: semana2.gradeNovaPorDia,
      episodeQueues: { 'EDU_01': fila },
      cursoresIniciais: semana2.cursoresAtualizados
    });

    expect(semana3.gradeNovaPorDia[1][0].episodio.codigo).toBe('EDU_02');
    expect(semana3.gradeNovaPorDia[1][0].episodio.titulo).toContain('EP02');
    expect(semana3.gradeNovaPorDia[3][0].episodio.codigo).toBe('EDU_02');
  });
});
