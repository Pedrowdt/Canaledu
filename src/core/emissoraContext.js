 // src/core/emissoraContext.js
// Gerenciamento da emissora ativa e lista de emissoras do usuário.
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EmissoraContext = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'canaledu:emissora_ativa_id';
  let emissorasCache = [];
  let emissoraAtivaId = null;

  function getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (_) {}
    return null;
  }

  function getEmissoraAtivaId() {
    if (emissoraAtivaId) return emissoraAtivaId;
    const s = getStorage();
    if (s) {
      const saved = s.getItem(STORAGE_KEY);
      if (saved) return saved;
    }
    return null;
  }

  function setEmissoraAtivaId(id) {
    emissoraAtivaId = id;
    const s = getStorage();
    if (s && id) {
      s.setItem(STORAGE_KEY, id);
    }
  }

  /**
   * Busca as emissoras disponíveis para o usuário autenticado.
   * Tenta primeiro via usuarios_emissoras; se vazio ou inacessível, lista de emissoras.
   */
  async function carregarEmissoras(client, userId) {
    if (!client) return [];

    try {
      // 1. Tenta carregar as emissoras vinculadas ao usuário
      if (userId) {
        const { data: vinculos, error: errVinculos } = await client
          .from('usuarios_emissoras')
          .select('emissora_id, papel, emissoras:emissora_id(id, nome, slug, tema)')
          .eq('usuario_id', userId)
          .eq('ativo', true);

        if (!errVinculos && Array.isArray(vinculos) && vinculos.length > 0) {
          emissorasCache = vinculos
            .filter(v => v.emissoras)
            .map(v => ({
              id: v.emissoras.id,
              nome: v.emissoras.nome,
              slug: v.emissoras.slug,
              papel: v.papel,
              tema: v.emissoras.tema,
            }));
          if (emissorasCache.length > 0) return emissorasCache;
        }
      }

      // 2. Fallback: lista diretamente da tabela emissoras
      const { data, error } = await client
        .from('emissoras')
        .select('id, nome, slug, tema')
        .eq('ativo', true)
        .order('nome');

      if (!error && Array.isArray(data)) {
        emissorasCache = data;
        return emissorasCache;
      }
    } catch (e) {
      console.warn('[EmissoraContext] Falha ao carregar emissoras do Supabase:', e);
    }

    return emissorasCache;
  }

  /**
   * Resolve a emissora ativa:
   * 1. Verifica se a salva no localStorage ainda está na lista de autorizadas.
   * 2. Caso contrário, escolhe a primeira da lista.
   */
  function resolverEmissoraAtiva(lista) {
    if (!Array.isArray(lista) || lista.length === 0) return null;
    const salva = getEmissoraAtivaId();
    const encontrada = lista.find(e => e.id === salva);
    if (encontrada) {
      emissoraAtivaId = encontrada.id;
      return encontrada;
    }
    emissoraAtivaId = lista[0].id;
    setEmissoraAtivaId(emissoraAtivaId);
    return lista[0];
  }

  return {
    STORAGE_KEY,
    getEmissoraAtivaId,
    setEmissoraAtivaId,
    carregarEmissoras,
    resolverEmissoraAtiva,
    getEmissorasCache: () => emissorasCache.slice(),
  };
});
