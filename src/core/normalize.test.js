import { describe, it, expect } from 'vitest';
import { parseValidade, validadeToISO, formatValidade, isValidadeExpired, parseRestricaoObs } from './normalize.js';

describe('parseValidade — aceita os formatos que convivem no sistema', () => {
  it('AAAA-MM-DD (cadastro / input[type=date] / coluna date do banco)', () => {
    const d = parseValidade('2026-08-04');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(4);
  });
  it('DD/MM/AAAA', () => {
    const d = parseValidade('04/08/2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(4);
  });
  it('DD/MM/AA (import legado de Excel)', () => {
    const d = parseValidade('04/08/26');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(4);
  });
  it('serial numérico de data do Excel', () => {
    // 46238 = 04/08/2026
    const d = parseValidade(46238);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(4);
  });
  it('entradas vazias/inválidas retornam null', () => {
    expect(parseValidade('')).toBeNull();
    expect(parseValidade(null)).toBeNull();
    expect(parseValidade('None')).toBeNull();
    expect(parseValidade('não é uma data')).toBeNull();
  });
});

describe('validadeToISO / formatValidade — forma canônica x exibição', () => {
  it('converte qualquer formato aceito para AAAA-MM-DD', () => {
    expect(validadeToISO('04/08/2026')).toBe('2026-08-04');
    expect(validadeToISO('04/08/26')).toBe('2026-08-04');
    expect(validadeToISO('2026-08-04')).toBe('2026-08-04');
  });
  it('converte qualquer formato aceito para DD/MM/AAAA', () => {
    expect(formatValidade('2026-08-04')).toBe('04/08/2026');
    expect(formatValidade('04/08/26')).toBe('04/08/2026');
  });
  it('entradas não reconhecidas viram string vazia, não lixo', () => {
    expect(validadeToISO('')).toBe('');
    expect(formatValidade('None')).toBe('');
  });
});

describe('isValidadeExpired — o bug original: ISO nunca era detectado como vencido', () => {
  const ref = new Date(2026, 7, 5, 10, 0, 0); // 05/08/2026 10:00

  it('peça com validade ISO vencida deve ser detectada como vencida', () => {
    expect(isValidadeExpired('2026-08-04', ref)).toBe(true);
  });
  it('peça com validade ISO ainda vigente não é vencida', () => {
    expect(isValidadeExpired('2026-08-06', ref)).toBe(false);
  });
  it('vence apenas depois do fim do próprio dia (23:59:59)', () => {
    expect(isValidadeExpired('2026-08-05', ref)).toBe(false);
  });
  it('formato legado DD/MM/AA continua funcionando', () => {
    expect(isValidadeExpired('04/08/26', ref)).toBe(true);
  });
  it('sem validade, nunca vence', () => {
    expect(isValidadeExpired('', ref)).toBe(false);
  });
});

describe('parseRestricaoObs — MVP-CADASTRO.md, Fase 3: import diário grava freq/hIni/hFim estruturados', () => {
  it('"PROGRAMAR Nx" vira freq estruturado', () => {
    expect(parseRestricaoObs('PROGRAMAR 3X')).toEqual({ freq: '3', hIni: null, hFim: null });
  });

  it('"ENTRE XhY E XhY" vira hIni/hFim em HH:MM', () => {
    expect(parseRestricaoObs('ENTRE 8H E 12H')).toEqual({ freq: null, hIni: '08:00', hFim: '12:00' });
  });

  it('minutos são reconhecidos ("8H30")', () => {
    expect(parseRestricaoObs('ENTRE 8H30 E 12H45')).toEqual({ freq: null, hIni: '08:30', hFim: '12:45' });
  });

  it('"ATÉ XhY" só grava hFim (hIni fica null, não vazio)', () => {
    expect(parseRestricaoObs('ATÉ 12H')).toEqual({ freq: null, hIni: null, hFim: '12:00' });
  });

  it('"APÓS XhY" só grava hIni (hFim fica null)', () => {
    expect(parseRestricaoObs('APÓS 8H')).toEqual({ freq: null, hIni: '08:00', hFim: null });
  });

  it('freq e janela de horário juntos no mesmo texto', () => {
    expect(parseRestricaoObs('PROGRAMAR 2X ENTRE 8H E 12H')).toEqual({ freq: '2', hIni: '08:00', hFim: '12:00' });
  });

  it('texto sem nenhum padrão reconhecido — tudo null, não lança erro', () => {
    expect(parseRestricaoObs('OBSERVAÇÃO QUALQUER SEM PADRÃO')).toEqual({ freq: null, hIni: null, hFim: null });
  });

  it('entradas vazias/undefined não lançam erro', () => {
    expect(parseRestricaoObs('')).toEqual({ freq: null, hIni: null, hFim: null });
    expect(parseRestricaoObs(undefined)).toEqual({ freq: null, hIni: null, hFim: null });
  });
});
