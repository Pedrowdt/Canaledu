/**
 * PartsStore — camada única de acesso aos módulos do roteiro
 * (Banco de Peças, Programas e Peças do Dia).
 *
 * Não substitui o `state` existente: serve como API estável,
 * persistência consistente via `saveState()` e ponto de
 * notificação (subscribe) para futuras telas.
 *
 * Persistência: localStorage (chave `roteiroApp`), idêntica ao app.
 * Para migrar para nuvem no futuro, basta trocar a implementação
 * interna mantendo a mesma API.
 */
(function (global) {
  'use strict';

  const LS_KEY = 'roteiroApp';
  const subs = new Set();

  function notify(evt) {
    subs.forEach(fn => { try { fn(evt); } catch (e) { console.error(e); } });
  }

  function readLS() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch { return {}; }
  }

  function persist() {
    if (typeof global.saveState === 'function') {
      global.saveState();
    } else {
      // Fallback: grava direto se app.js ainda não carregou.
      const saved = readLS();
      saved.pecas     = global.state?.pecas     ?? saved.pecas;
      saved.programas = global.state?.programas ?? saved.programas;
      localStorage.setItem(LS_KEY, JSON.stringify(saved));
    }
  }

  function rerender() {
    if (typeof global.renderAll === 'function') global.renderAll();
  }

  function todayKey() {
    const d = global.state?.currentDate || new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /* ---------- factory: CRUD genérico sobre uma coleção do state ---------- */
  function makeCollection(name, seedRef) {
    return {
      list() { return [...(global.state?.[name] || [])]; },

      get(code) {
        return (global.state?.[name] || []).find(p => p.code === code);
      },

      add(item) {
        if (!item || !item.code) throw new Error('code obrigatório');
        const arr = global.state[name];
        if (arr.some(p => p.code === item.code)) {
          throw new Error(`code ${item.code} já existe em ${name}`);
        }
        arr.push(item);
        persist(); notify({ type: 'add', collection: name, item });
        rerender();
        return item;
      },

      update(code, patch) {
        const arr = global.state[name];
        const i = arr.findIndex(p => p.code === code);
        if (i < 0) throw new Error(`code ${code} não encontrado em ${name}`);
        arr[i] = { ...arr[i], ...patch };
        persist(); notify({ type: 'update', collection: name, item: arr[i] });
        rerender();
        return arr[i];
      },

      remove(code) {
        const arr = global.state[name];
        const i = arr.findIndex(p => p.code === code);
        if (i < 0) return false;
        arr.splice(i, 1);
        persist(); notify({ type: 'remove', collection: name, code });
        rerender();
        return true;
      },

      bulkImport(items, mode = 'merge') {
        if (!Array.isArray(items)) throw new Error('items deve ser array');
        if (mode === 'replace') {
          global.state[name] = items.slice();
        } else {
          const existing = new Set(global.state[name].map(p => p.code));
          items.forEach(it => {
            if (it && it.code && !existing.has(it.code)) {
              global.state[name].push(it);
              existing.add(it.code);
            }
          });
        }
        persist(); notify({ type: 'bulk', collection: name, mode, count: items.length });
        rerender();
      },

      export() {
        const json = JSON.stringify(global.state?.[name] || [], null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${name}-${todayKey()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      },

      resetToSeed() {
        const seed = (typeof seedRef === 'function' ? seedRef() : seedRef) || [];
        global.state[name] = JSON.parse(JSON.stringify(seed));
        persist(); notify({ type: 'reset', collection: name });
        rerender();
      },

      count() { return (global.state?.[name] || []).length; },
    };
  }

  const PartsStore = {
    pecas:     makeCollection('pecas',     () => global.INITIAL_PECAS     || []),
    programas: makeCollection('programas', () => global.INITIAL_PROGRAMAS || []),

    // Peças do Dia são indexadas por data (objeto), não array — API própria.
    pecasDia: {
      list(dateKey) {
        const saved = readLS();
        const k = dateKey || todayKey();
        return (saved.pecasDia?.[k]) || [];
      },
      setForDate(dateKey, items) {
        const saved = readLS();
        if (!saved.pecasDia) saved.pecasDia = {};
        saved.pecasDia[dateKey] = items.slice();
        localStorage.setItem(LS_KEY, JSON.stringify(saved));
        if (global.state) global.state.pecasDia = items.slice();
        notify({ type: 'pecasDia.set', dateKey, count: items.length });
        rerender();
      },
      clearForDate(dateKey) {
        const saved = readLS();
        if (saved.pecasDia && saved.pecasDia[dateKey]) {
          delete saved.pecasDia[dateKey];
          localStorage.setItem(LS_KEY, JSON.stringify(saved));
        }
        notify({ type: 'pecasDia.clear', dateKey });
        rerender();
      },
      listDates() {
        const saved = readLS();
        return Object.keys(saved.pecasDia || {}).sort();
      },
    },

    /* Eventos */
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

    /* Diagnóstico rápido no console */
    debug() {
      return {
        pecas: this.pecas.count(),
        programas: this.programas.count(),
        pecasDiaDatas: this.pecasDia.listDates(),
      };
    },
  };

  global.PartsStore = PartsStore;
})(window);
