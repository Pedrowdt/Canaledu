-- =============================================================
-- 011_vincular_emissora_dados.sql
-- Fase segura: associa os registros existentes à emissora original.
--
-- IMPORTANTE:
--   * Mantém intactas fn_salvar_pecas(jsonb,text[]) e
--     fn_salvar_programas(jsonb,text[]), instaladas pela migration 006.
--   * Mantém as constraints globais de unicidade de `code`.
--   * Ainda NÃO habilita gravação multiemissora nem isolamento por RLS.
--   * A substituição das funções e a troca para unicidade composta devem
--     ocorrer em migration posterior, junto com autorização usuário-emissora.
-- =============================================================

begin;

-- A emissora legada precisa existir antes de associar os registros.
do $$
begin
  if not exists (
    select 1
    from public.emissoras
    where id = '00000000-0000-0000-0000-000000000001'::uuid
  ) then
    raise exception
      'A emissora Canal Educação (00000000-0000-0000-0000-000000000001) não existe. Aplique 009_emissoras.sql antes de 011.';
  end if;
end;
$$;

-- Adiciona a coluna com default para que os registros existentes sejam
-- vinculados ao Canal Educação sem alterar seu conteúdo operacional.
alter table public.pecas
  add column if not exists emissora_id uuid
  default '00000000-0000-0000-0000-000000000001'::uuid;

update public.pecas
set emissora_id = '00000000-0000-0000-0000-000000000001'::uuid
where emissora_id is null;

alter table public.pecas
  alter column emissora_id set default '00000000-0000-0000-0000-000000000001'::uuid,
  alter column emissora_id set not null;

-- Faz o mesmo para programas, preservando o fluxo de gravação atual.
alter table public.programas
  add column if not exists emissora_id uuid
  default '00000000-0000-0000-0000-000000000001'::uuid;

update public.programas
set emissora_id = '00000000-0000-0000-0000-000000000001'::uuid
where emissora_id is null;

alter table public.programas
  alter column emissora_id set default '00000000-0000-0000-0000-000000000001'::uuid,
  alter column emissora_id set not null;

-- FK idempotente para instalações em que a coluna já existia sem a FK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pecas'::regclass
      and conname = 'pecas_emissora_id_fkey'
  ) then
    alter table public.pecas
      add constraint pecas_emissora_id_fkey
      foreign key (emissora_id) references public.emissoras(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.programas'::regclass
      and conname = 'programas_emissora_id_fkey'
  ) then
    alter table public.programas
      add constraint programas_emissora_id_fkey
      foreign key (emissora_id) references public.emissoras(id);
  end if;
end;
$$;

-- activity_log é opcional em algumas instalações. Mantém a coluna nullable,
-- pois logs antigos ou integrações podem não ter uma emissora identificável.
do $$
begin
  if to_regclass('public.activity_log') is not null then
    execute $sql$
      alter table public.activity_log
      add column if not exists emissora_id uuid
      default '00000000-0000-0000-0000-000000000001'::uuid
    $sql$;

    execute $sql$
      update public.activity_log
      set emissora_id = '00000000-0000-0000-0000-000000000001'::uuid
      where emissora_id is null
    $sql$;

    execute $sql$
      alter table public.activity_log
      alter column emissora_id set default '00000000-0000-0000-0000-000000000001'::uuid
    $sql$;

    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.activity_log'::regclass
        and conname = 'activity_log_emissora_id_fkey'
    ) then
      execute $sql$
        alter table public.activity_log
        add constraint activity_log_emissora_id_fkey
        foreign key (emissora_id) references public.emissoras(id)
      $sql$;
    end if;
  end if;
end;
$$;

-- As funções legadas de 006 usam ON CONFLICT (code). Preserve/garanta
-- unicidade global até a migration futura atualizar as funções com autorização
-- por emissora. Isso também repara um ambiente local onde a tentativa anterior
-- de 011 já tenha trocado a constraint por unicidade composta.
create unique index if not exists pecas_code_legacy_uidx
  on public.pecas (code);

create unique index if not exists programas_code_legacy_uidx
  on public.programas (code);

-- Índices para filtros por emissora; não mudam a unicidade nem o fluxo legado.
create index if not exists idx_pecas_emissora_id
  on public.pecas (emissora_id);

create index if not exists idx_programas_emissora_id
  on public.programas (emissora_id);

do $$
begin
  if to_regclass('public.activity_log') is not null then
    execute 'create index if not exists idx_activity_log_emissora_id on public.activity_log (emissora_id)';
  end if;
end;
$$;

commit;

-- Atualiza o cache de schema do PostgREST após a migration.
notify pgrst, 'reload schema';
