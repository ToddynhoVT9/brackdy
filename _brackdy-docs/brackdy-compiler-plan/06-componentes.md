# Brackdy Compiler — Sistema de Componentes

## Visão Geral

Componentes permitem padrões de UI reutilizáveis com pontos de substituição nomeados (slots). Eles são completamente expandidos em tempo de compilação — o HTML de saída não contém nenhum rastro do sistema de componentes.

---

## Ciclo de Vida do Componente

```
Definir → Registrar → Expandir → Inlinear
```

1. **Definir:** `[>>Card ...]` no nível superior com sintaxe de slot
2. **Registrar:** o compilador armazena a definição pelo nome
3. **Expandir:** cada chamada `[>Card ...]` é substituída pelo corpo da definição, com slots substituídos
4. **Inlinear:** a árvore expandida entra na resolução normal de herança

---

## Tipos de Slot

### Slots de Prop (substituição de estilo)

Definidos dentro do bloco `()` de um componente:
```txt
<nomeSlot>propriedade-css:valor-padrão
```

Chamados com:
```txt
(<nomeSlot:novo-valor, ...>)
```

Cada slot de prop substitui um valor de propriedade CSS no bloco de estilo do componente.

### Slots de Nó (substituição estrutural)

Definidos dentro do corpo estrutural de um componente:
```txt
[<nomeSlot>tag "texto padrão"]
```

Chamados com:
```txt
[<nomeSlot "novo texto", ...>]
```

Slots de nó substituem apenas o **conteúdo de texto** de um nó. A tag em si é fixada pela definição. (Na v0.3, não é possível alterar a tag de um slot de nó no local de chamada.)

---

## Algoritmo de Expansão (detalhado)

### Entrada
- `def: ComponentDef`
- `call: ComponentCall`

### Passo 1: Resolver slots de prop

```ts
function resolvePropSlots(
  def: ComponentDef,
  call: ComponentCall
): StyleMap {
  const result: StyleMap = {};

  for (const slot of def.propSlots) {
    const override = call.propOverrides.find(o => o.slotName === slot.slotName);
    result[slot.cssKey] = override ? override.value : slot.defaultValue;
  }

  return result;
}
```

Exemplo:
- Definição: `<bg>background:#1E1E1E`, `<pad>padding:16px`
- Chamada: `(<bg:#ffffff>)` (pad não especificado)
- Resultado: `{ background: "#ffffff", padding: "16px" }`

### Passo 2: Resolver slots de nó

```ts
function resolveNodeSlots(
  def: ComponentDef,
  call: ComponentCall
): Map<string, string> {
  const map = new Map<string, string>();

  // Percorrer o corpo da definição para encontrar todos os SlotNodeDef
  for (const slotDef of collectSlotNodeDefs(def.body)) {
    const override = call.slotOverrides.find(o => o.slotName === slotDef.slotName);
    map.set(slotDef.slotName, override ? override.text : slotDef.defaultText);
  }

  return map;
}
```

### Passo 3: Clonar e substituir o corpo do componente

Percorrer o corpo da definição do componente. Para cada nó:
- Se for um `SlotNodeDef`: criar um `NodeDecl` com a tag do slot e o texto resolvido
- Se for um `NodeDecl` simples: cloná-lo, recursando nos filhos

Adicionar os slots de prop resolvidos como um `PropBlock` no início do nó raiz.

Se a chamada tiver um `id`, anexá-lo ao nó raiz clonado.

### Passo 4: Adicionar filhos extras

Quaisquer `extraChildren` da chamada (nós não-slot, nós simples, chamadas de componente aninhadas) são adicionados à lista de filhos do nó raiz após os filhos derivados de slots.

---

## Composição de Componentes

Quando um `ComponentCall` aparece dentro dos `extraChildren` de outro `ComponentCall`, ele é expandido recursivamente em profundidade-primeiro.

### Exemplo: Chamadas Aninhadas

```txt
[>Layout
  (<bg:#0a0a0a>)
  [<header "Página principal">]
  [h2 "Subtítulo fixo"]
  [>Card (<bg:#ffffff>) [<title "Card 1", body "Primeiro item">]]
  [p "Texto entre cards"]
  [>Card (<bg:#eeeeee>) [<title "Card 2", body "Segundo item">]]
]
```

