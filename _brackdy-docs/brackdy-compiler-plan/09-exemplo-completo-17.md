# Brackdy Compiler — Exemplo Completo: Landing Page (Exemplo 17)

Este documento rastreia a compilação completa do Exemplo 17 (a landing page completa) por todas as fases. Use como referência de integração canônica.

---

## Fonte

```txt
@logic "./landing.logic.ts"

(
  background:#121212
  color:#FFFFFF
  padding:24px
)
[#page::main
  (
    background:#1A1A1A
    padding:16px
  )
  [header
    [nav
      [a |> $href:"/home" "Home"]
      [a |> $href:"/about" "Sobre"]
      [a |> $href:"/contact" "Contato"]
    ]
  ]

  [#hero-section::section |> background:#181818 padding:32px @click:openHero
    [#hero-title::h1 "Título principal"]
    [p "Texto introdutório da página"]
  ]

  (
    display:grid
    grid-template-columns:1fr
    gap:24px
    md.grid-template-columns:1fr 1fr
    lg.grid-template-columns:1fr 1fr 1fr
  )
  [main
    (background:#1E1E1E padding:16px)
    [article
      [h2 "Bloco 1"]
      [p "Conteúdo do primeiro bloco"]
    ]

    (background:#202020 padding:16px)
    [article
      [h2 "Bloco 2"]
      [p "Conteúdo do segundo bloco"]
    ]

    (background:#222222 padding:16px)
    [article
      [h2 "Bloco 3"]
      [p "Conteúdo do terceiro bloco"]
    ]
  ]

  (
    background:#111111
    padding:20px
  )
  [footer
    [p "Rodapé da página"]
  ]
]
```

---

## Fase 1: Saída do Lexer (abreviada)

Sequências de tokens principais:

```
KW_LOGIC  STRING("./landing.logic.ts")

LPAREN
  IDENT("background") COLON IDENT("#121212")     -- atenção: HASH IDENT("121212")
  IDENT("color") COLON IDENT("#FFFFFF")
  IDENT("padding") COLON IDENT("24px")
RPAREN

LBRACKET HASH IDENT("page") DOUBLE_COLON IDENT("main")
  LPAREN
    IDENT("background") COLON HASH IDENT("1A1A1A")
    IDENT("padding") COLON IDENT("16px")
  RPAREN
  ...
RBRACKET
```

---

## Fase 2: Parser — AST Bruto (nível superior)

```
Program {
  logicFile: "./landing.logic.ts"
  definitions: []
  body: [
    PropBlock { background:#121212, color:#FFFFFF, padding:24px }
    NodeDecl {
      id: "page"
      tag: "main"
      children: [
        PropBlock { background:#1A1A1A, padding:16px }
        NodeDecl { tag:"header", children:[
          NodeDecl { tag:"nav", children:[
            NodeDecl { tag:"a", text:"Home",    inlineProps:[AttrProp{href:"/home"}] }
            NodeDecl { tag:"a", text:"Sobre",   inlineProps:[AttrProp{href:"/about"}] }
            NodeDecl { tag:"a", text:"Contato", inlineProps:[AttrProp{href:"/contact"}] }
          ]}
        ]}
        NodeDecl {
          id:"hero-section", tag:"section"
          inlineProps:[
            VisualProp{background:#181818}, VisualProp{padding:32px},
            EventProp{click, openHero, null}
          ]
          children:[
            NodeDecl { id:"hero-title", tag:"h1", text:"Título principal" }
            NodeDecl { tag:"p", text:"Texto introdutório da página" }
          ]
        }
        PropBlock {
          display:grid,
          grid-template-columns:1fr, gap:24px,
          ResponsiveProp{md, grid-template-columns, "1fr 1fr"}
          ResponsiveProp{lg, grid-template-columns, "1fr 1fr 1fr"}
        }
        NodeDecl { tag:"main", children:[
          PropBlock{background:#1E1E1E, padding:16px}
          NodeDecl{tag:"article", children:[h2"Bloco 1", p"Conteúdo..."]}
          PropBlock{background:#202020, padding:16px}
          NodeDecl{tag:"article", children:[h2"Bloco 2", p"Conteúdo..."]}
          PropBlock{background:#222222, padding:16px}
          NodeDecl{tag:"article", children:[h2"Bloco 3", p"Conteúdo..."]}
        ]}
        PropBlock{background:#111111, padding:20px}
        NodeDecl{tag:"footer", children:[p"Rodapé da página"]}
      ]
    }
  ]
}
```

