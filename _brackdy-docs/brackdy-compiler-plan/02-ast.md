# Brackdy Compiler — Tipos de Nó do AST

Todos os nós do AST carregam `line` e `col` para relatórios de erro.

---

## Program (raiz)

```ts
interface Program {
  kind: "Program";
  logicFile: string | null;        // valor de @logic "..." ou null
  definitions: ComponentDef[];    // todos os blocos de definição [>>Name ...]
  body: AstNode[];                 // nós e blocos de propriedades de nível superior
  line: number;
  col: number;
}
```

---

## Blocos de Propriedades

### PropBlock
Um bloco `()` independente que aparece ANTES de um nó.

```ts
interface PropBlock {
  kind: "PropBlock";
  props: Prop[];
  line: number;
  col: number;
}
```

### Prop
Uma entrada única chave:valor dentro de um bloco `()` ou lista `|>`.

```ts
type Prop = VisualProp | EventProp | AttrProp | ResponsiveProp;

interface VisualProp {
  kind: "VisualProp";
  key: string;     // ex.: "background", "padding", "grid-template-columns"
  value: string;   // ex.: "#121212", "24px", "1fr 1fr 1fr"
  line: number;
  col: number;
}

interface EventProp {
  kind: "EventProp";
  event: string;         // ex.: "click", "change", "input"
  action: string;        // ex.: "openHero"
  namespace: string | null; // ex.: "hero-section" se o caminho for "hero-section.openHero"
  line: number;
  col: number;
}

interface AttrProp {
  kind: "AttrProp";
  name: string;    // ex.: "href", "src", "alt", "type"
  value: string;   // ex.: "/home", "/img/logo.png"
  line: number;
  col: number;
}

interface ResponsiveProp {
  kind: "ResponsiveProp";
  breakpoint: "sm" | "md" | "lg" | "xl";
  key: string;     // ex.: "grid-template-columns"
  value: string;   // ex.: "1fr 1fr"
  line: number;
  col: number;
}
```

---

## Nós

### NodeDecl
Um nó `[tag ...]` comum.

```ts
interface NodeDecl {
  kind: "NodeDecl";
  id: string | null;               // da sintaxe #id::tag; null se não houver id
  tag: string;                     // ex.: "section", "h1", "main"
  text: string | null;             // conteúdo de texto inline; null se houver filhos
  inlineProps: Prop[] | null;      // da sintaxe |>; null se não presente
  children: ChildNode[];           // PropBlocks e NodeDecls/ComponentCalls intercalados
  line: number;
  col: number;
}
```

### ChildNode
Itens que podem aparecer como filhos de um `NodeDecl` ou corpo de `ComponentCall`:

```ts
type ChildNode = PropBlock | NodeDecl | ComponentCall;
```

---

## Componentes

### ComponentDef
Um bloco de definição `[>>Name ...]`.

```ts
interface ComponentDef {
  kind: "ComponentDef";
  name: string;                        // ex.: "Card", "Layout"
  propSlots: SlotPropDef[];            // slots dentro do bloco ()
  body: ComponentBodyNode[];           // o corpo estrutural (NodeDecl + SlotNodeDef)
  line: number;
  col: number;
}
```

### SlotPropDef
Um slot dentro do bloco `()` de um componente.

```ts
interface SlotPropDef {
  kind: "SlotPropDef";
  slotName: string;        // ex.: "bg", "pad"
  cssKey: string;          // ex.: "background", "padding"
  defaultValue: string;    // ex.: "#1E1E1E", "16px"
  line: number;
  col: number;
}
```

### SlotNodeDef
Um slot dentro do corpo estrutural de um componente.

```ts
interface SlotNodeDef {
  kind: "SlotNodeDef";
  slotName: string;        // ex.: "title", "body", "header"
  tag: string;             // ex.: "h2", "p", "h1"
  defaultText: string;     // ex.: "Título padrão"
  line: number;
  col: number;
}
```

### ComponentBodyNode
Nós permitidos dentro do corpo de um ComponentDef:

```ts
type ComponentBodyNode = NodeDecl | SlotNodeDef;
```

