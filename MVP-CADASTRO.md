# MVP — Cadastro consistente para uso diário de emissora

Documento de análise e proposta. Não implementa nada — é a base para aprovação
antes de virar trabalho (ver `PROMPT-IMPLEMENTACAO-CADASTRO.md`, que assume
este documento já aprovado, com ajustes se necessário).

## 1. O que toda peça realmente é, hoje

Você descreveu certo: no fundo, tudo é `<code><title><duration><type>`. Fui
conferir no código como isso se materializa e onde a promessa desse modelo
simples já quebra na prática.

### 1.1 Os quatro campos universais existem, e são bem definidos
- `code` — identificador único (do sistema de trânsito/automação).
- `descricao` (title) — texto livre.
- `tempo` (duration) — `HH:MM:SS`.
- `type` — um destes 7 valores fixos: `ECHE`, `ECHM`, `RCOM`, `RPOL`, `EINT`,
  `EVNH`, `RPRO`. Isso é metadado técnico do sistema de automação/trânsito —
  praticamente não muda e não deveria mudar.

### 1.2 O "fallback no title" é real, e são pelo menos 3 mecanismos diferentes, não 1
Fui atrás de cada lugar onde o sistema hoje "adivinha" o que uma peça é a
partir do texto do título, em vez de perguntar a um campo estruturado:

| O que precisa saber | Onde é decidido hoje | Como |
|---|---|---|
| Qual VH "daqui a pouco" vai antes de qual programa | `pecas_dia.js#matchVhDaquiForNext` | Casamento de palavras-chave no título (já corrigido uma vez nesta sessão, mas o mecanismo em si continua sendo parsing de texto) |
| Qual VH "a seguir" vai com qual programa | `app.js#VH_SEGUIR_MAP` — **44 entradas hardcoded no código-fonte**, cada uma com uma lista `keywords` para casar com o próximo programa | Comparação exata de string normalizada |
| Qual VH "você está assistindo" vai com qual programa | `app.js#VH_ASSISTINDO_MAP` — outra lista hardcoded, mesmo mecanismo | Idem |
| Qual assinatura (infantil/jovem/adulto) fechar um programa | `app.js#findVhAssinaturaFor` | Primeiro olha uma tag explícita no cadastro do programa (✅ isso já é estruturado); se não tiver, cai em listas de palavras-chave hardcoded (`infKw`/`adKw`) |
| Temporada/episódio/bloco de um programa | `app.js#baseProgramTitle`/`getEpisodeId` | 6 regexes encadeados sobre a descrição (`"PGM X - T01 EP03 - BL02"`) |
| Se uma peça do dia é "programar 3x" ou "só entre 8h e 12h" | `pecas_dia.js` (import de planilha) | Regex sobre a coluna de observação livre |

**O achado mais concreto:** `VH_SEGUIR_MAP` e `VH_ASSISTINDO_MAP` são dados de
negócio (qual vinheta promocional acompanha qual programa) **vivendo dentro
do código-fonte do app**, não no cadastro. Isso significa que toda vez que um
programa novo entra no ar ou um antigo sai, alguém precisa **editar e
reimplantar `app.js`** — a mesma ação que devia ser "cadastrar uma peça na
tela de Peças e Programas" vira uma tarefa de desenvolvimento.

### 1.3 O banco já tem infraestrutura para isso que nunca foi usada
Achado da sessão anterior, relevante de novo aqui: `fn_pecas_elegiveis`
(Postgres) e `src/core/pecasCatalog.js#selectPecasDoDia` (client-side, testada)
já existiam para derivar "o que está elegível hoje" diretamente do cadastro —
e não tinham nenhum chamador até a gente ligar isso na tela de Peças do Dia.
O padrão se repete aqui: a estrutura de dados quase sempre já é suficiente
(`dias`/`hIni`/`hFim`/`freq`/`validade` já existem na peça), só falta um
campo que registre explicitamente **qual programa** aquela peça acompanha —
hoje isso só existe como texto solto no título ou como uma lista hardcoded
em `app.js`.

### 1.4 Duas taxonomias de categoria, que não batem entre si nem com o histórico
O formulário de cadastro (`pecas-programas.html`) tem dois campos de
classificação sobrepostos:
- `type`: `ECHE/ECHM/RCOM/RPOL/EINT/EVNH/RPRO` (formato técnico)
- `categoria`: `CHAMADA_QUENTE/RCOM/RPOL/INTGOV/MANUT/BUSSOLA` (balde de
  organização visual/sidebar)

`RCOM`/`RPOL` aparecem nas duas listas com sentidos diferentes — uma peça
`type=RCOM` não necessariamente é `categoria=RCOM`. E o dataset histórico
embutido no próprio app (`data.js`, carregado como seed quando não há nada em
`localStorage`) usa **16 valores de categoria diferentes**
(`"MANUTS FAIXAS"`, `"FAIXA INFANTIL - \"DAQUI A POUCO\""`,
`"CLASSIFICAÇÃO INDICATICA"`, `"VINHETAS ID"`, `"ASSINATURA DO CANAL"`,
`"CARTELAS"`, `"QUINTA"`...) — **só 3 delas batem com as 6 opções do
dropdown atual**. Se esse seed algum dia for reaplicado, ele gera categorias
que a UI não reconhece (`catMeta()` já tem um fallback pra isso, mas é
sintoma, não solução).

