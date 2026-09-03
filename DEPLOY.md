# Como colocar o Roteiro Canal Educação no ar (grátis, com login)

Este guia usa **Supabase** (login + banco de dados, grátis) e **Vercel** (hospedagem
dos arquivos, grátis). Tempo estimado: 20-30 minutos, sem precisar programar.

Como você pediu: o **banco de peças, programas e regras é compartilhado** por toda
a equipe; **o roteiro do dia é isolado por usuário** (cada um só vê e edita o seu).

---

## Parte 1 — Criar o backend (Supabase)

1. Acesse **https://supabase.com** → "Start your project" → crie uma conta grátis
   (pode ser com GitHub ou e-mail).
2. Clique em **New project**. Escolha um nome (ex: `roteiro-canal-educacao`), uma
   senha para o banco (guarde-a, mas não precisará dela no dia a dia) e a região
   mais próxima (ex: São Paulo). Aguarde ~2 minutos até o projeto ficar pronto.
3. No menu lateral, vá em **SQL Editor** → **New query**.
4. Rode, **em ordem**, os arquivos da pasta `db/` (cada um copiado e colado
   inteiro, um de cada vez, clicando **Run** antes de passar para o próximo):
   1. `db/001_pecas_programas.sql` — cria as tabelas de peças/programas, tipos,
      índices, GRANTs, RLS, views e os triggers que espelham tudo em
      `shared_data` (para o código que ainda lê esse formato continuar
      funcionando).
   2. `db/002_migrar_shared_data.sql` — se você já vinha de uma instalação
      antiga (só com `shared_data`), importa o que já existia para as tabelas
      novas. Se é uma instalação nova, pode rodar mesmo assim — não faz nada.
   3. `db/003_consistencia.sql` — trava por versão (`row_version`) para
      detectar quando duas pessoas editam a mesma peça ao mesmo tempo.
   4. `db/004_activity_log.sql` e `db/005_log_atividades.sql` — criam o log de
      atividades (quem editou o quê, e quando) usado pelo botão de log das
      duas telas. Opcional: sem eles o sistema continua funcionando.
   5. `db/006_pecas_one_way.sql` — só a tela "Peças e Programas" pode alterar
      o cadastro; o Roteiro só lê. Reforçado no próprio banco (não é só uma
      regra do site).
   6. `db/004_autenticacao.sql` — fecha qualquer acesso residual do papel
      anônimo. Opcional, mas recomendado.
   7. `db/007_funcao_peca.sql` — campos estruturados de função de vinheta e
      identidade de programa (Fase 1 do MVP de cadastro, ver
      `MVP-CADASTRO.md`). Opcional: sem ele o sistema continua funcionando
      exatamente como antes, só sem os campos novos no formulário.

   > O arquivo `supabase-schema.sql` na raiz do projeto é **legado**: cria só
   > a tabela antiga `shared_data`, sem o cadastro relacional, sem RLS
   > granular e sem o fluxo de mão única acima. Use-o apenas se por algum
   > motivo você não puder rodar as migrações de `db/`; nesse caso, o sistema
   > funciona no modo de compatibilidade, mas sem essas proteções.
5. No menu lateral, vá em **Project Settings** → **API**. Copie:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **anon public key** (uma chave longa)
6. Abra o arquivo **`supabase-config.js`** do seu sistema (é o único lugar onde essas informações
   precisam ser preenchidas — tanto o Roteiro quanto o Cadastro de Peças e Programas usam este
   mesmo arquivo) e substitua:
   ```js
   const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';   // cole a Project URL (SEM /rest/v1 no final)
   const SUPABASE_ANON_KEY = 'ey....................';     // cole a anon public key
   ```
   Salve o arquivo.

### Criar os logins da equipe (1 a 5 pessoas)

Como o acesso é restrito à equipe, não existe tela de "criar conta" pública — você
mesmo cria o login de cada pessoa pelo painel:

1. No Supabase, vá em **Authentication** → **Users** → **Add user** → **Create new user**.
2. Preencha e-mail e uma senha provisória para cada pessoa da equipe. Marque
   **Auto Confirm User** (assim ela já pode logar sem precisar confirmar e-mail).
