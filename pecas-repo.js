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
    };
  }

  /* ---------- init ---------- */
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
      return { pecas: (rp || []).map(pecaFromRow), programas: (rg || []).map(programaFromRow) };
    }
    const { data, error } = await client
      .from('shared_data')
      .select('pecas, programas')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error) throw error;
    return {
      pecas: (data?.pecas || []).map((p) => ({ id: p.id || uid(), ...p })),
      programas: (data?.programas || []).map((p) => ({ id: p.id || uid(), ...p })),
    };
  }

  /* ---------- escrita ---------- */
  async function saveCollection(table, rows, toRow) {
    const payload = rows.filter((r) => r && r.code).map(toRow);
    const codes = payload.map((r) => r.code);

    if (payload.length) {
      const { error } = await client.from(table).upsert(payload, { onConflict: 'code' });
      if (error) throw error;
    }
    // Remove o que saiu da tela (exclusões e "excluir todos").
    let del = client.from(table).delete();
    del = codes.length ? del.not('code', 'in', `(${codes.map((c) => `"${c}"`).join(',')})`) : del.neq('code', '__none__');
    const { error: delError } = await del;
    if (delError) throw delError;
  }

  /**
   * Persiste o estado completo do cadastro.
   * Em modo relacional grava nas tabelas (o trigger espelha em shared_data);
   * em modo legado grava o JSONB como antes.
   */
  async function saveAll({ pecas, programas, userId }) {
    if (mode === 'relational') {
      await saveCollection('pecas', pecas || [], pecaToRow);
      await saveCollection('programas', programas || [], programaToRow);
      return;
    }
    const { error } = await client
      .from('shared_data')
      .update({
        pecas: pecas || [],
        programas: programas || [],
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);
    if (error) throw error;
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
    pecasElegiveis,
    onRemoteChange,
    get mode() {
      return mode;
    },
    _map: { pecaFromRow, pecaToRow, programaFromRow, programaToRow },
  };
})(typeof window !== 'undefined' ? window : globalThis);
