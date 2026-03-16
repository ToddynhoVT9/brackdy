# Brackdy Compiler — Especificação do Parser

## Visão Geral

O parser é um parser de descida recursiva escrito à mão. Consome um array `Token[]` (produzido pelo Lexer) e emite um nó `Program` no AST.

---

## Interface da Classe Parser

```ts
class Parser {
  constructor(tokens: Token[]) {}
  parse(): Program

  // Auxiliares internos de cursor
  private current(): Token
  private peek(offset?: number): Token
  private advance(): Token
  private expect(type: TokenType, hint?: string): Token
  private check(type: TokenType): boolean
  private checkValue(type: TokenType, value: string): boolean
  private isAtEnd(): boolean
  private error(msg: string, token?: Token): never
}
```

---

## Parse de Nível Superior: `parseProgram()`

```
Program := LogicDecl? (ComponentDef | PropBlock | NodeDecl)*
```

1. Se o token atual for `KW_LOGIC`, chamar `parseLogicDecl()` → definir `logicFile`
2. Loop até EOF:
   - Se `LBRACKET` seguido de `DOUBLE_RANGLE` → `parseComponentDef()`
   - Se `LBRACKET` seguido de `RANGLE` → `parseComponentCall()`
   - Se `LPAREN` → `parsePropBlock()`
   - Se `LBRACKET` → `parseNodeDecl()`
   - Caso contrário → erro

**A disambiguação é trivial e completamente orientada por tokens:**
- `[>>Name` (`LBRACKET DOUBLE_RANGLE`) → sempre um **ComponentDef**
- `[>Name` (`LBRACKET RANGLE`) → sempre um **ComponentCall**

Sem inspeção de corpo, sem varredura em dois passos, sem heurísticas. O lexer emite tokens distintos (`DOUBLE_RANGLE` vs `RANGLE`), então o parser faz o dispatch com uma única verificação `peek(1)`.

---

## `parseLogicDecl()`

```
LogicDecl := KW_LOGIC STRING
```

Consumir `KW_LOGIC`, depois `expect(STRING)`, retornar o valor da string.

---

## `parsePropBlock()`

```
PropBlock := LPAREN Prop* RPAREN
```

1. Consumir `LPAREN`
2. Loop até `RPAREN`:
   - `parseOneProp()`
3. Consumir `RPAREN`

---

## `parseOneProp()` — chamado dentro de `()` e `|>`

```
Prop := VisualProp | ResponsiveProp | EventProp | AttrProp

VisualProp    := IDENT COLON ValueTokens
ResponsiveProp := IDENT DOT IDENT COLON ValueTokens
EventProp     := AT IDENT COLON ActionPath
AttrProp      := DOLLAR IDENT COLON (STRING | ValueTokens)
```

**Dispatch:**
- `AT` → `parseEventProp()`
- `DOLLAR` → `parseAttrProp()`
- `IDENT DOT IDENT COLON` → `parseResponsiveProp()` (olhar à frente para verificar `.` após o primeiro IDENT e que o primeiro IDENT é um breakpoint: `sm|md|lg|xl`)
- `IDENT COLON` → `parseVisualProp()`

### `parseVisualProp()`
1. Consumir chave `IDENT`
2. Consumir `COLON`
3. Chamar `parseValue()` → retorna uma string

### `parseResponsiveProp()`
1. Consumir breakpoint `IDENT` → valor do breakpoint
2. Consumir `DOT`
3. Consumir chave `IDENT`
4. Consumir `COLON`
5. Chamar `parseValue()` → retorna uma string

### `parseEventProp()`
1. Consumir `AT`
2. Consumir nome do evento `IDENT` (ex.: `click`)
3. Consumir `COLON`
4. Consumir `IDENT` → primeira parte (ação ou namespace)
5. Se o próximo for `DOT`:
   - consumir `DOT`
   - consumir `IDENT` → ação
   - definir namespace = primeira parte, ação = segunda parte
6. Caso contrário: namespace = null, ação = primeira parte

### `parseAttrProp()`
1. Consumir `DOLLAR`
2. Consumir nome do atributo `IDENT` (ex.: `href`)
3. Consumir `COLON`
4. Se o próximo for `STRING`: consumir e usar como valor
5. Caso contrário: chamar `parseValue()`

---

## `parseValue()` — lê um valor CSS/atributo

Valores não estão entre aspas e terminam em: `RPAREN`, `RBRACKET`, `COMMA` ou quebra de linha (aproximado verificando a diferença de número de linha).

**Algoritmo:**
1. Acumular tokens em um buffer de string, separados por espaços
2. Um token de valor pode ser: `IDENT`, `HASH + IDENT` (→ `#valor`), `IDENT DOT IDENT` quando NÃO é um breakpoint (→ reconstruído como está para coisas como `1fr`)
3. Parar quando o próximo token for um terminador

**Terminadores:** `RPAREN`, `RBRACKET`, `COMMA`, `EOF`, ou quando o próximo `IDENT` estiver em uma nova linha e for seguido de `COLON` (início de nova propriedade)

> A implementação mais simples: rastrear a linha do token atual. Quando a linha mudar E os próximos dois tokens parecerem `IDENT COLON` (nova propriedade), interromper o valor.

---

## `parseNodeDecl()` / `parseComponentCall()`

