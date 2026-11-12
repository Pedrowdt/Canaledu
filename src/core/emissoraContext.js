// src/core/emissoraContext.js
// Gerenciamento da emissora ativa, lista de emissoras do usuário e personalização visual.
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

  function getEmissoraAtiva() {
    const id = getEmissoraAtivaId();
    if (id && emissorasCache.length > 0) {
      const encontrada = emissorasCache.find(e => e.id === id);
      if (encontrada) return encontrada;
    }
    return emissorasCache[0] || null;
  }

  function atualizarEmissoraNoCache(emissoraAtualizada) {
    if (!emissoraAtualizada || !emissoraAtualizada.id) return;
    const idx = emissorasCache.findIndex(e => e.id === emissoraAtualizada.id);
    if (idx >= 0) {
      emissorasCache[idx] = {
        ...emissorasCache[idx],
        ...emissoraAtualizada,
        cor_primaria: emissoraAtualizada.cor_primaria || emissorasCache[idx].cor_primaria || '#0066cc',
        logo_url: emissoraAtualizada.logo_url !== undefined ? emissoraAtualizada.logo_url : emissorasCache[idx].logo_url,
      };
    } else {
      emissorasCache.push({
        cor_primaria: '#0066cc',
        logo_url: null,
        ...emissoraAtualizada,
      });
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
          .select('emissora_id, papel, emissoras:emissora_id(id, nome, slug, tema, cor_primaria, logo_url)')
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
              cor_primaria: v.emissoras.cor_primaria || '#0066cc',
              logo_url: v.emissoras.logo_url || null,
            }));
          if (emissorasCache.length > 0) return emissorasCache;
        }
      }

      // 2. Fallback: lista diretamente da tabela emissoras
      const { data, error } = await client
        .from('emissoras')
        .select('id, nome, slug, tema, cor_primaria, logo_url')
        .eq('ativo', true)
        .order('nome');

      if (!error && Array.isArray(data)) {
        emissorasCache = data.map(e => ({
          ...e,
          cor_primaria: e.cor_primaria || '#0066cc',
          logo_url: e.logo_url || null,
        }));
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
    if (emissorasCache.length === 0) {
      emissorasCache = lista.slice();
    }
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
    getEmissoraAtiva,
    atualizarEmissoraNoCache,
    carregarEmissoras,
    resolverEmissoraAtiva,
    getEmissorasCache: () => emissorasCache.slice(),
  };
});
