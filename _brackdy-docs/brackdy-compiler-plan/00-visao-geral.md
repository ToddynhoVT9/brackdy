# Brackdy Compiler — Visão Geral e Arquitetura

## O que é o Brackdy?

Brackdy (`.by`) é uma DSL para descrever estrutura de UI, estilo visual, eventos e atributos HTML em formato compacto e legível. O compilador transforma arquivos-fonte `.by` em três artefatos de saída:

| Saída | Finalidade |
|---|---|
| `*.html` | Estrutura DOM compilada |
| `*.css` | Folha de estilos responsiva (apenas quando existem propriedades de breakpoint) |
| `*.bindings.ts` | Wiring de event-listeners para um arquivo de lógica externo |

---

## Pipeline de Compilação

```
Fonte (.by)
     │
     ▼
┌─────────┐
│  Lexer  │  → Token stream
└─────────┘
     │
     ▼
┌─────────┐
│ Parser  │  → AST bruto
└─────────┘
     │
     ▼
┌──────────────────────┐
│  Analisador Semântico│  → AST resolvido
│  · Herança           │
│  · Resolução de slot │
│  · Validação eventos │
│  · Classe responsiva │
└──────────────────────┘
     │
     ▼
┌──────────────────────┐
│  Gerador de Código   │
│  · HTML emitter      │
│  · CSS emitter       │
│  · TS emitter        │
└──────────────────────┘
     │
     ▼
Arquivos de saída: .html  .css  .bindings.ts
```

---

## Convenção de Nomenclatura de Arquivos

Para a entrada `landing.by`:
- `landing.html`
- `landing.css` (omitido se não existirem propriedades responsivas)
- `landing.bindings.ts` (omitido se não houver declaração `@logic` ou nenhum evento)

---

## Ponto de Entrada do Compilador (TypeScript)

```ts
interface CompilerOptions {
  input: string;         // caminho para o arquivo .by
  outDir?: string;       // padrão: mesmo diretório do arquivo de entrada
  logicFile?: string;    // substitui a declaração @logic
}

interface CompilerOutput {
  html: string;
  css: string | null;
  bindings: string | null;
}

function compile(source: string, options?: CompilerOptions): CompilerOutput
```

---

## Mapa de Módulos

```
src/
  lexer/
    tokens.ts        ← Enum de tipos de token + interface Token
    lexer.ts         ← Classe Lexer
  parser/
    ast.ts           ← Todas as interfaces de nós AST
    parser.ts        ← Classe Parser
  analyzer/
    inherit.ts       ← Resolvedor de herança de propriedades
    slots.ts         ← Resolvedor de slots de componentes
    events.ts        ← Validador de caminhos de eventos
    responsive.ts    ← Gerador de nomes de classes responsivas
  codegen/
    html.ts          ← HTML emitter
    css.ts           ← CSS emitter
    ts.ts            ← TypeScript bindings emitter
  errors/
    errors.ts        ← Tipos de erro + mensagens
  index.ts           ← Ponto de entrada compile()
```

---

## Fases do Compilador — Responsabilidades

### Fase 1: Lexer
- Lê a string fonte caractere por caractere
- Produz um array plano de objetos `Token`
- Processa: colchetes, parênteses, operadores (`|>`, `::`, `#`, `@`, `$`, `<`, `>`), strings entre aspas, identificadores, prefixos de breakpoint

### Fase 2: Parser
- Consome o array de tokens
- Emite um nó `Program` no AST
- Processa: declaração `@logic`, definições de componentes, árvores de nós, blocos de propriedades

### Fase 3: Analisador Semântico
- **Herança:** percorre a árvore de nós, mesclando as props computadas do pai em cada filho. Props `()` ou `|>` do filho sobrescrevem os valores herdados chave por chave.
- **Resolução de slot:** expande chamadas `[>ComponentName ...]` substituindo slots na definição do componente (declarada com `[>>ComponentName ...]`), produzindo árvores de nós simples
- **Validação de eventos:** verifica se cada `@evento:acao` (sem namespace) está associado a um nó que possui `id`, ou tem um caminho explícito `ns.acao`. Emite erros em tempo de build caso contrário.
- **Classes responsivas:** detecta nós cujas props computadas contêm chaves prefixadas por breakpoint; atribui nomes de classe determinísticos (`_dsl_<tag>_<n>`); extrai as props responsivas para a fila do CSS emitter

### Fase 4: Gerador de Código
- **HTML emitter:** percorre o AST resolvido, emite HTML indentado. Aplica `id=`, `style=` inline (ou `class=` para nós responsivos) e atributos nativos `$`.
- **CSS emitter:** emite blocos `@media` para cada classe responsiva
- **TS emitter:** emite wiring de `addEventListener` para cada evento resolvido

---

## Decisões Principais de Design

1. **Herança é computada, não herdada em runtime.** O conjunto de estilos final de cada nó é completamente resolvido em tempo de compilação e escrito como `style=` inline (ou `class=` para nós responsivos). Não existe cascata de estilos em runtime.

2. **Props responsivas sempre usam classes CSS.** Assim que um bloco de propriedades contém uma chave prefixada por breakpoint (`md.*`, `lg.*`, etc.), o nó inteiro muda de `style=` inline para saída baseada em classe. As props irmãs não-responsivas também são movidas para a definição da classe.

3. **Componentes são expandidos em tempo de compilação.** Não existe sistema de componentes em runtime. `[>>Card ...]` declara um componente; `[>Card ...]` o chama. Ambos são completamente resolvidos para HTML simples em tempo de compilação.

4. **Bindings de lógica são um arquivo de saída separado.** A saída HTML não contém JS inline. Todo o wiring de eventos fica em `*.bindings.ts`.

5. **Estratégia de erros: falhar rápido.** Qualquer erro estrutural ou semântico interrompe a compilação com uma mensagem descritiva incluindo número de linha e coluna.
