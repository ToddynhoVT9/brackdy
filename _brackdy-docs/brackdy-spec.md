# brackdy-spec.md — Regras, Sintaxe e Semântica da Linguagem Brackdy

## 1. Visão geral

Brackdy é uma DSL (Domain Specific Language) para descrição declarativa de interface.

Ela foi concebida para separar de forma explícita:

- estrutura semântica
- estilo visual
- atributos HTML nativos
- eventos declarativos
- ligação externa com lógica TypeScript/JavaScript

A unidade fundamental da linguagem é:

- bloco de propriedades `()`
- bloco estrutural `[]`

A leitura sempre ocorre em pares:

```txt
(
  propriedades
)
[nó]
```

---

## 2. Estrutura fundamental

Toda construção válida nasce da sequência:

```txt
(propriedades opcionais)
[nó obrigatório]
```

O bloco `()` modifica o bloco `[]` imediatamente seguinte.

Exemplo:

```txt
(
  background:#121212
  color:#FFFFFF
)
[main]
```

Sem `[]`, o bloco `()` é inválido.

---

## 3. Sintaxe dos nós

## Nó simples

```txt
[section]
```

Representa uma tag sem conteúdo textual nem filhos.

## Nó textual

```txt
[h1 "Título"]
[p "Texto"]
```

Formato:

```txt
[tag "texto"]
```

## Nó com filhos

```txt
[main
  [section
    [h1 "Título"]
    [p "Descrição"]
  ]
]
```

Formato:

```txt
[tag
  filhos...
]
```

## Nó com id explícito

```txt
[#heroMain-section]
```

Formato:

```txt
[#id-tag]
```

---

## 4. Regras dos identificadores

## Forma canônica

```txt
#id-tag
```

## Regras

- `#` inicia o identificador
- `-` separa id e tag
- id não pode conter `-`

## Caracteres permitidos no id

- letras minúsculas
- letras maiúsculas
- números
- `_`

## Exemplos válidos

```txt
#hero_main-section
#heroMain-section
#submitButton-button
```

## Exemplos inválidos

```txt
#hero-main-section
#hero main-section
#hero.section
```

---

## 5. Ordem canônica interna do nó

Dentro de `[]` a ordem correta é:

1. id opcional
2. tag obrigatória
3. texto opcional
4. filhos opcionais

## Exemplo correto

```txt
[#heroMain-section
  [h1 "Título"]
]
```

---

## 6. Propriedades em `()` e Inline `|>`

### Bloco `()`

Cada linha possui:

```txt
propriedade:valor
```

Exemplo:

```txt
(
  background:#121212
  color:#FFFFFF
  padding:24px
)
```

### Propriedades inline `|>`

Uma sintaxe alternativa, mais rápida, quando o nó tem poucas propriedades.

```txt
[section |> background:#181818 padding:32px @click:openHero
  [h1 "Título"]
]
```

O `|>` deve constar logo após a tag do nó e na mesma linha lógica. A prioridade de estilo da sintaxe inline é maior do que o bloco `()`.

---

## 7. Famílias de propriedades

## 7.1 Propriedades visuais

```txt
background:#121212
color:#FFFFFF
padding:24px
font-size:2rem
gap:16px
display:grid
```

## 7.2 Eventos

Eventos usam `@`

```txt
@click:submit
@change:updateField
@input:syncValue
```

## 7.3 Atributos HTML nativos

Atributos usam `$`

```txt
$href:"/home"
$src:"/img/logo.png"
$type:"button"
$alt:"Logo"
```

---

## 8. Herança Semântica e Restrições

Todo nó filho herda o referencial de seu pai **apenas para propriedades visuais**.

### Herdáveis

Propriedades semanticamente relacionadas à fluidez de texto:

```txt
color
font-size
font-family
font-weight
text-align
line-height
```
*(Nota: propriedades com prefixos de responsividade como `md.color` também garantem que o filho herde as variações de media queries correspondentes).*

### Não herdáveis

Atributos relacionados a caixa e layout não descem automaticamente:

```txt
padding
margin
display
grid-template-columns
gap
width
height
background
```

### Limites estritos de Herança

Diferente de CSS convencional, categorias lógicas **NÃO** são herdadas:

| Categoria | Herda para filhos? | Regra |
|---|---|---|
| Atributos HTML (`$`) | ❌ Não | Aplicam-se apenas ao nó que os declara explícitamente |
| Eventos (`@`) | ❌ Não | Funcionalidade e bindings atrelados unicamente ao nó declarante |

## Exemplo correto

```txt
(
  color:#FFFFFF
)
[main
  [p "Texto"]
]
```

## Exemplo incorreto semanticamente

```txt
(
  padding:32px
)
[main
  [p "Texto"]
]
```

Padding não deve contaminar o filho.

---

## 9. Sobrescrita

Quando o filho possui bloco próprio:

```txt
(
  color:#FFFFFF
)
[main
  (
    color:#00AAFF
  )
  [p "Texto"]
]
```

O filho sobrescreve.

---

## 10. Responsividade

Formato:

```txt
breakpoint.propriedade:valor
```

## Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## Exemplo

```txt
(
  display:grid
  grid-template-columns:1fr
  md.grid-template-columns:1fr 1fr
  lg.grid-template-columns:1fr 1fr 1fr
)
[main]
```

---

## 11. Eventos e runtime lógico

A linguagem obriga a declaração do script associado no topo do documento:
```txt
@logic "./landing.logic.ts"
```

Sem a tag `@logic` o compilador não emitirá o arquivo de *bindings*. O compilador possui forte validação de segurança estrutural:

## Declaração com ID Explícito (Padrão)

A vinculação acontece usando o ID estipulado na tag (`#submitButton-button` → `submitButton`).

```txt
@click:submit
```

```txt
[#submitButton-button "Enviar"]
```

Resolve para:
```ts
logic.submitButton.submit()
```

## Declaração Sem ID (Caminho Namespace Explícito)

Quando o nó é uma via rápida estrutural sem `#id`, o Brackdy exige a definição completa do namespace:

```txt
[section |> @click:hero-section.openHero
  [h1 "Ação Pura"]
]
```

Resolve para:
```ts
logic["hero-section"].openHero()
```

> **Aviso de Compilador**: Associar um `@evento:acao` num nó sem `#id` explícito ou sem `namespace.acao` quebra a fase semântica do compilador (`SEM_EVENT_NO_ID`). 

---

## 12. Arquivo lógico externo

## Estrutura esperada

```ts
const logic = {
  submitButton: {
    submit() {
      console.log("Executando");
    }
  },
  "hero-section": {
    openHero() {
      console.log("Ação Pura");
    }
  }
};
```

## Regra prática

Se houver evento e não existir arquivo `.logic.ts`, o compilador idealmente gera stub.

---

## 13. Atributos HTML

## Exemplo link

```txt
(
  $href:"/docs"
)
[a "Documentação"]
```

## Exemplo botão

```txt
(
  $type:"button"
)
[button "Enviar"]
```

---

## 14. Texto + filhos

## Recomendado

```txt
[h1 "Título"]
```

ou

```txt
[section
  [h1 "Título"]
  [p "Descrição"]
]
```

## Evitar

```txt
[section "Texto"
  [p "Descrição"]
]
```

---

## 15. Tags iniciais recomendadas

## Estruturais

- main
- section
- article
- header
- footer
- nav
- aside
- div

## Texto

- h1
- h2
- h3
- p

## Interação

- button
- a

---

## 16. Componentes e Slots

Componentes permitem padrões de UI reutilizáveis com pontos de substituição nomeados (slots). Eles são completamente expandidos em tempo de compilação.

## Definição de Componente

Usa-se o prefixo `>>` seguido do Nome em PascalCase. A definição deve ocorrer no nível superior.

```txt
(
  <bg>background:#1E1E1E
  <pad>padding:16px
)
[>>Card
  [<title>h2 "Título Padrão"]
  [<body>p "Texto Padrão"]
]
```

## Slots de Propriedades (Estilo)

Definidos dentro de `()` do componente: `<nomeSlot>propriedade:valor-padrão`.

## Slots de Nó (Conteúdo)

Definidos dentro do corpo estrutural do componente: `[<nomeSlot>tag "texto padrão"]`. Slots de nó substituem apenas o conteúdo de texto da tag.

## Chamada de Componente

Usa-se o prefixo `>` seguido do Nome. Os valores dos slots definidos podem ser sobrescritos.

```txt
(
  <bg:#FFFFFF>
)
[>Card
  [<title "Novo Título">]
  [<body "Novo conteúdo de texto do card">]
]
```

## Chamada sem Sobrescrita

Omitir as variáveis faz o componente assumir os valores padrões definidos nos slots:

```txt
[>Card]
```

## Limitações e Regras (v0.3)
- Componentes não podem aninhar (`>>`) outras construções de componentes internamente usando definições (apenas chamadas recursivas não cíclicas ou estáticas `[>]`).
- Slots de Node (`[<>]`) substituem exclusivamente o conteúdo textual interno do node e preservam inteiramente sua Tag de Declaração no Compilador.
- **Fail Fast:** O parser compilador corta falhas com aborto imediato na identificação do erro sem recuo sintático ou saídas espúrias isoladas por componentes/blocos.

---

## 17. Fluxo ideal do compilador

1. Lexer
2. Parser
3. AST
4. Analisador semântico
5. Resolução de herança
6. Codegen HTML
7. Codegen CSS
8. Codegen bindings TS

---

## 18. Saída esperada

## HTML

```html
<main>
  <section>
    <h1>Título</h1>
  </section>
</main>
```

## CSS

```css
.dsl_main_01 {
  background:#121212;
}
```

## TS bindings

```ts
button.addEventListener("click", logic.submitButton.submit);
```

---

## 19. Filosofia estrutural do Brackdy

Brackdy não tenta copiar HTML.

Brackdy tenta:

- reduzir ruído
- explicitar intenção
- manter semântica visível
- separar camadas sem abandonar legibilidade

A linguagem funciona melhor quando cada bloco expressa apenas uma responsabilidade semântica clara.
