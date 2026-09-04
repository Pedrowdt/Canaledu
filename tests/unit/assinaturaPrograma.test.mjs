// Testes da ponte de classificação Cadastro -> Roteiro.
// Regra de negócio: a tag (infantil/jovem/adulto) marcada no cadastro do
// programa em "Peças e Programas" decide a VH de assinatura; as regras do
// painel Admin (mapa por programa + keywords + padrão) são apenas fallback.
import { describe, it, expect } from 'vitest';
import AP from '../../assinatura-programa.js';
import { pickAssinatura, faixaDoCadastro } from '../../src/core/roteiroBuilder.js';

const REGRAS = {
  vhAssinaturaInfantil: { code: '85331', descricao: 'ASSINATURA_INFANTIL', tempo: '00:00:05' },
  vhAssinaturaJovem: { code: '85330', descricao: 'ASSINATURA_JOVEM', tempo: '00:00:05' },
  vhAssinaturaAdulto: { code: '85332', descricao: 'ASSINATURA_ADULTO', tempo: '00:00:05' },
  // No Admin, PALALOOS está classificado como ADULTO (propositalmente errado)
  classificacaoPrograma: { PALALOOS: 'adulto' },
  vhAssinaturaInfantilKeywords: 'TRILHINHA',
  vhAssinaturaAdultoKeywords: 'HUMANIDADES',
};

const CADASTRO = [
  { code: '70001', descricao: 'PALALOOS', assinatura: ['infantil'] },
  { code: '70002', descricao: 'HUMANIDADES', assinatura: 'adulto' },   // string (vem do banco)
  { code: '70003', descricao: 'PROGRAMA SEM TAG', assinatura: [] },
  { code: '70004', descricao: 'ARQUIVADO', assinatura: ['adulto'], ativo: false },
];

describe('assinatura-programa (UMD, navegador)', () => {
  it('a tag do cadastro vence a classificação do Admin', () => {
    const r = AP.resolverFaixa({ code: '70001', descricao: 'PGM PALALOOS - T01 EP05 - BL 02' }, REGRAS, CADASTRO);
    expect(r).toEqual({ faixa: 'infantil', origem: 'cadastro' });
  });

  it('casa por título base mesmo sem o code do programa', () => {
    const r = AP.resolverFaixa('PGM HUMANIDADES BL 01', REGRAS, CADASTRO);
    expect(r.faixa).toBe('adulto');
    expect(r.origem).toBe('cadastro');
  });

  it('programa inativo no cadastro não decide', () => {
    expect(AP.faixaDoCadastro({ code: '70004', descricao: 'ARQUIVADO' }, CADASTRO)).toBeNull();
  });

  it('fallback 1: sem tag, usa o mapa do Admin', () => {
    const regras = { ...REGRAS, classificacaoPrograma: { 'PROGRAMA SEM TAG': 'adulto' } };
    const r = AP.resolverFaixa('PGM PROGRAMA SEM TAG - BL 01', regras, CADASTRO);
    expect(r).toEqual({ faixa: 'adulto', origem: 'admin' });
  });

  it('fallback 2: keywords do Admin quando o programa não está cadastrado', () => {
    const r = AP.resolverFaixa('PGM TRILHINHA - BL 01', REGRAS, CADASTRO);
    expect(r).toEqual({ faixa: 'infantil', origem: 'keywords' });
  });

  it('fallback 3: padrão jovem', () => {
    const r = AP.resolverFaixa('PGM DESCONHECIDO - BL 01', REGRAS, CADASTRO);
    expect(r).toEqual({ faixa: 'jovem', origem: 'padrao' });
  });

  it('monta a VH com code/tempo das REGRAS e respeita ativo:false', () => {
    const vh = AP.montarVhAssinatura({ code: '70001', descricao: 'PALALOOS' }, REGRAS, CADASTRO);
    expect(vh).toMatchObject({ code: '85331', descricao: 'ASSINATURA_INFANTIL', type: 'EVNH' });

    const desligado = { ...REGRAS, vhAssinaturaInfantil: { ativo: false } };
    expect(AP.montarVhAssinatura({ code: '70001', descricao: 'PALALOOS' }, desligado, CADASTRO)).toBeNull();
  });
});

