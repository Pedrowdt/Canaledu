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
