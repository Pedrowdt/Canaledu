// =====================================================
// CADASTRO SYNC — fila de pendências do banco de peças
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// PROBLEMA QUE ESTE MÓDULO RESOLVE
// A tela do Roteiro (banco-manager.js) criava, importava e
// excluía peças/programas apenas no estado local + localStorage.
// Nada disso subia para o cadastro na nuvem, porque o push do
// cloud-sync deixou de enviar pecas/programas.
// Resultado: assim que o OUTRO usuário salvava algo no cadastro,
// o tempo real trazia o cadastro da nuvem e a ponte substituía
// state.pecas — apagando da tela tudo que só existia localmente.
// Para o usuário, "as peças sumiram".
//
// A partir daqui, toda alteração feita no Roteiro entra numa
// FILA DE PENDÊNCIAS persistida em localStorage e é enviada ao
// cadastro relacional via PecasRepo.saveDelta (upsert por code +
// delete só dos codes explicitamente excluídos). Enquanto a
// pendência não foi confirmada pela nuvem, a ponte a mantém em
// tela — logo uma atualização feita por outro usuário nunca
// apaga trabalho ainda não sincronizado.
//
// UMD: publica window.CadastroSync e module.exports (testes).
// =====================================================
(function (global) {
  'use strict';

  const LS_KEY = 'cadastroPendentes';
  const DEBOUNCE_MS = 800;

  let client = null;
  let user = null;
  let workspaceId = 'workspace';
  let repo = null;
  let timer = null;
  let enviando = false;
  // FLUXO DE MÃO ÚNICA: só a tela de Cadastro (pecas-programas.js) pode
  // escrever no cadastro. Sem allowWrite:true todas as funções de escrita
  // viram no-op e apenas avisam no console.
  let allowWrite = false;

  function podeEscrever(fn) {
    if (allowWrite) return true;
    console.warn(
      `[cadastro-sync] ${fn}() ignorado: esta tela não tem permissão de escrita no cadastro. ` +
      'O fluxo é de mão única — só "Peças e Programas" grava em public.pecas/programas.'
    );
    return false;
  }

  const vazio = () => ({
    pecas: {},
    programas: {},
    excluidos: { pecas: [], programas: [] },
  });

  function log(evento, detalhe, opts) {
    if (global.CanalLog) global.CanalLog.registrar(evento, detalhe, opts);
  }

  function ler() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return vazio();
      return {
        pecas: raw.pecas || {},
        programas: raw.programas || {},
        excluidos: {
          pecas: (raw.excluidos && raw.excluidos.pecas) || [],
          programas: (raw.excluidos && raw.excluidos.programas) || [],
        },
      };
    } catch {
      return vazio();
    }
  }

  function gravar(fila) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(fila));
    } catch (e) {
      console.warn('[cadastro-sync] não foi possível persistir a fila', e);
    }
  }

  function total(fila) {
    const f = fila || ler();
    return (
      Object.keys(f.pecas).length +
      Object.keys(f.programas).length +
      f.excluidos.pecas.length +
      f.excluidos.programas.length
    );
  }

  /**
   * Pendências no formato que a ponte consome:
   * { pecas: [...], programas: [...], excluidos: { pecas: [], programas: [] } }
   */
  function pendentes() {
    const f = ler();
    return {
      pecas: Object.values(f.pecas),
      programas: Object.values(f.programas),
      excluidos: f.excluidos,
    };
  }

  function init({ client: c, user: u, workspaceId: w, repo: r, allowWrite: aw } = {}) {
    allowWrite = aw === true;
    if (c) client = c;
    if (u) user = u;
    if (w) workspaceId = w;
    repo = r || global.PecasRepo || null;
    if (!allowWrite) {
      console.info('[cadastro-sync] modo somente leitura (allowWrite ausente): nada será enviado ao cadastro.');
      return api;
    }
    if (total()) agendar(0); // reenvia o que ficou pendente da sessão anterior
    return api;
  }

  /** Marca itens criados/editados no Roteiro para subirem ao cadastro. */
  function marcarUpsert(kind, itens) {
    if (!podeEscrever('marcarUpsert')) return;
    const alvo = kind === 'programas' ? 'programas' : 'pecas';
    const fila = ler();
    const codes = [];
    (Array.isArray(itens) ? itens : [itens]).forEach((item) => {
      if (!item || !item.code) return;
      const code = String(item.code);
      fila[alvo][code] = Object.assign({}, item, { code });
      fila.excluidos[alvo] = fila.excluidos[alvo].filter((c) => c !== code);
      codes.push(code);
    });
    if (!codes.length) return;
    gravar(fila);
    log(alvo === 'pecas' ? 'pecas_alteradas_local' : 'programas_alterados_local', { quantidade: codes.length }, { codes });
    agendar();
  }

  /** Marca exclusões explícitas — a única coisa que autoriza DELETE na nuvem. */
  function marcarExclusao(kind, codes) {
    if (!podeEscrever('marcarExclusao')) return;
    const alvo = kind === 'programas' ? 'programas' : 'pecas';
    const fila = ler();
    const lista = (Array.isArray(codes) ? codes : [codes]).filter(Boolean).map(String);
    lista.forEach((code) => {
      delete fila[alvo][code];
      if (!fila.excluidos[alvo].includes(code)) fila.excluidos[alvo].push(code);
    });
    if (!lista.length) return;
    gravar(fila);
    log(alvo === 'pecas' ? 'pecas_excluidas_local' : 'programas_excluidos_local', { quantidade: lista.length }, { codes: lista });
    agendar();
  }

  function agendar(ms = DEBOUNCE_MS) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      flush().catch((e) => console.warn('[cadastro-sync] falha no envio', e));
    }, ms);
  }

  /**
   * Envia a fila para o cadastro relacional. Só limpa as pendências que a
   * nuvem confirmou; qualquer falha mantém a fila intacta para a próxima
   * tentativa (e a peça continua visível em tela).
   */
  async function flush() {
    if (enviando) return { enviados: 0, pendentes: total() };
    if (!allowWrite) return { enviados: 0, pendentes: total() };
    const repositorio = repo || global.PecasRepo;
    if (!repositorio || !client || !user) return { enviados: 0, pendentes: total() };

    const fila = ler();
    const enviadoPecas = Object.keys(fila.pecas);
    const enviadoProgs = Object.keys(fila.programas);
    const delPecas = fila.excluidos.pecas.slice();
    const delProgs = fila.excluidos.programas.slice();
    if (!enviadoPecas.length && !enviadoProgs.length && !delPecas.length && !delProgs.length) {
      return { enviados: 0, pendentes: 0 };
    }

    enviando = true;
    try {
      const res = await repositorio.saveDelta({
        pecas: Object.values(fila.pecas),
        programas: Object.values(fila.programas),
        deletedPecas: delPecas,
        deletedProgramas: delProgs,
        userId: user.id,
      });

      const conflitos = new Set(((res && res.conflitos) || []).map((c) => String(c.code)));
      // Remove da fila só o que subiu sem conflito. Itens em conflito ficam
      // pendentes de decisão do usuário e continuam visíveis.
      const atual = ler();
      enviadoPecas.forEach((code) => { if (!conflitos.has(code)) delete atual.pecas[code]; });
      enviadoProgs.forEach((code) => { if (!conflitos.has(code)) delete atual.programas[code]; });
      atual.excluidos.pecas = atual.excluidos.pecas.filter((c) => !delPecas.includes(c));
      atual.excluidos.programas = atual.excluidos.programas.filter((c) => !delProgs.includes(c));
      gravar(atual);

      log('cadastro_sync_ok', {
        aplicados: (res && res.aplicados) || 0,
        removidos: (res && res.removidos) || 0,
        conflitos: [...conflitos],
        restantes: total(atual),
      }, { codes: [...enviadoPecas, ...enviadoProgs], nivel: conflitos.size ? 'warn' : 'info' });

      return { enviados: enviadoPecas.length + enviadoProgs.length, pendentes: total(atual), conflitos: [...conflitos] };
    } catch (e) {
      log('cadastro_sync_falhou', { mensagem: e.message || String(e), pendentes: total() }, { nivel: 'error' });
      throw e;
    } finally {
      enviando = false;
    }
  }

  /* ---------- captura automática das alterações do Roteiro ---------- */
  // Assinatura do último estado já enfileirado, para não reenfileirar o
  // banco inteiro a cada saveState().
  const visto = { pecas: new Map(), programas: new Map() };

  function assinatura(item) {
    return JSON.stringify(
      Object.keys(item).filter((k) => k !== 'id').sort().map((k) => [k, item[k]])
    );
  }

  function mudados(kind, lista) {
    const mapa = visto[kind];
    const out = [];
    (lista || []).forEach((item) => {
      if (!item || !item.code) return;
      const code = String(item.code);
      const fp = assinatura(item);
      if (mapa.get(code) === fp) return;
      mapa.set(code, fp);
      out.push(item);
    });
    return out;
  }

  /**
   * Chamado pelo saveState() do Roteiro: enfileira para a nuvem tudo que foi
   * criado ou editado localmente. NUNCA deduz exclusões daqui — remover uma
   * peça do banco compartilhado exige marcarExclusao() explícito, senão um
   * estado local incompleto apagaria o cadastro da equipe.
   */
  function sincronizarEstado(state) {
    if (!state) return;
    if (!podeEscrever('sincronizarEstado')) return;
    marcarUpsert('pecas', mudados('pecas', state.pecas));
    marcarUpsert('programas', mudados('programas', state.programas));
  }

  const api = { init, marcarUpsert, marcarExclusao, sincronizarEstado, flush, pendentes, total, _LS_KEY: LS_KEY };
  global.CadastroSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
