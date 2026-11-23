import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const m = src.match(/const TIPOS_PADRAO_EDUCACAO[\s\S]*?\n}\n/);
const fn = new Function(`${m[0]}; return { tiposFiltroEmissora, TIPOS_PADRAO_EDUCACAO };`)();

describe('filtros de tipo por emissora', () => {
  it('Canal Educação (tipos legados) mantém os 6 filtros de sempre', () => {
    expect(fn.tiposFiltroEmissora([{ type: 'ECHM' }, { type: 'EINT' }])).toEqual(fn.TIPOS_PADRAO_EDUCACAO);
    expect(fn.tiposFiltroEmissora([])).toEqual(fn.TIPOS_PADRAO_EDUCACAO);
  });
  it('Gov mostra só os tipos cadastrados, sem programas', () => {
    const r = fn.tiposFiltroEmissora([{ type: 'GCHM' }, { type: 'GGV' }, { type: 'GPRO' }, { type: 'GVNH' }]);
    expect(r).toEqual(['GCHM', 'GGV', 'GVNH']);
  });
  it('Internacional mostra CH/PROMO/VH', () => {
    expect(fn.tiposFiltroEmissora([{ type: 'VH' }, { type: 'CH' }, { type: 'IPRO' }, { type: 'PROMO' }])).toEqual(['CH', 'PROMO', 'VH']);
  });
});
