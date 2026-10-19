// =====================================================
// CANAL LOG — trilha de auditoria da equipe e diagnóstico de erros
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// Por que existe: com dois ou mais usuários no mesmo banco
// compartilhado, "a peça sumiu" ou falhas de execução só são
// investigáveis se houver registro de quem gravou, quem excluiu,
// o que a nuvem devolveu e contexto dos erros ocorridos.
//
// Como funciona:
//   1) Todo evento vai para o console (com prefixo [log]).
//   2) Todo evento entra num anel local (localStorage,
//      últimos 300), disponível offline via CanalLog.recentes()
//      e exportável em JSON por CanalLog.exportar().
//   3) Se houver sessão Supabase, o evento também é gravado em
//      public.activity_log (db/004_activity_log.sql). Falha de
//      rede nunca interrompe a ação do usuário: o log remoto é
//      best-effort e o registro local permanece.
//   4) Captura global de erros com categorização automática,
//      rastro recente (breadcrumbs) e deduplicação de disparos repetidos.
//
// UMD: publica window.CanalLog e module.exports (testes em Node).
// =====================================================
(function (global) {
  'use strict';

  const LS_KEY = 'canalLog';
  const MAX_LOCAL = 300;

  const breadcrumbsList = [];

  function adicionarBreadcrumb(acao) {
    if (!acao) return;
    breadcrumbsList.push(String(acao));
    if (breadcrumbsList.length > 5) breadcrumbsList.shift();
  }

  let client = null;
  let user = null;
  let tela = 'desconhecida';
  let workspaceId = 'workspace';

  function init({ client: c, user: u, tela: t, workspaceId: w } = {}) {
    if (c) client = c;
    if (u) user = u;
    if (t) tela = t;
    if (w) workspaceId = w;
    return api;
  }

  function ler() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function gravarLocal(entrada) {
    try {
      if (typeof localStorage === 'undefined') return;
      const arr = ler();
      arr.push(entrada);
      localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(-MAX_LOCAL)));
    } catch (e) {
      // Cota cheia / storage bloqueado: o console ainda tem o evento.
      console.warn('[log] não foi possível gravar o log local', e);
    }
  }

  /**
   * Classifica uma mensagem/stack de erro em categorias úteis para diagnóstico.
   * @param {string} mensagem
   * @param {string} [stack]
   * @returns {'inicializacao'|'rede_nuvem'|'armazenamento'|'interface_dom'|'geral'}
   */
  function classificarErro(mensagem, stack) {
    const texto = `${mensagem || ''} ${stack || ''}`.toLowerCase();
    if (
      texto.includes('is not defined') ||
      texto.includes('referenceerror') ||
      texto.includes('syntaxerror') ||
      texto.includes('debounce') ||
      texto.includes('is not a function') ||
      (texto.includes('cannot read properties of undefined') && !texto.includes('queryselector'))
    ) {
      return 'inicializacao';
    }
    if (
      texto.includes('fetch') ||
      texto.includes('network') ||
      texto.includes('supabase') ||
      texto.includes('failed to fetch') ||
      texto.includes('jwt') ||
      texto.includes('auth') ||
      texto.includes('timeout')
    ) {
      return 'rede_nuvem';
    }
    if (
      texto.includes('quota') ||
      texto.includes('localstorage') ||
      texto.includes('quotaexceedederror') ||
      texto.includes('storage')
    ) {
      return 'armazenamento';
    }
    if (
      texto.includes('addeventlistener') ||
      (texto.includes('null') && texto.includes('reading')) ||
      texto.includes('queryselector') ||
      texto.includes('classlist') ||
      texto.includes('innerhtml')
    ) {
      return 'interface_dom';
    }
    return 'geral';
  }

  /**
   * Extrai o contexto de execução atual (URL, rota, data de roteiro selecionada).
   */
  function extrairContextoAtual() {
    const ctx = {};
    try {
      if (typeof window !== 'undefined') {
        ctx.url = window.location ? (window.location.pathname || window.location.href) : '';
        if (window.state && window.state.currentDate) {
          ctx.data_roteiro = typeof window.dateKey === 'function' ? window.dateKey(window.state.currentDate) : String(window.state.currentDate);
        }
      }
    } catch {}
    return ctx;
  }

  /**
   * Registra um evento.
   * @param {string} evento  identificador curto (peca_criada, sync_ok...)
   * @param {object} detalhe dados livres (contagens, mensagens de erro...)
   * @param {object} opts    { codes: string[], nivel: 'info'|'warn'|'error' }
   */
  function registrar(evento, detalhe = {}, { codes = [], nivel = 'info' } = {}) {
    const detalheClone = { ...(detalhe || {}) };

    // Se for erro não tratado ou erro explícito sem categoria, categorizar automaticamente
    const ehErro = nivel === 'error' || evento === 'erro_nao_tratado' || String(evento).startsWith('erro_');
    if (ehErro && !detalheClone.categoria) {
      detalheClone.categoria = classificarErro(detalheClone.mensagem, detalheClone.stack);
    }
    if (ehErro && !detalheClone.url && typeof window !== 'undefined' && window.location) {
      detalheClone.url = window.location.pathname || window.location.href || '';
    }
    if (ehErro && !detalheClone.contexto) {
      const ctx = extrairContextoAtual();
      if (Object.keys(ctx).length) detalheClone.contexto = ctx;
    }
    if (ehErro && !detalheClone.breadcrumbs && breadcrumbsList.length) {
      detalheClone.breadcrumbs = [...breadcrumbsList];
    }

    const entrada = {
      criado_em: new Date().toISOString(),
      tela,
      evento,
      nivel,
      codes: (codes || []).filter(Boolean).map(String),
      user_email: (user && user.email) || null,
      detalhe: detalheClone,
    };

    const fn = nivel === 'error' ? console.error : nivel === 'warn' ? console.warn : console.info;
    fn('[log]', evento, entrada);
    gravarLocal(entrada);

    if (client && user) {
      client
        .from('activity_log')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          user_email: user.email || null,
          tela,
          evento,
          nivel,
          codes: entrada.codes,
          detalhe: detalheClone,
        })
        .then(({ error }) => {
          if (error) console.warn('[log] falha ao enviar evento para a nuvem:', error.message);
        });
    }

    return entrada;
  }

  /** Últimos eventos registrados neste navegador (mais novos por último). */
  function recentes(n = 50) {
    return ler().slice(-n);
  }

  /** Últimos eventos da equipe (todos os usuários) direto da nuvem. */
  async function equipe(n = 100) {
    if (!client) return [];
    const { data, error } = await client
      .from('activity_log')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(n);
    if (error) {
      console.warn('[log] falha ao ler o log da equipe:', error.message);
      return [];
    }
    return data || [];
  }

  /** Baixa o log local em JSON — útil para anexar num relato de problema. */
  function exportar() {
    const blob = new Blob([JSON.stringify(ler(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'canal-log-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function limparLocal() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_KEY);
    }
  }

  /** Assina novas entradas em tempo real (para uma tela de log aberta). */
  function onNovaEntrada(handler) {
    if (!client) return () => {};
    const channel = client
      .channel('activity_log_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => handler(payload.new)
      )
      .subscribe();
    return () => client.removeChannel(channel);
  }

  let capturaGlobalAtiva = false;
  let ultimoErroHash = '';
  let ultimoErroTimestamp = 0;
  let errosRepetidosContador = 0;

  function processarErroGlobal(dados) {
    const agora = Date.now();
    const hash = `${dados.mensagem || ''}|${dados.arquivo || ''}|${dados.linha || ''}`;

    // Deduplicação: se o mesmo erro disparar em cascata em menos de 2.5s, evita poluição
    if (hash === ultimoErroHash && agora - ultimoErroTimestamp < 2500) {
      errosRepetidosContador++;
      return;
    }

    if (errosRepetidosContador > 0) {
      dados.repeticoes_suprimidas = errosRepetidosContador;
      errosRepetidosContador = 0;
    }

    ultimoErroHash = hash;
    ultimoErroTimestamp = agora;

    // Breadcrumbs: últimos 3 eventos que antecederam este erro
    try {
      const eventosAnteriores = ler().slice(-3).map(e => `${e.criado_em ? e.criado_em.slice(11, 19) : ''} [${e.tela}] ${e.evento}`);
      if (eventosAnteriores.length) dados.historico_recente = eventosAnteriores;
    } catch {}

    registrar('erro_nao_tratado', dados, { nivel: 'error' });
  }

  /**
   * Liga a captura automática de erros não tratados (exceções síncronas e
   * promises rejeitadas sem catch) direto no log — sem precisar espalhar
   * try/catch pelo código só para registrar. Chamada uma vez por init().
   */
  function ativarCapturaGlobal() {
    if (capturaGlobalAtiva || typeof window === 'undefined') return;
    capturaGlobalAtiva = true;

    window.addEventListener('error', (event) => {
      const err = event.error;
      processarErroGlobal({
        mensagem: (err && err.message) || event.message || 'Erro desconhecido',
        stack: err && err.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : undefined,
        arquivo: event.filename,
        linha: event.lineno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      processarErroGlobal({
        mensagem: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error && reason.stack ? String(reason.stack).split('\n').slice(0, 8).join('\n') : undefined,
        origem: 'unhandledrejection',
      });
    });
  }

  const api = {
    init,
    registrar,
    recentes,
    equipe,
    exportar,
    limparLocal,
    onNovaEntrada,
    classificarErro,
    extrairContextoAtual,
    adicionarBreadcrumb,
    registrarAcao: adicionarBreadcrumb,
  };
  global.CanalLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // Ativa a captura de erros globais assim que o script carrega
  ativarCapturaGlobal();
})(typeof window !== 'undefined' ? window : globalThis);
