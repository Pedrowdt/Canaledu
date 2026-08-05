# Correção — banco perdendo dados quando dois usuários editam

## Diagnóstico (o que causava a perda)

1. **Snapshot inteiro a cada gravação (last-write-wins).**
   `cloud-sync.js` enviava `shared_data.pecas`/`programas` com a cópia que
   estava no `localStorage` daquele navegador. Quem salvasse por último
   sobrescrevia o cadastro inteiro com a sua versão antiga — tudo que outra
   pessoa havia cadastrado depois do login desaparecia.

2. **Duas fontes da verdade brigando.**
   O cadastro passou a viver nas tabelas relacionais `pecas`/`programas`
   (espelhadas em `shared_data` por trigger), mas a tela de roteiro continuava
   escrevendo direto no espelho. O espelho ficava divergente do banco e, no
   login seguinte, o app lia o espelho — daí a sensação de "o banco zerou".

3. **Gravação destrutiva no cadastro.**
   `PecasRepo.saveAll()` fazia `upsert` da lista da tela e depois
   `delete ... not in (codes da tela)`. Uma tela aberta há 10 minutos apagava
   fisicamente toda peça criada nesse intervalo por outro usuário.

4. **Sem detecção de conflito.** Nada comparava versões: duas edições
   simultâneas do mesmo item terminavam com a última sobrescrevendo a outra
   em silêncio.

## Solução aplicada

### Banco — `db/003_consistencia.sql` (aplicar após 001 e 002)

- `row_version` em `pecas` e `programas`, incrementada pelo trigger de update
  (**optimistic locking**).
- `fn_salvar_pecas(p_upserts jsonb, p_deletes text[])` e
  `fn_salvar_programas(...)`: gravam **delta** (só o que mudou) e apagam
  **somente** os codes enviados explicitamente. Retornam
  `{aplicados, removidos, conflitos:[{code, esperado, atual}]}` — a edição
  baseada em versão velha volta como conflito, sem sobrescrever.
- **Guarda no espelho** (`shared_data_guard`): qualquer UPDATE em
  `shared_data` que não venha das funções de espelho tem `pecas` e
  `programas` preservados. Um snapshot velho do `localStorage` não consegue
  mais zerar o cadastro.
- Helpers tolerantes (`fn_categoria_safe`, `fn_posicao_safe`,
  `fn_assinatura_safe`): categoria/posição desconhecida não derruba a
  gravação (cai em `OUTROS`/`null`).

### Aplicação

- `pecas-repo.js`: mantém um *baseline* do último estado lido e envia apenas
  as linhas alteradas, com a `row_version` do banco; `saveDelta()` recebe as
  exclusões explícitas. Sem a RPC (banco ainda não migrado) usa
  `upsert` + `delete in(codes)` — nunca mais `delete not in`. No modo legado
  (JSONB) relê o estado remoto e **mescla** antes de gravar.
- `pecas-programas.js`: registra os codes excluídos na tela (item único e
  "excluir todos"), grava em delta, e ao terminar recarrega do banco. Se
  houver conflito, avisa quais itens outra pessoa alterou e mostra a versão
  do banco.
- `cloud-sync.js`: a tela de roteiro **não envia mais** `pecas`/`programas`
  para `shared_data`; continua enviando grade/regras e recebendo o cadastro
  pelo espelho + realtime.

## Como aplicar em produção

1. Supabase → SQL Editor → rode `db/003_consistencia.sql`.
2. Publique os arquivos `pecas-repo.js`, `pecas-programas.js`, `cloud-sync.js`.
3. Peça a todos que recarreguem a página (Ctrl+F5).

## Testes

- `npm test` → 39 testes (inclui os 7 novos de consistência: delta,
  exclusão explícita, conflito, fallback sem RPC, mescla no modo legado).
- `npm run test:db` → aplica 001+002+003 em um Postgres real (PGlite) e
  reproduz os cenários multiusuário: peça de outro usuário sobrevive,
  conflito detectado, exclusão só do code enviado, espelho protegido.
