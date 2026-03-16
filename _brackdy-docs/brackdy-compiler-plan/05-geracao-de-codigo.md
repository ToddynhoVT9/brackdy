# Brackdy Compiler — Geração de Código

## Visão Geral

O gerador de código recebe um `ResolvedProgram` e emite três strings de saída:
- `html`: a estrutura HTML
- `css`: folha de estilos opcional para classes responsivas
- `bindings`: wiring de eventos TypeScript opcional

---

## HTML Emitter

### Ponto de Entrada

```ts
function emitHtml(nodes: ResolvedNode[], indent?: number): string
```

Indent padrão = 0. Cada nível adiciona 2 espaços.

---

### Regras de Emissão de Nós

Para cada `ResolvedNode`:

1. Abrir tag com atributos
2. Emitir conteúdo de texto OU recursar nos filhos
3. Fechar tag

```ts
function emitNode(node: ResolvedNode, indent: number): string {
  const pad = " ".repeat(indent);
  const attrs = buildAttrString(node);
  const open = `${pad}<${node.tag}${attrs}>`;
  const close = `</${node.tag}>`;

  if (node.text !== null) {
    return `${open}${node.text}${close}`;
  }

  if (node.children.length === 0) {
    return `${open}${close}`;
  }

  const childLines = node.children
    .map(child => emitNode(child, indent + 2))
    .join("\n");

  return `${open}\n${childLines}\n${pad}${close}`;
}
```

---

### `buildAttrString(node: ResolvedNode): string`

Constrói a string de atributos que vai dentro da tag de abertura.

**Ordem:**
1. `id="..."` (se `node.id` estiver definido)
2. `class="..."` (se `node.className` estiver definido)
3. `style="..."` (se `node.style` estiver definido e não for null)
4. Todas as entradas de `node.attrs` (atributos HTML nativos)

```ts
function buildAttrString(node: ResolvedNode): string {
  const parts: string[] = [];

  if (node.id) {
    parts.push(`id="${node.id}"`);
  }

  if (node.className) {
    parts.push(`class="${node.className}"`);
  }

  if (node.style && Object.keys(node.style).length > 0) {
    const styleStr = buildStyleString(node.style);
    parts.push(`style="${styleStr}"`);
  }

  for (const [attr, val] of Object.entries(node.attrs)) {
    parts.push(`${attr}="${val}"`);
  }

  return parts.length > 0 ? " " + parts.join(" ") : "";
}
```

---

### `buildStyleString(style: StyleMap): string`

Converte um `StyleMap` em uma string CSS inline.

```ts
function buildStyleString(style: StyleMap): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join("; ");
}
```

Formato de saída: `background:#121212; color:#FFFFFF; padding:24px`

> Nota: a spec usa `;` com um espaço após cada entrada. Respeitar isso exatamente.

---

### Exemplo de Saída HTML

Para o Exemplo 5 (resolvido):
```html
<main style="background:#121212; color:#FFFFFF; padding:24px">
  <article style="background:#1E1E1E; color:#FFFFFF; padding:16px">
    <h2 style="background:#1E1E1E; color:#FFFFFF; padding:16px">Subbloco</h2>
    <p style="background:#1E1E1E; color:#FFFFFF; padding:16px">Conteúdo</p>
  </article>
</main>
```

---

## CSS Emitter

Executado apenas se `responsiveClasses.length > 0`.

### Ponto de Entrada

```ts
function emitCss(classes: ResponsiveClass[]): string
```

### Para cada `ResponsiveClass`

1. Emitir bloco de classe base
2. Para cada bloco de breakpoint (em ordem: sm → md → lg → xl), emitir bloco `@media`

