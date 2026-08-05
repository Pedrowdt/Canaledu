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
