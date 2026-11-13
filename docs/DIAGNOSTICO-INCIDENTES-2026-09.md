# Diagnóstico — Peças somem, import de CSV perde/desordena programas, alertas inconsistentes

Investigação de 3 relatos de usuário, todos no `app.js` (Roteiro). Os dois
primeiros compartilham a mesma causa raiz (incompatibilidade de chave entre
a Grade Semanal e o gerador automático de roteiro); o terceiro é
independente. Nenhuma correção foi aplicada ainda — são 3 prompts
separados ao final, para aprovar e implementar quando puder.

---

## 1 e 2. "Peças somem" (log menciona grade) + últimos programas do CSV vêm errados/faltando

### A causa raiz: duas funções constroem a MESMA chave de forma diferente

Quando você importa a **Grade Semanal** (planilha XLSX), cada célula vira uma
chave assim (`_gradePreviewSelectedSheet`, `app.js`):

```js
const title   = sanitizeText(_gradeProgTitle(cell));
const episode = sanitizeText(_gradeEpisodeId(cell));      // ex.: "T01 EP03"
const fullTitle = episode ? `${title} - ${episode}` : title;
...
const key = counters[dow][fullTitle] === 1 ? fullTitle : `${fullTitle} [${n}ª]`;
gradeByDay[dow][key] = time;   // ex.: "PALALOOS - T01 EP03": "08:00:00"
```

Quando você importa o **CSV de programas** e o sistema tenta casar cada
programa com o horário que a grade previu (`buildRoteiroFromPrograms`,
`app.js`):

```js
const baseTitle = baseProgramTitle(prog.descricao);       // remove T01/EP03/BL02!
...
const gradeKey = ordinal === 1 ? baseTitle : `${baseTitle} [${ordinal}ª]`;
const expectedTimeStr = gradeDiaria[gradeKey];             // procura "PALALOOS", não acha
```

`baseProgramTitle()` **remove de propósito** o "T01 EP03" do título (é assim
que ele agrupa blocos do mesmo episódio). Só que isso faz a chave de busca
ficar `"PALALOOS"`, enquanto a grade guardou `"PALALOOS - T01 EP03"` — **a
busca nunca bate** para nenhum programa que tenha temporada/episódio
detectado na planilha da grade (ou seja, a maioria da programação seriada).

### O efeito disso

- `expectedTimeStr` vem `undefined` → nenhum `__GAP__` (ajuste de horário) é
  inserido para alinhar aquele programa com o horário real da grade.
- O roteiro é montado **concatenando tudo direto**, sem respeitar os
  horários da grade — o atraso/adiantamento vai se acumulando programa a
  programa. Quanto mais programas passam, maior o desvio acumulado —
  **por isso o problema aparece concentrado nos últimos da lista**: não é
  que eles "vêm errados" isoladamente, é que o desvio de horário já
  acumulou o dia inteiro até ali.
- "Peças somem": se o operador já tinha peças/VHs posicionadas manualmente
  em horários específicos esperando que a grade "seguurasse" o tempo até
  lá, e a sincronização silenciosamente não fez nada (porque a chave nunca
  bateu), a segunda metade do dia acaba sendo reconstruída/deslocada de
  forma que dá a impressão de peças terem desaparecido — na prática, o
  roteiro nunca esperou o horário certo pra elas.

Isso explica por que você viu "algo relacionado a grade" no log: a
grade é lida (`loadGrade(dow)`), só que o valor lido nunca é
efetivamente usado para nada, porque a chave de busca não bate.

---

## 2b. Programas que literalmente não aparecem no import de CSV

Achado separado, mesma função (`importNotionCSV`, `app.js`):

```js
const lines = text.split(/\r?\n/);            // (1) quebra em linhas ANTES de entender aspas
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(line, sep);        // (2) parseia UMA linha por vez, sem memória entre linhas
  ...
  if (!code || !desc || !tempo) continue;      // (3) linha incompleta é descartada em silêncio
}
```

Se a **descrição de um programa** contiver uma quebra de linha real dentro
de aspas (comum em exportações do Google Sheets/Notion quando alguém
aperta Enter dentro da célula, ou o texto foi colado com quebra automática),
o passo (1) já corta esse registro em duas "linhas" **antes** de qualquer
lógica de aspas rodar. As duas metades resultantes ficam com colunas
incompletas/deslocadas e caem no `continue` do passo (3) — **o programa
inteiro some do import, sem nenhum aviso**. Como o parser não guarda
estado entre linhas, o efeito fica isolado a esse registro (não corrompe
o arquivo inteiro), mas cada ocorrência é uma peça que simplesmente não
chega no roteiro.

