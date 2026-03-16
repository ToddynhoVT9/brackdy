# Brackdy Compiler — Especificação do Lexer

## Interface Token

```ts
interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}
```

---

## Enum TokenType

```ts
enum TokenType {
  // Estruturais
  LBRACKET,        // [
  RBRACKET,        // ]
  LPAREN,          // (
  RPAREN,          // )
  LANGLE,          // <   (abertura de slot em definições/chamadas)
  RANGLE,          // >   (fechamento de slot em definições/chamadas; também prefixo de CHAMADA de componente)
  DOUBLE_RANGLE,   // >>  (prefixo de DEFINIÇÃO de componente)

  // Operadores
  DOUBLE_COLON,    // ::
  PIPE_ARROW,      // |>
  HASH,            // #
  AT,              // @
  DOLLAR,          // $
  DOT,             // .
  COLON,           // :
  COMMA,           // ,

  // Literais
  STRING,          // "..." — valor contém o conteúdo SEM as aspas
  IDENT,           // qualquer identificador: nomes de tag, ids, nomes de evento, nomes de prop, etc.

  // Palavras-chave (reconhecidas durante o lexing para clareza; tratadas como IDENT no parser como fallback)
  KW_LOGIC,        // @logic  (o token completo incluindo @)

  // Especial
  EOF,
}
```

---

## Regras do Lexer (ordem de prioridade)

### 1. Espaço em branco e quebras de linha
- Ignorar todo espaço em branco (` `, `\t`, `\r`, `\n`)
- Rastrear linha/coluna para relatórios de erro

### 2. Comentários
- Nenhuma sintaxe de comentário definida na v0.3. Reservado para uso futuro.

### 3. `@logic`
- Quando `@` é seguido imediatamente por `logic` (sem espaço), emitir um único token `KW_LOGIC` com valor `@logic`.
- Olhar à frente: se o identificador após `@` NÃO for `logic`, emitir `AT` e continuar.

### 4. Operadores de dois caracteres (verificar antes dos de um caractere)
- `::` → `DOUBLE_COLON`
- `|>` → `PIPE_ARROW`
- `>>` → `DOUBLE_RANGLE`  ← **deve ser verificado antes do `>` simples**

> **Nota de prioridade:** quando o caractere atual é `>` e o próximo também é `>`, emitir `DOUBLE_RANGLE`. Emitir `RANGLE` apenas quando o próximo caractere NÃO for `>`.

### 5. Tokens de um caractere
```
[  →  LBRACKET
]  →  RBRACKET
(  →  LPAREN
)  →  RPAREN
<  →  LANGLE
>  →  RANGLE
#  →  HASH
@  →  AT
$  →  DOLLAR
.  →  DOT
:  →  COLON
,  →  COMMA
```

### 6. Strings entre aspas
- Detectada a abertura `"`
- Consumir caracteres até o fechamento `"`
- Emitir `STRING` com valor = conteúdo entre as aspas (sem escaping definido na v0.3)
- Erro se EOF antes do fechamento `"`

### 7. Identificadores
- Primeiro caractere: letra (`a-z`, `A-Z`) ou `_`
- Subsequentes: letra, dígito, `-`, `_`
- Nota: `-` é permitido dentro de identificadores (para propriedades CSS como `grid-template-columns`, ids HTML como `hero-section` e nomes de evento)
- Emitir `IDENT`

### 8. Caractere desconhecido
- Emitir um `LexError` com informações de posição

---

## Disambiguação de Identificadores

O lexer emite todos os tokens semelhantes a palavras como `IDENT`. O parser faz a disambiguação pelo contexto:

| Contexto | Exemplos |
|---|---|
| Após `[` (posição de tag) | `section`, `h1`, `main`, `article` … |
| Após `[#id::` | mesmo conjunto de tags |
| Após `[>>` (`DOUBLE_RANGLE`) | nomes de **definição** de componente começando com maiúscula |
| Após `[>` (`RANGLE`) | nomes de **chamada** de componente começando com maiúscula |
| Após `(` em sua própria linha | nome de propriedade CSS |
| Após `@` (exceto `logic`) | nome de evento |
| Após `$` | nome de atributo HTML |
| Após `bp.` | nome de propriedade CSS |
| Prefixo de breakpoint | `sm`, `md`, `lg`, `xl` — testado pelo parser quando `.` se segue |