Ordem de expansão:
1. Expandir chamada `Layout`:
   - Resolver slots de prop do `Layout` (bg → #0a0a0a, pad permanece padrão)
   - Resolver slots de nó do `Layout` (header → "Página principal")
   - Clonar o corpo do layout (um `[section ...]`)
   - `extraChildren` = `[h2 "Subtítulo fixo"]`, `[>Card ...]`, `[p ...]`, `[>Card ...]`
   - Adicionar filhos extras aos filhos da section clonada
2. Agora expandir recursivamente as duas chamadas `Card` dentro dos filhos da section

Árvore expandida final:
```
section (style: bg:#0a0a0a, pad:32px)
  h1  "Página principal"
  h2  "Subtítulo fixo"
  article (style: bg:#ffffff, pad:16px)
    h2  "Card 1"
    p   "Primeiro item"
  p   "Texto entre cards"
  article (style: bg:#eeeeee, pad:16px)
    h2  "Card 2"
    p   "Segundo item"
```

---

## Registro de Componentes

```ts
class ComponentRegistry {
  private defs = new Map<string, ComponentDef>();

  register(def: ComponentDef): void {
    if (this.defs.has(def.name)) {
      throw new SemanticError(`Definição de componente duplicada: "${def.name}"`);
    }
    this.defs.set(def.name, def);
  }

  get(name: string): ComponentDef {
    const def = this.defs.get(name);
    if (!def) throw new SemanticError(`Componente desconhecido: "${name}"`);
    return def;
  }
}
```

---

## Restrição de Ordenação de Componentes

Definições de componentes devem aparecer **antes** do seu primeiro uso no arquivo. O analisador os registra em uma varredura de primeiro passo do corpo de nível superior.

Implementação:
1. Primeiro passo: coletar todos os nós `ComponentDef` de `program.definitions` (o parser os armazena separadamente)
2. Registrar todas as definições antes de expandir qualquer chamada
3. Isso permite referências antecipadas se necessário no futuro, mas atualmente o parser coloca todos os blocos `[>>Name ...]` de nível superior em `program.definitions`

---

## Limitações na v0.3

| Limitação | Notas |
|---|---|
| Slot de nó não pode alterar a tag | A tag é fixada na definição; apenas o texto muda |
| Sem slot para filhos | Slots suportam apenas nós de texto; não é possível passar uma subárvore como valor de slot |
| Sem slot para eventos ou attrs | Eventos e attrs em definições de componentes são estáticos |
| Sem componentes recursivos | Um componente não pode chamar a si mesmo |
| Sem nós estruturais opcionais | Todas as entradas SlotNodeDef sempre aparecem na saída (usando o padrão se não sobrescritas) |

---

## Casos Especiais de Sintaxe de Slot

### Chamada sem sobrescritas → todos os padrões

```txt
[>Card]
```

Idêntico a chamar com todos os padrões. Todos os `SlotPropDef.defaultValue` e `SlotNodeDef.defaultText` são usados.

### Chamada com apenas sobrescrita de prop

```txt
[>Card (<bg:#2A2A2A>)]
```

Apenas `bg` é sobrescrito. `pad` usa o padrão. Slots de nó usam os padrões.

### Chamada com id mas sem sobrescritas

```txt
[>Card #my-card]
```

O nó raiz recebe `id="my-card"`. Todos os slots usam os padrões.

### Múltiplas chamadas, mesmo componente

Cada chamada produz uma expansão independente. Não há estado compartilhado entre chamadas.

---

## Disambiguação de Parsing de Componentes (resumo)

Com a sintaxe de definição `>>`, a disambiguação é **completamente orientada por tokens e não requer heurísticas**:

- `[>>Name ...]` (`LBRACKET DOUBLE_RANGLE IDENT`) → **sempre** um `ComponentDef`
- `[>Name ...]` (`LBRACKET RANGLE IDENT`) → **sempre** um `ComponentCall`

O lexer emite `DOUBLE_RANGLE` para `>>` e `RANGLE` para `>` como tokens distintos, então o parser faz o dispatch com um único `peek(1)` com zero ambiguidade. Não há varredura em dois passos, inspeção de corpo ou sensibilidade ao contexto.

```ts
// Dentro do loop de parseProgram():
if (check(LBRACKET) && peek(1).type === DOUBLE_RANGLE) {
  return parseComponentDef();   // [>>Name ...]
}
if (check(LBRACKET) && peek(1).type === RANGLE) {
  return parseComponentCall();  // [>Name ...]
}
```

Isso também significa que definições e chamadas são sintaticamente não-ambíguas em qualquer profundidade de aninhamento — um `[>>Name]` aparecendo dentro do corpo de um nó é imediatamente sinalizado como `PARSE_NESTED_DEF` sem inspecionar seu conteúdo.