```
Node := LBRACKET NodeHead NodeBody RBRACKET

NodeHead := (HASH IDENT DOUBLE_COLON)? IDENT    -- id::tag ou apenas tag
          | RANGLE IDENT                          -- chamada de componente: >Name  (NÃO >>)

NodeBody := (PIPE_ARROW InlinePropList)?
            (STRING | ChildList)?

ChildList := (PropBlock | NodeDecl | ComponentCall)*
```

### Parsing do `NodeHead`
1. Consumir `LBRACKET`
2. Se o próximo for `RANGLE` (único `>`): é uma chamada de componente → `parseComponentCall()`
3. Se o próximo for `DOUBLE_RANGLE` (`>>`): é uma definição de componente → `parseComponentDef()` (erro se não estiver no nível superior)
4. Se o próximo for `HASH`:
   - consumir `HASH`
   - consumir `IDENT` → id
   - consumir `DOUBLE_COLON`
   - consumir `IDENT` → tag
5. Caso contrário: consumir `IDENT` → tag; id = null

### Parsing de props inline `|>`
Após tag (e id opcional), se o próximo for `PIPE_ARROW`:
1. Consumir `PIPE_ARROW`
2. Fazer parse das props até atingir uma quebra de linha sem mais props ou `RBRACKET`
   - Mesma lógica de `parseOneProp()`; parar quando o próximo token iniciar uma nova linha e NÃO for `@`, `$` ou uma propriedade CSS

> Na prática, as props `|>` são separadas por espaços em uma única linha lógica. O parser lê props até encontrar uma quebra de linha antes de um token não-propriedade, ou `RBRACKET`.

### Parsing do corpo do nó
Após head + props inline opcionais:
- Se o próximo for `STRING`: text = consumir valor da string
- Caso contrário: fazer parse dos filhos até `RBRACKET`

### Parsing dos filhos
Loop até `RBRACKET`:
- `LPAREN` → `parsePropBlock()`
- `LBRACKET` depois peek `RANGLE` → `parseComponentCall()`
- `LBRACKET` depois peek `DOUBLE_RANGLE` → erro (`PARSE_NESTED_DEF`)
- `LBRACKET` → `parseNodeDecl()`

---

## `parseComponentCall()`

```
ComponentCall := LBRACKET RANGLE IDENT 
                 (HASH IDENT)?           -- id opcional
                 PropSlotCall?           -- (<slot:val, ...>)
                 NodeSlotCall?           -- [<slot "val", ...>]
                 ExtraChild*
                 RBRACKET

PropSlotCall  := LPAREN LANGLE SlotPropPair (COMMA SlotPropPair)* RANGLE RPAREN
SlotPropPair  := IDENT COLON Value

NodeSlotCall  := LBRACKET LANGLE SlotNodePair (COMMA SlotNodePair)* RANGLE RBRACKET
SlotNodePair  := IDENT STRING

ExtraChild    := PropBlock | NodeDecl | ComponentCall
```

1. Consumir `LBRACKET`, `RANGLE`, nome `IDENT`
2. Se o próximo for `HASH`: consumir `HASH`, `IDENT` → id
3. Se o próximo for `LPAREN` e peek(1) for `LANGLE`: fazer parse de `PropSlotCall`
4. Se o próximo for `LBRACKET` e peek(1) for `LANGLE`: fazer parse de `NodeSlotCall`
5. Fazer parse dos itens `ExtraChild` restantes
6. Consumir `RBRACKET`

---

## `parseComponentDef()`

```
ComponentDef := LBRACKET DOUBLE_RANGLE IDENT
                PropSlotDefBlock?     -- ( <slot>key:val ... )
                NodeDefBody
                RBRACKET

PropSlotDefBlock  := LPAREN SlotPropDefEntry+ RPAREN
SlotPropDefEntry  := LANGLE IDENT RANGLE IDENT COLON Value

NodeDefBody := NodeDecl (com filhos SlotNodeDef)
```

1. Consumir `LBRACKET`, `DOUBLE_RANGLE`, nome `IDENT`
2. Se o próximo for `LPAREN`: fazer parse de `PropSlotDefBlock`
3. Fazer parse de `NodeDefBody` (um `NodeDecl` cujos filhos podem conter `SlotNodeDef`s)
4. Consumir `RBRACKET`

Um `SlotNodeDef` é parseado quando, dentro dos filhos de um `NodeDecl`, encontramos:
```
LBRACKET LANGLE IDENT RANGLE IDENT STRING? RBRACKET
```
ou seja, `[<nomeSlot>tag "textoDefault"]`

---

## Regras de Validação do Parser

| Regra | Erro |
|---|---|
| Texto e filhos coexistem no mesmo nó | `ParseError: nó não pode ter texto inline e filhos ao mesmo tempo` |
| `#id` sem `::tag` seguinte | `ParseError: declaração de id deve ser seguida de :: e nome de tag` |
| Nome de tag desconhecido | `ParseError: tag desconhecida "<n>"` |
| Nome de componente começa com minúscula | `ParseError: nomes de componente devem começar com letra maiúscula` |
| `[>>Def]` aninhado dentro de qualquer nó ou corpo de componente | `ParseError: definições de componente não podem ser aninhadas` |

### Tags permitidas (whitelist)
```ts
const ALLOWED_TAGS = new Set([
  "main", "section", "article", "nav", "aside", "header", "footer", "div",
  "h1", "h2", "h3", "p",
  "button", "a"
]);
```
