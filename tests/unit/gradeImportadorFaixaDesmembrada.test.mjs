import { describe, it, expect } from 'vitest';
import GradeImportador from '../../src/core/gradeImportador.js';

describe('GradeImportador — Desmembramento e Reagrupamento de Faixas Compostas', () => {
  const {
    GRADE_TV_BRASIL_SEMANA_45,
    SUBPROGRAMAS_TV_BRASIL_ANIMADA,
    prepararPreviaImportacao,
    desmembrarFaixaSlots,
    reagruparFaixaSlots,
  } = GradeImportador;

  it('preserva as 23 atrações listadas na referência da TV Brasil Animada', () => {
    expect(SUBPROGRAMAS_TV_BRASIL_ANIMADA).toBeDefined();
    expect(SUBPROGRAMAS_TV_BRASIL_ANIMADA.length).toBe(23);
    expect(SUBPROGRAMAS_TV_BRASIL_ANIMADA[0].titulo).toBe('ESSE E O BICHO - T 01');
    expect(SUBPROGRAMAS_TV_BRASIL_ANIMADA[21].titulo).toContain('IURI & UDI');
    expect(SUBPROGRAMAS_TV_BRASIL_ANIMADA[22].titulo).toContain('HEROINAS NEGRAS BRASILEIRAS');
  });

  it('não cria sobreposição quando as 23 atrações excedem o bloco de 5h30', () => {
    const previa = prepararPreviaImportacao(GRADE_TV_BRASIL_SEMANA_45, []);
    const slotsSegunda = previa.slotsPorDia[1];
    const bloco = slotsSegunda.find(s => s.time === '07:00:00');
    expect(bloco).toBeDefined();
    expect(bloco.program.title).toBe('TV BRASIL ANIMADA');
    expect(bloco.isFaixa).toBe(true);
    expect(previa.avisos.some(aviso => aviso.includes('23 atrações'))).toBe(true);
  });

  it('quando desmembrarFaixas: false, mantém a faixa como um único bloco de 05:30:00 quando a opção está desativada', () => {
    const previa = prepararPreviaImportacao(GRADE_TV_BRASIL_SEMANA_45, [], { desmembrarFaixas: false });
    const slotsSegunda = previa.slotsPorDia[1];

    const slotAnimada = slotsSegunda.find(s => s.time === '07:00:00');
    expect(slotAnimada).toBeDefined();
    expect(slotAnimada.duration).toBe('05:30:00');
    expect(slotAnimada.program.title).toBe('TV BRASIL ANIMADA');
    expect(slotAnimada.isFaixa).toBe(true);
  });

  it('desmembrarFaixaSlots divide um bloco composto em slots de 15 minutos com metadados corretos', () => {
    const bloco = {
      time: '08:00:00',
      duration: '01:00:00',
      durationSec: 3600,
      program: { title: 'FAIXA INFANTIL', categoria: 'Infantil' },
      classificacao: 'licenciado'
    };
    const subs = [
      { titulo: 'Desenho 1', categoria: 'Infantil' },
      { titulo: 'Desenho 2', categoria: 'Infantil' },
      { titulo: 'Desenho 3', categoria: 'Infantil' },
      { titulo: 'Desenho 4', categoria: 'Infantil' },
    ];

    const slots = desmembrarFaixaSlots(bloco, subs);
    expect(slots.length).toBe(4);
    expect(slots[0].time).toBe('08:00:00');
    expect(slots[0].duration).toBe('00:15:00');
    expect(slots[0].program.title).toBe('Desenho 1');
    expect(slots[0].faixaNome).toBe('FAIXA INFANTIL');

    expect(slots[1].time).toBe('08:15:00');
    expect(slots[2].time).toBe('08:30:00');
    expect(slots[3].time).toBe('08:45:00');
    expect(slots[3].endTime).toBe('09:00:00');
  });

  it('reagruparFaixaSlots junta slots consecutivos de uma faixa de volta em um único bloco', () => {
    const slots = [
      { time: '08:00:00', durationSec: 900, duration: '00:15:00', program: { title: 'Desenho A', faixaNome: 'FAIXA INFANTIL' }, faixaNome: 'FAIXA INFANTIL' },
      { time: '08:15:00', durationSec: 900, duration: '00:15:00', program: { title: 'Desenho B', faixaNome: 'FAIXA INFANTIL' }, faixaNome: 'FAIXA INFANTIL' },
      { time: '08:30:00', durationSec: 900, duration: '00:15:00', program: { title: 'Desenho C', faixaNome: 'FAIXA INFANTIL' }, faixaNome: 'FAIXA INFANTIL' },
    ];

    const blocoComposto = reagruparFaixaSlots(slots, 'FAIXA INFANTIL');
    expect(blocoComposto).toBeDefined();
    expect(blocoComposto.time).toBe('08:00:00');
    expect(blocoComposto.durationSec).toBe(2700);
    expect(blocoComposto.duration).toBe('00:45:00');
    expect(blocoComposto.endTime).toBe('08:45:00');
    expect(blocoComposto.program.title).toBe('FAIXA INFANTIL');
    expect(blocoComposto.isFaixa).toBe(true);
    expect(blocoComposto.subprogramas.length).toBe(3);
    expect(blocoComposto.subprogramas[0].titulo).toBe('Desenho A');
  });
});
