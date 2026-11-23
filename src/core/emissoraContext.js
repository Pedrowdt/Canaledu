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
  const tiposCache = {};

  const TIPOS_PADRAO = {
    'canal-gov': [
      { codigo: 'GPRO', nome: 'Programa Gov', sigla: 'PGM', eh_interprograma: false, ordem: 1, cor: '#0284c7' },
      { codigo: 'GVNH', nome: 'Vinheta Gov', sigla: 'VNH', eh_interprograma: false, ordem: 2, cor: '#8b5cf6' },
      { codigo: 'GCHM', nome: 'Chamada Gov', sigla: 'CHM', eh_interprograma: false, ordem: 3, cor: '#ef4444' },
      { codigo: 'GGV', nome: 'Governo Federal / Campanhas', sigla: 'GGV', eh_interprograma: true, ordem: 4, cor: '#f59e0b' },
      { codigo: 'GINS', nome: 'Institucional Gov', sigla: 'INS', eh_interprograma: true, ordem: 5, cor: '#10b981' },
      { codigo: 'LIVE', nome: 'Ao Vivo / Transmissão', sigla: 'VIV', eh_interprograma: false, ordem: 6, cor: '#dc2626' },
    ],
    'tv-brasil': [
      { codigo: 'RPRO', nome: 'Programa', sigla: 'PGM', eh_interprograma: false, ordem: 1, cor: '#10b981' },
      { codigo: 'CH', nome: 'Chamada', sigla: 'CH', eh_interprograma: false, ordem: 2, cor: '#ef4444' },
      { codigo: 'VH', nome: 'Vinheta', sigla: 'VH', eh_interprograma: false, ordem: 3, cor: '#8b5cf6' },
      { codigo: 'PROMO', nome: 'Promoção', sigla: 'PRM', eh_interprograma: false, ordem: 4, cor: '#f59e0b' },
      { codigo: 'INTERPRO', nome: 'Interprograma', sigla: 'INT', eh_interprograma: true, ordem: 5, cor: '#3b82f6' },
      { codigo: 'CI', nome: 'Classificação Indicativa', sigla: 'CI', eh_interprograma: false, ordem: 6, cor: '#64748b' },
      { codigo: 'PROGRAMETE', nome: 'Programete', sigla: 'PGT', eh_interprograma: true, ordem: 7, cor: '#059669' },
    ],
    'tv-brasil-int': [
      { codigo: 'IPRO', nome: 'Programa Internacional', sigla: 'PGM', eh_interprograma: false, ordem: 1, cor: '#f59e0b' },
      { codigo: 'CH', nome: 'Chamada', sigla: 'CH', eh_interprograma: false, ordem: 2, cor: '#ef4444' },
      { codigo: 'VH', nome: 'Vinheta', sigla: 'VH', eh_interprograma: false, ordem: 3, cor: '#8b5cf6' },
      { codigo: 'PROMO', nome: 'Promoção', sigla: 'PRM', eh_interprograma: false, ordem: 4, cor: '#06b6d4' },
      { codigo: 'INTERPRO', nome: 'Interprograma', sigla: 'INT', eh_interprograma: true, ordem: 5, cor: '#3b82f6' },
      { codigo: 'CI', nome: 'Classificação Indicativa', sigla: 'CI', eh_interprograma: false, ordem: 6, cor: '#64748b' },
    ],
    'canal-educacao': [
      { codigo: 'ECHE', nome: 'Chamada de Estreia', sigla: 'ECHE', eh_interprograma: false, ordem: 1, cor: '#ef9f27' },
      { codigo: 'ECHM', nome: 'Chamada Comum / Manutenção', sigla: 'ECHM', eh_interprograma: false, ordem: 2, cor: '#888780' },
      { codigo: 'RCOM', nome: 'Comercial', sigla: 'RCOM', eh_interprograma: false, ordem: 3, cor: '#378add' },
      { codigo: 'RPOL', nome: 'Político', sigla: 'RPOL', eh_interprograma: false, ordem: 4, cor: '#7f77dd' },
      { codigo: 'EINT', nome: 'Interprograma', sigla: 'EINT', eh_interprograma: true, ordem: 5, cor: '#1d9e75' },
      { codigo: 'EVNH', nome: 'Vinheta / ID', sigla: 'EVNH', eh_interprograma: false, ordem: 6, cor: '#8b5cf6' },
      { codigo: 'RPRO', nome: 'Programa', sigla: 'RPRO', eh_interprograma: false, ordem: 7, cor: '#10b981' },
    ],
  };

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

  function getEmissoraAtivaNome() {
    const ativa = getEmissoraAtiva();
    return ativa ? (ativa.nome || ativa.codigo || 'Emissora Ativa') : 'Emissora Ativa';
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
   * Identifica o grupo padrão de tipos a partir do slug ou nome da emissora.
   */
  function resolverChavePadrao(slugOrNome) {
    const str = String(slugOrNome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (str.includes('gov')) return 'canal-gov';
    if (str.includes('inter') || str.includes('-int') || str === 'tv-brasil-int') return 'tv-brasil-int';
    if (str.includes('brasil') || str.includes('rede')) return 'tv-brasil';
    return 'canal-educacao';
  }

  function getTiposPadrao(slugOrNome) {
    const chave = resolverChavePadrao(slugOrNome);
    return (TIPOS_PADRAO[chave] || TIPOS_PADRAO['canal-educacao']).map(t => ({ ...t }));
  }

  function setTiposEmissoraCache(emissoraId, tipos) {
    if (!emissoraId || !Array.isArray(tipos)) return;
    tiposCache[emissoraId] = tipos.map(t => ({ ...t }));
  }

  function getTiposEmissora(emissoraId) {
    if (emissoraId && tiposCache[emissoraId]) {
      return tiposCache[emissoraId].map(t => ({ ...t }));
    }
    const ativa = getEmissoraAtiva();
    const slugOuNome = ativa ? (ativa.slug || ativa.nome) : null;
    return getTiposPadrao(slugOuNome);
  }

  function getTiposEmissoraAtiva() {
    return getTiposEmissora(getEmissoraAtivaId());
  }

  /**
   * Carrega os tipos de peças para uma emissora via Supabase RPC fn_tipos_pecas_emissora
   * com fallback para consulta direta na tabela ou catálogo padrão em memória.
   */
  async function carregarTiposEmissora(client, emissoraId, slugOrNome) {
    if (emissoraId && tiposCache[emissoraId] && tiposCache[emissoraId].length > 0) {
      return tiposCache[emissoraId].map(t => ({ ...t }));
    }

    if (client && emissoraId) {
      try {
        // 1. Tenta RPC fn_tipos_pecas_emissora
        if (typeof client.rpc === 'function') {
          const { data, error } = await client.rpc('fn_tipos_pecas_emissora', { p_emissora_id: emissoraId });
          if (!error && Array.isArray(data) && data.length > 0) {
            setTiposEmissoraCache(emissoraId, data);
            return tiposCache[emissoraId].map(t => ({ ...t }));
          }
        }

        // 2. Fallback direto na tabela tipos_pecas
        if (typeof client.from === 'function') {
          const { data, error } = await client
            .from('tipos_pecas')
            .select('codigo, nome, sigla, cor, eh_interprograma, ordem')
            .eq('emissora_id', emissoraId)
            .eq('ativo', true)
            .order('ordem');

          if (!error && Array.isArray(data) && data.length > 0) {
            setTiposEmissoraCache(emissoraId, data);
            return tiposCache[emissoraId].map(t => ({ ...t }));
          }
        }
      } catch (e) {
        console.warn('[EmissoraContext] Falha ao consultar tipos de peças na nuvem:', e);
      }
    }

    const padroes = getTiposPadrao(slugOrNome || (getEmissoraAtiva() ? (getEmissoraAtiva().slug || getEmissoraAtiva().nome) : ''));
    if (emissoraId) {
      setTiposEmissoraCache(emissoraId, padroes);
    }
    return padroes;
  }

  function isVinhetaType(tipo, tipos) {
    if (!tipo) return false;
    const t = String(tipo).trim().toUpperCase();
    if (['EVNH', 'GVNH', 'VH', 'VINHETA'].includes(t)) return true;
    const list = Array.isArray(tipos) ? tipos : getTiposEmissoraAtiva();
    if (Array.isArray(list)) {
      const item = list.find(x => (x.codigo || '').toUpperCase() === t);
      if (item) {
        const sigla = (item.sigla || '').toUpperCase();
        const nome = (item.nome || '').toLowerCase();
        if (sigla === 'VH' || sigla === 'VNH' || nome.includes('vinheta')) return true;
      }
    }
    return false;
  }

  function isProgramaType(tipo, tipos) {
    if (!tipo) return false;
    const t = String(tipo).trim().toUpperCase();
    if (['RPRO', 'GPRO', 'IPRO', 'PGM'].includes(t)) return true;
    const list = Array.isArray(tipos) ? tipos : getTiposEmissoraAtiva();
    if (Array.isArray(list)) {
      const item = list.find(x => (x.codigo || '').toUpperCase() === t);
      if (item) {
        const sigla = (item.sigla || '').toUpperCase();
        const nome = (item.nome || '').toLowerCase();
        if (sigla === 'PGM' || nome.includes('programa')) return true;
      }
    }
    return false;
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
    emissorasCache = lista.slice();
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
    getEmissoraAtivaNome,
    atualizarEmissoraNoCache,
    carregarEmissoras,
    resolverEmissoraAtiva,
    getEmissorasCache: () => emissorasCache.slice(),
    getTiposPadrao,
    carregarTiposEmissora,
    setTiposEmissoraCache,
    getTiposEmissora,
    getTiposEmissoraAtiva,
    isVinhetaType,
    isProgramaType,
  };
});
