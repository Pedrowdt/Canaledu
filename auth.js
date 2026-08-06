// =====================================================
// AUTH — Autenticação única do Roteiro Canal Educação
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// POR QUE ESTE ARQUIVO EXISTE
// Antes, o login estava duplicado: uma implementação em
// cloud-sync.js (tela do Roteiro) e outra em
// pecas-programas.js (tela de Cadastro). Cada uma criava
// o seu próprio cliente Supabase, o que gerava dois
// "GoTrue clients" no mesmo navegador — causa clássica de
// sessão que "não entra", token renovado em duplicidade e
// logout que não propaga entre as telas.
//
// Agora existe UM único ponto de verdade:
//   window.CanalAuth
// que é usado pelas duas telas. O cliente Supabase é um
// singleton guardado em window.__canalSupabaseClient.
//
// RESPONSABILIDADES
//   1) criar/retornar o cliente Supabase (singleton);
//   2) restaurar a sessão persistida (com retentativas,
//      porque o SDK lê o localStorage de forma assíncrona);
//   3) login por e-mail/senha e logout;
//   4) proteger uma página (guard): sem sessão -> login
//      na própria página, guardando para onde voltar;
//   5) avisar as telas quando a sessão muda (login/logout
//      em outra aba, token expirado, etc.).
//
// COMO PROTEGER UMA PÁGINA (padrão usado nas duas telas):
//   const user = await CanalAuth.requireUser();
//   if (!user) { /* mostra formulário de login inline */ }
//
// Este arquivo é UMD: no navegador publica window.CanalAuth
// e, sob Node/Vitest, também exporta via module.exports —
// é assim que tests/unit/auth.test.mjs consegue testá-lo.
// =====================================================
(function (global) {
  'use strict';

  // Chave usada para lembrar em qual página o usuário estava
  // quando a sessão expirou, para voltar exatamente para lá
  // depois do login. Fica em sessionStorage (morre com a aba).
  const RETURN_KEY = 'canaledu:returnTo';

  // Quantas vezes / de quanto em quanto tempo tentamos
  // recuperar a sessão antes de considerar "não logado".
  // O SDK do Supabase pode responder `null` na primeira
  // chamada enquanto ainda está restaurando/renovando o
  // token do localStorage — daí as retentativas.
  const SESSION_RETRIES = 5;
  const SESSION_RETRY_MS = 400;

  /* =====================================================
     HELPERS PUROS (sem rede, sem DOM) — testáveis
     ===================================================== */

  /** Normaliza o e-mail digitado (evita falha de login por espaço/caixa). */
  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  /** Validação mínima de formulário, antes de gastar uma ida ao servidor. */
  function validateCredentials(email, password) {
    const e = normalizeEmail(email);
    if (!e) return 'Informe o e-mail.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'E-mail inválido.';
    if (!password) return 'Informe a senha.';
    if (String(password).length < 6) return 'A senha tem no mínimo 6 caracteres.';
    return null; // null = está tudo certo
  }

  /**
   * Traduz o erro técnico do Supabase para uma frase que a
   * equipe entende. Mensagem crua ("Invalid login credentials")
   * confunde quem só quer trabalhar.
   */
  function describeAuthError(error) {
    const msg = String((error && (error.message || error)) || '').toLowerCase();
    if (!msg) return 'Não foi possível entrar. Tente novamente.';
    if (msg.includes('invalid login')) return 'E-mail ou senha inválidos.';
    if (msg.includes('email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
    if (msg.includes('too many')) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.';
    if (msg.includes('user already registered')) return 'Este e-mail já possui acesso. Faça login.';
    return (error && error.message) || 'Não foi possível entrar. Tente novamente.';
  }

  /** A sessão é utilizável? (existe usuário e não está expirada) */
  function isSessionValid(session, nowSeconds) {
    if (!session || !session.user) return false;
    const now = typeof nowSeconds === 'number' ? nowSeconds : Math.floor(Date.now() / 1000);
    if (!session.expires_at) return true; // sem validade informada: confiamos no SDK
    return Number(session.expires_at) > now;
  }

  /**
   * Sanitiza o destino de retorno pós-login: só aceitamos
   * caminho relativo da própria aplicação. Isso impede que
   * um link malicioso (?returnTo=http://site-falso) leve o
   * usuário para fora depois de autenticar (open redirect).
   */
  function sanitizeReturnTo(value, fallback) {
    const fb = fallback || 'index.html';
    const raw = String(value || '').trim();
    if (!raw) return fb;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return fb; // http:, javascript:, data:...
    if (raw.startsWith('//')) return fb;             // //outro-dominio
    if (raw.startsWith('/')) return fb;              // caminho absoluto do host: não usamos
    if (raw.includes('..')) return fb;               // travessia de diretório
    return raw;
  }

  /* =====================================================
     CLIENTE SUPABASE (singleton)
     ===================================================== */

  /**
   * Lê as constantes de supabase-config.js. Atenção: `const` no topo de um
   * script clássico entra no escopo léxico global — existe como identificador
   * (SUPABASE_URL), mas NÃO como propriedade de window. Por isso lemos das
   * duas formas (window primeiro, para permitir injeção nos testes).
   */
  function configValue(nome) {
    if (global && typeof global[nome] !== 'undefined') return global[nome];
    try {
      // eslint-disable-next-line no-eval
      return eval(nome);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Retorna o cliente Supabase compartilhado, criando-o na
   * primeira chamada. Guardar em window evita o aviso
   * "Multiple GoTrueClient instances detected" e garante que
   * Roteiro e Cadastro leiam/gravem a MESMA sessão.
   */
  function getClient() {
    if (global.__canalSupabaseClient) return global.__canalSupabaseClient;

    const url = configValue('SUPABASE_URL');
    const anonKey = configValue('SUPABASE_ANON_KEY');
    if (!url || !anonKey) {
      throw new Error('Configuração pendente: preencha supabase-config.js (veja DEPLOY.md).');
    }
    if (typeof global.isSupabaseConfigured === 'function' && !global.isSupabaseConfigured()) {
      throw new Error('Configuração pendente: preencha supabase-config.js (veja DEPLOY.md).');
    }
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('Biblioteca do Supabase não carregou (verifique a conexão).');
    }

    global.__canalSupabaseClient = global.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,     // mantém logado ao recarregar a página
        autoRefreshToken: true,   // renova o token antes de expirar
        detectSessionInUrl: true, // suporta link de recuperação de senha
        storageKey: 'canaledu-auth',
      },
    });
    return global.__canalSupabaseClient;
  }

  /* =====================================================
     SESSÃO
     ===================================================== */

  /**
   * Recupera a sessão persistida, tentando algumas vezes.
   * `client` é injetável para permitir teste com cliente falso.
   */
  async function resolveSession(client, retries) {
    const c = client || getClient();
    const tentativas = typeof retries === 'number' ? retries : SESSION_RETRIES;
    for (let i = 0; i < tentativas; i++) {
      try {
        const { data } = await c.auth.getSession();
        if (isSessionValid(data && data.session)) return data.session;
      } catch (e) {
        console.error('[CanalAuth] getSession falhou:', e);
      }
      // Espera curta antes de tentar de novo (o SDK pode estar
      // restaurando o token do localStorage neste instante).
      if (i < tentativas - 1) await new Promise((r) => setTimeout(r, SESSION_RETRY_MS));
    }
    return null;
  }

  /** Usuário logado ou `null`. Não redireciona: quem chama decide. */
  async function requireUser(options) {
    const session = await resolveSession((options && options.client) || null, options && options.retries);
    return session ? session.user : null;
  }

  /** Login por e-mail/senha. Retorna { user } ou lança Error já traduzido. */
  async function signIn(email, password, options) {
    const c = (options && options.client) || getClient();
    const erroFormulario = validateCredentials(email, password);
    if (erroFormulario) throw new Error(erroFormulario);

    const { data, error } = await c.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: String(password),
    });
    if (error) throw new Error(describeAuthError(error));
    if (!data || !data.user) throw new Error('Login sem usuário retornado. Tente novamente.');
    return { user: data.user, session: data.session };
  }

  /**
   * Logout. Encerra a sessão nas DUAS telas (a sessão é a
   * mesma) e leva o usuário de volta ao ponto de entrada.
   */
  async function signOut(redirectTo, options) {
    const c = (options && options.client) || getClient();
    try {
      await c.auth.signOut();
    } catch (e) {
      console.warn('[CanalAuth] signOut falhou (seguindo assim mesmo):', e);
    }
    try {
      if (global.sessionStorage) global.sessionStorage.removeItem(RETURN_KEY);
    } catch (e) { /* modo privado pode bloquear: ignorar */ }
    if (redirectTo && global.location) global.location.href = sanitizeReturnTo(redirectTo);
  }

  /**
   * Observa mudanças de sessão. Serve para: logout feito em
   * outra aba, token expirado, ou login concluído em outro
   * lugar. `handler(evento, session)`.
   */
  function onAuthChange(handler, options) {
    const c = (options && options.client) || getClient();
    const { data } = c.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED / INITIAL_SESSION disparam com muita
      // frequência e não mudam quem é o usuário: filtramos.
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return;
      handler(event, session);
    });
    return () => data && data.subscription && data.subscription.unsubscribe();
  }

  /* --------- memória do destino pós-login (returnTo) --------- */

  function rememberReturnTo(path) {
    try {
      if (global.sessionStorage) global.sessionStorage.setItem(RETURN_KEY, sanitizeReturnTo(path));
    } catch (e) { /* ignora storage bloqueado */ }
  }

  function takeReturnTo(fallback) {
    let value = null;
    try {
      if (global.sessionStorage) {
        value = global.sessionStorage.getItem(RETURN_KEY);
        global.sessionStorage.removeItem(RETURN_KEY);
      }
    } catch (e) { /* ignora storage bloqueado */ }
    return sanitizeReturnTo(value, fallback);
  }

  const CanalAuth = {
    getClient,
    resolveSession,
    requireUser,
    signIn,
    signOut,
    onAuthChange,
    rememberReturnTo,
    takeReturnTo,
    // helpers puros expostos para os testes automatizados
    _helpers: { normalizeEmail, validateCredentials, describeAuthError, isSessionValid, sanitizeReturnTo },
  };

  global.CanalAuth = CanalAuth;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanalAuth;
})(typeof window !== 'undefined' ? window : globalThis);