```ts
function emitResponsiveClass(rc: ResponsiveClass): string {
  const lines: string[] = [];

  // Classe base
  lines.push(`.${rc.className} {`);
  for (const [k, v] of Object.entries(rc.baseProps)) {
    lines.push(`  ${k}: ${v};`);
  }
  lines.push(`}`);

  // Blocos de breakpoint
  const bpOrder = ["sm", "md", "lg", "xl"];
  for (const bp of bpOrder) {
    const block = rc.breakpoints.find(b => b.breakpoint === bp);
    if (!block) continue;

    lines.push(`@media (min-width: ${block.minWidth}px) {`);
    lines.push(`  .${rc.className} {`);
    for (const [k, v] of Object.entries(block.props)) {
      lines.push(`    ${k}: ${v};`);
    }
    lines.push(`  }`);
    lines.push(`}`);
  }

  return lines.join("\n");
}
```

### Exemplo de Saída CSS

Para o Exemplo 8:
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

---

## TypeScript Bindings Emitter

Executado apenas se `eventBindings.length > 0` E `logicFile !== null`.

### Ponto de Entrada

```ts
function emitBindings(
  logicFile: string,
  bindings: EventBinding[]
): string
```

### Estrutura

```ts
import { logic } from "${logicFile}";
// OU: estilo require se preferido; usar import ESM como padrão

// Depois um addEventListener por binding
```

### Emissão por binding

**Quando o binding tem um `targetId`:**
```ts
document.getElementById("${binding.targetId}")
  .addEventListener("${binding.domEvent}", () => logic["${binding.logicPath}"].${binding.methodName}());
```

**Quando o binding não tem `targetId`** (caminho explícito sem id no nó):
```ts
// Usar querySelector ou abordagem baseada em data.
// Para v0.3: emitir um comentário de aviso — eventos com caminho explícito sem id requerem wiring manual.
// [TODO: versão futura — atribuir atributo data-brackdy-event ao nó durante a emissão HTML]
document.querySelector('[data-brackdy-ref="${binding.logicPath}-${binding.methodName}"]')
  ?.addEventListener("${binding.domEvent}", () => logic["${binding.logicPath}"].${binding.methodName}());
```

> Para v0.3, a abordagem mais simples: se não houver `targetId`, emitir um comentário `// AVISO:` e pular o binding. Os exemplos da spec mostram apenas bindings com caminho explícito resolvendo para `logic["ns"].method()` sem wiring DOM. Documentar isso como uma limitação.

### Exemplo Completo de Saída de Bindings

Para o Exemplo 9:
```ts
import { logic } from "./page.logic.ts";

document.getElementById("hero-section")
  .addEventListener("click", () => logic["hero-section"].openHero());
```

---

## Ponto de Entrada do Emitter Completo

```ts
function generate(resolved: ResolvedProgram): CompilerOutput {
  const html = emitHtml(resolved.nodes);

  const css = resolved.responsiveClasses.length > 0
    ? resolved.responsiveClasses.map(emitResponsiveClass).join("\n\n")
    : null;

  const bindings = (resolved.eventBindings.length > 0 && resolved.logicFile !== null)
    ? emitBindings(resolved.logicFile, resolved.eventBindings)
    : null;

  return { html, css, bindings };
}
```

---

## Envolvimento em Documento HTML

O emitter produz **fragmentos**, não documentos HTML completos. A saída `html` é apenas a árvore de nós (sem `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`). Isso mantém a saída do compilador embutível.

Se um documento completo for necessário, o consumidor envolve a saída:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="saida.css">
</head>
<body>
  <!-- saída html do brackdy aqui -->
  <script type="module" src="saida.bindings.js"></script>
</body>
</html>
```

Uma flag `--wrap` na CLI pode automatizar isso.

---

## Casos Especiais

| Caso | Comportamento |
|---|---|
| Nó sem estilo e sem classe | Emitir tag sem atributo `style` ou `class` |
| Nó com filhos vazios | Emitir `<tag></tag>` em uma linha |
| Tags auto-fechantes | Não aplicável — Brackdy suporta apenas tags não-void |
| Attrs `$` com valores entre aspas | Remover aspas do valor antes de emitir |
| Múltiplos eventos no mesmo nó | Emitir um `addEventListener` por evento |
| Nó responsivo sem props base | O bloco de classe ainda é emitido (apenas breakpoints) |
