# Brackdy Compiler — Checklist de Implementação

Este documento define a ordem de build recomendada e um checklist para cada fase. Use como lista de tarefas ao implementar o compilador com um LLM.

---

## Ordem de Build

Construa e teste cada camada antes de avançar para a próxima. Cada camada depende da anterior.

```
1. Tokens + Lexer
2. Tipos do AST
3. Parser
4. Analisador Semântico — apenas herança
5. Analisador Semântico — expansão de componentes
6. Analisador Semântico — validação de eventos
7. Analisador Semântico — classes responsivas
8. HTML Emitter
9. CSS Emitter
10. TypeScript Bindings Emitter
11. Ponto de entrada compile()
12. CLI
13. Testes de integração (todos os 17 exemplos)
```

---

## Camada 1: Tokens + Lexer

**Arquivos:** `src/lexer/tokens.ts`, `src/lexer/lexer.ts`

- [x] Definir enum `TokenType` com todos os tipos de token (ver `01-lexer.md`)
- [x] Definir interface `Token` `{ type, value, line, col }`
- [x] Implementar classe `Lexer` com método `tokenize()`
- [x] Tratar pulo de espaço em branco com rastreamento de linha/coluna
- [x] Tratar operadores de dois caracteres: `::`, `|>`, `>>` (`DOUBLE_RANGLE` — deve ser verificado antes do `>` simples)
- [x] Tratar `@logic` como um único token `KW_LOGIC`
- [x] Tratar strings entre aspas (erro em não-terminada)
- [x] Tratar identificadores com `-` permitido internamente
- [x] Tratar `#` como token independente (NÃO mesclar com o ident seguinte)
- [x] Testes unitários: tokenizar cada operador, uma string, um ident, `@logic "..."`, `#id::tag`

---

## Camada 2: Tipos do AST

**Arquivo:** `src/parser/ast.ts`

- [x] Interfaces `VisualProp`, `EventProp`, `AttrProp`, `ResponsiveProp`
- [x] Interface `PropBlock`
- [x] Interface `NodeDecl`
- [x] Interfaces `SlotPropDef`, `SlotNodeDef`
- [x] Interface `ComponentDef`
- [x] Interfaces `SlotPropOverride`, `SlotNodeOverride`
- [x] Interface `ComponentCall`
- [x] Interface `Program`
- [x] Tipos de união `AstNode`, `ChildNode`, `ComponentBodyNode`

---

## Camada 3: Parser

**Arquivo:** `src/parser/parser.ts`

- [x] Classe `Parser` com auxiliares de cursor (`current`, `peek`, `advance`, `expect`, `check`)
- [x] `parseProgram()` — loop de nível superior; dispatch em `DOUBLE_RANGLE` vs `RANGLE` vs `LBRACKET` vs `LPAREN`
- [x] `parseLogicDecl()` — `@logic "..."`
- [x] `parsePropBlock()` — `( props )`
- [x] Dispatcher `parseOneProp()`
- [x] `parseVisualProp()` — `ident: valor`
- [x] `parseResponsiveProp()` — `bp.ident: valor`
- [x] `parseEventProp()` — `@evento:acao` e `@evento:ns.acao`
- [x] `parseAttrProp()` — `$attr:valor`
- [x] `parseValue()` — lógica de terminação de valor com múltiplas palavras
- [x] `parseNodeDecl()` — com id, tag, texto, props inline, filhos
- [x] `parseInlineProps()` — lista `|>`
- [x] `parseComponentDef()` — acionado por `LBRACKET DOUBLE_RANGLE`; com defs de slot de prop e corpo
- [x] `parseComponentCall()` — acionado por `LBRACKET RANGLE`; com sobrescritas de prop/nó e filhos extras
- [x] Erro `PARSE_NESTED_DEF` quando `DOUBLE_RANGLE` é encontrado dentro dos filhos de um nó
- [x] Validação de whitelist de tags
- [x] Testes unitários: fazer parse de cada produção gramatical, todos os erros de parse

---

## Camada 4: Analisador Semântico — Herança

**Arquivo:** `src/analyzer/inherit.ts`

- [x] Função recursiva `resolveInheritance(nodes, inherited)`
- [x] Associação de PropBlock (PropBlock aplica-se ao próximo nó irmão NodeDecl)
- [x] Ordem de mesclagem: herdado → PropBlock → `|>` inline
- [x] `$attrs` NÃO fazem cascata para filhos
- [x] Eventos NÃO fazem cascata para filhos
- [x] Tipo de saída `ResolvedNode`
- [x] Testes unitários: exemplos 4, 5, 6 (herança e sobrescritas de prop)

---

## Camada 5: Analisador Semântico — Expansão de Componentes

**Arquivo:** `src/analyzer/expand.ts`

- [x] Classe `ComponentRegistry`
- [x] Registrar todos os `ComponentDef`s de `program.definitions`
- [x] `expandComponents(nodes, registry)` — expansão depth-first
- [x] `resolvePropSlots(def, call)` — mesclar padrões + sobrescritas
- [x] `resolveNodeSlots(def, call)` — mesclar padrões + sobrescritas
- [x] Clonar e substituir o corpo do componente
- [x] Anexar id ao nó raiz se fornecido na chamada
- [x] Adicionar `extraChildren` à raiz
- [x] Expansão recursiva (componentes dentro de `extraChildren`)
- [x] Testes unitários: exemplos 12, 13, 14, 15, 16

---

## Camada 6: Analisador Semântico — Validação de Eventos

**Arquivo:** `src/analyzer/events.ts`