> Nota: filhos `NodeDecl` dentro de uma definição de componente podem conter `SlotNodeDef`s como filhos. A raiz do corpo de um componente é sempre um único nó estrutural (ex.: `[article ...]`).

---

### ComponentCall
Uma invocação `[>Name ...]`.

```ts
interface ComponentCall {
  kind: "ComponentCall";
  name: string;                          // ex.: "Card"
  id: string | null;                     // #id atribuído no local de chamada
  propOverrides: SlotPropOverride[];     // de (<slot:val, ...>)
  slotOverrides: SlotNodeOverride[];     // de [<slot "texto", ...>]
  extraChildren: ChildNode[];            // filhos não-slot (nós simples, chamadas aninhadas)
  line: number;
  col: number;
}
```

### SlotPropOverride
Um valor de slot passado em um bloco de chamada `(<...>)`.

```ts
interface SlotPropOverride {
  kind: "SlotPropOverride";
  slotName: string;    // ex.: "bg"
  value: string;       // ex.: "#ffffff"
  line: number;
  col: number;
}
```

### SlotNodeOverride
Um valor de texto de slot passado em um bloco de chamada `[<...>]`.

```ts
interface SlotNodeOverride {
  kind: "SlotNodeOverride";
  slotName: string;    // ex.: "title"
  text: string;        // ex.: "Outro título"
  line: number;
  col: number;
}
```

---

## União AstNode

```ts
type AstNode = PropBlock | NodeDecl | ComponentCall | ComponentDef;
```

---

## Exemplo — Saída Parseada para o Exemplo 5 (Sobrescrita de Herança)

Fonte:
```txt
(
  background:#121212
  color:#FFFFFF
  padding:24px
)
[main
  (
    background:#1E1E1E
    padding:16px
  )
  [article
    [h2 "Subbloco"]
    [p "Conteúdo"]
  ]
]
```

AST:
```json
{
  "kind": "Program",
  "logicFile": null,
  "definitions": [],
  "body": [
    {
      "kind": "PropBlock",
      "props": [
        { "kind": "VisualProp", "key": "background", "value": "#121212" },
        { "kind": "VisualProp", "key": "color", "value": "#FFFFFF" },
        { "kind": "VisualProp", "key": "padding", "value": "24px" }
      ]
    },
    {
      "kind": "NodeDecl",
      "id": null,
      "tag": "main",
      "text": null,
      "inlineProps": null,
      "children": [
        {
          "kind": "PropBlock",
          "props": [
            { "kind": "VisualProp", "key": "background", "value": "#1E1E1E" },
            { "kind": "VisualProp", "key": "padding", "value": "16px" }
          ]
        },
        {
          "kind": "NodeDecl",
          "id": null,
          "tag": "article",
          "text": null,
          "inlineProps": null,
          "children": [
            { "kind": "NodeDecl", "tag": "h2", "text": "Subbloco", "children": [] },
            { "kind": "NodeDecl", "tag": "p",  "text": "Conteúdo", "children": [] }
          ]
        }
      ]
    }
  ]
}
```

---

## Exemplo — AST ComponentDef para o Exemplo 11

Fonte:
```txt
[>>Card
  (
    <bg>background:#1E1E1E
    <pad>padding:16px
  )
  [article
    [<title>h2 "Título padrão"]
    [<body>p "Conteúdo padrão"]
  ]
]
```

AST:
```json
{
  "kind": "ComponentDef",
  "name": "Card",
  "propSlots": [
    { "kind": "SlotPropDef", "slotName": "bg",  "cssKey": "background", "defaultValue": "#1E1E1E" },
    { "kind": "SlotPropDef", "slotName": "pad", "cssKey": "padding",    "defaultValue": "16px" }
  ],
  "body": [
    {
      "kind": "NodeDecl",
      "tag": "article",
      "children": [
        { "kind": "SlotNodeDef", "slotName": "title", "tag": "h2", "defaultText": "Título padrão" },
        { "kind": "SlotNodeDef", "slotName": "body",  "tag": "p",  "defaultText": "Conteúdo padrão" }
      ]
    }
  ]
}
```