describe('[Fase 2] assinatura específica por programa (peça EVNH cadastrada com funcao=assinatura_<faixa>)', () => {
  const PECAS = [
    { code: 'VHESP1', descricao: 'ASSINATURA_INFANTIL PALALOOS ESPECIAL', tempo: '00:00:07', type: 'EVNH', funcao: 'assinatura_infantil', programaRelacionado: 'PALALOOS', ativo: true },
  ];

  it('peça cadastrada com funcao/programaRelacionado vence o código genérico da faixa (PADRAO/Admin)', () => {
    const vh = AP.montarVhAssinatura({ code: '70001', descricao: 'PALALOOS' }, REGRAS, CADASTRO, PECAS);
    expect(vh.code).toBe('VHESP1');
    expect(vh.descricao).toBe('ASSINATURA_INFANTIL PALALOOS ESPECIAL');
    expect(vh._assinaturaOrigem).toBe('cadastro-especifico');
  });

  it('sem o 4º argumento (pecas), comportamento idêntico a antes da Fase 2 — chamador antigo não quebra', () => {
    const vh = AP.montarVhAssinatura({ code: '70001', descricao: 'PALALOOS' }, REGRAS, CADASTRO);
    expect(vh.code).toBe('85331'); // code genérico da faixa infantil (REGRAS), não a peça específica
  });

  it('peça cadastrada para OUTRO programa não interfere', () => {
    const pecasOutroPrograma = [{ ...PECAS[0], programaRelacionado: 'OUTRO PROGRAMA' }];
    const vh = AP.montarVhAssinatura({ code: '70001', descricao: 'PALALOOS' }, REGRAS, CADASTRO, pecasOutroPrograma);
    expect(vh.code).toBe('85331'); // cai no genérico, já que a peça cadastrada não é para PALALOOS
  });

  it('peça cadastrada com funcao de outra faixa não interfere (funcao=assinatura_adulto não serve para faixa infantil)', () => {
    const pecasFaixaErrada = [{ ...PECAS[0], funcao: 'assinatura_adulto' }];
    const vh = AP.montarVhAssinatura({ code: '70001', descricao: 'PALALOOS' }, REGRAS, CADASTRO, pecasFaixaErrada);
    expect(vh.code).toBe('85331');
  });

  it('peça inativa (ativo:false) não é escolhida — cai no genérico', () => {
    const pecasInativa = [{ ...PECAS[0], ativo: false }];
    const vh = AP.montarVhAssinatura({ code: '70001', descricao: 'PALALOOS' }, REGRAS, CADASTRO, pecasInativa);
    expect(vh.code).toBe('85331');
  });

  it('assinaturaEspecificaDoCadastro desempata por `ordem`', () => {
    const duasOpcoes = [
      { code: 'SEGUNDA', type: 'EVNH', funcao: 'assinatura_infantil', programaRelacionado: 'PALALOOS', ordem: 5 },
      { code: 'PRIMEIRA', type: 'EVNH', funcao: 'assinatura_infantil', programaRelacionado: 'PALALOOS', ordem: 1 },
    ];
    const r = AP.assinaturaEspecificaDoCadastro('PALALOOS', 'infantil', duasOpcoes);
    expect(r.code).toBe('PRIMEIRA');
  });
});

describe('roteiroBuilder.pickAssinatura (módulo puro)', () => {
  it('usa a tag do cadastro no lugar da regra do Admin', () => {
    const vh = pickAssinatura({ code: '70001', descricao: 'PGM PALALOOS - BL 03' }, REGRAS, CADASTRO);
    expect(vh.descricao).toBe('ASSINATURA_INFANTIL');
  });

  it('sem cadastro, mantém o comportamento antigo (fallback Admin)', () => {
    const vh = pickAssinatura('PGM PALALOOS - BL 03', REGRAS, []);
    expect(vh.descricao).toBe('ASSINATURA_ADULTO');
  });

  it('faixaDoCadastro ignora programas sem tag', () => {
    expect(faixaDoCadastro({ code: '70003', descricao: 'PROGRAMA SEM TAG' }, CADASTRO)).toBeNull();
  });
});
