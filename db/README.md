# Banco de dados — Peças e Programas

## O que é

O cadastro de **Peças e Programas** deixou de viver em um único campo JSONB e passou
a ter tabelas relacionais próprias, que são a **fonte da verdade** do sistema e
**alimentam automaticamente a confecção de roteiros**.

```
pecas ─┐
       ├─► triggers de espelho ─► shared_data.pecas / .programas (JSONB legado)
programas ─┘                          │
                                      └─► tela de roteiro (app.js / roteiroBuilder)
```

Assim, tudo que é cadastrado aparece no roteiro sem nenhuma etapa manual, e o código
antigo que lia `shared_data` continua funcionando.

## Como aplicar (Supabase → SQL Editor → New query → Run)

1. `001_pecas_programas.sql` — cria tabelas, tipos, índices, GRANTs, RLS, views,
   a função de elegibilidade e os triggers de espelho. É **idempotente**.
2. `002_migrar_shared_data.sql` — importa o que já existe em `shared_data`
   (JSONB) para as tabelas novas. Roda dentro de uma transação e pode ser
   reexecutado sem duplicar (upsert por `code`).
3. `003_consistencia.sql` — `row_version` (optimistic locking) e gravação por
   delta com detecção de conflito. Ver CONSISTENCIA.md.
4. `004_activity_log.sql` — cria `public.activity_log`, usada por
   `canal-log.js` (`CanalLog`) para registrar o que a equipe faz nas duas
   telas (peças/programas salvos, sincronizações adiadas, erros não
   tratados...). Opcional: sem ela o log continua funcionando só em
   console + `localStorage` (best-effort, nunca bloqueia a ação do usuário).
5. `005_log_atividades.sql` — evolução de `004_activity_log.sql` (tabela
   `log_atividades`, mesma finalidade).
6. `006_pecas_one_way.sql` — fluxo de mão única: só a tela "Peças e
   Programas" pode gravar em `pecas`/`programas` (REVOKE + RLS + trigger de
   escopo). O Roteiro passa a ser somente leitura no banco.
7. `004_autenticacao.sql` — revoga qualquer privilégio residual do papel
   `anon` nas tabelas de cadastro, log e espelho legado. Reexecutável a
   qualquer momento (todo `REVOKE` é seguro mesmo que o privilégio já não
   exista). Numerado como "004" porque foi planejado antes de
   `004_activity_log.sql`/`005_log_atividades.sql` existirem — a ordem de
   aplicação não importa entre este e os dois de log, mas aplique depois de
   `001`/`003`/`006` (precisa que `pecas`/`programas` já existam).
8. `007_funcao_peca.sql` — Fase 1 do MVP de consolidação do cadastro (ver
   `MVP-CADASTRO.md` na raiz): adiciona `pecas.funcao`/
   `pecas.programa_relacionado` (substituem, de forma incremental, as
   listas `VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP` hardcoded em `app.js`) e
   `programas.programa_titulo`/`temporada`/`episodio`/`bloco`. Aditiva —
   toda peça/programa existente fica com os campos novos em `NULL`,
   comportamento idêntico ao anterior à migração. Aplique depois de `006`
   (redefine `fn_salvar_pecas`/`fn_salvar_programas`/`v_pecas_roteiro`/
   `v_programas_roteiro` para reconhecer os campos novos).

Nada precisa ser apagado: `shared_data` continua existindo como espelho.

## Estrutura

**`pecas`** — `code` (único), `descricao`, `tempo` (`HH:MM:SS` validado),
`midia`, `type`, `categoria` (enum), `validade` (data), `dias` (`{seg,ter,...}`),
`h_ini`/`h_fim` (janela horária `HH:MM`), `freq`, `obs`,
`posicao` (enum — preenchido = peça fixa), `ordem`, `ativo`, auditoria
(`created_by`, `updated_by`, `created_at`, `updated_at`).

**`programas`** — `code` (único), `descricao`, `tempo`, `midia`, `type`,
`assinatura` (faixa: infantil/jovem/adulto), `ativo`, auditoria.

## Regras de negócio no banco

`fn_pecas_elegiveis(dow, hora, data_ref)` devolve só as peças válidas para um
dia/horário, aplicando: validade não expirada, dia da semana permitido
(vazio = todos) e janela horária (inclusive janelas que viram a meia-noite,
ex.: 22:00→02:00). É a mesma regra implementada em `src/core/pecasCatalog.js`,
para que back-end e front-end nunca divirjam.

## Segurança

RLS habilitada nas duas tabelas. A equipe **autenticada** lê e grava; o papel
anônimo não recebe nenhum GRANT. As funções de espelho são `security definer`
com `search_path` fixo.

## Testes

```bash
npm test        # regras de catálogo, roteiro, normalização e repositório
npm run test:db # aplica 001 + 002 em um Postgres real (WASM) e valida os triggers
```

`npm run test:db` verifica: aplicação dos dois scripts, migração do JSONB legado,
enum desconhecido caindo em `OUTROS`, espelho após insert/update/delete,
`updated_at` automático, elegibilidade por dia/hora/validade, idempotência,
`check` de formato de tempo e unicidade de `code`.
