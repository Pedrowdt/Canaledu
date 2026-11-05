import { describe, it, expect, beforeEach } from 'vitest';
import EmissoraContext from '../../src/core/emissoraContext.js';

describe('EmissoraContext', () => {
  beforeEach(() => {
    EmissoraContext.setEmissoraAtivaId(null);
  });

  it('armazena e recupera o ID da emissora ativa', () => {
    EmissoraContext.setEmissoraAtivaId('uuid-emissora-1');
    expect(EmissoraContext.getEmissoraAtivaId()).toBe('uuid-emissora-1');
  });

  it('resolve a primeira emissora da lista quando nenhuma foi salva anteriormente', () => {
    const lista = [
      { id: 'uuid-1', nome: 'Canal Educação' },
      { id: 'uuid-2', nome: 'TV Escola' },
    ];
    const ativa = EmissoraContext.resolverEmissoraAtiva(lista);
    expect(ativa.id).toBe('uuid-1');
    expect(EmissoraContext.getEmissoraAtivaId()).toBe('uuid-1');
  });

  it('preserva a emissora salva se ela existir na lista de autorizadas', () => {
    EmissoraContext.setEmissoraAtivaId('uuid-2');
    const lista = [
      { id: 'uuid-1', nome: 'Canal Educação' },
      { id: 'uuid-2', nome: 'TV Escola' },
    ];
    const ativa = EmissoraContext.resolverEmissoraAtiva(lista);
    expect(ativa.id).toBe('uuid-2');
  });

  it('troca para a primeira da lista se a emissora salva não estiver mais disponível', () => {
    EmissoraContext.setEmissoraAtivaId('uuid-antiga-inexistente');
    const lista = [
      { id: 'uuid-1', nome: 'Canal Educação' },
    ];
    const ativa = EmissoraContext.resolverEmissoraAtiva(lista);
    expect(ativa.id).toBe('uuid-1');
  });
});
