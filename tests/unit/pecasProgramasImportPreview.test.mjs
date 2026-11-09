import { describe, it, expect } from 'vitest';
import CsvImportador from '../../src/core/csvImportador.js';

describe('Integração de importação CSV com pré-visualização e delimitador ponto e vírgula', () => {
  it('detecta delimitador ponto e vírgula prioritário e gera análise correta', () => {
    const csvContent = `CODE;DESCRIPTION;DURATION;TYPE
P001;Chamada Jornalismo;0000:30.00;CHAMADA
P002;Interprograma Cultura;0001:15.12;INTERPROGRAMA
P003;Abertura Oficial;01:30;PROGRAMA`;

    const delimInfo = CsvImportador.detectarDelimitador(csvContent);
    expect(delimInfo.delimitador).toBe(';');

    const rows = [
      ['CODE', 'DESCRIPTION', 'DURATION', 'TYPE'],
      ['P001', 'Chamada Jornalismo', '0000:30.00', 'CHAMADA'],
      ['P002', 'Interprograma Cultura', '0001:15.12', 'INTERPROGRAMA'],
      ['P003', 'Abertura Oficial', '01:30', 'PROGRAMA'],
    ];

    const existentes = [
      { id: '1', code: 'P001', desc: 'Chamada Antiga', tempo: '00:00:30', type: 'CHAMADA' }
    ];

    const analise = CsvImportador.analisarImportacao({
      rows,
      itensExistentes: existentes,
      isPecas: true,
      uidGenerator: () => 'uuid-teste',
    });

    expect(analise.valido).toBe(true);
    expect(analise.totalLinhas).toBe(3);
    expect(analise.totalNovos).toBe(2);
    expect(analise.totalDuplicados).toBe(1);

    // Amostra
    expect(analise.amostra.length).toBe(3);
    expect(analise.amostra[0].status).toBe('duplicado');
    expect(analise.amostra[0].tempoFormatado).toBe('00:00:30');

    expect(analise.amostra[1].status).toBe('novo');
    expect(analise.amostra[1].tempoFormatado).toBe('00:01:15');

    expect(analise.amostra[2].status).toBe('novo');
    expect(analise.amostra[2].tempoFormatado).toBe('00:01:30');

    // Itens novos a gravar
    expect(analise.novosItens.length).toBe(2);
    expect(analise.novosItens[0].code).toBe('P002');
    expect(analise.novosItens[0].tempo).toBe('00:01:15');
    expect(analise.novosItens[0].type).toBe("EINT");
  });
});

  it('processa perfeitamente o padrão real exportado do servidor (TESTE C VH.csv)', () => {
    const rows = [
      ['Code', 'Description', 'Duration', 'Type'],
      ['10584', 'VH CLASSIFICACAO INDICATIVA LIVRE', '0000:10,00', 'CANAL LIBRAS - VINHETA'],
      ['65565', 'VH CANAL EDUCACAO  AO VIVO', '0000:07,00', 'CANAL EDUCACAO - VINHETA'],
      ['69667', 'VH ASSISTA AGORA CAFE COM PIMENTA', '0000:05,00', 'CANAL EDUCACAO - VINHETA'],
      ['CE136659', 'INTPGM TODA MATEMATICA', '0002:16,00', 'CANAL EDUCACAO - INTERPROGRAMA'],
    ];

    const analise = CsvImportador.analisarImportacao({
      rows,
      itensExistentes: [],
      isPecas: true,
      uidGenerator: () => 'uuid-teste',
    });

    expect(analise.valido).toBe(true);
    expect(analise.totalNovos).toBe(4);

    // Verificações dos tipos mapeados
    expect(analise.novosItens[0].type).toBe('EVNH');
    expect(analise.novosItens[0].tempo).toBe('00:00:10');

    expect(analise.novosItens[1].type).toBe('EVNH');
    expect(analise.novosItens[1].tempo).toBe('00:00:07');

    expect(analise.novosItens[2].type).toBe('EVNH');
    expect(analise.novosItens[2].tempo).toBe('00:00:05');

    expect(analise.novosItens[3].type).toBe('EINT');
    expect(analise.novosItens[3].tempo).toBe('00:02:16');
  });