---

## 3. Alertas de horário inconsistentes

`scheduleBlockAlerts()` (o motor que agenda os toques/notificações de
"início de bloco") só é chamado em **três lugares**:

1. Uma vez, 1.5s depois da página carregar (`window.addEventListener('load', ...)`).
2. Depois de gerar um roteiro a partir de CSV do Notion.
3. Depois de gerar um roteiro a partir de códigos do banco.

**Nunca é chamado ao**: trocar de dia (`selectDate`/`changeWeek`), aplicar
uma nova Grade Semanal (`applyGradeSemanalImport`), ou quando a meia-noite
passa com a aba aberta. Como o agendamento é feito uma vez, para os
horários de **um dia específico** (`state.currentDate` no momento da
chamada), qualquer um desses cenários deixa os alertas "presos" no dia
errado ou apagados sem serem refeitos — exatamente o "às vezes aparece,
às vezes não" relatado, e não é aleatório: depende só de quando a página
foi recarregada pela última vez.

---

## Prompts de correção (separados, para aprovar e implementar quando puder)

### Prompt A — Corrigir a chave grade × roteiro (resolve os itens 1 e 2)

> Em `app.js`, `buildRoteiroFromPrograms()` usa `baseProgramTitle(prog.descricao)`
> (que remove temporada/episódio) para montar `gradeKey` e buscar em
> `gradeDiaria`. Mas `_gradePreviewSelectedSheet()` grava as chaves da
> grade incluindo o episódio quando detectado (`fullTitle = episode ? \`${title} - ${episode}\` : title`).
> Corrija `buildRoteiroFromPrograms()` para montar a chave de busca do
> MESMO jeito que a grade grava: extraia o episódio da descrição do
> programa importado (reaproveite `getEpisodeId()`, já existe no arquivo)
> e monte `fullTitle` exatamente como `_gradePreviewSelectedSheet` faz,
> antes de aplicar a lógica de ordinal (`[2ª]`/`[3ª]`). Não mude o
> agrupamento de blocos por episódio (que já usa `baseTitle` corretamente
> para isso) — só a busca na grade. Adicione um teste de integração que
> importe uma grade com "PALALOOS - T01 EP03" às 08:00 e confirme que um
> programa "PALALOOS T01 EP03" importado por CSV recebe o `__GAP__`
> correto para alinhar com esse horário (hoje esse teste falharia). Rode
> `npm test` inteiro antes de considerar concluído.

### Prompt B — CSV com quebra de linha dentro de um campo (resolve o item 2b)

> Em `app.js`, `importNotionCSV()` faz `text.split(/\r?\n/)` antes de
> qualquer parsing consciente de aspas, então um campo entre aspas com
> quebra de linha real corrompe esse registro e ele é descartado em
> silêncio pelo `if (!code || !desc || !tempo) continue;`. Substitua a
> quebra ingênua por um parser CSV completo, consciente de aspas
> multi-linha (pode estender `parseCSVLine()` para processar o texto
> inteiro de uma vez, respeitando `inQuote` através de quebras de linha,
> em vez de por linha isolada). Adicione um teste com um CSV cuja segunda
> coluna contenha `"linha 1\nlinha 2"` entre aspas e confirme que o
> programa é importado corretamente (hoje ele desaparece). Enquanto
> estiver nisso, troque o `continue` silencioso por um aviso ao usuário
> (`tempoInvalido`-style, já existe um padrão parecido no mesmo arquivo)
> contando quantas linhas foram descartadas por dados incompletos — hoje
> isso falha 100% em silêncio, sem nenhum jeito de notar que algo sumiu.

### Prompt C — Re-armar alertas de bloco nos eventos certos (resolve o item 3)

> Em `app.js`, `scheduleBlockAlerts()` só é chamada no load da página e
> depois dos dois fluxos de geração de roteiro por CSV. Adicione a mesma
> chamada (`try { scheduleBlockAlerts({silent:true}); } catch(_) {}`) em:
> `selectDate()`/`changeWeek()` (trocar de dia deveria re-armar para o dia
> novo) e `applyGradeSemanalImport()` (uma grade nova invalida os horários
> antigos). Considere também um `setInterval` leve (a cada poucas horas,
> ou checando a virada de dia) para re-armar sozinho se a aba ficar aberta
> por muito tempo — hoje isso só acontece se a página for recarregada.
> Teste que trocar de dia cancela os timers antigos (`clearBlockAlerts()`
> já existe e já é chamado no início de `scheduleBlockAlerts()`, então não
> deveria haver timers duplicados) e agenda os do novo dia.
