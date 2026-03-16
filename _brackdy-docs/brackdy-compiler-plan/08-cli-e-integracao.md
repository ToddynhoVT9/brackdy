# Brackdy Compiler — CLI e Integração

## Uso da CLI

```bash
brackdy <entrada.by> [opções]
```

### Opções

| Flag | Padrão | Descrição |
|---|---|---|
| `--out-dir <dir>` | Mesmo diretório da entrada | Diretório de saída |
| `--logic <arquivo>` | Do `@logic` no fonte | Substitui o caminho do arquivo de lógica |
| `--wrap` | false | Envolve a saída em um documento HTML completo |
| `--watch` | false | Observa o arquivo de entrada, recompila em mudanças |
| `--no-css` | false | Suprime a saída `.css` mesmo se existirem props responsivas |
| `--no-bindings` | false | Suprime a saída `.bindings.ts` |
| `--verbose` | false | Imprime o AST e o programa resolvido no stdout |
| `--version` | — | Imprime a versão do compilador |

### Exemplos

```bash
# Compilar landing.by → landing.html, landing.css, landing.bindings.ts
brackdy landing.by

# Compilar para um diretório específico
brackdy src/pages/home.by --out-dir dist/

# Envolver em documento HTML completo
brackdy landing.by --wrap

# Modo de observação
brackdy landing.by --watch
```

---

## API Programática

```ts
import { compile } from "brackdy";

const source = `
[#hero::section |> background:#181818
  [h1 "Hello"]
]
`;

const result = compile(source);
// result.html   → "<section id=\"hero\" style=\"background:#181818\">..."
// result.css    → null  (sem props responsivas)
// result.bindings → null  (sem eventos)
```

### Assinatura de `compile(source, options?)`

```ts
interface CompilerOptions {
  filename?: string;          // para mensagens de erro; padrão: "<source>"
  outDir?: string;
  logicFileOverride?: string;
}

interface CompilerOutput {
  html: string;
  css: string | null;
  bindings: string | null;
}

function compile(source: string, options?: CompilerOptions): CompilerOutput
```

---

## Estrutura de Projeto (recomendada)

```
meu-projeto/
  src/
    pages/
      landing.by          ← Fonte Brackdy
      landing.logic.ts    ← Arquivo de lógica (escrito à mão)
  dist/
    landing.html          ← Saída do compilador
    landing.css           ← Saída do compilador
    landing.bindings.ts   ← Saída do compilador
```

---

## Integração com Ferramentas de Build

### Plugin Vite (esboço)

```ts
// vite-plugin-brackdy.ts
import { compile } from "brackdy";

export default function brackdyPlugin() {
  return {
    name: "brackdy",
    transform(src: string, id: string) {
      if (!id.endsWith(".by")) return null;
      const result = compile(src, { filename: id });
      // Retornar como módulo JS exportando strings html/css
      return {
        code: `export const html = ${JSON.stringify(result.html)};
               export const css = ${JSON.stringify(result.css)};`,
        map: null,
      };
    }
  };
}
```

---

## Estrutura do Pacote

```
brackdy/
  package.json
  tsconfig.json
  src/
    lexer/
      tokens.ts
      lexer.ts
    parser/
      ast.ts
      parser.ts
    analyzer/
      index.ts
      expand.ts       ← expansão de componentes
      inherit.ts      ← herança de propriedades
      events.ts       ← validação de eventos
      responsive.ts   ← geração de classes responsivas
    codegen/
      index.ts
      html.ts
      css.ts
      ts.ts
    errors/
      errors.ts
    index.ts          ← ponto de entrada compile()
  cli/
    index.ts          ← ponto de entrada da CLI
  tests/
    lexer.test.ts
    parser.test.ts
    analyzer.test.ts
    codegen.test.ts
    integration/
      example-01.test.ts   ← um teste por exemplo da spec
      ...
      example-17.test.ts
```

---

## Estratégia de Testes

Cada um dos 17 exemplos da spec se torna um teste de integração:

```ts
// example-05.test.ts
import { compile } from "../../src/index";
import { readFileSync } from "fs";

test("Exemplo 5 — Sobrescrita de herança", () => {
  const source = `
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
  `;

  const { html } = compile(source);

  expect(html).toBe(
    `<main style="background:#121212; color:#FFFFFF; padding:24px">\n` +
    `  <article style="background:#1E1E1E; color:#FFFFFF; padding:16px">\n` +
    `    <h2 style="background:#1E1E1E; color:#FFFFFF; padding:16px">Subbloco</h2>\n` +
    `    <p style="background:#1E1E1E; color:#FFFFFF; padding:16px">Conteúdo</p>\n` +
    `  </article>\n` +
    `</main>`
  );
});
```

---

## Linguagem de Implementação

**TypeScript**, com alvo Node.js 18+.

- Sem bibliotecas externas de geração de parser (lexer escrito à mão + parser de descida recursiva)
- Sem dependências de runtime no compilador principal
- CLI usa `commander` ou `process.argv` puro
- Testes usam `vitest` ou `jest`

---

## Extensão de Arquivo

Arquivos-fonte Brackdy usam a extensão `.by`.
