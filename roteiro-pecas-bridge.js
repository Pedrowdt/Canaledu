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

  /**
   * Mescla o cadastro dentro do objeto `roteiroApp`.
   * IMPORTANTE: substitui pecas/programas (o cadastro manda),
   * mas NUNCA toca em roteiros/pecasDia/grade — esses são do
   * roteiro e pertencem a cada usuário.
   */
  function mergeCadastro(app, cadastro) {
    const base = app && typeof app === 'object' ? app : {};
    const pecas = apenasAtivos(cadastro && cadastro.pecas);
    const programas = apenasAtivos(cadastro && cadastro.programas);
    return Object.assign({}, base, {
      // Se o cadastro voltar vazio por falha de leitura, preservamos o
      // que já estava local para não zerar a tela do usuário.
      pecas: pecas.length ? pecas : base.pecas || [],
      programas: programas.length ? programas : base.programas || [],
    });
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
  function aplicarNoEstado(state, cadastro) {
    if (!state) return false;
    const pecas = apenasAtivos(cadastro && cadastro.pecas);
    const programas = apenasAtivos(cadastro && cadastro.programas);
    const mudou =
      JSON.stringify(state.pecas || []) !== JSON.stringify(pecas) ||
      JSON.stringify(state.programas || []) !== JSON.stringify(programas);
    if (!mudou) return false;
    state.pecas = pecas;
    state.programas = programas;
    return true;
  }

  const api = { mergeCadastro, carregarCadastro, aplicarNoEstado, apenasAtivos };
  global.RoteiroPecasBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
