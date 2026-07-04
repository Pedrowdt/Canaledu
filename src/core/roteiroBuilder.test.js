// src/core/roteiroBuilder.test.js
import { describe, it, expect } from 'vitest';
import { buildRoteiroFromPrograms } from './roteiroBuilder.js';

describe('buildRoteiroFromPrograms', () => {
  const regrasMinimas = {
    vhSeguirAtivo: false,
    vhAssistindoAtivo: false,
    vhDaquiAPouco: false,
    vhClassificacao: { ativo: false },
    vhAssinaturaInfantil: { ativo: false },
    vhAssinaturaJovem: { ativo: false },
    vhAssinaturaAdulto: { ativo: false },
    // outras regras que a função possa usar
  };

  it('gera roteiro com um programa simples', () => {
    const programs = [{ code: 'P1', descricao: 'PROGRAMA TESTE', tempo: '00:30:00', type: 'RPRO' }];
    const grade = {}; // sem grade
    const resultado = buildRoteiroFromPrograms(programs, regrasMinimas, grade);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].code).toBe('P1');
  });

  it('insere peças fixas nas posições corretas', () => {
    const programs = [{ code: 'P1', descricao: 'PROGRAMA TESTE', tempo: '00:30:00', type: 'RPRO' }];
    const fixas = [
      { code: 'FIXA1', descricao: 'Fixa Início', tempo: '00:00:10', type: 'EVNH', posicao: 'inicio' },
      { code: 'FIXA2', descricao: 'Fixa Fim', tempo: '00:00:10', type: 'EVNH', posicao: 'fim' },
    ];
    const resultado = buildRoteiroFromPrograms(programs, regrasMinimas, {}, fixas);
    expect(resultado[0].code).toBe('FIXA1');
    expect(resultado[resultado.length - 1].code).toBe('FIXA2');
  });

  // Adicione mais casos conforme a lógica real
});