---

## 2. O modelo proposto

Mantém exatamente os 4 campos universais que você descreveu — não é uma
reescrita, é parar de esconder informação estruturada dentro do título.

### 2.1 Novo campo: `funcao` (só relevante para `type=EVNH`, opcional)
Substitui a necessidade de adivinhar pelo texto. Enum fechado:

```
assinatura_infantil | assinatura_jovem | assinatura_adulto | assinatura_padrao
vh_a_seguir | vh_daqui_a_pouco | vh_voce_esta_assistindo
classificacao_indicativa | cartela_oficial | vinheta_id | transicao
outro (default — comportamento atual, sem mudança)
```

### 2.2 Novo campo: `programa_relacionado` (só relevante quando `funcao` referencia um programa)
Em vez de um `keywords: [...]` hardcoded em `app.js`, um campo de busca no
próprio formulário de cadastro: digite o nome do programa, o sistema sugere
entre os `RPRO` já cadastrados, grava o `code` (ou o título-base normalizado,
para sobreviver a reimportações com code novo por episódio). Isso transforma
"qual VH vai com qual programa" de um problema de correspondência de texto
em uma consulta direta.

### 2.3 Campos estruturados para RPRO: `programa_titulo`, `temporada`, `episodio`, `bloco`
Preenchidos automaticamente pelo importador (que já faz esse parsing hoje —
só não guarda o resultado) em vez de re-parseados toda vez que alguém
precisa agrupar blocos do mesmo episódio.

### 2.4 `categoria` unificada
Uma única lista canônica, migrando os 16 valores históricos para as
categorias que a operação realmente usa no dia a dia (a lista deve ser
validada com quem cadastra hoje — este documento não decide sozinho a lista
final, só sinaliza que ela precisa existir e ser única).

### 2.5 O import passa a escrever nos campos estruturados, não só ler `obs`
O import diário de planilha (`pecas_dia.js`) hoje faz regex em cima de uma
coluna de observação livre para descobrir "programar 3x"/"só entre 8h-12h".
Passa a **gravar isso de volta no cadastro** (`freq`/`dias`/`hIni`/`hFim`),
completando o que a sessão anterior já começou (peças do dia auto-preenchidas
do cadastro) — hoje a informação de recorrência entra pela planilha e morre
no dia; devia entrar uma vez e ficar.

---

## 3. Regras de negócio da distribuição automática — o que muda

Hoje as regras vivem em 3 lugares que não se falam: `REGRAS` (objeto
editável pelo Admin, em `app.js`), listas hardcoded (`VH_SEGUIR_MAP` etc.), e
funções puras em `src/core/` (testadas, mas parcialmente desconectadas da
UI real — o mesmo padrão de "infraestrutura pronta e não usada" da seção 1.3).

**Proposta:** toda decisão de "que peça inserir automaticamente aqui" passa a
consultar primeiro os campos estruturados do cadastro (`funcao` +
`programa_relacionado`), com o texto-matching atual como *fallback*, não
como mecanismo primário — nenhuma peça existente para de funcionar no dia da
virada, mas toda peça nova cadastrada com os campos novos preenchidos já não
depende de heurística de texto nem de deploy de código.

---

## 4. Escopo do MVP (faseado — não é tudo de uma vez)

| Fase | O que entrega | Risco |
|---|---|---|
| **1. Schema + formulário** | Migração aditiva (`funcao`, `programa_relacionado`, `programa_titulo`/`temporada`/`episodio`/`bloco`), campos novos no formulário só quando `type=EVNH`/`RPRO` | Baixo — nada obrigatório, tudo aceita `null` |
| **2. Motor de distribuição** | `matchVhDaquiForNext`/equivalentes para "a seguir"/"você está assistindo" passam a checar os campos novos **antes** do texto; sem eles preenchidos, comportamento idêntico ao de hoje | Médio — mexe em lógica que já foi corrigida 2x nesta sessão; precisa de testes de regressão fortes |
| **3. Import estruturado** | Import diário grava `freq`/`dias`/`hIni`/`hFim` de volta no cadastro; importador de Peças e Programas ganha os campos novos | Médio — toca o fluxo de mão única (`006_pecas_one_way.sql`), precisa respeitar o guard existente |
| **4. Limpeza** | Aposentar `VH_SEGUIR_MAP`/`VH_ASSISTINDO_MAP`/taxonomia antiga do `data.js` só depois que o cadastro real tiver `funcao` preenchida nas peças ativas | Baixo, mas só depois que 1-3 estiverem em produção há um tempo |

Recomendo aprovar fase a fase, não o pacote inteiro de uma vez — cada fase é
entregável e reversível sozinha.