---

## Fase 3: Análise Semântica

### Passo 1: Expansão de componentes
Nenhum componente definido. Passagem direta.

### Passo 2: Resolução de herança

**Contexto raiz:** `{}`

**PropBlock de nível superior** define o ambiente: `{background:#121212, color:#FFFFFF, padding:24px}`

**Nó `[#page::main]`:**
- Herdado: `{background:#121212, color:#FFFFFF, padding:24px}`
- PropBlock próprio: `{background:#1A1A1A, padding:16px}`
- Mesclado: `{background:#1A1A1A, color:#FFFFFF, padding:16px}`
- Sem props inline
- **Estilo final:** `background:#1A1A1A; color:#FFFFFF; padding:16px`

**`[header]`** (filho de page::main):
- Herdado: `{background:#1A1A1A, color:#FFFFFF, padding:16px}`
- Sem props próprias
- **Estilo final:** `background:#1A1A1A; color:#FFFFFF; padding:16px`

**`[nav]`** (filho de header):
- Herdado do header
- **Estilo final:** igual ao header

**`[a "Home"]`** com `$href:"/home"`:
- Herdado do nav
- Props inline próprias: `AttrProp{href:"/home"}` (attr, não visual)
- **Estilo final:** igual ao nav; **attrs:** `{href:"/home"}`

**`[#hero-section::section]`:**
- Herdado: `{background:#1A1A1A, color:#FFFFFF, padding:16px}`
- Props inline próprias: `{background:#181818, padding:32px}` + EventProp
- Mesclado: `{background:#181818, color:#FFFFFF, padding:32px}`
- **Estilo final:** `background:#181818; color:#FFFFFF; padding:32px`
- **Evento coletado:** `{targetId:"hero-section", domEvent:"click", logicPath:"hero-section", methodName:"openHero"}`

**`[#hero-title::h1]`** (filho de hero-section):
- Herdado: `{background:#181818, color:#FFFFFF, padding:32px}`
- **Estilo final:** igual ao hero-section

**`[p "Texto..."]`** (filho de hero-section):
- Mesmo estilo herdado

**`[main]`** com PropBlock responsivo:
- Herdado: `{background:#1A1A1A, color:#FFFFFF, padding:16px}`
- PropBlock próprio contém entradas `ResponsiveProp` → **aciona atribuição de classe responsiva**
- Props base (não-responsivas): `{display:grid, grid-template-columns:1fr, gap:24px}` mescladas com o herdado: `{background:#1A1A1A, color:#FFFFFF, padding:16px, display:grid, grid-template-columns:1fr, gap:24px}`
- Responsivo: `md.grid-template-columns:1fr 1fr`, `lg.grid-template-columns:1fr 1fr 1fr`
- **Classe atribuída:** `_dsl_main_01`
- **ResponsiveClass registrado**

**Filhos `[article]` do `[main]` responsivo** — cada um também recebe `_dsl_main_01` (herdam o contexto responsivo), MAIS seus próprios PropBlocks sobrescrevem suas props base.

> Nota: Conforme o Exemplo 8 da spec, todos os filhos recebem a mesma classe. As sobrescritas de seus próprios PropBlocks (ex.: `background:#1E1E1E`) precisam ser tratadas. Na prática, para v0.3: filhos de um nó responsivo que possuem seus próprios PropBlocks recebem TANTO a classe responsiva QUANTO um `style` inline para suas sobrescritas de props não-responsivas. Este é um trade-off intencional — o layout responsivo aplica-se via classe, as sobrescritas locais aplicam-se via style inline.

