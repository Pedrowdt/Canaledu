import { describe, it, expect, beforeEach } from 'vitest';
import EmissoraContext from '../../src/core/emissoraContext.js';

describe('EmissoraContext — tipos e helpers multiemissora', () => {
  it('retorna os tipos padrão específicos para Canal Gov', () => {
    const tipos = EmissoraContext.getTiposPadrao('canal-gov');
    const codigos = tipos.map(t => t.codigo);
    expect(codigos).toEqual(['GPRO', 'GVNH', 'GCHM', 'GGV', 'GINS', 'LIVE']);
    expect(EmissoraContext.isVinhetaType('GVNH', tipos)).toBe(true);
    expect(EmissoraContext.isProgramaType('GPRO', tipos)).toBe(true);
    expect(EmissoraContext.isProgramaType('GCHM', tipos)).toBe(false);
  });

  it('retorna os tipos padrão específicos para TV Brasil / Rede', () => {
    const tipos = EmissoraContext.getTiposPadrao('tv-brasil');
    const codigos = tipos.map(t => t.codigo);
    expect(codigos).toContain('VH');
    expect(codigos).toContain('CH');
    expect(codigos).toContain('RPRO');
    expect(EmissoraContext.isVinhetaType('VH', tipos)).toBe(true);
    expect(EmissoraContext.isProgramaType('RPRO', tipos)).toBe(true);
  });

  it('retorna os tipos padrão específicos para TV Brasil Internacional', () => {
    const tipos = EmissoraContext.getTiposPadrao('tv-brasil-int');
    const codigos = tipos.map(t => t.codigo);
    expect(codigos).toContain('IPRO');
    expect(codigos).toContain('VH');
    expect(EmissoraContext.isProgramaType('IPRO', tipos)).toBe(true);
    expect(EmissoraContext.isVinhetaType('VH', tipos)).toBe(true);
  });

  it('preserva os tipos legados do Canal Educação', () => {
    const tipos = EmissoraContext.getTiposPadrao('canal-educacao');
    const codigos = tipos.map(t => t.codigo);
    expect(codigos).toEqual(['ECHE', 'ECHM', 'RCOM', 'RPOL', 'EINT', 'EVNH', 'RPRO']);
    expect(EmissoraContext.isVinhetaType('EVNH', tipos)).toBe(true);
    expect(EmissoraContext.isProgramaType('RPRO', tipos)).toBe(true);
  });
});
