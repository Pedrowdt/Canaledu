// =====================================================
// PONTE DE CLASSIFICAÇÃO: CADASTRO (Peças e Programas) -> ROTEIRO
// GNU GPL v3 · Canal Educação / MEC · 2026
//
// O QUE ESTE MÓDULO RESOLVE
// -------------------------
// A vinheta de assinatura (VH ASSINATURA_INFANTIL / _JOVEM / _ADULTO)
// inserida ao fim de cada programa era decidida SOMENTE por configuração
// da instância Roteiro (painel Admin):
//
//     1) mapa `classificacaoPrograma` (modal "Classificação por programa");
//     2) listas de palavras-chave (`vhAssinatura*Keywords`);
//     3) padrão "jovem".
//
// A partir desta versão a FONTE DA VERDADE passa a ser a TAG marcada no
// cadastro do programa, na instância **Peças e Programas** (campo
// `assinatura` — enum `faixa_assinatura`: infantil | jovem | adulto).
// A configuração do Admin vira FALLBACK, usada apenas quando o programa
// não existe no cadastro ou está sem tag.
//
// Nova ordem de decisão:
//
//     0) TAG do cadastro do programa            <- NOVO (decisório)
//     1) mapa `classificacaoPrograma` (Admin)   <- fallback
//     2) palavras-chave (Admin)                 <- fallback
//     3) padrão "jovem"                         <- fallback
//
// COMO O PROGRAMA DO ROTEIRO É CASADO COM O CADASTRO
// --------------------------------------------------
//   a) por `code` (match forte e exato — é o mesmo código do sistema);
//   b) por título base normalizado (sem "PGM ", sem "T01 EP02",
//      sem "- BL 03", sem parênteses/minutagem, sem acento, maiúsculas).
//
// O item do roteiro é um BLOCO ("PGM PALALOOS - T01 EP05 - BL 02"), e o
// cadastro guarda o programa ("PALALOOS"); por isso a normalização.
//
// DESENHO
// -------
// Módulo puro (sem DOM, sem estado global) e UMD: publica
// `window.AssinaturaPrograma` para as telas e `module.exports` para os
// testes em Node. Se nada for encontrado, devolve `null` e o chamador
// mantém exatamente o comportamento antigo — a mudança é aditiva e
// seguramente reversível.
// =====================================================
(function (global) {
  'use strict';

  /** Faixas válidas (espelha o enum `faixa_assinatura` do banco). */
  const FAIXAS = ['infantil', 'jovem', 'adulto'];

  /** Remove acentos, colapsa espaços, devolve MAIÚSCULAS. */
  function normalizeKey(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /**
   * Título base do programa. Mesmas regras de `baseProgramTitle` do
   * app.js / src/core/normalize.js — replicadas aqui de propósito para
   * este arquivo poder ser carregado por <script> simples, sem bundler.
   */
  function baseProgramTitle(desc) {
    return String(desc || '')
      .replace(/^\s*PGM\s+/i, '')
      .replace(/\s*-\s*T\s*\d+\s*EP\s*\d+.*$/i, '')
      .replace(/\s*T\d+\s*EP\s*\d+.*$/i, '')
      .replace(/\s*-\s*BL\s*\d+\s*$/i, '')
      .replace(/\s*BL\s*\d+\s*$/i, '')
      .replace(/\s*\(.*?\)\s*$/, '')
      .replace(/\s*\d+'\s*$/, '')
      .trim();
  }

  /** Chave de comparação de programa: título base normalizado. */
  function progKey(desc) {
    return normalizeKey(baseProgramTitle(desc));
  }

  /**
   * Extrai a faixa de um registro de programa do cadastro.
   * O campo aceita as duas formas que circulam no sistema:
   *   - string: 'infantil' (como vem da coluna do Postgres)
   *   - array:  ['infantil'] (como a UI de Peças e Programas grava)
   * Retorna 'infantil' | 'jovem' | 'adulto' | null.
   */
  function faixaDoRegistro(prog) {
    if (!prog) return null;
    const bruto = Array.isArray(prog.assinatura) ? prog.assinatura[0] : prog.assinatura;
    const faixa = String(bruto || '').trim().toLowerCase();
    return FAIXAS.includes(faixa) ? faixa : null;
  }

  /**
   * Monta o índice de consulta a partir da lista de programas cadastrados.
   * Programas inativos (`ativo === false`) e sem tag são ignorados — não
   * devem influenciar o roteiro.
   *
   * @param {Array} programas lista vinda de state.programas / cadastro
   * @returns {{porCode: Map<string,string>, porTitulo: Map<string,string>}}
   */
  function buildIndex(programas) {
    const porCode = new Map();
    const porTitulo = new Map();
    (programas || []).forEach((p) => {
      if (!p || p.ativo === false) return;
      const faixa = faixaDoRegistro(p);
      if (!faixa) return; // sem tag => não decide nada, cai no fallback
      if (p.code) porCode.set(String(p.code).trim(), faixa);
      const key = progKey(p.descricao);
      // O primeiro cadastro com tag vence: evita que uma reprise/variante
      // homônima cadastrada depois troque a faixa silenciosamente.
      if (key && !porTitulo.has(key)) porTitulo.set(key, faixa);
    });
    return { porCode, porTitulo };
  }

  /**
   * Descobre a faixa de um item do roteiro consultando o cadastro.
   *
   * @param {Object|string} item  bloco do roteiro ({code, descricao}) ou só a descrição
   * @param {Array|Object} fonte  lista de programas OU um índice de buildIndex()
   * @returns {'infantil'|'jovem'|'adulto'|null} null = cadastro não decide
   */
  function faixaDoCadastro(item, fonte) {
    if (!fonte) return null;
    const idx = fonte.porCode && fonte.porTitulo ? fonte : buildIndex(fonte);
    const obj = typeof item === 'string' ? { descricao: item } : item || {};

    // (a) match por code — exato, imune a variação de título
    if (obj.code) {
      const porCode = idx.porCode.get(String(obj.code).trim());
      if (porCode) return porCode;
    }
    // (b) match por título base normalizado
    const key = progKey(obj.descricao);
    return (key && idx.porTitulo.get(key)) || null;
  }

  /**
   * Resolve a faixa final, com a origem da decisão (útil para log/diagnóstico).
   *
   * @param {Object|string} item     bloco do roteiro
   * @param {Object} regras          REGRAS do Admin (fallback)
   * @param {Array|Object} programas cadastro (lista ou índice)
   * @returns {{faixa:string, origem:'cadastro'|'admin'|'keywords'|'padrao'}}
   */
  function resolverFaixa(item, regras, programas) {
    const r = regras || {};
    const obj = typeof item === 'string' ? { descricao: item } : item || {};

    // 0) TAG do cadastro (Peças e Programas) — decisório
    const doCadastro = faixaDoCadastro(obj, programas);
    if (doCadastro) return { faixa: doCadastro, origem: 'cadastro' };

    // 1) FALLBACK — classificação explícita do modal do painel Admin
    const explicita = (r.classificacaoPrograma || {})[progKey(obj.descricao)];
    if (FAIXAS.includes(explicita)) return { faixa: explicita, origem: 'admin' };

    // 2) FALLBACK — palavras-chave configuradas no Admin
    const u = normalizeKey(obj.descricao);
    const kw = (txt) => String(txt || '').split(',').map((k) => k.trim()).filter(Boolean);
    if (kw(r.vhAssinaturaInfantilKeywords).some((k) => u.includes(normalizeKey(k)))) {
      return { faixa: 'infantil', origem: 'keywords' };
    }
    if (kw(r.vhAssinaturaAdultoKeywords).some((k) => u.includes(normalizeKey(k)))) {
      return { faixa: 'adulto', origem: 'keywords' };
    }

    // 3) FALLBACK final — jovem
    return { faixa: 'jovem', origem: 'padrao' };
  }

  /** Config/valores padrão da VH por faixa (mesmos codes históricos). */
  const PADRAO = {
    infantil: { chave: 'vhAssinaturaInfantil', code: '85331', descricao: 'ASSINATURA_INFANTIL' },
    jovem: { chave: 'vhAssinaturaJovem', code: '85330', descricao: 'ASSINATURA_JOVEM' },
    adulto: { chave: 'vhAssinaturaAdulto', code: '85332', descricao: 'ASSINATURA_ADULTO' },
  };

  /**
   * Monta o item de VH de assinatura pronto para entrar no roteiro.
   * Respeita `ativo:false` da faixa (nesse caso nada é inserido).
   *
   * @returns {Object|null} item do roteiro ou null
   */
  function montarVhAssinatura(item, regras, programas) {
    const r = regras || {};
    const { faixa, origem } = resolverFaixa(item, regras, programas);
    const meta = PADRAO[faixa] || PADRAO.jovem;
    const cfg = r[meta.chave] || {};
    if (cfg.ativo === false) return null;
    return {
      code: cfg.code || meta.code,
      descricao: cfg.descricao || meta.descricao,
      tempo: cfg.tempo || '00:00:05',
      midia: '0OMN',
      type: 'EVNH',
      // Rastro da decisão — não afeta exportação, ajuda no diagnóstico.
      _assinaturaFaixa: faixa,
      _assinaturaOrigem: origem,
    };
  }

  const api = {
    FAIXAS,
    normalizeKey,
    baseProgramTitle,
    progKey,
    faixaDoRegistro,
    buildIndex,
    faixaDoCadastro,
    resolverFaixa,
    montarVhAssinatura,
  };

  global.AssinaturaPrograma = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
