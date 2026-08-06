// src/core/validator.test.js
import { describe, it, expect } from 'vitest';
import { validateRoteiroRegras } from './validator.js';

describe('validateRoteiroRegras', () => {
  const regrasMock = {
    regrasTipos: {
      RPOL: {
        ativo: true,
        inicio: '19:30',
        fim: '22:30',
        intervaloMinMin: 0,
        naoAdjacenteA: [],
      },
      ECHE: {
        ativo: true,
        inicio: '06:00',
        fim: '23:59',
        intervaloMinMin: 0,
        naoAdjacenteA: ['ECHM', 'ECHE'],
      },
    }
  };

  it('reporta erro se RPOL fora da janela', () => {
    const roteiro = [{ type: 'RPOL', IN: '18:00:00', code: 'x' }];
    const result = validateRoteiroRegras(roteiro, regrasMock);
    expect(result[0]).toContain('RPOL fora da janela 19:30–22:30');
  });

  it('não reporta erro se RPOL dentro da janela', () => {
    const roteiro = [{ type: 'RPOL', IN: '20:00:00', code: 'x' }];
    const result = validateRoteiroRegras(roteiro, regrasMock);
    expect(result[0]).toBeUndefined();
  });

  it('detecta adjacência proibida entre chamadas', () => {
    const roteiro = [
      { type: 'ECHE', IN: '10:00:00', code: 'a' },
      { type: 'ECHM', IN: '10:01:00', code: 'b' },
    ];
    const result = validateRoteiroRegras(roteiro, regrasMock);
    // Como as regras têm naoAdjacenteA: ['ECHM','ECHE'] para ECHE, deve avisar
    expect(result[0]).toBeDefined();
    expect(result[0][0]).toContain('adjacente a ECHM (proibido)');
  });
});