- [x] Coletar todas as entradas `EventProp` durante o passo de herança
- [x] `resolveEvent(prop, node)` — validar e construir `EventBinding`
- [x] Erro em `@evento:acao` sem id no nó
- [x] Erro em qualquer evento quando `logicFile` é null
- [x] Aviso em `@logic` sem eventos
- [x] Testes unitários: exemplos 9, 10; casos de erro

---

## Camada 7: Analisador Semântico — Classes Responsivas

**Arquivo:** `src/analyzer/responsive.ts`

- [x] Detectar `ResponsiveProp` durante a mesclagem de herança
- [x] `generateClassName(tag)` com contador global
- [x] Construir `ResponsiveClass` com `baseProps` e `breakpoints`
- [x] Atribuir `className` ao nó e descendentes no mesmo contexto
- [x] Teste unitário: exemplo 8

---

## Camada 8: HTML Emitter

**Arquivo:** `src/codegen/html.ts`

- [x] Ponto de entrada `emitHtml(nodes, indent)`
- [x] `emitNode(node, indent)` recursivo
- [x] `buildAttrString(node)` — id, class, style, attrs nativos
- [x] `buildStyleString(style)` — `chave:valor; chave:valor`
- [x] Indentação correta (2 espaços por nível)
- [x] Nós de texto em linha única: `<tag>texto</tag>`
- [x] Nós vazios em linha única: `<tag></tag>`
- [x] Testes unitários: todos os tipos de nó, attrs, combinados

---

## Camada 9: CSS Emitter

**Arquivo:** `src/codegen/css.ts`

- [x] Ponto de entrada `emitCss(classes)`
- [x] `emitResponsiveClass(rc)` — bloco base + media queries
- [x] Ordem de breakpoints: sm → md → lg → xl
- [x] Valores corretos de min-width: 640, 768, 1024, 1280
- [x] Teste unitário: exemplo 8

---

## Camada 10: TypeScript Bindings Emitter

**Arquivo:** `src/codegen/ts.ts`

- [x] Ponto de entrada `emitBindings(logicFile, bindings)`
- [x] Declaração de import ESM
- [x] `addEventListener` por binding com `getElementById`
- [x] Tratar caso de id ausente (emitir comentário de aviso)
- [x] Testes unitários: exemplos 9, 10

---

## Camada 11: Ponto de Entrada `compile()`

**Arquivo:** `src/index.ts`

- [x] Instanciar `Lexer` → tokens
- [x] Instanciar `Parser` → AST
- [x] Executar `analyze(program)` → `ResolvedProgram`
- [x] Executar `generate(resolved)` → `CompilerOutput`
- [x] Propagar erros com rótulos de fase corretos
- [x] Teste unitário: round-trip completo, css/bindings null quando não necessários

---

## Camada 12: CLI

**Arquivo:** `cli/index.ts`

- [x] Fazer parse de `process.argv`
- [x] Ler arquivo de entrada `.by`
- [x] Chamar `compile(source, options)`
- [x] Escrever saída `.html`
- [x] Escrever saída `.css` se não for null
- [x] Escrever saída `.bindings.ts` se não for null
- [x] Imprimir erros no stderr com código de saída 1
- [x] Flag `--wrap` para saída em documento completo
- [x] Modo `--watch` (opcional para v1)

---

## Camada 13: Testes de Integração

**Arquivos:** `tests/integration/example-XX.test.ts`

- [x] Exemplo 1: nó simples
- [x] Exemplo 2: nós de texto
- [x] Exemplo 3: nó com id
- [x] Exemplo 4: herança de propriedades
- [x] Exemplo 5: sobrescrita de herança
- [x] Exemplo 6: props `|>` inline
- [x] Exemplo 7: atributos nativos `$`
- [x] Exemplo 8: grid responsivo
- [x] Exemplo 9: binding de lógica por id
- [x] Exemplo 10: binding de lógica com caminho explícito
- [x] Exemplo 11: definição de componente
- [x] Exemplo 12: chamada de componente com padrões
- [x] Exemplo 13: chamada de componente sobrescrevendo todos os slots
- [x] Exemplo 14: chamada de componente com sobrescrita parcial
- [x] Exemplo 15: chamada de componente com id
- [x] Exemplo 16: composição de componentes
- [x] Exemplo 17: landing page completa

---

## Armadilhas e Pontos Delicados Conhecidos

| Problema | Notas |
|---|---|
| `#` em posição de valor | `#` é sempre um token `HASH`; o parser reconstrói `#IDENT` → `"#valor"` |
| Valores CSS com múltiplas palavras | `1fr 1fr 1fr` abrange múltiplos tokens; usar detecção de mudança de linha para terminar |
| Propriedade do PropBlock | Um PropBlock aplica-se ao PRÓXIMO nó irmão, não ao pai |
| Coexistência de responsivo + inline | Nós em contexto responsivo ainda podem ter seu próprio style inline de sobrescrita |
| `main` interno vs externo | O Exemplo 17 tem dois elementos `main`; os ids os distinguem |
| Eventos não herdados | APENAS o nó que declara `@evento` recebe o binding |
| `$attrs` não herdados | Aplica-se apenas ao nó em que foram declarados |
| `>>` deve ser verificado antes de `>` no lexer | Varredura gulosa caractere por caractere: ao ver `>`, sempre olhar o próximo antes de emitir `RANGLE` |
| `[>>Name]` é sempre uma def, `[>Name]` sempre uma chamada | Sem heurísticas; o tipo de token é o único sinal |
| Defs de componente em `program.definitions` | O parser coloca os blocos `[>>Name]` lá; o corpo contém chamadas `[>Name]` |
| Slots de nó substituem apenas texto | A tag é fixa; não é possível mudar `h2` para `h1` via slot |