---

## Exemplos do Lexer

### Entrada
```
[#hero-section::section |> background:#181818 padding:32px
```

### Token stream
```
LBRACKET
HASH
IDENT("hero-section")
DOUBLE_COLON
IDENT("section")
PIPE_ARROW
IDENT("background")
COLON
IDENT("#181818")     ← cor hex é tokenizada como IDENT (começa com #? Não — # é seu próprio token)
```

**Caso especial importante:** `#181818` em posição de valor.

Quando `#` aparece dentro de um valor de propriedade (após `:`), ainda é tokenizado como token `HASH` seguido de `IDENT("181818")`. O **parser** recombina `HASH + IDENT` em uma string de valor de cor `"#181818"` quando está em contexto de leitura de valor.

---

### Entrada
```
@logic "./landing.logic.ts"
```

### Token stream
```
KW_LOGIC
STRING("./landing.logic.ts")
```

---

### Entrada
```
(<bg:#ffffff, pad:20px>)
```

### Token stream
```
LPAREN
LANGLE
IDENT("bg")
COLON
HASH
IDENT("ffffff")
COMMA
IDENT("pad")
COLON
IDENT("20px")
RANGLE
RPAREN
```

---

### Entrada
```
[<title "Outro título", body "Outro conteúdo">]
```

### Token stream
```
LBRACKET
LANGLE
IDENT("title")
STRING("Outro título")
COMMA
IDENT("body")
STRING("Outro conteúdo")
RANGLE
RBRACKET
```

---

### Entrada
```
[>>Card
```

### Token stream
```
LBRACKET
DOUBLE_RANGLE
IDENT("Card")
```

### Entrada
```
[>Card]
```

### Token stream
```
LBRACKET
RANGLE
IDENT("Card")
RBRACKET
```

> Observe como `>>` (definição) e `>` (chamada) produzem tokens distintos. O parser nunca precisa olhar para dentro do corpo para determinar se um bloco `[>...]` é uma definição ou uma chamada — o próprio token é o sinal.

---

## Interface da Classe Lexer

```ts
class Lexer {
  constructor(source: string) {}
  tokenize(): Token[]
  private advance(): string
  private peek(offset?: number): string
  private readString(): Token
  private readIdent(): Token
  private skipWhitespace(): void
  private error(msg: string): never
}
```

---

## Notas sobre Tokenização de Valores

Valores no Brackdy aparecem após `:` em contextos de propriedade. Eles NÃO são entre aspas (exceto valores de atributos HTML `$`, que PODEM ser strings entre aspas). Valores sem aspas terminam em espaço em branco, `,`, `)`, `\n` ou `]`.

O lexer NÃO trata valores de forma especial — tokeniza de forma gulosa em `IDENT`, `HASH`, `DOT`, `COLON` etc., e o parser reconstrói as strings de valor em modo de leitura de valor.

**Regras de reconstrução de valor (responsabilidade do parser):**
- `HASH IDENT` → `"#" + ident.value` (cor hexadecimal)
- `IDENT DOT IDENT` → mantido como sequência DOT para detecção de breakpoint ou reconstruído como `"valor"` em contexto de valor simples
- `IDENT` sozinho → valor simples (ex.: `16px`, `1fr`, `grid`, `flex`, `center`)
- Múltiplos `IDENT`s separados por espaços → valor multi-token (ex.: `grid-template-columns:1fr 1fr 1fr` → valor = `"1fr 1fr 1fr"`)

Valores com múltiplas palavras (como `1fr 1fr 1fr`) são analisados consumindo tokens `IDENT` até que um terminador seja encontrado (quebra de linha, `,`, `)`, `RBRACKET`).
