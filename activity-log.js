// =====================================================
// ActivityLog — log de atividades multiusuário
// Roteiro Canal Educação
//
// Registra ações relevantes (criar/editar/excluir peça ou
// programa, conflitos de edição simultânea, sincronização
// adiada por segurança) em dois lugares:
//   1) console (sempre, mesmo offline ou sem tabela ainda
//      migrada — nunca trava a tela por causa do log);
//   2) tabela public.log_atividades no Supabase, quando
//      disponível (ver db/005_log_atividades.sql), para dar
//      visibilidade real do que a equipe fez, útil para
//      investigar relatos como "uma peça sumiu".
//
// Uso:
//   ActivityLog.init(supabaseClient, { workspaceId, user });
//   ActivityLog.registrar('editar', 'peca', { codigo: 'X1', ... });
//   const entradas = await ActivityLog.listar(50);
//   ActivityLog.onNovaEntrada((entrada) => { ... });
// =====================================================
(function (global) {
  'use strict';

  let client = null;
  let workspaceId = 'workspace';
  let user = null;
  let tableDisponivel = null; // null = ainda não checou; true/false depois

  /** Atalho para registrar um erro (`entidade` default 'sistema'). Aceita um
   * objeto Error, uma string, ou detalhes já prontos. */
  function erro(mensagem, entidade = 'sistema', extra = {}) {
    const err = mensagem instanceof Error ? mensagem : null;
    return registrar('erro', entidade, {
      mensagem: err ? err.message : String(mensagem),
      stack: err && err.stack ? String(err.stack).split('\n').slice(0, 6).join('\n') : undefined,
      ...extra,
    });
  }

  let capturaGlobalAtiva = false;

  /**
   * Liga a captura automática de erros não tratados (exceções síncronas e
   * promises rejeitadas sem catch) direto no log — sem precisar espalhar
   * try/catch pelo código só para registrar. Chamado uma vez por init().
   */
  function ativarCapturaGlobal() {
    if (capturaGlobalAtiva || typeof window === 'undefined') return;
    capturaGlobalAtiva = true;

    window.addEventListener('error', (event) => {
      erro(event.error || event.message || 'Erro desconhecido', 'sistema', {
        origem: 'window.onerror',
        arquivo: event.filename,
        linha: event.lineno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      erro(reason instanceof Error ? reason : String(reason), 'sistema', {
        origem: 'unhandledrejection',
      });
    });
  }

  function init(supabaseClient, opts = {}) {
    client = supabaseClient;
    workspaceId = opts.workspaceId || 'workspace';
    user = opts.user || null;
    ativarCapturaGlobal();
  }

  function setUser(u) {
    user = u;
  }

  /**
   * Registra uma entrada de log. Nunca lança erro — uma falha ao gravar o
   * log não pode impedir a ação real do usuário (salvar, excluir, etc).
   */
  async function registrar(acao, entidade, detalhes = {}) {
    const entrada = {
      workspace_id: workspaceId,
      user_id: user?.id || null,
      user_email: user?.email || null,
      acao,
      entidade,
      codigo: detalhes.codigo || detalhes.code || null,
      detalhes,
      created_at: new Date().toISOString(),
    };

    // Sempre visível no console, com prefixo fácil de filtrar.
    console.info(`[log] ${acao}/${entidade}`, entrada);

    if (!client || tableDisponivel === false) return;

    try {
      const { error } = await client.from('log_atividades').insert({
        workspace_id: entrada.workspace_id,
        user_id: entrada.user_id,
        user_email: entrada.user_email,
        acao: entrada.acao,
        entidade: entrada.entidade,
        codigo: entrada.codigo,
        detalhes: entrada.detalhes,
      });
      if (error) {
        // Tabela ainda não migrada (db/004) — não insiste, só loga localmente.
        tableDisponivel = false;
        console.warn('[log] tabela log_atividades indisponível, mantendo log só no console:', error.message);
      } else {
        tableDisponivel = true;
      }
    } catch (e) {
      console.warn('[log] falha ao gravar log remoto:', e.message || e);
    }
  }

  /** Últimas N entradas do log (mais recentes primeiro). */
  async function listar(limit = 50) {
    if (!client) return [];
    try {
      const { data, error } = await client
        .from('log_atividades')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[log] falha ao listar log:', e.message || e);
      return [];
    }
  }

  /** Assina novas entradas em tempo real (para uma tela de log aberta). */
  function onNovaEntrada(handler) {
    if (!client) return () => {};
    const channel = client
      .channel('log_atividades_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'log_atividades', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => handler(payload.new)
      )
      .subscribe();
    return () => client.removeChannel(channel);
  }

  global.ActivityLog = { init, setUser, registrar, erro, listar, onNovaEntrada };

  // Ativa a captura de erros globais assim que o script carrega — não
  // precisa esperar o login/init para começar a registrar (mesmo que só no
  // console até o Supabase estar disponível).
  ativarCapturaGlobal();
})(typeof window !== 'undefined' ? window : globalThis);
