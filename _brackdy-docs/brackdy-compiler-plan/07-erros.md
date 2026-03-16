# Brackdy Compiler — Tratamento de Erros

## Filosofia de Erros

- **Falhar rápido:** o compilador para no primeiro erro de cada fase
- **Mensagens descritivas:** cada erro inclui arquivo, linha, coluna e uma explicação legível por humanos
- **Rótulos de fase:** os erros são marcados com a fase que os produziu (Lex, Parse, Semantic, Codegen)

---

## Classe Base de Erro

```ts
class BrackdyError extends Error {
  constructor(
    public phase: "Lex" | "Parse" | "Semantic" | "Codegen",
    public message: string,
    public line: number,
    public col: number,
    public source?: string     // linha fonte original para contexto
  ) {
    super(`[${phase}] Linha ${line}:${col} — ${message}`);
  }
}
```

---

## Erros do Lexer

| Código | Gatilho | Mensagem |
|---|---|---|
| `LEX_UNTERMINATED_STRING` | EOF antes do fechamento `"` | `String literal não terminada` |
| `LEX_UNEXPECTED_CHAR` | Caractere que não faz parte de nenhum token | `Caractere inesperado: '${char}'` |

---

## Erros do Parser

| Código | Gatilho | Mensagem |
|---|---|---|
| `PARSE_EXPECTED_TOKEN` | `expect()` falha | `Esperado ${tokenType}, encontrado ${actual.type} ("${actual.value}")` |
| `PARSE_UNKNOWN_TAG` | Nome de tag não está no conjunto permitido | `Tag desconhecida: "${name}". Permitidas: main, section, article, nav, aside, header, footer, div, h1, h2, h3, p, button, a` |
| `PARSE_INVALID_ID` | `#` não seguido por chars de id válidos | `Id inválido: ids podem conter letras, dígitos, - e _` |
| `PARSE_ID_WITHOUT_TAG` | `#id` não seguido de `::tag` | `Declaração de id "#${id}" deve ser seguida de "::" e um nome de tag` |
| `PARSE_TEXT_AND_CHILDREN` | Texto e filhos no mesmo nó | `Nó "${tag}" não pode ter texto inline e filhos ao mesmo tempo` |
| `PARSE_COMPONENT_LOWERCASE` | `[>>nome]` ou `[>nome]` com inicial minúscula | `Nomes de componente devem começar com letra maiúscula: "${name}"` |
| `PARSE_NESTED_DEF` | `[>>Def]` dentro de qualquer nó ou corpo de componente | `Definições de componente não podem ser aninhadas. Use [>>Name] apenas no nível superior` |
| `PARSE_UNEXPECTED_EOF` | Token stream termina inesperadamente | `Fim de arquivo inesperado durante o parsing de ${context}` |

---

## Erros Semânticos

| Código | Gatilho | Mensagem |
|---|---|---|
| `SEM_UNKNOWN_COMPONENT` | Chamada `[>Name]` com nome não registrado | `Componente desconhecido: "${name}". Ele está definido antes desta chamada?` |
| `SEM_DUPLICATE_COMPONENT` | Duas definições com o mesmo nome | `Componente "${name}" está definido mais de uma vez` |
| `SEM_DUPLICATE_ID` | Dois nós com o mesmo id | `Id duplicado: "${id}". Todos os ids devem ser únicos dentro de um arquivo` |
| `SEM_EVENT_NO_ID` | `@evento:acao` em nó sem id e sem namespace | `Evento "@${event}:${action}" requer que o nó tenha um id, ou use um caminho explícito como "@${event}:namespace.${action}"` |
| `SEM_EVENT_NO_LOGIC` | Evento declarado mas sem `@logic` no arquivo | `Evento "@${event}:${action}" encontrado mas nenhum arquivo de lógica declarado. Adicione "@logic \"./seu.logic.ts\"" no topo do arquivo` |
| `SEM_UNKNOWN_SLOT` | Sobrescrita de slot referencia um slot não existente na definição | `Slot desconhecido "${name}" no componente "${component}". Slots disponíveis: ${list}` |
| `SEM_LOGIC_UNUSED` | `@logic` declarado mas sem eventos no arquivo | Aviso (não fatal): `@logic declarado mas nenhum evento encontrado neste arquivo` |

---

## Formatação de Erros

Ao imprimir no console, mostrar a linha fonte com um cursor:

```
[Parse] Linha 12:5 — Tag desconhecida: "span". Permitidas: main, section, article...

  12 |   [span "hello"]
         ^^^^^
```

Implementação:
- Dividir a fonte por `\n`, obter a linha no índice `error.line - 1`
- Imprimir a linha com prefixo de barra
- Imprimir espaços + cursor(es) alinhados a `error.col`

---

## Estratégia de Recuperação

**v0.3: Sem recuperação de erros.** O compilador coleta o primeiro erro por fase e para. Isso é intencional — saída de compilação parcial seria enganosa.

Versões futuras podem coletar múltiplos erros em um único passo usando uma estratégia de `continue`.

---

## Aviso vs Erro

Na v0.3, existe apenas um aviso: `SEM_LOGIC_UNUSED`. Todos os outros diagnósticos são erros que interrompem a compilação.

Avisos são impressos no stderr mas não definem um código de saída não-zero.

---

## Códigos de Saída (CLI)

| Código | Significado |
|---|---|
| `0` | Sucesso |
| `1` | Erro de compilação (qualquer fase) |
| `2` | Arquivo não encontrado / erro de IO |
| `3` | Argumentos de CLI inválidos |
