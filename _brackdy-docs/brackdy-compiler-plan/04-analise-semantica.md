# Brackdy Compiler — Analisador Semântico

## Visão Geral

O analisador semântico transforma o AST bruto em um **AST Resolvido** onde:

1. A herança de propriedades é completamente computada para cada nó
2. Chamadas de componente são inlineadas em árvores de nós simples
3. Bindings de eventos são validados e coletados
4. Nomes de classes responsivas são atribuídos

A saída é um `ResolvedProgram` — uma árvore de objetos `ResolvedNode` pronta para geração de código.

---

## Tipos do AST Resolvido

```ts
interface ResolvedProgram {
  logicFile: string | null;
  nodes: ResolvedNode[];
  responsiveClasses: ResponsiveClass[];    // todas as definições de classes responsivas
  eventBindings: EventBinding[];           // todos os mapeamentos evento → lógica
}

interface ResolvedNode {
  id: string | null;
  tag: string;
  text: string | null;
  style: StyleMap | null;         // null se o nó usa uma classe responsiva
  className: string | null;       // definido quando o nó tem props responsivas
  attrs: Record<string, string>;  // atributos HTML nativos ($chave → valor)
  children: ResolvedNode[];
}

type StyleMap = Record<string, string>;   // ex.: { background: "#121212", padding: "24px" }

interface ResponsiveClass {
  className: string;               // ex.: "_dsl_main_01"
  baseProps: StyleMap;             // props não-responsivas
  breakpoints: BreakpointBlock[];
}

interface BreakpointBlock {
  breakpoint: "sm" | "md" | "lg" | "xl";
  minWidth: number;                // sm=640, md=768, lg=1024, xl=1280
  props: StyleMap;
}

interface EventBinding {
  targetId: string | null;        // null = usa querySelector via data-attr (futuro)
  querySelector: string | null;   // seletor CSS se sem id (futuro; atualmente sempre null)
  domEvent: string;               // ex.: "click"
  logicPath: string;              // ex.: "hero-section"
  methodName: string;             // ex.: "openHero"
}
```

---

## Fase 1: Expansão de Componentes

Antes de qualquer passo de herança, expandir todos os nós `ComponentCall` em árvores `NodeDecl` simples.

### Algoritmo: `expandComponents(program: Program, defs: Map<string, ComponentDef>): AstNode[]`

Para cada `ComponentCall` no corpo (recursivamente):

1. Buscar `ComponentDef` pelo nome. Erro se não encontrado.
2. Construir **slots de prop efetivos**: começar com os valores padrão de `SlotPropDef[]`, mesclar os `SlotPropOverride[]` da chamada.
3. Construir **slots de nó efetivos**: começar com os valores padrão de `SlotNodeDef[]` no corpo do componente, mesclar os `SlotNodeOverride[]` da chamada.
4. Clonar o `NodeDecl` do corpo do componente, substituindo:
   - Filhos `SlotNodeDef` → nós `NodeDecl` com o texto efetivo
   - O `NodeDecl` raiz recebe um `PropBlock` adicionado no início com os valores de prop efetivos
   - Se a chamada tem um `id`, anexá-lo ao nó raiz
5. Adicionar quaisquer `extraChildren` da chamada à lista de filhos do nó raiz, após os filhos derivados de slots.
6. Retornar o `NodeDecl` expandido.

### Exemplo: Chamada → Expansão

Chamada:
```txt
[>Card #my-card
  (<bg:#ffffff>)
  [<title "Card com id">]
]
```

Definição:
```txt
[>>Card
  (<bg>background:#1E1E1E, <pad>padding:16px)
  [article
    [<title>h2 "Título padrão"]
    [<body>p "Conteúdo padrão"]
  ]
]
```

A expansão produz (logicamente):
```txt
[#my-card::article
  (background:#ffffff padding:16px)
  [h2 "Card com id"]
  [p "Conteúdo padrão"]
]
```

---

## Fase 2: Herança de Propriedades

Percorrer a árvore de nós expandida recursivamente, passando um contexto `ComputedProps` para baixo.

```ts
type ComputedProps = {
  visual: StyleMap;
  attrs: Record<string, string>;
  // Nota: eventos NÃO são herdados
};
```

### Algoritmo: `resolveInheritance(nodes: AstNode[], inherited: ComputedProps): ResolvedNode[]`

Para cada par `(PropBlock?, NodeDecl)` na sequência:

1. Coletar qualquer `PropBlock` precedente para este nó (PropBlocks sempre precedem seu nó alvo).
2. Mesclar: `nodeProps = { ...inherited.visual, ...propBlockVisual, ...inlinePropsVisual }`
   - PropBlock sobrescreve o herdado
   - Props inline `|>` sobrescrevem o PropBlock
3. Attrs: `nodeAttrs = { ...inherited.attrs, ...propBlockAttrs, ...inlineAttrs }`
   - Attrs SÃO mesclados/herdados (o Exemplo 7 da spec implica que `$attrs` não são herdados por padrão — ver nota)
