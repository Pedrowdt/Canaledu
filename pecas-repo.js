// =====================================================
// PecasRepo — acesso ao banco de PEÇAS e PROGRAMAS
// (tabelas relacionais public.pecas / public.programas).
//
// Estratégia: usa as tabelas relacionais quando o schema
// db/001_pecas_programas.sql já foi aplicado; se elas não
// existirem ainda, cai automaticamente no formato antigo
// (shared_data.pecas / shared_data.programas em JSONB),
// para que nada pare de funcionar durante a migração.
//
// O espelho para shared_data é feito por trigger no banco,
// então a tela de confecção de roteiros continua lendo o
// cadastro sem nenhuma alteração.
// =====================================================
(function (global) {
  'use strict';

  const DIAS_VALIDOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const FAIXAS = ['infantil', 'jovem', 'adulto'];

  let client = null;
  let mode = 'unknown'; // 'relational' | 'legacy'
  let workspaceId = 'workspace';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const hhmm = (v) => (/^\d{2}:\d{2}$/.test(v || '') ? v : null);
  const hhmmss = (v) => (/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(v || '') ? v : '00:00:00');

  /* ---------- mapeamento banco <-> tela ---------- */
  function pecaFromRow(r) {
    return {
      id: r.id || uid(),
      code: r.code,
      descricao: r.descricao || '',
      tempo: r.tempo || '00:00:00',
      midia: r.midia || '0OMN',
      type: r.type || 'ECHE',
      categoria: r.categoria || 'OUTROS',
      validade: r.validade || '',
      dias: r.dias || [],
      hIni: r.h_ini || '',
      hFim: r.h_fim || '',
      freq: r.freq || '',
      obs: r.obs || '',
      posicao: r.posicao || '',
      ordem: r.ordem ?? 0,
      ativo: r.ativo !== false,
      rowVersion: r.row_version ?? null,
    };
  }

  function pecaToRow(p) {
    return {
      code: String(p.code || '').trim(),
      descricao: p.descricao || '',
      tempo: hhmmss(p.tempo),
      midia: p.midia || '0OMN',
      type: p.type || 'ECHE',
      categoria: p.categoria || 'OUTROS',
      validade: p.validade || null,
      dias: (p.dias || []).map((d) => String(d).toLowerCase()).filter((d) => DIAS_VALIDOS.includes(d)),
      h_ini: hhmm(p.hIni),
      h_fim: hhmm(p.hFim),
      freq: p.freq || null,
      obs: p.obs || '',
      posicao: p.posicao || null,
      ordem: Number(p.ordem) || 0,
      ativo: p.ativo !== false,
      row_version: p.rowVersion ?? null,
    };
  }

  function programaFromRow(r) {
    return {
      id: r.id || uid(),
      code: r.code,
      descricao: r.descricao || '',
      tempo: r.tempo || '00:00:00',
      midia: r.midia || '0OMN',
      type: r.type || 'RPRO',
      assinatura: r.assinatura ? [r.assinatura] : [],
      ativo: r.ativo !== false,
      rowVersion: r.row_version ?? null,
    };
  }

  function programaToRow(p) {
    const faixa = String((p.assinatura || [])[0] || '').toLowerCase();
    return {
      code: String(p.code || '').trim(),
      descricao: p.descricao || '',
      tempo: hhmmss(p.tempo),
      midia: p.midia || '0OMN',
      type: p.type || 'RPRO',
      assinatura: FAIXAS.includes(faixa) ? faixa : null,
      ativo: p.ativo !== false,
      row_version: p.rowVersion ?? null,
    };
  }

  /* ---------- init ---------- */
  // baseline = último estado conhecido do banco (por code) — base do DELTA.
  const baseline = { pecas: new Map(), programas: new Map() };

  /** Identidade do conteúdo de uma linha, ignorando row_version. */
  function fingerprint(row) {
    const { row_version, ...rest } = row;
    return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
  }

  function setBaseline(kind, rows, toRow) {
    const map = new Map();
    rows.forEach((r) => {
      const row = toRow(r);
      map.set(row.code, { fp: fingerprint(row), row_version: r.rowVersion ?? null });
    });
    baseline[kind] = map;
  }

  /** Linhas alteradas/novas em relação ao baseline (nunca a lista inteira). */
  function diff(kind, items, toRow) {
    const base = baseline[kind];
    const upserts = [];
    (items || []).filter((r) => r && r.code).forEach((item) => {
      const row = toRow(item);
      const prev = base.get(row.code);
      if (prev && prev.fp === fingerprint(row)) return; // nada mudou
      row.row_version = prev ? prev.row_version : null; // null = linha nova
      upserts.push(row);
    });
    return upserts;
  }

  async function init(supabaseClient, wsId) {
    client = supabaseClient;
    if (wsId) workspaceId = wsId;
    const { error } = await client.from('pecas').select('code').limit(1);
    mode = error ? 'legacy' : 'relational';
    if (error) console.warn('[PecasRepo] usando modo legado (shared_data):', error.message);
    return mode;
  }

  /* ---------- leitura ---------- */
  async function loadAll() {
    if (mode === 'relational') {
      const [{ data: rp, error: e1 }, { data: rg, error: e2 }] = await Promise.all([
        client.from('pecas').select('*').order('categoria').order('code'),
        client.from('programas').select('*').order('code'),
      ]);
      if (e1 || e2) throw e1 || e2;
      const pecas = (rp || []).map(pecaFromRow);
      const programas = (rg || []).map(programaFromRow);
      setBaseline('pecas', pecas, pecaToRow);
      setBaseline('programas', programas, programaToRow);
      return { pecas, programas };
    }
    const { data, error } = await client
      .from('shared_data')
      .select('pecas, programas')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    const pecas = (data?.pecas || []).map((p) => ({ id: p.id || uid(), ...p }));
    const programas = (data?.programas || []).map((p) => ({ id: p.id || uid(), ...p }));
    setBaseline('pecas', pecas, pecaToRow);
    setBaseline('programas', programas, programaToRow);
    return { pecas, programas };
  }

  /* ---------- escrita (DELTA) ---------- */
  function rpcAusente(error) {
    const msg = ((error && (error.message || error.details)) || '').toLowerCase();
    return msg.includes('does not exist') || msg.includes('could not find the function') || error?.code === 'PGRST202';
  }

  async function salvarTabela(kind, rpcName, upserts, deletes) {
    if (!upserts.length && !deletes.length) return { aplicados: 0, removidos: 0, conflitos: [] };
    const { data, error } = await client.rpc(rpcName, { p_upserts: upserts, p_deletes: deletes });
    if (error) {
      // Não existe mais caminho de escrita direta: as RPCs SECURITY DEFINER
      // são as ÚNICAS portas de gravação do cadastro (migração 006).
      if (rpcAusente(error)) {
        throw new Error(
          'As funções de gravação do cadastro (fn_salvar_pecas / fn_salvar_programas) ' +
          'não estão instaladas no banco. Aplique as migrações em db/ antes de salvar.'
        );
      }
      throw error;
    }
    return data || { aplicados: upserts.length, removidos: deletes.length, conflitos: [] };
  }

  /**
   * Grava APENAS o que mudou desde o último loadAll/saveDelta:
   *   - upserts: linhas novas ou editadas nesta tela
   *   - deletes: codes que o usuário excluiu explicitamente
   * Linhas criadas por outros usuários nunca são tocadas, e uma edição sobre
   * uma versão antiga volta como conflito em vez de sobrescrever.
   */
  async function saveDelta({ pecas, programas, deletedPecas = [], deletedProgramas = [], userId } = {}) {
    if (mode !== 'relational') {
      return await saveLegacy({ pecas, programas, deletedPecas, deletedProgramas, userId });
    }

    const upPecas = diff('pecas', pecas, pecaToRow);
    const upProgs = diff('programas', programas, programaToRow);
    const delPecas = [...new Set(deletedPecas.filter(Boolean))];
    const delProgs = [...new Set(deletedProgramas.filter(Boolean))];

    const [rp, rg] = [
      await salvarTabela('pecas', 'fn_salvar_pecas', upPecas, delPecas),
      await salvarTabela('programas', 'fn_salvar_programas', upProgs, delProgs),
    ];

    const conflitos = [...(rp.conflitos || []), ...(rg.conflitos || [])];
    return { conflitos, aplicados: (rp.aplicados || 0) + (rg.aplicados || 0), removidos: (rp.removidos || 0) + (rg.removidos || 0) };
  }

  /**
   * Modo legado (sem as tabelas relacionais): mescla o delta local com o que
   * está na nuvem AGORA, para não apagar o que outro usuário acabou de gravar.
   */
  async function saveLegacy({ pecas, programas, deletedPecas, deletedProgramas, userId }) {
    const remoto = await loadAllRemotoLegacy();
    const mescla = (remotos, locais, excluidos) => {
      const map = new Map((remotos || []).map((r) => [r.code, r]));
      (excluidos || []).forEach((code) => map.delete(code));
      (locais || []).filter((l) => l && l.code).forEach((l) => map.set(l.code, l));
      return [...map.values()];
    };
    const { error } = await client
      .from('shared_data')
      .update({
        pecas: mescla(remoto.pecas, pecas, deletedPecas),
        programas: mescla(remoto.programas, programas, deletedProgramas),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);
    if (error) throw error;
    return { conflitos: [], aplicados: (pecas || []).length, removidos: (deletedPecas || []).length };
  }

  async function loadAllRemotoLegacy() {
    const { data, error } = await client
      .from('shared_data')
      .select('pecas, programas')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    return { pecas: data?.pecas || [], programas: data?.programas || [] };
  }

  /**
   * Compatibilidade: deriva as exclusões comparando com o baseline DESTE
   * cliente (nunca apaga codes que este cliente nunca viu) e delega ao delta.
   */
  async function saveAll({ pecas, programas, userId }) {
    const presentes = (arr) => new Set((arr || []).filter((r) => r && r.code).map((r) => String(r.code)));
    const codesPecas = presentes(pecas);
    const codesProgs = presentes(programas);
    return await saveDelta({
      pecas,
      programas,
      deletedPecas: [...baseline.pecas.keys()].filter((c) => !codesPecas.has(c)),
      deletedProgramas: [...baseline.programas.keys()].filter((c) => !codesProgs.has(c)),
      userId,
    });
  }

  /** Peças elegíveis para um dia/horário — usado pela confecção de roteiros. */
  async function pecasElegiveis({ dow, hora } = {}) {
    if (mode !== 'relational') {
      const { pecas } = await loadAll();
      return pecas;
    }
    const { data, error } = await client.rpc('fn_pecas_elegiveis', {
      p_dow: dow ?? new Date().getDay(),
      p_hora: hora ?? new Date().toTimeString().slice(0, 5),
    });
    if (error) throw error;
    return (data || []).map(pecaFromRow);
  }

  /** Assina mudanças feitas por outros usuários. */
  function onRemoteChange(handler) {
    const tables = mode === 'relational' ? ['pecas', 'programas'] : ['shared_data'];
    const channel = client.channel('cadastro_pecas_programas');
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => handler(payload));
    });
    channel.subscribe();
    return () => client.removeChannel(channel);
  }

  global.PecasRepo = {
    init,
    loadAll,
    saveAll,
    saveDelta,
    pecasElegiveis,
    onRemoteChange,
    get mode() {
      return mode;
    },
    _map: { pecaFromRow, pecaToRow, programaFromRow, programaToRow },
    _diff: { diff, fingerprint, setBaseline, baseline },
  };
})(typeof window !== 'undefined' ? window : globalThis);
