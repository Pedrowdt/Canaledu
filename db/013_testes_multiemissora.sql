-- Testes de aceitação da migration 013.
-- Executar no harness PGlite depois das migrations 009–013.
-- O harness precisa ter auth.uid() apontando para o usuário de teste
-- 00000000-0000-0000-0000-000000000001.

DO $$
declare
  v_legacy uuid := '00000000-0000-0000-0000-000000000001';
  v_other uuid := '00000000-0000-0000-0000-000000000002';
  v_result jsonb;
  v_count integer;
  v_description text;
begin
  -- Pré-condições: o usuário legado acessa Canal Educação, não a emissora 2.
  if not public.fn_usuario_tem_acesso_emissora(v_legacy) then
    raise exception 'Falha: vínculo legado com Canal Educação não está ativo';
  end if;
  if public.fn_usuario_tem_acesso_emissora(v_other) then
    raise exception 'Falha: usuário de teste recebeu acesso inesperado à emissora 2';
  end if;

  -- A tentativa não autorizada deve falhar sem gravar nada.
  begin
    perform public.fn_salvar_pecas(
      '[{"code":"013_NEGADA","descricao":"não deve gravar"}]'::jsonb,
      '{}'::text[], v_other
    );
    raise exception 'Falha: escrita sem vínculo foi aceita';
  exception when insufficient_privilege then
    null;
  end;
  select count(*) into v_count from public.pecas where code = '013_NEGADA';
  if v_count <> 0 then raise exception 'Falha: escrita negada deixou registro'; end if;

  -- Dá acesso temporário ao usuário de teste à emissora 2 para os testes.
  insert into public.usuarios_emissoras (usuario_id, emissora_id, papel, ativo)
  values ('00000000-0000-0000-0000-000000000001', v_other, 'operador', true)
  on conflict (usuario_id, emissora_id) do update set papel = 'operador', ativo = true;

  -- Mesmo code em emissoras diferentes não deve colidir nem sobrescrever.
  perform public.fn_salvar_pecas(
    '[{"code":"013_SHARED_CODE","descricao":"Peça Canal Edu","tempo":"00:00:08","midia":"0OMN","type":"EVNH","categoria":"OUTROS","funcao":"vh_daqui_a_pouco","programa_relacionado":"PROG_A","h_fim":"13:00","freq":"1","obs":"teste campos"}]'::jsonb,
    '{}'::text[], v_legacy
  );
  perform public.fn_salvar_pecas(
    '[{"code":"013_SHARED_CODE","descricao":"Peça emissora 2","tempo":"00:00:09","midia":"1OMN","type":"EVNH","categoria":"OUTROS","funcao":"outro","programa_relacionado":"PROG_B"}]'::jsonb,
    '{}'::text[], v_other
  );

  select count(*) into v_count from public.pecas where code = '013_SHARED_CODE';
  if v_count <> 2 then raise exception 'Falha: código compartilhado não ficou isolado por emissora (count=%)', v_count; end if;
  select descricao into v_description from public.pecas where emissora_id = v_legacy and code = '013_SHARED_CODE';
  if v_description <> 'Peça Canal Edu' then raise exception 'Falha: gravação da emissora 2 sobrescreveu Canal Educação'; end if;

  -- Confere preservação dos campos usados pelas funções 006/007.
  if not exists (
    select 1 from public.pecas
     where emissora_id = v_legacy and code = '013_SHARED_CODE'
       and tempo = '00:00:08' and midia = '0OMN' and type = 'EVNH'
       and h_fim = '13:00' and freq = '1' and obs = 'teste campos'
       and funcao::text = 'vh_daqui_a_pouco' and programa_relacionado = 'PROG_A'
  ) then raise exception 'Falha: campos da peça não foram preservados'; end if;

  -- Conflito de versão não sobrescreve dado da mesma emissora.
  perform public.fn_salvar_pecas(
    '[{"code":"013_SHARED_CODE","descricao":"versão nova","row_version":1}]'::jsonb,
    '{}'::text[], v_legacy
  );
  v_result := public.fn_salvar_pecas(
    '[{"code":"013_SHARED_CODE","descricao":"snapshot velho","row_version":1}]'::jsonb,
    '{}'::text[], v_legacy
  );
  if jsonb_array_length(v_result->'conflitos') <> 1 then
    raise exception 'Falha: conflito de row_version não foi reportado: %', v_result;
  end if;

  -- Programas também aceitam o mesmo code nos dois tenants.
  perform public.fn_salvar_programas(
    '[{"code":"013_PROG_DUP","descricao":"Programa A","tempo":"00:26:00","midia":"0OMN","type":"RPRO","assinatura":"infantil","programa_titulo":"PROGRAMA A","temporada":1,"episodio":2,"bloco":1}]'::jsonb,
    '{}'::text[], v_legacy
  );
  perform public.fn_salvar_programas(
    '[{"code":"013_PROG_DUP","descricao":"Programa B","tempo":"00:25:00","midia":"0OMN","type":"RPRO","programa_titulo":"PROGRAMA B","temporada":2,"episodio":1,"bloco":2}]'::jsonb,
    '{}'::text[], v_other
  );
  select count(*) into v_count from public.programas where code = '013_PROG_DUP';
  if v_count <> 2 then raise exception 'Falha: mesmo code de programa não isolou por emissora'; end if;

  -- A assinatura antiga permanece operante e grava em Canal Educação.
  perform public.fn_salvar_pecas(
    '[{"code":"013_LEGACY","descricao":"contrato antigo"}]'::jsonb,
    '{}'::text[]
  );
  if not exists (
    select 1 from public.pecas where emissora_id = v_legacy and code = '013_LEGACY'
  ) then raise exception 'Falha: assinatura legada não grava no Canal Educação'; end if;

  -- Delete limitado ao tenant: apaga emissora 2, preserva Canal Educação.
  perform public.fn_salvar_pecas('[]'::jsonb, array['013_SHARED_CODE'], v_other);
  select count(*) into v_count from public.pecas where code = '013_SHARED_CODE';
  if v_count <> 1 or not exists (
    select 1 from public.pecas where emissora_id = v_legacy and code = '013_SHARED_CODE'
  ) then raise exception 'Falha: exclusão atravessou o limite da emissora'; end if;

  -- Limpeza dos registros temporários e do vínculo concedido pelo teste.
  perform public.fn_salvar_pecas('[]'::jsonb,
    array['013_SHARED_CODE','013_LEGACY','013_NEGADA'], v_legacy);
  perform public.fn_salvar_programas('[]'::jsonb, array['013_PROG_DUP'], v_legacy);
  perform public.fn_salvar_programas('[]'::jsonb, array['013_PROG_DUP'], v_other);
  delete from public.usuarios_emissoras
   where usuario_id = '00000000-0000-0000-0000-000000000001' and emissora_id = v_other;

  raise notice '013 validada: acesso, isolamento, campos, conflitos, deletes e retrocompatibilidade';
end $$;