4. Definir o estilo final do nó como `nodeProps`
5. Recursar nos filhos com `nodeProps` como novo contexto herdado

> **Nota sobre herança de attrs:** A spec não declara explicitamente se `$attrs` propagam para filhos. O Exemplo 4 mostra apenas props visuais propagando. Interpretação mais segura: `$attrs` NÃO propagam para filhos. Apenas chaves `VisualProp` fazem cascata.

### Associação de PropBlock

Um `PropBlock` em uma lista `ChildNode[]` aplica-se ao **próximo NodeDecl irmão** nessa lista.

```
children = [PropBlock_A, NodeDecl_1, PropBlock_B, NodeDecl_2, NodeDecl_3]
```

- `PropBlock_A` → aplica-se a `NodeDecl_1`
- `PropBlock_B` → aplica-se a `NodeDecl_2`
- `NodeDecl_3` → sem PropBlock (usa apenas o contexto herdado do pai)

### Prioridade de Mesclagem (menor → maior)

```
Herdado do pai  <  PropBlock antes do nó  <  Props inline |> no nó
```

---

## Fase 3: Atribuição de Classes Responsivas

Após a resolução de herança, escanear cada `ResolvedNode`:

1. Se seu `StyleMap` computado contiver QUALQUER entrada `ResponsiveProp` (detectada durante a mesclagem de herança):
   - Gerar um nome de classe: `_dsl_<tag>_<contador>` (contador é global, incrementado por classe única)
   - Separar o `StyleMap` em:
     - `baseProps`: entradas que são `VisualProp` simples
     - `breakpointBlocks`: agrupadas por breakpoint
   - Armazenar o `ResponsiveClass` na lista `responsiveClasses` do programa
   - Definir `node.className = classNameGerado` e `node.style = null`
   - Aplicar o mesmo className a todos os descendentes (pois herdam o mesmo contexto responsivo)

> **Importante:** No Exemplo 8 da spec, todos os filhos do nó `[main]` recebem a MESMA classe que o próprio `main`. Isso ocorre porque herdaram as props responsivas. A atribuição de classe aplica-se ao nó E a todos os seus descendentes que compartilham o mesmo contexto de estilo resolvido.

### Geração de Nome de Classe

```ts
let classCounter = 0;

function generateClassName(tag: string): string {
  classCounter++;
  const n = String(classCounter).padStart(2, "0");
  return `_dsl_${tag}_${n}`;
}
```

---

## Fase 4: Coleta de Bindings de Eventos

Após expansão e herança, percorrer a árvore resolvida coletando eventos.

Para cada nó com eventos em suas props computadas:

1. Identificar entradas `EventProp` (de `|>` inline ou `PropBlock`)
2. Resolver o binding:

```ts
function resolveEvent(event: EventProp, node: ResolvedNode): EventBinding {
  if (event.namespace !== null) {
    // Caminho explícito: @click:hero-section.openHero
    return {
      targetId: node.id,       // pode ser null para eventos com caminho explícito
      domEvent: event.event,
      logicPath: event.namespace,
      methodName: event.action,
    };
  } else {
    // Caminho implícito: @click:openHero — requer que o nó tenha um id
    if (node.id === null) {
      throw new SemanticError(
        `Evento @${event.event}:${event.action} em nó sem id — ` +
        `use caminho explícito @${event.event}:namespace.${event.action}`,
        event.line, event.col
      );
    }
    return {
      targetId: node.id,
      domEvent: event.event,
      logicPath: node.id,
      methodName: event.action,
    };
  }
}
```

> **Nota:** Eventos NÃO são herdados. Apenas o nó que declara `@evento:...` em seu próprio `|>` ou `PropBlock` recebe o binding. Isso é intencional.

---

## Mapa de Largura Mínima por Breakpoint

```ts
const BREAKPOINT_WIDTHS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};
```

---

## Tipos de Erro Semântico

| Erro | Gatilho |
|---|---|
| `UnknownComponentError` | Chamada `[>Name]` onde Name nunca foi definido |
| `EventWithoutIdError` | `@evento:acao` em nó sem id e sem namespace explícito |
| `DuplicateComponentError` | Duas definições `[>>Name]` com o mesmo nome |
| `DuplicateIdError` | Dois nós com o mesmo valor de id no mesmo arquivo |
| `LogicWithoutEventError` | `@logic` declarado mas nenhum evento encontrado (aviso, não erro) |
| `EventWithoutLogicError` | Evento declarado mas sem `@logic` encontrado (erro em tempo de build) |

---

## Ponto de Entrada do Analisador

```ts
function analyze(program: Program): ResolvedProgram {
  const defs = collectComponentDefs(program.definitions);
  const expanded = expandComponents(program.body, defs);
  const { nodes, responsiveClasses, eventBindings } = resolveAll(expanded);
  return { logicFile: program.logicFile, nodes, responsiveClasses, eventBindings };
}
```
