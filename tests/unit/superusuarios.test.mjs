import { describe, it, expect, beforeEach } from 'vitest';
import EmissoraContext from '../../src/core/emissoraContext.js';

describe('Política de Superusuários e Acesso Multi-Emissora', () => {
  beforeEach(() => {
    EmissoraContext.setEmissoraAtivaId(null);
  });

  it('carrega todas as emissoras vinculadas com papel superadmin quando o usuário é superusuário', async () => {
    const mockClient = {
      from(table) {
        if (table === 'usuarios_emissoras') {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return Promise.resolve({
                        data: [
                          {
                            emissora_id: 'e1',
                            papel: 'superadmin',
                            emissoras: { id: 'e1', nome: 'Canal Educação', slug: 'canaledu', cor_primaria: '#1a56db' }
                          },
                          {
                            emissora_id: 'e2',
                            papel: 'superadmin',
                            emissoras: { id: 'e2', nome: 'TV Brasil', slug: 'tv-brasil', cor_primaria: '#10b981' }
                          },
                          {
                            emissora_id: 'e3',
                            papel: 'superadmin',
                            emissoras: { id: 'e3', nome: 'TV Brasil Internacional', slug: 'tv-brasil-int', cor_primaria: '#f59e0b' }
                          }
                        ],
                        error: null
                      });
                    }
                  };
                }
              };
            }
          };
        }
        return {};
      }
    };

    const lista = await EmissoraContext.carregarEmissoras(mockClient, 'user-superadmin-uuid');
    expect(lista).toHaveLength(3);
    expect(lista.map(e => e.nome)).toEqual(['Canal Educação', 'TV Brasil', 'TV Brasil Internacional']);
    expect(lista.every(e => e.papel === 'superadmin')).toBe(true);
  });

  it('usuário admin comum só carrega a emissora que possui vínculo', async () => {
    const mockClient = {
      from(table) {
        if (table === 'usuarios_emissoras') {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return Promise.resolve({
                        data: [
                          {
                            emissora_id: 'e2',
                            papel: 'admin',
                            emissoras: { id: 'e2', nome: 'TV Brasil', slug: 'tv-brasil', cor_primaria: '#10b981' }
                          }
                        ],
                        error: null
                      });
                    }
                  };
                }
              };
            }
          };
        }
        return {};
      }
    };

    const lista = await EmissoraContext.carregarEmissoras(mockClient, 'user-admin-comum-uuid');
    expect(lista).toHaveLength(1);
    expect(lista[0].nome).toBe('TV Brasil');
    expect(lista[0].papel).toBe('admin');
  });
});