3. Repita para cada pessoa (até 5, no seu caso). Depois é só avisar cada uma do
   e-mail e senha — elas podem trocar a senha depois, se quiser, pedindo redefinição
   pelo próprio painel do Supabase.

> O plano gratuito do Supabase permite até 50.000 usuários autenticados e é mais
> que suficiente para uma equipe pequena. O banco de dados gratuito também é mais
> que suficiente para o volume de dados desse sistema (texto/JSON).

---

## Parte 2 — Publicar o site (Vercel)

Você pode usar Vercel, Netlify ou Cloudflare Pages — todos têm plano gratuito
equivalente para esse tipo de site. Este guia usa a Vercel por ser a mais direta.

### Opção A — sem usar linha de comando (recomendado)

1. Crie uma conta grátis em **https://vercel.com** (pode entrar com GitHub).
2. Coloque a pasta do seu sistema (com o `cloud-sync.js` já editado) em um
   repositório no GitHub:
   - Crie um repositório novo em **https://github.com/new**.
   - Faça upload de todos os arquivos do projeto pela própria interface do
     GitHub (botão **Add file → Upload files**) — **exceto a pasta `node_modules`**,
     que não é necessária (o site não usa build/bundler).
3. Na Vercel, clique em **Add New → Project**, selecione o repositório que você
   acabou de criar e clique em **Deploy**. Não é necessário configurar nada
   (é um site estático).
4. Em 1-2 minutos a Vercel te dá uma URL pública, tipo
   `https://roteiro-canal-educacao.vercel.app` — é esse o link que você vai
   compartilhar com a equipe.

### Opção B — com linha de comando

```bash
npm install -g vercel
cd "V3.4.5 copia"
vercel --prod
```
Siga as instruções na tela (login, nome do projeto). Ao final ele mostra a URL pública.

---

## Parte 3 — Testar

1. Abra a URL pública recebida na Vercel.
2. Faça login com um dos e-mails/senhas criados no Supabase.
3. Edite alguma peça, programa ou o roteiro do dia — a cada alteração o sistema
   sincroniza automaticamente com a nuvem (veja o indicador "Sincronizado ✓" no
   canto inferior direito).
4. Peça para outra pessoa da equipe logar com o e-mail dela: ela verá o mesmo
   banco de peças/programas/regras, mas terá o próprio roteiro do dia, separado.

---

## Tela de escolha (Roteiro x Peças e Programas)

Depois do login, a equipe vê uma tela com duas opções:

- **Roteiro** — o sistema de montagem do roteiro do dia (como já era antes)
- **Peças e Programas** — um cadastro separado (`pecas-programas.html`), com abas para
  Peças e Programas, que edita o **mesmo banco compartilhado** usado pelo Roteiro. Ou
  seja: uma peça cadastrada ali já aparece automaticamente no banco de peças do Roteiro,
  e vice-versa — não é preciso importar nada manualmente entre os dois.

Ambas as telas usam o mesmo login — não é necessário logar duas vezes.

## O que acontece com os dados que já existiam no navegador?

Se você já usava o sistema localmente (sem login) e tinha peças/programas
cadastrados, **na primeira vez que você logar nesse mesmo navegador**, o sistema
detecta que a nuvem está vazia e envia automaticamente os dados que já existiam
localmente para servir de ponto de partida do banco compartilhado da equipe. Nas
próximas vezes (e para as outras pessoas), os dados já vêm da nuvem.

---

## Custos

Com uma equipe de até 5 pessoas, este sistema roda inteiramente dentro do plano
gratuito da Vercel e do Supabase, sem custo algum, salvo mudanças futuras nas
políticas dessas empresas.

## Limitações desta solução

- O login é fechado (só quem você cadastrar no Supabase entra) — não existe
  tela de "criar minha própria conta". Isso é intencional para uma equipe pequena.
- A sincronização acontece cerca de 1 segundo depois de cada alteração local; em
  quedas de internet, o app continua funcionando normalmente offline (usando o
  `localStorage`) e sincroniza assim que a conexão voltar.
- Se no futuro a equipe crescer muito além de ~5-10 pessoas usando ao mesmo
  tempo, vale considerar mover a lógica de sincronização de "documento inteiro"
  para atualizações por campo — hoje ela replica o banco compartilhado inteiro
  a cada alteração, o que é tranquilo nessa escala mas não é o ideal para uma
  equipe grande.
