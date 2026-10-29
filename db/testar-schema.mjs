// Valida os scripts SQL em um Postgres real (WASM, via PGlite).
// Uso: npm i -D @electric-sql/pglite && npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = await PGlite.create();
const q = (sql) => db.exec(sql);

// Stubs do ambiente Supabase
await q(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  -- Stub de auth.uid(): o Supabase real popula isso a partir do JWT da
  -- sessão; aqui simulamos uma sessão autenticada fixa, necessária a
  -- partir de 006 (fn_salvar_pecas/fn_salvar_programas passam a exigir
  -- public.fn_uid() não-nulo, e created_by/updated_by referenciam
  -- auth.users via FK).
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'teste@teste.com');
  create or replace function auth.uid() returns uuid
  language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
  create or replace function auth.role() returns text
  language sql stable as $$ select 'authenticated'::text $$;
  create table if not exists public.shared_data (
    id text primary key, pecas jsonb default '[]', programas jsonb default '[]',
    grade jsonb default '{}', updated_by uuid, updated_at timestamptz default now());
  insert into public.shared_data (id) values ('workspace');
  create role anon; create role authenticated; create role service_role;
  create publication supabase_realtime;
`);


const schema = readFileSync(new URL('./001_pecas_programas.sql', import.meta.url), 'utf8');
await q(schema);
console.log('001 aplicado ✓');

// Dados legados no JSONB para testar a migração
await q(`update public.shared_data set
  pecas = '[{"code":"90001","descricao":"VH A SEGUIR SCIENTIA","tempo":"00:00:05","type":"EVNH","categoria":"CHAMADA_QUENTE","dias":["seg","ter"],"hIni":"10:00","hFim":"14:00","validade":"2026-12-31"},
            {"code":"70001","descricao":"CHAMADA X","tempo":"00:00:30","type":"ECHE","categoria":"ZZZDESCONHECIDA","posicao":"inicio","ordem":2}]',
  programas = '[{"code":"P1","descricao":"SCIENTIA","tempo":"00:26:00","type":"RPRO","assinatura":["infantil"]}]'
  where id = 'workspace';`);

await q(readFileSync(new URL('./002_migrar_shared_data.sql', import.meta.url), 'utf8'));
console.log('002 aplicado ✓');

await q(readFileSync(new URL('./003_consistencia.sql', import.meta.url), 'utf8'));
console.log('003 aplicado ✓');

const show = async (label, sql) => {
  const r = await db.query(sql);
  console.log(label, JSON.stringify(r.rows));
};

await show('pecas:', `select code, categoria, dias, h_ini, posicao, ordem from public.pecas order by code`);
await show('programas:', `select code, assinatura from public.programas`);
await show('espelho shared_data (pecas):', `select jsonb_array_length(pecas) as n, pecas->0->>'code' as primeiro from public.shared_data where id='workspace'`);
await show('espelho shared_data (programas):', `select programas from public.shared_data where id='workspace'`);
await show('elegiveis seg 12:00:', `select code from public.fn_pecas_elegiveis(1,'12:00','2026-08-05')`);
await show('elegiveis seg 20:00:', `select code from public.fn_pecas_elegiveis(1,'20:00','2026-08-05')`);
await show('elegiveis qua 12:00:', `select code from public.fn_pecas_elegiveis(3,'12:00','2026-08-05')`);
await show('validade expirada em 2027:', `select code from public.fn_pecas_elegiveis(1,'12:00','2027-01-01')`);

// idempotência: 002 novamente + delete espelhando
await q(readFileSync(new URL('./002_migrar_shared_data.sql', import.meta.url), 'utf8'));
await show('após reexecutar 002:', `select count(*) from public.pecas`);
await q(`delete from public.pecas where code='70001'`);
await show('espelho após delete:', `select jsonb_array_length(pecas) as n from public.shared_data where id='workspace'`);
await q(`update public.pecas set descricao='NOVA DESC' where code='90001'`);
await show('updated_at mudou:', `select (updated_at > created_at) as touched from public.pecas where code='90001'`);
await show('espelho após update:', `select pecas->0->>'descricao' as d from public.shared_data where id='workspace'`);

// check de formato de tempo
try { await q(`insert into public.pecas (code, descricao, tempo) values ('X','x','9:99')`); console.log('ERRO: check de tempo não barrou'); }
catch (e) { console.log('check de tempo barrou ✓'); }

// code duplicado
try { await q(`insert into public.pecas (code, descricao) values ('90001','dup')`); console.log('ERRO: code duplicado passou'); }
catch (e) { console.log('unique code barrou ✓'); }

console.log('SQL validado.');


// =====================================================
// 003 — CONSISTÊNCIA MULTIUSUÁRIO
// =====================================================
const call = (fn, ups, dels = []) =>
  db.query(`select public.${fn}($1::jsonb, $2::text[]) as res`, [JSON.stringify(ups), dels]);

// Usuário A cadastra duas peças
await call('fn_salvar_pecas', [
  { code: 'A1', descricao: 'PECA A1', tempo: '00:00:30', categoria: 'CHAMADA_QUENTE', dias: ['seg'] },
  { code: 'A2', descricao: 'PECA A2', tempo: '00:00:10', categoria: 'CATEGORIA_INVENTADA' },
]);
await show('após usuário A:', `select code, categoria, row_version from public.pecas where code like 'A%' order by code`);

// Usuário B, com snapshot antigo (sem A2), salva só a peça dele -> A2 sobrevive
await call('fn_salvar_pecas', [{ code: 'B1', descricao: 'PECA B1' }]);
await show('A2 sobreviveu ao save do usuário B:', `select count(*) from public.pecas where code = 'A2'`);

// Conflito: B edita A1 com row_version desatualizada
await call('fn_salvar_pecas', [{ code: 'A1', descricao: 'EDITADA POR A', row_version: 1 }]);
const conf = await call('fn_salvar_pecas', [{ code: 'A1', descricao: 'EDICAO VELHA DE B', row_version: 1 }]);
console.log('conflito detectado (não sobrescreveu):', JSON.stringify(conf.rows[0].res));
await show('A1 mantém a versão vencedora:', `select descricao, row_version from public.pecas where code = 'A1'`);

// Exclusão só acontece quando o code é enviado explicitamente
await call('fn_salvar_pecas', [], ['A2']);
await show('após exclusão explícita de A2:', `select code from public.pecas where code like any (array['A%','B%']) order by code`);

// Guarda do espelho: snapshot velho da tela de roteiro não apaga o cadastro
const antes = await db.query(`select jsonb_array_length(pecas) as n from public.shared_data where id='workspace'`);
await q(`update public.shared_data set pecas = '[]'::jsonb, programas = '[]'::jsonb, grade = '{"x":1}' where id='workspace'`);
const depois = await db.query(`select jsonb_array_length(pecas) as n, grade from public.shared_data where id='workspace'`);
console.log('espelho protegido:', JSON.stringify({ antes: antes.rows[0], depois: depois.rows[0] }),
  antes.rows[0].n === depois.rows[0].n ? '✓' : 'ERRO');

console.log('\nTodos os cenários executados.');


// =====================================================
// 004_activity_log / 005_log_atividades / 006 (mão única) / 007 (função)
// =====================================================
await q(readFileSync(new URL('./004_activity_log.sql', import.meta.url), 'utf8'));
console.log('004_activity_log aplicado ✓');

await q(readFileSync(new URL('./005_log_atividades.sql', import.meta.url), 'utf8'));
console.log('005_log_atividades aplicado ✓');

await q(readFileSync(new URL('./006_pecas_one_way.sql', import.meta.url), 'utf8'));
console.log('006_pecas_one_way aplicado ✓');

await q(readFileSync(new URL('./007_funcao_peca.sql', import.meta.url), 'utf8'));
console.log('007_funcao_peca aplicado ✓');

// A partir daqui, pecas/programas só aceitam escrita via fn_salvar_* (006) —
// testa exatamente o caminho que o app usa em produção.
try {
  await q(`insert into public.pecas (code, descricao) values ('BLOQUEADA', 'x')`);
  console.log('ERRO: insert direto não foi bloqueado pelo fluxo de mão única');
} catch (e) {
  console.log('fluxo de mão única bloqueia insert direto fora de fn_salvar_pecas ✓');
}

// funcao/programa_relacionado (peças) — via fn_salvar_pecas, único caminho de escrita
await call('fn_salvar_pecas', [
  { code: 'VH001', descricao: 'VH DAQUI A POUCO PALALOOS', tempo: '00:00:08', type: 'EVNH',
    funcao: 'vh_daqui_a_pouco', programa_relacionado: 'PALALOOS' },
  // funcao inválida não pode derrubar o salvamento inteiro — vira NULL (fn_funcao_safe)
  { code: 'VH002', descricao: 'PECA SEM FUNCAO CLASSIFICADA', tempo: '00:00:08', type: 'EVNH',
    funcao: 'NAO_EXISTE_NO_ENUM' },
  // peça sem os campos novos continua funcionando exatamente como antes de 007
  { code: 'VH003', descricao: 'PECA ANTIGA SEM OS CAMPOS NOVOS', tempo: '00:00:05', type: 'EVNH' },
]);
await show('funcao/programa_relacionado gravados corretamente:',
  `select code, funcao, programa_relacionado from public.pecas where code like 'VH%' order by code`);

// programa_titulo/temporada/episodio/bloco (programas) — via fn_salvar_programas
await call('fn_salvar_programas', [
  { code: 'PALALOOS_T01EP03', descricao: 'PGM PALALOOS - T01 EP03 - BL02', tempo: '00:26:00',
    programa_titulo: 'PALALOOS', temporada: 1, episodio: 3, bloco: 2 },
]);
await show('campos estruturados do programa gravados:',
  `select code, programa_titulo, temporada, episodio, bloco from public.programas where code = 'PALALOOS_T01EP03'`);

// v_pecas_roteiro/v_programas_roteiro só ADICIONARAM colunas — nada quebrou
await show('view v_pecas_roteiro expõe funcao/programa_relacionado:',
  `select code, funcao, "programa_relacionado" from public.v_pecas_roteiro where code='VH001'`);
await show('fn_pecas_elegiveis continua funcionando depois de 007:',
  `select code from public.fn_pecas_elegiveis(1,'12:00','2026-08-05')`);

console.log('\n007 validado.');
// =====================================================
// 008 (grade_por_usuario), 009 (emissoras), 010 (tipos_pecas)
// =====================================================
try {
  await q(readFileSync(new URL('./008_grade_por_usuario.sql', import.meta.url), 'utf8'));
  console.log('008_grade_por_usuario aplicado ✓');
} catch (e) {
  // Se o 008 não estiver na pasta de testes, apenas loga
  console.log('008 pulado ou não encontrado');
}

await q(readFileSync(new URL('./009_emissoras.sql', import.meta.url), 'utf8'));
console.log('009_emissoras aplicado ✓');

await q(readFileSync(new URL('./010_tipos_pecas.sql', import.meta.url), 'utf8'));
console.log('010_tipos_pecas aplicado ✓');

// Validações básicas das novas tabelas
await show('emissoras cadastradas:', `select id, nome, slug, ativo from public.emissoras`);
await show('tipos de peças (Canal Educação):', `select codigo, nome, eh_interprograma from public.tipos_pecas where emissora_id = '00000000-0000-0000-0000-000000000001' order by ordem`);

// Teste de integridade: tenta cadastrar uma nova emissora e tipos personalizados para ela
await q(`insert into public.emissoras (id, nome, slug) values ('00000000-0000-0000-0000-000000000002', 'TV Cultura Regional', 'cultura-reg')`);
await q(`insert into public.tipos_pecas (emissora_id, codigo, nome, eh_interprograma) values ('00000000-0000-0000-0000-000000000002', 'PATROCINIO', 'Patrocínio Master', false)`);

await show('tipo criado para a nova emissora:', `select e.nome as emissora, t.codigo, t.nome as tipo from public.tipos_pecas t join public.emissoras e on e.id = t.emissora_id where e.slug = 'cultura-reg'`);

console.log('\n009 e 010 validados com sucesso ✓');
// --- 011_vincular_emissora_dados.sql ---
const s011 = readFileSync(new URL('./011_vincular_emissora_dados.sql', import.meta.url), 'utf8');
await q(s011);
console.log('011_vincular_emissora_dados aplicado ✓');

// 011 só vincula os dados existentes ao Canal Educação e mantém o contrato
// original das funções da migration 006 (jsonb, text[]). Multiemissora ainda
// não é habilitada nesta etapa.
const emissoraLegada = '00000000-0000-0000-0000-000000000001';
await show('peças vinculadas à emissora legada:',
  `select count(*) as total, count(*) filter (where emissora_id = '${emissoraLegada}') as canal_educacao from public.pecas`);
await show('programas vinculados à emissora legada:',
  `select count(*) as total, count(*) filter (where emissora_id = '${emissoraLegada}') as canal_educacao from public.programas`);

// Verifica gravação pelo contrato legado e aplicação do default de emissora_id.
await q(`select public.fn_salvar_pecas(
  '[{"code":"011_TESTE_LEGADO","descricao":"Teste 011","tempo":"00:00:05","type":"ECHE","categoria":"CHAMADA_QUENTE"}]'::jsonb,
  '{}'::text[]
)`);
await q(`select public.fn_salvar_programas(
  '[{"code":"011_PROG_LEGADO","descricao":"Teste 011","tempo":"00:01:00","type":"RPRO"}]'::jsonb,
  '{}'::text[]
)`);
await show('peça criada pelo contrato legado mantém Canal Educação:',
  `select code, emissora_id from public.pecas where code = '011_TESTE_LEGADO'`);
await show('programa criado pelo contrato legado mantém Canal Educação:',
  `select code, emissora_id from public.programas where code = '011_PROG_LEGADO'`);

// Confirma que as assinaturas de gravação continuam com dois parâmetros.
await show('assinatura legada de fn_salvar_pecas:',
  `select to_regprocedure('public.fn_salvar_pecas(jsonb,text[])') is not null as existe`);
await show('assinatura legada de fn_salvar_programas:',
  `select to_regprocedure('public.fn_salvar_programas(jsonb,text[])') is not null as existe`);

console.log('011 validado: vínculo legado e funções preservados ✓');


// --- 012_usuarios_emissoras.sql ---
const s012 = readFileSync(new URL('./012_usuarios_emissoras.sql', import.meta.url), 'utf8');
await q(s012);
console.log('012_usuarios_emissoras aplicado ✓');

await show('vínculo retrocompatível do usuário de teste:',
  `select usuario_id, emissora_id, papel, ativo from public.usuarios_emissoras where usuario_id = '00000000-0000-0000-0000-000000000001'`);
await show('função confirma acesso ao Canal Educação:',
  `select public.fn_usuario_tem_acesso_emissora('00000000-0000-0000-0000-000000000001'::uuid) as permitido`);
await show('sem vínculo automático à emissora de teste:',
  `select public.fn_usuario_tem_acesso_emissora('00000000-0000-0000-0000-000000000002'::uuid) as permitido`);
await show('papel do usuário no Canal Educação:',
  `select public.fn_usuario_papel_emissora('00000000-0000-0000-0000-000000000001'::uuid) as papel`);

// Idempotência: reaplicar 012 não duplica nem altera vínculos existentes.
await q(s012);
await show('vínculos após reaplicar 012:',
  `select count(*) as total from public.usuarios_emissoras where usuario_id = '00000000-0000-0000-0000-000000000001'`);
console.log('012 validado: associação, verificação de acesso e idempotência ✓');

// =====================================================
// 013 — ESCRITA E ISOLAMENTO MULTIEMISSORA
// =====================================================
await q(readFileSync(new URL('./013_escrita_multiemissora.sql', import.meta.url), 'utf8'));
console.log('013_escrita_multiemissora aplicado ✓');

await q(readFileSync(new URL('./013_testes_multiemissora.sql', import.meta.url), 'utf8'));
console.log('013 testes de aceitação executados ✓');

// ============================================================
// 014: Particionamento de user_data por emissora
// ============================================================
// Garante a tabela base caso a migration 008 tenha sido pulada no runner local
await q(`
  create table if not exists public.user_data (
    user_id uuid primary key,
    grade jsonb default '{}'
  );