**Nota de implementação para filhos de nós responsivos:**

Quando um filho herda um contexto de classe responsiva mas também tem seu próprio `PropBlock`:
- A classe responsiva aplica-se ao filho (mesmo nome de classe)
- MAS as props visuais do próprio `PropBlock` do filho (como `background:#1E1E1E`) são emitidas como `style` inline em adição à classe

Isso corresponde ao comportamento do Exemplo 17 da spec, onde cada article do grid tem backgrounds distintos.

---

## Fase 4: Geração de Código

### Saída HTML

```html
<main id="page" style="background:#1A1A1A; color:#FFFFFF; padding:16px">
  <header style="background:#1A1A1A; color:#FFFFFF; padding:16px">
    <nav style="background:#1A1A1A; color:#FFFFFF; padding:16px">
      <a href="/home" style="background:#1A1A1A; color:#FFFFFF; padding:16px">Home</a>
      <a href="/about" style="background:#1A1A1A; color:#FFFFFF; padding:16px">Sobre</a>
      <a href="/contact" style="background:#1A1A1A; color:#FFFFFF; padding:16px">Contato</a>
    </nav>
  </header>
  <section id="hero-section" style="background:#181818; color:#FFFFFF; padding:32px">
    <h1 id="hero-title" style="background:#181818; color:#FFFFFF; padding:32px">Título principal</h1>
    <p style="background:#181818; color:#FFFFFF; padding:32px">Texto introdutório da página</p>
  </section>
  <main class="_dsl_main_01">
    <article class="_dsl_main_01" style="background:#1E1E1E; padding:16px">
      <h2 style="background:#1E1E1E; padding:16px">Bloco 1</h2>
      <p style="background:#1E1E1E; padding:16px">Conteúdo do primeiro bloco</p>
    </article>
    <article class="_dsl_main_01" style="background:#202020; padding:16px">
      <h2 style="background:#202020; padding:16px">Bloco 2</h2>
      <p style="background:#202020; padding:16px">Conteúdo do segundo bloco</p>
    </article>
    <article class="_dsl_main_01" style="background:#222222; padding:16px">
      <h2 style="background:#222222; padding:16px">Bloco 3</h2>
      <p style="background:#222222; padding:16px">Conteúdo do terceiro bloco</p>
    </article>
  </main>
  <footer style="background:#111111; color:#FFFFFF; padding:20px">
    <p style="background:#111111; color:#FFFFFF; padding:20px">Rodapé da página</p>
  </footer>
</main>
```

### Saída CSS

```css
._dsl_main_01 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 768px) {
  ._dsl_main_01 {
    grid-template-columns: 1fr 1fr;
  }
}
@media (min-width: 1024px) {
  ._dsl_main_01 {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
```

### Saída de TypeScript bindings

```ts
import { logic } from "./landing.logic.ts";

document.getElementById("hero-section")
  .addEventListener("click", () => logic["hero-section"].openHero());
```

---

## Observações Principais para Implementadores

1. **`color` herda profundamente** — definido na raiz, flui pelo header/nav/footer/hero sem alteração
2. **`background` é sobrescrito em cada nível** — cada seção tem seu próprio background
3. **`$href` NÃO propaga** — aplica-se apenas ao nó `[a]` onde foi declarado
4. **Eventos NÃO herdam** — apenas `hero-section` recebe o binding de click, NÃO seus filhos
5. **Contexto responsivo coexiste com sobrescritas inline** — os articles usam tanto classe quanto style
6. **O `[main]` interno e o `[#page::main]` externo** são dois nós diferentes — o interno é anônimo e recebe a classe responsiva; o externo tem `id="page"` e recebe style inline
