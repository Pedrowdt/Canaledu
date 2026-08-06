# Autenticação e persistência do cadastro no roteiro

## 1. O que mudou

### Autenticação única (`auth.js`)
Antes existiam **dois** logins independentes: um em `cloud-sync.js` (Roteiro) e
outro em `pecas-programas.js` (Cadastro). Cada um criava o seu próprio cliente
Supabase, o que produzia duas instâncias do GoTrue no mesmo navegador —
causa clássica de "a sessão não entra", token renovado em duplicidade e logout
que não propaga entre as telas.

Agora existe um único módulo, `auth.js`, publicado como `window.CanalAuth`:

| Função | Para que serve |
| --- | --- |
| `CanalAuth.getClient()` | cliente Supabase **singleton** (uma só sessão no navegador) |
| `CanalAuth.resolveSession()` | restaura a sessão persistida com até 5 retentativas (~2 s) |
| `CanalAuth.requireUser()` | devolve o usuário logado ou `null` — usado como *guard* das páginas |
| `CanalAuth.signIn(email, senha)` | valida o formulário, faz login e **traduz** o erro do Supabase |
| `CanalAuth.signOut(destino)` | encerra a sessão das duas telas e volta ao ponto de entrada |
| `CanalAuth.onAuthChange(cb)` | reage a logout/expiração (inclusive feito em outra aba) |
| `CanalAuth.rememberReturnTo/takeReturnTo` | volta para a página de origem após o login (sem *open redirect*) |

Regras de acesso a **Peças e Programas**:

1. sem sessão válida a página **não** abre — mostra o formulário de login
   *na própria página* (nada de redirect silencioso, que era o antigo bug de
   "a seção não está entrando");
2. a sessão é a mesma do Roteiro: quem já entrou no Roteiro abre o cadastro
   direto;
3. logout em qualquer tela derruba a outra (`onAuthChange` → `SIGNED_OUT`);
4. no banco, `db/004_autenticacao.sql` revoga qualquer acesso do papel
   anônimo e registra `created_by` / `updated_by` em cada linha do cadastro.

### Persistência garantida no roteiro (`roteiro-pecas-bridge.js`)
A tela de confecção lê o banco de peças do `localStorage` (`roteiroApp`),
enquanto o cadastro grava nas tabelas `public.pecas` / `public.programas`.
A ponte torna o cadastro a **fonte da verdade**:

1. ao abrir o Roteiro, `carregarCadastro()` lê as tabelas relacionais;
2. `mergeCadastro()` substitui `pecas`/`programas` no `localStorage`
   **antes** de `app.js` carregar — e nunca toca em `roteiros`, `pecasDia`,
   `grade` (dados do usuário);
3. peças inativas (`ativo = false`) ou sem `code` não entram no roteiro;
4. se a leitura falhar ou voltar vazia, o banco local é preservado
   (a tela nunca "zera");
5. se as tabelas relacionais ainda não existirem, a ponte usa o espelho
   `shared_data` — a migração pode ser aplicada sem parar o sistema;
6. tempo real: mudança nas tabelas de cadastro atualiza o roteiro aberto
   (`PecasRepo.onRemoteChange` → `aplicarNoEstado` → `renderAll`).

## 2. Como aplicar

```sql
-- No SQL Editor do Supabase, na ordem:
\i db/001_pecas_programas.sql
\i db/002_migrar_shared_data.sql
\i db/003_consistencia.sql
\i db/004_autenticacao.sql   -- NOVO: fecha o acesso anônimo + autoria
```

Crie os usuários da equipe em **Authentication → Users** (e-mail + senha).
Não há autocadastro: o acesso é concedido pela coordenação.

## 3. Como testar

```bash
npm test        # 62 testes (inclui auth.test.mjs e roteiroPersistencia.test.mjs)
npm run test:db # aplica 001→004 em Postgres real (PGlite) e valida os cenários
```

Teste manual:

1. abra `pecas-programas.html` sem estar logado → deve aparecer o login inline;
2. entre com senha errada → "E-mail ou senha inválidos.";
3. entre corretamente → o cadastro abre e mostra o e-mail no topo;
4. cadastre uma peça, volte ao Roteiro → a peça já aparece no banco de peças;
5. clique em **Sair** em uma aba → a outra aba volta ao login.
