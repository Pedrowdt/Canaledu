// =====================================================
// PONTE CADASTRO -> ROTEIRO
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// PROBLEMA QUE ESTA PONTE RESOLVE
// A tela de confecção de roteiro (app.js) lê o banco de
// peças e programas do localStorage (chave `roteiroApp`).
// O cadastro, por sua vez, grava nas tabelas relacionais
// public.pecas / public.programas.
//
// Sem uma ponte explícita, o roteiro dependia do espelho
// JSONB (shared_data.pecas) e, se o espelho atrasasse ou o
// snapshot local fosse mais antigo, a peça recém-cadastrada
// "desaparecia" na hora de montar o roteiro.
//
// Aqui o cadastro passa a ser a FONTE DA VERDADE:
//   1) ao abrir o roteiro, lemos as tabelas relacionais;
//   2) o resultado sobrescreve pecas/programas no
//      localStorage antes de app.js carregar;
//   3) se as tabelas ainda não existirem (migração não
//      aplicada), usamos o shared_data como reserva —
//      nada quebra durante a transição.
//
// UMD: publica window.RoteiroPecasBridge e também
// module.exports (para os testes rodarem em Node).
// =====================================================
(function (global) {
  'use strict';

  /** Só peças ativas entram no roteiro (ativo !== false). */
  function apenasAtivos(lista) {
    return (lista || []).filter((item) => item && item.code && item.ativo !== false);
  }

  // ---------------------------------------------------
  // Normalização de `validade` — o Roteiro (app.js/isExpired)
  // hoje só entende dd/mm/aa(aa); o cadastro grava sempre
  // AAAA-MM-DD (input[type=date] + coluna `date` do banco). Sem
  // normalizar aqui, a peça vencida nunca era marcada como vencida
  // e o card mostrava a data em formato ISO. Réplica não-modular de
  // src/core/normalize.js#parseValidade (mesma regra, coberta pelos
  // testes de lá) — atualize os dois lugares juntos.
  // ---------------------------------------------------
  function parseValidade(v) {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (!s || s === 'None') return null;

    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // AAAA-MM-DD
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // DD/MM/AAAA ou DD/MM/AA
    if (m) {
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      const d = new Date(year, Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /** Forma canônica AAAA-MM-DD usada dentro do `roteiroApp` (local e legado convivem hoje). */
  function validadeToISO(v) {
    const d = parseValidade(v);
    if (!d) return v || '';
    const yyyy = String(d.getFullYear()).padStart(4, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Garante `validade` em ISO em cada item, sem tocar em nenhum outro campo. */
  function normalizarValidades(lista) {
    return (lista || []).map((item) => {
      if (!item || item.validade == null || item.validade === '') return item;
      const iso = validadeToISO(item.validade);
      return iso === item.validade ? item : Object.assign({}, item, { validade: iso });
    });
  }

  /**
   * Mescla o cadastro dentro do objeto `roteiroApp`.
   * IMPORTANTE: substitui pecas/programas (o cadastro manda),
   * mas NUNCA toca em roteiros/pecasDia/grade — esses são do
   * roteiro e pertencem a cada usuário.
   */
  function mergeCadastro(app, cadastro, pendentes) {
    const base = app && typeof app === 'object' ? app : {};
    const pecas = combinar(apenasAtivos(cadastro && cadastro.pecas), base.pecas, pendentes, 'pecas');
    const programas = combinar(apenasAtivos(cadastro && cadastro.programas), base.programas, pendentes, 'programas');
    return Object.assign({}, base, {
      // Se o cadastro voltar vazio por falha de leitura, preservamos o
      // que já estava local para não zerar a tela do usuário.
      pecas: pecas.length ? pecas : base.pecas || [],
      programas: programas.length ? programas : base.programas || [],
    });
  }

  /** Pendências locais (fila do CadastroSync) — o que ainda não subiu. */
  function lerPendentes(pendentes) {
    const p = pendentes || (global.CadastroSync && global.CadastroSync.pendentes()) || {};
    return {
      pecas: p.pecas || [],
      programas: p.programas || [],
      excluidos: {
        pecas: (p.excluidos && p.excluidos.pecas) || [],
        programas: (p.excluidos && p.excluidos.programas) || [],
      },
    };
  }

  /** Carimbo de recência de um item (row_version > updated_at > 0). */
  function versao(item) {
    if (!item || typeof item !== 'object') return -1;
    const rv = Number(item.row_version);
    if (Number.isFinite(rv)) return rv * 1e13; // row_version domina o timestamp
    const ts = Date.parse(item.updated_at || item.updatedAt || item.atualizado_em || '');
    return Number.isFinite(ts) ? ts : 0;
  }

  /**
   * Une o cadastro da nuvem com o snapshot local desta máquina.
   *
   * FLUXO DE MÃO ÚNICA: o Roteiro nunca escreve de volta no cadastro. Para
   * que uma atualização vinda de outro usuário não apague da tela algo mais
   * recente que este navegador já tem, a escolha é feita por RECÊNCIA
   * (row_version / updated_at), e não sincronizando de volta para a nuvem:
   *   1) o cadastro da nuvem é a base;
   *   2) quando o item local é comprovadamente mais novo (versão maior),
   *      ele prevalece em tela até a nuvem alcançá-lo;
   *   3) itens que existem só localmente permanecem visíveis (rascunho local
   *      do roteiro), sem nunca subirem ao cadastro;
   *   4) a fila legada de pendências, quando existir, ainda é respeitada.
   */
  function combinar(remotos, locais, pendentes, kind) {
    const pend = lerPendentes(pendentes);
    const mapa = new Map();
    // Normaliza `validade` para ISO em toda fonte (cadastro remoto,
    // snapshot local e fila de pendências) para que o roteiro nunca
    // misture AAAA-MM-DD com dd/mm/aa(aa) dentro do mesmo `roteiroApp`.
    normalizarValidades(remotos).forEach((item) => { if (item && item.code) mapa.set(String(item.code), item); });

    // Snapshot local: mantém o que é só local e o que é mais recente.
    normalizarValidades(locais).forEach((item) => {
      if (!item || !item.code) return;
      const code = String(item.code);
      const remoto = mapa.get(code);
      if (remoto) {
        if (versao(item) > versao(remoto)) mapa.set(code, item);
        return;
      }
      // Ausente na nuvem: só permanece se for um rascunho criado no
      // Roteiro (marcado com _localOnly). Itens que vieram do cadastro e
      // sumiram de lá foram realmente excluídos no cadastro.
      if (item._localOnly === true) mapa.set(code, item);
    });

    normalizarValidades(apenasAtivos(pend[kind])).forEach((item) => mapa.set(String(item.code), item));
    pend.excluidos[kind].forEach((code) => mapa.delete(String(code)));
    return [...mapa.values()];
  }

  /**
   * Lê o cadastro na nuvem. Retorna sempre um objeto
   * { pecas, programas, origem } — origem ajuda no diagnóstico
   * ('relacional' | 'shared_data' | 'local').
   */
  async function carregarCadastro({ client, repo, sharedRow, workspaceId } = {}) {
    const repositorio = repo || global.PecasRepo;
    if (repositorio && client) {
      try {
        const mode = await repositorio.init(client, workspaceId);
        const dados = await repositorio.loadAll();
        return {
          pecas: dados.pecas || [],
          programas: dados.programas || [],
          origem: mode === 'relational' ? 'relacional' : 'shared_data',
        };
      } catch (e) {
        // Falha de rede/permissão não pode impedir o roteiro de abrir.
        console.warn('[Ponte] não foi possível ler o cadastro relacional:', e);
      }
    }
    return {
      pecas: (sharedRow && sharedRow.pecas) || [],
      programas: (sharedRow && sharedRow.programas) || [],
      origem: sharedRow ? 'shared_data' : 'local',
    };
  }

  /**
   * Aplica o cadastro no estado em memória do app já carregado
   * (usado pelo tempo real). Retorna true se algo mudou, para
   * evitar re-render desnecessário.
   */
  function aplicarNoEstado(state, cadastro, pendentes) {
    if (!state) return false;
    const pecas = combinar(apenasAtivos(cadastro && cadastro.pecas), state.pecas, pendentes, 'pecas');
    const programas = combinar(apenasAtivos(cadastro && cadastro.programas), state.programas, pendentes, 'programas');
    const mudou =
      JSON.stringify(state.pecas || []) !== JSON.stringify(pecas) ||
      JSON.stringify(state.programas || []) !== JSON.stringify(programas);
    if (!mudou) return false;
    state.pecas = pecas;
    state.programas = programas;
    return true;
  }

  const api = { mergeCadastro, carregarCadastro, aplicarNoEstado, apenasAtivos, combinar, normalizarValidades, validadeToISO };
  global.RoteiroPecasBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
