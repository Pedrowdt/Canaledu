// src/core/roteiroBuilder.test.js
import { describe, it, expect } from 'vitest';
import {
  buildRoteiroFromPrograms, injectPecasFixas, computeTimeline,
  pickAssinatura, resolveFaixa,
} from './roteiroBuilder.js';
import { timeToSec } from './normalize.js';

const regrasMinimas = {
  vhSeguirAtivo: false,
  vhAssistindoAtivo: false,
  vhDaquiAPouco: false,
  vhClassificacao: { ativo: false },
  vhAssinaturaInfantil: { ativo: false },
  vhAssinaturaJovem: { ativo: false },
  vhAssinaturaAdulto: { ativo: false },
};

// Regras completas, como no app (REGRAS_DEFAULT)
const regrasCompletas = {
  inicioRoteiro: 6 * 3600,
  breakSlotsPorBloco: 2,
  vhClassificacao: { code: '85283', descricao: 'VH CLASSIFICAÇAO INDICATIVA LIVRE', tempo: '00:00:06', ativo: true },
  vhAssinaturaInfantil: { code: '85331', descricao: 'ASSINATURA_INFANTIL', tempo: '00:00:05', ativo: true },
  vhAssinaturaJovem: { code: '85330', descricao: 'ASSINATURA_JOVEM', tempo: '00:00:05', ativo: true },
  vhAssinaturaAdulto: { code: '85332', descricao: 'ASSINATURA_ADULTO', tempo: '00:00:05', ativo: true },
  vhAssinaturaInfantilKeywords: 'PALALOOS',
  vhAssinaturaAdultoKeywords: 'HUMANIDADES',
};

// Cadastro (Peças e Programas) que alimenta o roteiro
const cadastro = {
  pecas: [
    { code: '85283', descricao: 'VH CLASSIFICAÇAO INDICATIVA LIVRE', tempo: '00:00:06', type: 'EVNH' },
    { code: '90001', descricao: 'VH A SEGUIR SCIENTIA', tempo: '00:00:05', type: 'EVNH' },
    { code: '90002', descricao: 'VH VC ESTA ASSISTINDO SCIENTIA', tempo: '00:00:05', type: 'EVNH' },
  ],
  programas: [
    { code: 'P1', descricao: 'SCIENTIA', tempo: '00:26:00', type: 'RPRO', assinatura: ['infantil'] },
  ],
};