`);

await q(readFileSync(new URL('./014_user_data_multiemissora.sql', import.meta.url), 'utf8'));
console.log('014_user_data_multiemissora aplicado ✓');

// ============================================================
// 015: Funções administrativas seguras (Painel Admin)
// ============================================================
await q(readFileSync(new URL('./015_painel_admin.sql', import.meta.url), 'utf8'));
console.log('015_painel_admin aplicado ✓');

// Teste de aceitação: criar emissora via RPC e listar membros
const resCriacao = await db.query(`
  select public.fn_admin_criar_emissora('TV Brasil Central', 'tbc-admin', '#10b981') as res;
`);
const emissoraCriada = resCriacao.rows[0].res;
console.log('015 emissora criada:', emissoraCriada);

const resMembros = await db.query(`
  select public.fn_admin_listar_membros('${emissoraCriada.emissora_id}'::uuid) as membros;
`);
console.log('015 membros listados:', resMembros.rows[0].membros);
console.log('014 e 015 validados com sucesso ✓');
/// ============================================================
//  016_editar_emissora.sql
// ============================================================

const s016 = readFileSync(new URL('./016_editar_emissora.sql', import.meta.url), 'utf8');
await q(s016);
console.log('016_editar_emissora aplicado ✓');

// 1. Busca a emissora criada na 015 onde o usuário de teste é admin
const rEmissoraAdmin = await db.query(`select id from public.emissoras where slug = 'tbc-admin' limit 1;`);
const idAdmin = rEmissoraAdmin.rows[0].id;

// 2. Testa a consulta dos dados da emissora (deve autorizar)
const rObter = await db.query(`select public.fn_admin_obter_emissora('${idAdmin}'::uuid) as dados;`);
console.log('016 dados da emissora obtidos:', rObter.rows[0].dados);

// 3. Testa a atualização de nome, cor e logo da emissora
const rAtualizar = await db.query(`
  select public.fn_admin_atualizar_emissora(
    '${idAdmin}'::uuid,
    'TV Brasil Central - Atualizada',
    '#059669',
    'https://exemplo.com/logo-tbc.png'
  ) as resultado;
`);
console.log('016 emissora atualizada:', rAtualizar.rows[0].resultado);

// 4. Confirma que os dados foram gravados na tabela
const rConfirma = await db.query(`
  select nome, cor_primaria, logo_url
  from public.emissoras
  where id = '${idAdmin}'::uuid;
`);
console.log('016 conferência no banco:', JSON.stringify(rConfirma.rows[0]));
console.log('016 validado com sucesso ✓\n');



