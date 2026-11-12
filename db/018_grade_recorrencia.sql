-- Persiste regras semanais, filas de episódios e exceções por emissora.
-- Mantém a grade base existente e o isolamento por (user_id, emissora_id).
alter table public.user_data
  add column if not exists grade_recorrencia jsonb not null default '{"slots":{},"episodeQueues":{},"dateExceptions":{}}'::jsonb;

notify pgrst, 'reload schema';
