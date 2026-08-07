// =====================================================
// CANAL LOG — trilha de auditoria da equipe
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// Por que existe: com dois ou mais usuários no mesmo banco
// compartilhado, "a peça sumiu" só é investigável se houver
// registro de quem gravou, quem excluiu e o que a nuvem
// devolveu em cada sincronização.
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
//
// UMD: publica window.CanalLog e module.exports (testes em Node).
// =====================================================
(function (global) {
  'use strict';

  const LS_KEY = 'canalLog';
  const MAX_LOCAL = 300;

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
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function gravarLocal(entrada) {
    try {
      const arr = ler();
      arr.push(entrada);
      localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(-MAX_LOCAL)));
    } catch (e) {
      // Cota cheia / storage bloqueado: o console ainda tem o evento.
      console.warn('[log] não foi possível gravar o log local', e);
    }
  }

  /**
   * Registra um evento.
   * @param {string} evento  identificador curto (peca_criada, sync_ok...)
   * @param {object} detalhe dados livres (contagens, mensagens de erro...)
   * @param {object} opts    { codes: string[], nivel: 'info'|'warn'|'error' }
   */
  function registrar(evento, detalhe = {}, { codes = [], nivel = 'info' } = {}) {
    const entrada = {
      criado_em: new Date().toISOString(),
      tela,
      evento,
      nivel,
      codes: (codes || []).filter(Boolean).map(String),
      user_email: (user && user.email) || null,
      detalhe,
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
          detalhe,
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
    localStorage.removeItem(LS_KEY);
  }

  const api = { init, registrar, recentes, equipe, exportar, limparLocal };
  global.CanalLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
