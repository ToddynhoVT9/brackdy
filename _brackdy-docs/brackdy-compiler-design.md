# Brackdy DSL v0.3 — Compiler Design

---

## Índice

1. [Visão geral do pipeline](#1-visão-geral-do-pipeline)
2. [Estrutura de arquivos e pastas](#2-estrutura-de-arquivos-e-pastas)
3. [Fase 1 — Lexer](#3-fase-1--lexer)
4. [Fase 2 — Parser](#4-fase-2--parser)
5. [Fase 3 — Resolvedor Semântico](#5-fase-3--resolvedor-semântico)
6. [Fase 4 — Gerador de Saída](#6-fase-4--gerador-de-saída)
7. [Sistema de Herança de Propriedades](#7-sistema-de-herança-de-propriedades)
8. [Sistema de Componentes](#8-sistema-de-componentes)
9. [Sistema de Responsividade](#9-sistema-de-responsividade)
10. [Sistema de Ligação Lógica](#10-sistema-de-ligação-lógica)
11. [Gerenciamento de Erros](#11-gerenciamento-de-erros)
12. [Orquestrador (entry point)](#12-orquestrador-entry-point)
13. [Fluxo completo de dados](#13-fluxo-completo-de-dados)

---

## 1. Visão geral do pipeline

O compilador transforma um arquivo `.brd` (ou `.dsl`) em três artefatos de saída:

```
arquivo.brd
    │
    ▼
┌─────────┐     tokens     ┌─────────┐     AST bruto     ┌──────────────────────┐
│  Lexer  │ ─────────────► │ Parser  │ ─────────────────► │ Resolvedor Semântico │
└─────────┘                └─────────┘                    └──────────────────────┘
                                                                      │
                                                              AST resolvido
                                                                      │
                                                                      ▼
                                                          ┌───────────────────────┐
                                                          │   Gerador de Saída    │
                                                          └───────────────────────┘
                                                             │        │        │
                                                             ▼        ▼        ▼
                                                          .html     .css    .ts/.js
```

Cada fase é uma transformação pura: recebe uma estrutura de dados e produz outra. Nenhuma fase escreve arquivo em disco — isso é responsabilidade exclusiva do orquestrador.

---

## 2. Estrutura de arquivos e pastas

```
brackdy-compiler/
│
├── src/
│   ├── lexer/
│   │   ├── Lexer.ts               — tokenizador principal
│   │   ├── TokenType.ts           — enum de todos os tipos de token
│   │   └── Token.ts               — tipo/interface do token
│   │
│   ├── parser/
│   │   ├── Parser.ts              — parser principal (tokens → AST bruto)
│   │   └── nodes/
│   │       ├── ASTNode.ts         — interface base de todos os nós
│   │       ├── DocumentNode.ts    — nó raiz do documento
│   │       ├── ElementNode.ts     — nó de tag HTML ([tag ...])
│   │       ├── PropBlockNode.ts   — nó de bloco de propriedades (())
│   │       ├── PropEntry.ts       — entrada individual de propriedade
│   │       ├── ComponentDefNode.ts — nó de definição de componente ([>Nome])
│   │       ├── ComponentCallNode.ts — nó de chamada de componente
│   │       └── LogicDirectiveNode.ts — nó do @logic no topo
│   │
│   ├── resolver/
│   │   ├── Resolver.ts            — orquestra as sub-etapas de resolução
│   │   ├── InheritanceResolver.ts — propaga e mescla propriedades herdadas
│   │   ├── ComponentRegistry.ts   — registra definições e instancia chamadas
│   │   ├── SlotResolver.ts        — preenche slots com valores passados ou padrão
│   │   ├── LogicResolver.ts       — valida e vincula eventos a caminhos lógicos
│   │   └── ResponsiveResolver.ts  — extrai propriedades responsivas do AST
│   │
│   ├── generator/
│   │   ├── Generator.ts           — orquestra os sub-geradores
│   │   ├── HTMLGenerator.ts       — AST resolvido → string HTML
│   │   ├── CSSGenerator.ts        — regras responsivas → string CSS
│   │   └── JSGenerator.ts         — eventos vinculados → string TS/JS
│   │
│   ├── errors/
│   │   ├── CompilerError.ts       — classe base de erro com posição (linha/col)
│   │   ├── LexerError.ts
│   │   ├── ParseError.ts
│   │   └── SemanticError.ts
│   │
│   └── compiler/
│       └── Compiler.ts            — orquestrador: recebe source, devolve artefatos
│
├── tests/
│   ├── lexer/
│   ├── parser/
│   ├── resolver/
│   └── generator/
│
└── cli/
    └── index.ts                   — entry point de linha de comando
```

### Responsabilidade de cada pasta

| Pasta | O que faz | O que NÃO deve fazer |
|---|---|---|
| `lexer/` | Transformar texto em tokens | Interpretar significado dos tokens |
| `parser/` | Transformar tokens em AST bruto | Resolver herança ou componentes |
| `resolver/` | Enriquecer/validar o AST | Produzir texto de saída |
| `generator/` | Serializar AST resolvido em texto | Tomar decisões semânticas |
| `compiler/` | Orquestrar fases e I/O | Conter lógica de compilação própria |

---

## 3. Fase 1 — Lexer

### Responsabilidade

O Lexer recebe a string bruta do arquivo fonte e produz uma lista plana de tokens. Um token é a menor unidade com significado reconhecível.

### Tipos de token

```
LBRACKET          [
RBRACKET          ]
LPAREN            (
RPAREN            )
PIPE_ARROW        |>
HASH              # (início de id)
DOUBLE_COLON      :: (separador id::tag)
GREATER           > (prefixo de componente dentro de [])
AT                @ (início de evento)
DOLLAR            $ (início de atributo nativo)
COLON             :
DOT               . (em breakpoint.propriedade)
COMMA             ,
ANGLE_OPEN        < (início de slot)
ANGLE_CLOSE       > (fim de slot)
STRING            "..." (conteúdo entre aspas)
IDENT             qualquer sequência de chars sem operadores
LOGIC_DIRECTIVE   @logic (token especial de topo)
NEWLINE           \n (usado para rastreamento de linha)
EOF               fim do arquivo
```

### Comportamento

O Lexer percorre o texto caractere a caractere mantendo um cursor e um par `(linha, coluna)` para rastreamento de posição. A cada token emitido, a posição de início é armazenada no token — isso é essencial para mensagens de erro precisas.

**Regras de consumo de caracteres:**

- Espaços e tabs são ignorados (whitespace insignificante), exceto dentro de strings `"..."`.
- Quebras de linha são ignoradas para a gramática, mas o contador de linha é incrementado.
- Ao encontrar `"`, o Lexer entra em modo string: consome tudo até o próximo `"` não escapado e emite `STRING`. Strings não suportam quebra de linha.
- Ao encontrar `@logic`, o Lexer emite `LOGIC_DIRECTIVE` antes de emitir `AT + IDENT`, para que o Parser diferencie a diretiva de topo de um evento.
- Sequências como `|>`, `::`, `@`, `$`, `<`, `>` são reconhecidas como tokens compostos ou prefixos especiais antes de tentar ler como `IDENT`.
- Qualquer caractere que inicie uma sequência não reconhecida gera `LexerError` com posição.

### Saída

Lista ordenada de `Token`:

```
Token {
  type: TokenType
  value: string        // texto original do token
  line: number
  col: number
}
```

---

## 4. Fase 2 — Parser

### Responsabilidade

O Parser consome a lista de tokens e produz um AST bruto. "Bruto" significa que herança, componentes e ligações lógicas ainda não foram resolvidos — o AST representa fielmente a estrutura sintática do arquivo.

### Nó raiz: DocumentNode

Todo arquivo compila para um único `DocumentNode`:

```
DocumentNode {
  logicDirective: string | null   // caminho do @logic, se presente
  componentDefs: ComponentDefNode[]  // todas as definições [>Nome]
  children: ASTNode[]             // sequência de PropBlockNode e ElementNode
}
```

O Parser varre os tokens em sequência e distingue três construções de topo:

1. **`@logic "..."` no início** → lê e armazena em `logicDirective`. Só pode aparecer uma vez e deve ser a primeira linha não-vazia.
2. **`[>NomeMaiúsculo` → definição de componente** → parser entra em modo `parseComponentDef`.
3. **`(` → bloco de propriedades** → parser entra em modo `parsePropBlock`.
4. **`[tag` → elemento** → parser entra em modo `parseElement`.

### Parsing de PropBlock `()`

Um `PropBlockNode` é uma lista de `PropEntry`. O Parser lê entrada por entrada até encontrar `)`.

Cada `PropEntry` pode ser:
- **Propriedade visual**: `IDENT COLON IDENT` (ex: `background:#121212`)
- **Evento**: `AT IDENT COLON IDENT` (ex: `@click:openHero`)
- **Atributo nativo**: `DOLLAR IDENT COLON STRING` (ex: `$href:"/home"`)
- **Propriedade responsiva**: `IDENT DOT IDENT COLON IDENT` (ex: `md.grid-template-columns:1fr 1fr`)
- **Slot de propriedade na definição**: `ANGLE_OPEN IDENT ANGLE_CLOSE IDENT COLON IDENT` (ex: `<bg>background:#1E1E1E`)

Para a propriedade responsiva, o valor pode conter espaços (ex: `1fr 1fr 1fr`). O Parser deve consumir todos os tokens de valor até encontrar uma quebra de linha ou fechamento do bloco.

### Parsing de ElementNode `[]`

Um `ElementNode` é o nó mais complexo. O Parser lê os tokens internos de `[` até `]` correspondente, respeitando aninhamento (contando abertura e fechamento).

Sequência esperada dentro de `[...]`:

```
[ <id_opcional> <tag_ou_componente> <texto_opcional> <pipe_arrow_opcional> <filhos> ]
```

**Passo a passo:**

1. Após `[`, verificar se o próximo token é `HASH` → se sim, ler id: consumir `HASH`, depois `IDENT` (o id), depois `DOUBLE_COLON`.
2. Ler a tag: `IDENT` simples, ou `GREATER IDENT` (componente).
3. Verificar se o próximo token é `STRING` → se sim, é texto inline; armazenar em `ElementNode.text`.
4. Verificar se o próximo token é `PIPE_ARROW` → se sim, ler propriedades inline até encontrar quebra de linha ou início de filho `[`.
5. Ler filhos recursivamente: cada filho é um `PropBlockNode` ou `ElementNode` (ou `ComponentCallNode`).
6. Ao encontrar `]` correspondente (respeitando aninhamento), fechar o nó.

**Regra texto + filhos:** Se o parser encontrar texto inline e depois `[`, deve emitir `ParseError` com mensagem clara.

### Parsing de ComponentDef `[>Nome ...]`

Idêntico ao `ElementNode`, mas:

- O nome começa com maiúscula (verificado pelo Parser).
- Os slots `<nome>` dentro de `()` e `[<nome>tag]` são marcados especialmente.
- Não pode conter outra definição `[>Nome]` aninhada — se encontrar, emite `ParseError`.

### Parsing de ComponentCall `[>nome ...]`

Quando `>` é seguido por um `IDENT` que começa com maiúscula dentro de `[...]` que não está no topo (i.e., está como filho de outro nó), é uma chamada de componente.

Dentro de uma chamada, os filhos podem ser:
- `(<slots...>)` — passagem de slots de propriedade
- `[<slots...>]` — passagem de slots estruturais
- Nós regulares (ElementNode, ComponentCallNode)

O parser deve distinguir `(<...>)` de `()` pelo `ANGLE_OPEN` logo após `(`.

### Saída

`DocumentNode` com toda a árvore sintática.

---

## 5. Fase 3 — Resolvedor Semântico

Esta é a fase central do compilador. O Resolvedor recebe o AST bruto e produz um AST resolvido, onde toda a semântica está completamente determinada.

O `Resolver.ts` orquestra quatro sub-resolvedores que devem ser executados nesta ordem específica:

```
AST bruto
    │
    ▼
ComponentRegistry  ← registra todas as definições antes de qualquer outra coisa
    │
    ▼
SlotResolver       ← substitui chamadas de componente pela árvore instanciada
    │
    ▼
InheritanceResolver ← propaga estilos de pai para filho
    │
    ▼
LogicResolver      ← valida e resolve caminhos de eventos
    │
    ▼
AST resolvido
```

### 5.1 — ComponentRegistry

**O que faz:**

Percorre o `DocumentNode.componentDefs` e registra cada definição em um mapa `Map<string, ComponentDefNode>`. Essa etapa deve ocorrer antes de qualquer instanciação — garante que componentes possam referenciar outros já definidos (forward reference não é necessário, mas a ordem de registro deve ser completa antes do SlotResolver começar).

**Comportamento:**

- Chave do mapa: nome do componente (ex: `"Card"`, `"Layout"`).
- Se o mesmo nome for registrado duas vezes, emite `SemanticError: componente "X" já definido`.
- Não transforma nada. Apenas coleta.

### 5.2 — SlotResolver

**O que faz:**

Percorre o AST e substitui cada `ComponentCallNode` pela árvore expandida do componente referenciado, com os slots preenchidos.

**Algoritmo de instanciação:**

Para cada `ComponentCallNode` encontrado (em qualquer profundidade):

1. Buscar a definição no `ComponentRegistry`. Se não existir, emite `SemanticError: componente "X" não encontrado`.
2. Fazer uma **cópia profunda** da definição — nunca mutar a definição original, pois o mesmo componente pode ser instanciado múltiplas vezes.
3. Coletar os slots passados na chamada:
   - Slots de propriedade: extraídos de `(<...>)` — mapa `slotName → valor`
   - Slots estruturais: extraídos de `[<...>]` — mapa `slotName → {tag?, text?}`
4. Percorrer a cópia da definição e substituir cada slot marcado:
   - `<bg>background:#1E1E1E` dentro de `()`: se `bg` foi passado, usar o valor passado; caso contrário, usar `#1E1E1E` (valor padrão).
   - `[<title>h2 "Texto padrão"]` dentro de `[]`: se `title` foi passado com novo texto, substituir `"Texto padrão"` pelo novo; se passou nova tag, substituir `h2`; caso contrário, manter padrão.
5. Coletar os filhos "extras" da chamada (nós que não são `(<>)` nem `[<>]`): eles são injetados na árvore instanciada **na ordem em que aparecem na chamada**.
6. Se um id foi atribuído na chamada (`[>Card #my-card ...]`), aplicar esse id ao nó raiz da instância.
7. Substituir o `ComponentCallNode` no AST pelo nó raiz da instância.

**Regra crítica de ordem dos filhos:**

A ordem dos filhos do DOM compilado é determinada pela ordem dos filhos na chamada. Se a chamada tiver:

```
[>Layout
  [<header "Página principal">]
  [h2 "Subtítulo"]
  [>Card ...]
  [p "Texto"]
  [>Card ...]
]
```

O DOM gerado preserva exatamente essa ordem: header, h2, Card, p, Card.

O slot `<header>` substitui o nó marcado na definição de `Layout`; os demais filhos (`[h2]`, `[>Card]`, `[p]`, `[>Card]`) são inseridos após o conteúdo da definição ou intercalados conforme sua posição relativa na chamada.

**Recursividade:** Após instanciar um componente, o SlotResolver deve verificar se a instância contém outras `ComponentCallNode` e resolvê-las recursivamente.

### 5.3 — InheritanceResolver

**O que faz:**

Propaga propriedades visuais de pai para filho através da árvore. Após o SlotResolver, o AST não contém mais componentes — é uma árvore pura de `ElementNode` e `PropBlockNode`.

**Conceito central — conjunto computado:**

Cada nó possui um **conjunto computado de propriedades** que é a mesclagem de todas as propriedades herdadas dos ancestrais com as suas próprias. Apenas propriedades visuais e eventos são herdados — atributos `$` não são herdados.

**Algoritmo:**

O InheritanceResolver percorre a árvore em profundidade (DFS pré-ordem), mantendo uma pilha de contextos de propriedades.

Para cada nó visitado:

1. Pegar o contexto atual da pilha (conjunto de propriedades do pai).
2. Verificar se o nó tem `PropBlockNode` imediatamente anterior a ele (irmão imediato) ou `|>` próprio.
3. Mesclar: `propriedades_pai MERGED_WITH propriedades_proprias_do_no`.
   - A mesclagem sobrescreve chaves conflitantes com o valor local — propriedades do filho têm prioridade sobre o pai.
   - Propriedades ausentes no filho são herdadas do pai sem modificação.
4. Escrever o conjunto computado resultante em `ElementNode.resolvedProps`.
5. Empurrar esse conjunto computado na pilha.
6. Visitar filhos recursivamente.
7. Ao terminar os filhos, retirar da pilha (pop).

**Associação PropBlock ↔ ElementNode:**

Um `PropBlockNode` que aparece imediatamente antes de um `ElementNode` na lista de filhos do mesmo pai é "consumido" por aquele `ElementNode`. Após a resolução, esses `PropBlockNode` não precisam mais existir no AST — suas propriedades já estão em `resolvedProps` do nó correspondente.

**Regra de escopo do PropBlock:**

Um `PropBlockNode` fora de qualquer `ElementNode` (filho direto do `DocumentNode`) aplica-se ao primeiro `ElementNode` seguinte e a toda a sua subárvore. Um `PropBlockNode` dentro de um `ElementNode` aplica-se ao próximo irmão `ElementNode` dentro do mesmo pai.

**O que não é herdado:**

- Atributos HTML nativos `$attr`: ficam apenas no nó onde foram declarados.
- Responsividade: as propriedades responsivas (`md.prop:valor`) são armazenadas separadamente e não entram no fluxo de herança normal — elas são coletadas pelo `ResponsiveResolver`.

### 5.4 — LogicResolver

**O que faz:**

Percorre todos os nós que possuem eventos (`@evento:...`) em suas `resolvedProps` e valida/normaliza o caminho de resolução.

**Regras de resolução:**

Para cada entrada `@evento:valor` encontrada:

1. Verificar se `valor` contém `.`:
   - Sim → é um caminho explícito `namespace.acao`. Normalizar para `{ namespace: "namespace", action: "acao" }`.
   - Não → é uma ação simples `acao`. Verificar se o nó possui `id`:
     - Sim → normalizar para `{ namespace: id_do_no, action: "acao" }`.
     - Não → emitir `SemanticError: evento "@evento:acao" em nó sem id — caminho explícito necessário` com linha/coluna.

2. Se `@logic` foi declarado no documento, verificar se o arquivo lógico existe em disco. Se não existir, emitir aviso (não erro fatal), pois o arquivo pode ser criado posteriormente.

3. Armazenar o evento normalizado em `ElementNode.resolvedEvents` como lista de `{ event, namespace, action, nodeId? }`.

**Responsividade — ResponsiveResolver (sub-etapa do InheritanceResolver):**

Durante o InheritanceResolver, ao encontrar propriedades com formato `breakpoint.propriedade:valor`, elas são extraídas para uma estrutura separada:

```
ResponsiveRule {
  className: string     // gerado deterministicamente
  baseProps: Map        // propriedades sem breakpoint
  breakpoints: Map<breakpoint, Map<prop, valor>>
}
```

Essa estrutura alimenta o `CSSGenerator`. A regra de herança de responsividade é que as propriedades responsivas de um `PropBlock` aplicam-se ao nó pai ao qual o bloco está associado — e **não são herdadas pelos filhos** individualmente (o filho herda o `className` se necessário, mas não recria as media queries).

---

## 6. Fase 4 — Gerador de Saída

O `Generator.ts` recebe o AST resolvido e produz três strings independentes.

### 6.1 — HTMLGenerator

Percorre o AST resolvido em DFS e serializa cada `ElementNode` para HTML.

**Para cada nó:**

1. Abrir tag: `<tag`.
2. Se `id` presente: adicionar `id="valor"`.
3. Se `resolvedProps` contém propriedades visuais normais (sem breakpoint): adicionar `style="..."`.
4. Se `resolvedProps` contém `$atributos`: adicionar como atributos HTML diretos (`href`, `src`, etc.).
5. Se o nó possui `responsiveClassName` (atribuído pelo ResponsiveResolver): adicionar `class="className"`.
6. Fechar abertura da tag: `>`.
7. Se texto inline: emitir texto.
8. Recursão para filhos.
9. Fechar tag: `</tag>`.

**Formatação:**

O HTMLGenerator mantém um nível de indentação (inteiro) que incrementa a cada nível de profundidade. A indentação é configurável (padrão: 2 espaços).

**Atributos de evento:**

Eventos **não** são emitidos como atributos HTML (`onclick=...`). Eles são resolvidos via JS gerado. O HTMLGenerator não adiciona nenhum `on*` attribute.

### 6.2 — CSSGenerator

Recebe a lista de `ResponsiveRule` coletada pelo ResolvResolver e serializa para CSS.

**Para cada `ResponsiveRule`:**

1. Emitir o bloco base:
   ```css
   .className {
     prop: valor;
     ...
   }
   ```
2. Para cada breakpoint em ordem crescente de largura (`sm` < `md` < `lg` < `xl`), emitir:
   ```css
   @media (min-width: Xpx) {
     .className {
       prop: valor;
     }
   }
   ```

**Mapeamento de breakpoints para pixels:**

| Breakpoint | min-width |
|---|---|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

**Geração de className:**

O `className` deve ser **determinístico e único**. Estratégia recomendada: hash curto baseado no conjunto de propriedades do bloco. Formato: `_dsl_[tag]_[hash]` onde `[tag]` é a tag do nó raiz ao qual o bloco está associado e `[hash]` são os primeiros 6 caracteres de um hash MD5 ou similar do conteúdo das propriedades.

Se duas regras produzirem o mesmo hash (colisão), o gerador deve detectar e diferenciar.

### 6.3 — JSGenerator

Recebe a lista de eventos resolvidos de todos os nós do AST e gera o código de binding.

**Para cada evento resolvido:**

```
ElementNode.resolvedEvents → [{ event, namespace, action, nodeId }]
```

O JSGenerator emite, para cada entrada:

```ts
document.getElementById("nodeId")
  .addEventListener("event", () => logic["namespace"].action());
```

**Casos especiais:**

- Se o nó não tem id mas tem caminho explícito (ex: `@click:hero-section.openHero`), o binding usa o namespace do caminho.
- O JSGenerator envolve todo o output gerado em um bloco `document.addEventListener("DOMContentLoaded", () => { ... })` para garantir que o DOM esteja disponível.
- O JSGenerator emite, no topo do arquivo gerado, um comentário de aviso se `logicDirective` estiver presente — o arquivo de lógica externo deve ser importado manualmente ou o output deve importá-lo com `import` ES module.

**Output:**

```ts
import { logic } from "./page.logic.ts";   // se @logic declarado

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("hero-section")
    .addEventListener("click", () => logic["hero-section"].openHero());
});
```

---

## 7. Sistema de Herança de Propriedades

Esta seção detalha a lógica de mesclagem com mais precisão.

### Estrutura de contexto

O InheritanceResolver mantém uma pilha de objetos `PropContext`:

```
PropContext {
  visual: Map<string, string>       // prop → valor
  responsive: Map<string, Map<string, string>>  // breakpoint → (prop → valor)
  attrs: Map<string, string>        // $attr → valor (não herdado)
  events: Map<string, string>       // @evento → valor (herdado)
}
```

Ao entrar em um nó filho, o resolvedor cria um novo `PropContext` baseado no do pai:

```
novoContexto.visual = { ...contextoDosPais.visual, ...propriedadesPropriasDoNo.visual }
novoContexto.events = { ...contextoDosPais.events, ...propriedadesPropriasDoNo.events }
novoContexto.attrs = { ...propriedadesPropriasDoNo.attrs }   // NÃO herda attrs
novoContexto.responsive = propriedadesPropriasDoNo.responsive  // tratado separadamente
```

### Associação de PropBlock com seu nó alvo

A posição de um `PropBlock` na lista de filhos determina quem ele afeta:

```
irmãos = [PropBlock_A, ElementNode_X, PropBlock_B, ElementNode_Y, ElementNode_Z]
```

- `PropBlock_A` → afeta `ElementNode_X` e seus descendentes
- `PropBlock_B` → afeta `ElementNode_Y` e seus descendentes
- `ElementNode_Z` → não tem `PropBlock` próprio; herda somente do pai

Se dois `PropBlock` consecutivos aparecerem sem `ElementNode` entre eles, o segundo sobrescreve o primeiro (ou ambos são mesclados em ordem). Um `PropBlock` sem `ElementNode` seguinte dentro do mesmo escopo é descartado com aviso.

### Sobrescrita de breakpoints

Se o pai tem `md.grid-template-columns:1fr 1fr` e o filho tem `md.grid-template-columns:1fr`, o filho sobrescreve a propriedade responsiva do pai para aquele breakpoint. A mesclagem responsiva segue a mesma lógica da mesclagem visual: chave sobrescreve chave.

---

## 8. Sistema de Componentes

### Cópia profunda da definição

Ao instanciar um componente, a cópia da definição deve ser **totalmente independente** da definição original. Isso é crítico porque o SlotResolver modifica a cópia in-place durante o preenchimento dos slots.

A cópia profunda deve incluir todos os níveis da árvore, todos os `PropEntry`, todos os `ElementNode` filhos.

### Preenchimento de slots — detalhamento

**Slot de propriedade visual:**

Na definição:
```
(<bg>background:#1E1E1E)
```
Isso significa: "a propriedade `background` neste contexto pode ser customizada via slot `bg`; o valor padrão é `#1E1E1E`".

Na chamada:
```
(<bg:#ffffff>)
```
O SlotResolver localiza todas as ocorrências de `<bg>` na cópia da definição e substitui o valor pelo passado (`#ffffff`).

**Slot estrutural:**

Na definição:
```
[<title>h2 "Título padrão"]
```
Isso significa: "este nó pode ser customizado via slot `title`; padrão é `h2` com texto `"Título padrão"`".

Na chamada:
```
[<title "Outro título">]
```
O SlotResolver localiza o nó marcado com `<title>` na cópia e substitui apenas o texto, mantendo a tag `h2`. Se a tag também fosse passada (`[<title h3 "Outro">]`), a tag também seria substituída.

**Resolução parcial:**

Se apenas `bg` é passado e a definição também tem `pad`, o slot `pad` usa seu valor padrão (`16px`). O SlotResolver não exige que todos os slots sejam passados.

### Slots estruturais vs filhos extras

Dentro de uma chamada de componente, os filhos se dividem em dois grupos:

1. **Slots estruturais** `[<nomeSlot ...>]`: vão para posições específicas marcadas na definição.
2. **Filhos extras**: qualquer `ElementNode` ou `ComponentCallNode` não marcado como slot. Eles são inseridos **depois** do conteúdo raiz da definição, na ordem em que aparecem.

Esse comportamento é análogo ao `children` do React: o componente tem sua estrutura interna, e os filhos extras são adicionados ao final do nó raiz.

### Recursividade e profundidade

O SlotResolver deve detectar chamadas circulares de componentes (A instancia B que instancia A). Se detectado, emite `SemanticError: ciclo de componentes detectado: A → B → A`.

---

## 9. Sistema de Responsividade

### Quando uma regra responsiva é criada

Uma `ResponsiveRule` é criada sempre que um `PropBlock` (ou propriedade inline `|>`) contém pelo menos uma entrada no formato `breakpoint.prop:valor`.

### Associação nó ↔ className

O nó raiz ao qual o `PropBlock` está associado recebe o `responsiveClassName` gerado. Todos os seus filhos **também** recebem o mesmo `className`, pois a especificação mostra que o CSS responsivo com herança se aplica a todos os nós afetados pelo bloco.

Isso é análogo à herança visual: se o `PropBlock` seria aplicado ao elemento e seus descendentes, o `className` também é aplicado a todos eles.

### CSS gerado

O `CSSGenerator` garante que cada `ResponsiveRule` seja emitida uma única vez, mesmo que o mesmo `className` apareça em múltiplos nós. O gerador mantém um `Set<string>` de classes já emitidas.

### Propriedades base + responsivas no mesmo bloco

Um bloco pode ter propriedades base e responsivas simultaneamente:

```
(
  display:grid
  grid-template-columns:1fr
  gap:24px
  md.grid-template-columns:1fr 1fr
)
```

As propriedades base (`display`, `grid-template-columns:1fr`, `gap`) vão para o bloco CSS principal. As responsivas (`md.grid-template-columns`) vão para o `@media` correspondente. No `style=""` inline do HTML, apenas as propriedades base (sem breakpoint) são incluídas.

Se o nó tem tanto propriedades visuais simples quanto responsivas, o gerador de HTML emite `style="..."` para as simples e `class="..."` para as responsivas — ambos podem coexistir no mesmo elemento HTML.

---

## 10. Sistema de Ligação Lógica

### Arquivo de lógica externo

O `@logic "caminho"` no topo do arquivo DSL declara o arquivo que exporta o objeto `logic`. O compilador não precisa ler nem parsear esse arquivo — ele apenas precisa do caminho para gerar os imports corretos.

### Estrutura esperada do arquivo lógico

O compilador assume que o arquivo lógico exporta um objeto `logic` onde as chaves são os ids dos nós e os valores são objetos com os métodos:

```ts
export const logic = {
  "hero-section": {
    openHero() { ... }
  }
}
```

Se o arquivo lógico usa `module.exports` (CommonJS), o JSGenerator deve ajustar o import.

### Validação em build time

O LogicResolver valida que:

- Todo evento `@evento:acao` em nó com id tem o caminho `logic[id].acao` disponível — se o arquivo lógico existir em disco, o resolvedor pode lê-lo e verificar se `logic["id"]` e `logic["id"]["acao"]` existem; se não existirem, emite aviso.
- Todo evento `@evento:ns.acao` em nó sem id tem `ns` e `acao` bem formados (não contém espaços, caracteres inválidos).
- Evento sem caminho resolvível emite `SemanticError` fatal.

### Múltiplos eventos no mesmo nó

Um nó pode ter múltiplos eventos:

```
[#btn::button |> @click:submit @change:updateField]
```

Cada evento gera um `addEventListener` separado no output JS.

---

## 11. Gerenciamento de Erros

### Filosofia

O compilador deve **acumular erros** sempre que possível, em vez de parar na primeira ocorrência. Isso permite ao desenvolvedor ver todos os problemas de uma vez.

Exceção: erros que tornam impossível continuar (ex: token inválido no Lexer que impede a formação de tokens subsequentes) são fatais e interrompem imediatamente.

### Níveis de severidade

| Nível | Significado | Comportamento |
|---|---|---|
| `ERROR` | Problema que impede saída válida | Acumula, nenhum artefato é escrito |
| `WARNING` | Problema que não impede saída | Acumula, artefatos são escritos com aviso |
| `INFO` | Nota informativa | Exibido mas não conta como falha |

### Estrutura de erro

```
CompilerError {
  level: "ERROR" | "WARNING" | "INFO"
  phase: "lexer" | "parser" | "resolver" | "generator"
  message: string
  line: number
  col: number
  source?: string   // trecho do código que causou o erro
}
```

### Erros por fase

**Lexer:**
- Caractere não reconhecido
- String não fechada
- `@logic` com caminho inválido

**Parser:**
- Tag não permitida (não está no conjunto permitido)
- Nó com texto + filhos simultaneamente
- Definição de componente com nome em minúscula
- Definição de componente aninhada dentro de outra
- `::` sem `#` antes ou sem tag depois
- Atributo `$` sem nome ou sem valor
- `|>` fora de um contexto de nó

**Resolver:**
- Componente não encontrado no registry
- Ciclo de componentes
- Evento sem caminho resolvível
- Dois componentes com mesmo nome
- PropBlock sem nó alvo

**Generator:**
- Colisão de className (tratado como WARNING, não ERROR)

---

## 12. Orquestrador (entry point)

O `Compiler.ts` é a única API pública do compilador. Ele expõe uma função que recebe as opções de compilação e retorna os artefatos.

### Interface de entrada

```
CompilerOptions {
  source: string              // conteúdo do arquivo .brd
  filename: string            // nome base para nomes de artefatos
  rootDir: string             // diretório raiz para resolver @logic
  outputDir: string           // onde escrever os artefatos
  indentSize?: number         // padrão: 2
  cssMode?: "inline" | "file" // padrão: "file"
}
```

### Interface de saída

```
CompilerResult {
  html: string
  css: string                 // vazio se cssMode = "inline"
  js: string
  errors: CompilerError[]
  warnings: CompilerError[]
  success: boolean            // true se nenhum ERROR
}
```

### Sequência de execução

```
1. Lexer.tokenize(source)
     → se erros fatais: retornar resultado com errors, success=false
2. Parser.parse(tokens)
     → se erros: acumular, continuar se possível
3. Resolver.resolve(ast)
     → sub-fases em ordem: ComponentRegistry, SlotResolver, InheritanceResolver, LogicResolver
     → acumular erros e warnings
4. Generator.generate(resolvedAst)
     → HTMLGenerator, CSSGenerator, JSGenerator
     → acumular warnings
5. Se success=true: escrever artefatos em outputDir
6. Retornar CompilerResult
```

### CLI (`cli/index.ts`)

O CLI lê argumentos da linha de comando, chama `Compiler`, exibe erros formatados no terminal e retorna código de saída `0` (sucesso) ou `1` (erro).

Formato de exibição de erros no terminal:
```
[ERROR] parser @ linha 12, col 5: tag "span" não é permitida
[WARN]  resolver @ linha 8, col 1: PropBlock sem nó alvo — será ignorado
```

---

## 13. Fluxo completo de dados

Para ilustrar o fluxo end-to-end, acompanhe o exemplo abaixo sendo processado:

**Entrada:**

```txt
@logic "./page.logic.ts"

(
  background:#121212
  color:#FFFFFF
)
[#hero::section
  [h1 "Título"]
  [p "Subtítulo"]
]
```

**Após Lexer:**

```
LOGIC_DIRECTIVE, STRING("./page.logic.ts"),
LPAREN,
  IDENT("background"), COLON, IDENT("#121212"),
  IDENT("color"), COLON, IDENT("#FFFFFF"),
RPAREN,
LBRACKET, HASH, IDENT("hero"), DOUBLE_COLON, IDENT("section"),
  LBRACKET, IDENT("h1"), STRING("Título"), RBRACKET,
  LBRACKET, IDENT("p"), STRING("Subtítulo"), RBRACKET,
RBRACKET, EOF
```

**Após Parser (AST bruto):**

```
DocumentNode {
  logicDirective: "./page.logic.ts"
  componentDefs: []
  children: [
    PropBlockNode {
      entries: [
        { type: "visual", prop: "background", value: "#121212" },
        { type: "visual", prop: "color", value: "#FFFFFF" }
      ]
    },
    ElementNode {
      id: "hero"
      tag: "section"
      text: null
      ownProps: null   ← PropBlock ainda separado, não mesclado
      children: [
        ElementNode { id: null, tag: "h1", text: "Título", children: [] },
        ElementNode { id: null, tag: "p", text: "Subtítulo", children: [] }
      ]
    }
  ]
}
```

**Após Resolver (AST resolvido):**

```
DocumentNode {
  logicDirective: "./page.logic.ts"
  children: [
    ElementNode {
      id: "hero"
      tag: "section"
      resolvedProps: {
        visual: { background: "#121212", color: "#FFFFFF" },
        attrs: {},
        events: {}
      }
      children: [
        ElementNode {
          tag: "h1", text: "Título",
          resolvedProps: {
            visual: { background: "#121212", color: "#FFFFFF" }
          }
        },
        ElementNode {
          tag: "p", text: "Subtítulo",
          resolvedProps: {
            visual: { background: "#121212", color: "#FFFFFF" }
          }
        }
      ]
    }
  ]
}
```

**Após HTMLGenerator:**

```html
<section id="hero" style="background:#121212; color:#FFFFFF">
  <h1 style="background:#121212; color:#FFFFFF">Título</h1>
  <p style="background:#121212; color:#FFFFFF">Subtítulo</p>
</section>
```

**Após CSSGenerator:**

```css
/* vazio — nenhuma propriedade responsiva neste exemplo */
```

**Após JSGenerator:**

```ts
import { logic } from "./page.logic.ts";

document.addEventListener("DOMContentLoaded", () => {
  /* nenhum evento declarado neste exemplo */
});
```

---

### Considerações finais sobre a ordem das fases

Cada fase depende da anterior ser completa antes de começar. Nenhuma fase pode ser paralelizada com outra no mesmo arquivo porque:

- O Parser precisa de todos os tokens (o Lexer precisa completar).
- O SlotResolver precisa do ComponentRegistry completo antes de instanciar qualquer componente.
- O InheritanceResolver precisa da árvore com componentes já expandidos (sem nenhum `ComponentCallNode` restante).
- O LogicResolver precisa das `resolvedProps` já computadas para verificar eventos.
- Os três geradores podem rodar em paralelo entre si, pois cada um lê o AST resolvido de forma independente sem modificá-lo.
