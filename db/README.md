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
