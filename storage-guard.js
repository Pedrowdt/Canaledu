// =====================================================
// STORAGE GUARD — retenção de histórico + gravação resiliente
// Roteiro Canal Educação
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// PROBLEMA QUE RESOLVE
//   "Failed to execute 'setItem' on 'Storage': Setting the value of
//   'roteiroApp' exceeded the quota" (cloud-sync.js).
//
//   A chave `roteiroApp` guarda num único JSON o catálogo + TODOS os
//   roteiros / peças do dia já montados (roteiros['YYYY-MM-DD']).
//   Sem descarte, o JSON cresce para sempre até estourar os ~5 MB do
//   localStorage. Como a nuvem (user_data) devolve esse mesmo JSON
//   gigante no login, trocar de navegador não resolvia.
//
// O QUE ESTE MÓDULO FAZ
//   1) POLÍTICA DE RETENÇÃO: descarta dias passados mais antigos que
//      `diasRetencao` (padrão 90). Dias de hoje em diante e o dia que
//      está aberto na tela NUNCA são descartados.
//   2) PODA POR COTA: se mesmo assim o navegador recusar a gravação
//      (QuotaExceededError), reduz a retenção em degraus
//      (30 → 14 → 7 → 2 → 0 dias) e tenta de novo.
//   3) FALLBACK GRACIOSO: se nada couber, o valor fica numa cópia em
//      memória (a sessão continua funcionando e o push para a nuvem
//      segue normal) e NENHUMA exceção é propagada para o app.
//
// UMD: publica window.StorageGuard e module.exports (testes em Node).
// =====================================================
(function (global) {
  'use strict';

  const CHAVE_APP = 'roteiroApp';
  const CHAVES_CRITICAS = ['roteiroApp', 'roteiroRegras'];
  // Mapas dentro de `roteiroApp` indexados por 'YYYY-MM-DD'.
  const MAPAS_POR_DIA = ['roteiros', 'pecasDia', 'pecasDiaLimpo'];
  const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

  const POLITICA_PADRAO = Object.freeze({
    diasRetencao: 90,                  // histórico mantido em condições normais
    niveisEmergencia: [30, 14, 7, 2, 0], // degraus usados quando a cota estoura
    limiteSuaveChars: 4000000,         // acima disso poda ANTES de tentar gravar
  });

  // ---------- datas ----------
  function pad(n) { return String(n).padStart(2, '0'); }

  /** 'YYYY-MM-DD' no fuso local (mesma convenção do dateKey() do app.js). */
  function chaveDia(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function chaveCorte(hoje, dias) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias);
    return chaveDia(d);
  }

  // ---------- detecção de erro de cota ----------
  /** Cobre Chrome/Safari (QuotaExceededError, code 22), Firefox (NS_ERROR_DOM_QUOTA_REACHED, 1014) e mensagens. */
  function ehErroDeCota(e) {
    if (!e) return false;
    return (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 || e.code === 1014 ||
      /quota/i.test(String(e.message || ''))
    );
  }

  // ---------- poda ----------
  /**
   * Devolve uma CÓPIA de `app` sem os dias passados mais antigos que
   * `diasRetencao`. Não muta o original. Chaves que não são datas e
   * qualquer dia em `protegidos` são preservados.
   */
  function podarHistorico(app, opcoes) {
    const o = opcoes || {};
    const hoje = o.hoje || new Date();
    const dias = o.diasRetencao != null ? o.diasRetencao : POLITICA_PADRAO.diasRetencao;
    const protegidos = new Set(o.protegidos || []);
    const corte = chaveCorte(hoje, dias);

    const copia = Object.assign({}, app);
    const removidos = {};
    let total = 0;

    for (const campo of MAPAS_POR_DIA) {
      const mapa = app && app[campo];
      if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) continue;
      const novo = {};
      let n = 0;
      for (const k of Object.keys(mapa)) {
        const velho = RE_DIA.test(k) && k < corte && !protegidos.has(k);
        if (velho) n++; else novo[k] = mapa[k];
      }
      if (n) { copia[campo] = novo; removidos[campo] = n; total += n; }
    }
    return { app: copia, removidos, total, corte };
  }

  // ---------- guarda de escrita ----------
  /**
   * @param {object} cfg
   *  - storage:        objeto tipo Storage (getItem/removeItem)
   *  - setItemOriginal: função (key, value) que grava de verdade (sem patch)
   *  - getItemOriginal: (opcional) leitura real; padrão storage.getItem
   *  - agora:          () => Date            (injetável nos testes)
   *  - protegidos:     () => string[]        dias que não podem ser podados
   *  - onEvento:       (tipo, detalhe) => void  (log/status na UI)
   *  - politica:       sobrescreve POLITICA_PADRAO
   */
  function criar(cfg) {
    const storage = cfg.storage;
    const setRaw = cfg.setItemOriginal;
    const getRaw = cfg.getItemOriginal || ((k) => storage.getItem(k));
    const agora = cfg.agora || (() => new Date());
    const protegidos = cfg.protegidos || (() => []);
    const emitir = cfg.onEvento || (() => {});
    const politica = Object.assign({}, POLITICA_PADRAO, cfg.politica || {});

    /** Cópia em memória das chaves que não couberam no disco. */
    const memoria = new Map();

    function tentar(key, value) {
      try { setRaw(key, value); memoria.delete(key); return true; }
      catch (e) { if (ehErroDeCota(e)) return false; throw e; }
    }

    function opcoesPoda(dias) {
      return { hoje: agora(), diasRetencao: dias, protegidos: protegidos() };
    }

    /** Poda preventiva/por retenção de um JSON de roteiroApp já serializado. */
    function podarSerializado(value, dias) {
      let app;
      try { app = JSON.parse(value); } catch (_) { return null; }
      if (!app || typeof app !== 'object') return null;
      const r = podarHistorico(app, opcoesPoda(dias));
      return { json: JSON.stringify(r.app), ...r };
    }

    function gravarApp(value) {
      // 0) Acima do limite suave: poda antes mesmo de incomodar o navegador.
      let candidato = value;
      if (value.length > politica.limiteSuaveChars) {
        const p = podarSerializado(value, politica.diasRetencao);
        if (p && p.total) {
          candidato = p.json;
          emitir('poda_preventiva', { removidos: p.removidos, total: p.total, dias: politica.diasRetencao });
        }
      }
      if (tentar(CHAVE_APP, candidato)) return { ok: true, valor: candidato, podado: candidato !== value };

      // 1) Cota estourou: retenção normal e depois degraus de emergência.
      const degraus = [politica.diasRetencao, ...politica.niveisEmergencia]
        .filter((d, i, a) => a.indexOf(d) === i)
        .sort((a, b) => b - a);
      for (const dias of degraus) {
        const p = podarSerializado(candidato, dias);
        if (!p) break; // JSON inválido: não dá para podar com segurança
        if (!p.total) continue; // nada a remover neste degrau
        if (tentar(CHAVE_APP, p.json)) {
          emitir('poda_por_cota', { removidos: p.removidos, total: p.total, dias });
          return { ok: true, valor: p.json, podado: true, dias };
        }
        candidato = p.json; // segue podando em cima do já reduzido
      }

      // 2) Fallback: mantém só em memória; a sessão e o sync continuam.
      memoria.set(CHAVE_APP, candidato);
      emitir('fallback_memoria', { chave: CHAVE_APP, tamanho: candidato.length });
      return { ok: false, emMemoria: true, valor: candidato };
    }

    function gravarCriticaSimples(key, value) {
      if (tentar(key, value)) return { ok: true, valor: value };
      // Libera espaço podando o roteiroApp já gravado e tenta de novo.
      liberarEspaco();
      if (tentar(key, value)) return { ok: true, valor: value, podado: true };
      memoria.set(key, value);
      emitir('fallback_memoria', { chave: key, tamanho: value.length });
      return { ok: false, emMemoria: true, valor: value };
    }

    /** Poda o `roteiroApp` que já está no disco (usado por chaves não-críticas). */
    function liberarEspaco() {
      const atual = getRaw(CHAVE_APP);
      if (!atual) return false;
      const degraus = [politica.diasRetencao, ...politica.niveisEmergencia];
      for (const dias of degraus) {
        const p = podarSerializado(atual, dias);
        if (p && p.total && tentar(CHAVE_APP, p.json)) {
          emitir('poda_por_cota', { removidos: p.removidos, total: p.total, dias, origem: 'liberar_espaco' });
          return true;
        }
      }
      return false;
    }

    return {
      /** Substituto de localStorage.setItem. Nunca lança para chaves críticas. */
      setItem(key, value) {
        const v = String(value);
        if (key === CHAVE_APP) return gravarApp(v);
        if (CHAVES_CRITICAS.includes(key)) return gravarCriticaSimples(key, v);
        // Demais chaves: uma única tentativa extra após liberar espaço; se
        // ainda falhar, propaga o erro original (quem chama já tem try/catch).
        try { setRaw(key, v); memoria.delete(key); return { ok: true }; }
        catch (e) {
          if (!ehErroDeCota(e)) throw e;
          liberarEspaco();
          setRaw(key, v);
          return { ok: true, podado: true };
        }
      },
      /** Substituto de getItem: serve a cópia em memória quando o disco não coube. */
      getItem(key) {
        return memoria.has(key) ? memoria.get(key) : getRaw(key);
      },
      removeItem(key) {
        memoria.delete(key);
        return storage.removeItem(key);
      },
      emMemoria(key) { return memoria.has(key); },
      /** Aplica a retenção ao roteiroApp no disco agora (ex.: após o login). */
      aplicarRetencao() {
        const atual = memoria.has(CHAVE_APP) ? memoria.get(CHAVE_APP) : getRaw(CHAVE_APP);
        if (!atual) return { total: 0 };
        const p = podarSerializado(atual, politica.diasRetencao);
        if (!p || !p.total) return { total: 0 };
        gravarApp(p.json);
        emitir('poda_retencao', { removidos: p.removidos, total: p.total, dias: politica.diasRetencao });
        return { total: p.total, removidos: p.removidos };
      },
    };
  }

  const api = {
    criar, podarHistorico, ehErroDeCota, chaveDia, chaveCorte,
    POLITICA_PADRAO, MAPAS_POR_DIA, CHAVES_CRITICAS,
  };

  global.StorageGuard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