describe('buildRoteiroFromPrograms', () => {
  it('gera roteiro com um programa simples', () => {
    const programs = [{ code: 'P1', descricao: 'PROGRAMA TESTE', tempo: '00:30:00', type: 'RPRO' }];
    const resultado = buildRoteiroFromPrograms(programs, regrasMinimas, {});
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

  it('usa as VHs cadastradas em Peças e Programas', () => {
    const programs = [
      { code: 'P1', descricao: 'SCIENTIA - T01 EP01 - BL 01', tempo: '00:10:00', type: 'RPRO' },
      { code: 'P1', descricao: 'SCIENTIA - T01 EP01 - BL 02', tempo: '00:10:00', type: 'RPRO' },
    ];
    const r = buildRoteiroFromPrograms(programs, regrasCompletas, {}, [], cadastro);
    const codes = r.map((i) => i.code);
    expect(codes[0]).toBe('90001');          // VH A SEGUIR do cadastro
    expect(codes[1]).toBe('85283');          // classificação antes do BL01
    expect(codes).toContain('90002');        // VH VC ESTA ASSISTINDO no break
    expect(codes.filter((c) => c === '__BREAK__')).toHaveLength(2);
    // BL02 não recebe classificação novamente
    expect(codes.filter((c) => c === '85283')).toHaveLength(1);
    // assinatura vem da faixa cadastrada no programa (infantil)
    expect(codes[codes.length - 1]).toBe('85331');
  });

  it('ancora o programa na grade injetando AJUSTE PARA GRADE', () => {
    const programs = [{ code: 'P1', descricao: 'SCIENTIA', tempo: '00:26:00', type: 'RPRO' }];
    const grade = { SCIENTIA: '07:00:00' };
    const r = buildRoteiroFromPrograms(programs, regrasMinimas, grade);
    expect(r[0].code).toBe('__GAP__');
    expect(timeToSec(r[0].tempo)).toBe(3600);
  });

  it('separa ocorrências repetidas do mesmo programa na grade', () => {
    const programs = [
      { code: 'P1', descricao: 'SCIENTIA', tempo: '00:30:00', type: 'RPRO' },
      { code: 'P2', descricao: 'OUTRO', tempo: '00:30:00', type: 'RPRO' },
      { code: 'P1', descricao: 'SCIENTIA', tempo: '00:30:00', type: 'RPRO' },
    ];
    const grade = { SCIENTIA: '06:00:00', 'SCIENTIA [2ª]': '08:00:00' };
    const r = buildRoteiroFromPrograms(programs, regrasMinimas, grade);
    const gaps = r.filter((i) => i.code === '__GAP__');
    expect(gaps).toHaveLength(1);
    expect(timeToSec(gaps[0].tempo)).toBe(3600); // 07:00 -> 08:00
  });

  it('respeita injetarFixas=false', () => {
    const programs = [{ code: 'P1', descricao: 'X', tempo: '00:10:00', type: 'RPRO' }];
    const fixas = [{ code: 'F', descricao: 'f', tempo: '00:00:10', posicao: 'inicio' }];
    const r = buildRoteiroFromPrograms(programs, { ...regrasMinimas, injetarFixas: false }, {}, fixas);
    expect(r).toHaveLength(1);
  });

  it('calcula IN/OUT quando withTimes=true', () => {
    const programs = [
      { code: 'P1', descricao: 'A', tempo: '00:30:00', type: 'RPRO' },
      { code: 'P2', descricao: 'B', tempo: '00:15:00', type: 'RPRO' },
    ];
    const r = buildRoteiroFromPrograms(programs, regrasMinimas, {}, [], { withTimes: true });
    expect(r[0].IN).toBe('06:00:00');
    expect(r[0].OUT).toBe('06:30:00');
    expect(r[1].IN).toBe('06:30:00');
    expect(r[1].OUT).toBe('06:45:00');
  });
});

describe('assinaturas e fixas', () => {
  it('faixa vem do cadastro, depois das regras, depois padrão jovem', () => {
    expect(resolveFaixa('SCIENTIA', regrasCompletas, { programas: cadastro.programas })).toBe('infantil');
    expect(resolveFaixa('HUMANIDADES', regrasCompletas, {})).toBe('adulto');
    expect(resolveFaixa('QUALQUER COISA', regrasCompletas, {})).toBe('jovem');
  });

  it('assinatura desativada não é inserida', () => {
    expect(pickAssinatura('SCIENTIA', regrasMinimas, {})).toBeNull();
  });

  it('fixa antes_programa e apos_assinatura entram nos pontos certos', () => {
    const roteiro = [
      { code: 'P1', descricao: 'A - BL 01', tempo: '00:10:00', type: 'RPRO' },
      { code: '85330', descricao: 'ASSINATURA_JOVEM', tempo: '00:00:05', type: 'EVNH' },
    ];
    const r = injectPecasFixas(roteiro, [
      { code: 'AP', descricao: 'antes', tempo: '00:00:05', posicao: 'antes_programa' },
      { code: 'PA', descricao: 'apos', tempo: '00:00:05', posicao: 'apos_assinatura' },
    ]);
    expect(r.map((i) => i.code)).toEqual(['AP', 'P1', '85330', 'PA']);
  });

  it('computeTimeline dá a volta na meia-noite', () => {
    const r = computeTimeline([{ tempo: '02:00:00' }, { tempo: '01:00:00' }], 23 * 3600);
    expect(r[0].IN).toBe('23:00:00');
    expect(r[1].IN).toBe('01:00:00');
    expect(r[1].OUT).toBe('02:00:00');
  });
});
