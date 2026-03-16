# Brackdy — Compilador DSL v0.3

> Transforme interfaces declarativas em **HTML + CSS + TypeScript** com uma sintaxe mínima e sem runtime.

```
(
  background:#121212
  color:#FFFFFF
)
[#hero::section
  [h1 "Olá, Brackdy!"]
  [p "Interfaces declarativas, zero overhead."]
]
```

↓ compila para ↓

```html
<section id="hero" style="background:#121212; color:#FFFFFF">
  <h1 style="background:#121212; color:#FFFFFF">Olá, Brackdy!</h1>
  <p style="background:#121212; color:#FFFFFF">Interfaces declarativas, zero overhead.</p>
</section>
```

---

## Instalação

```bash
git clone https://github.com/ToddynhoVT9/brackdy.git
cd brackdy
npm install
```

---

## Uso

### Via CLI

```bash
# Compilação básica — gera arquivo.html no mesmo diretório
npx ts-node cli/index.ts caminho/para/arquivo.by

# Gera documento HTML completo (com <!DOCTYPE>, <head>, <body>)
npx ts-node cli/index.ts arquivo.by --wrap

# Define diretório de saída
npx ts-node cli/index.ts arquivo.by --out-dir dist/

# Suprime geração de CSS ou bindings
npx ts-node cli/index.ts arquivo.by --no-css --no-bindings

# Modo verboso (imprime artefatos gerados)
npx ts-node cli/index.ts arquivo.by --verbose
```

**Flags disponíveis:**

| Flag | Descrição |
|---|---|
| `--out-dir <dir>` | Diretório de saída |
| `--logic <file>` | Sobrescreve a declaração `@logic` do arquivo |
| `--wrap` | Envolve saída em documento HTML completo |
| `--no-css` | Não gera arquivo `.css` |
| `--no-bindings` | Não gera arquivo `.bindings.ts` |
| `--verbose` | Imprime detalhes da compilação |

### Via API Programática

```ts
import { compile } from "./src/index";

const resultado = compile(`
  (background:#0D0D0D color:#F5F5F5)
  [main
    [h1 "Minha Página"]
    [p "Conteúdo aqui"]
  ]
`);

console.log(resultado.html);      // string HTML
console.log(resultado.css);       // string CSS ou null
console.log(resultado.bindings);  // string TS ou null
```

A função `compile()` retorna:

```ts
{
  html: string;       // HTML gerado (sempre presente)
  css: string | null;  // CSS com @media — presente se há props responsivas
  bindings: string | null; // TS com addEventListener — presente se há @eventos
}
```

---

## Migrando para outro projeto

### 1. Copiar o compilador

Copie a pasta `src/` inteira para dentro do seu projeto:

```
meu-projeto/
├── src/
│   └── brackdy/           ← cole aqui
│       ├── lexer/
│       ├── parser/
│       ├── resolver/
│       ├── generator/
│       ├── compiler/
│       ├── errors/
│       └── index.ts
├── ...
```

### 2. Instalar dependências

O compilador tem **zero dependências de runtime**. Você só precisa de TypeScript:

```bash
npm install typescript @types/node --save-dev
```

O `commander` é usado apenas pelo CLI e não é necessário se você usar a API programática.

### 3. Importar e usar

```ts
// Em qualquer arquivo do seu projeto
import { compile } from "./brackdy/index";

// Lendo de um arquivo .by
import { readFileSync } from "fs";

const source = readFileSync("pages/home.by", "utf-8");
const output = compile(source);

// Escrever os artefatos onde quiser
writeFileSync("public/home.html", output.html);
if (output.css) writeFileSync("public/home.css", output.css);
if (output.bindings) writeFileSync("public/home.bindings.ts", output.bindings);
```

### 4. Integrar com build tools (opcional)

**Com um script npm:**
```json
{
  "scripts": {
    "compile:pages": "ts-node scripts/compile-brackdy.ts"
  }
}
```

**Com Vite (plugin personalizado):**
```ts
// vite-plugin-brackdy.ts
import { compile } from "./src/brackdy/index";

export default function brackdyPlugin() {
  return {
    name: "vite-plugin-brackdy",
    transform(code: string, id: string) {
      if (!id.endsWith(".by")) return null;
      const { html } = compile(code);
      return { code: `export default ${JSON.stringify(html)};` };
    }
  };
}
```

---

## Sintaxe Rápida

| Recurso | Sintaxe | Exemplo |
|---|---|---|
| Nó HTML | `[tag]` | `[section]`, `[h1 "Texto"]` |
| ID + Tag | `[#id::tag]` | `[#hero::section]` |
| Bloco de props | `( prop:valor )` | `(background:#121212)` |
| Props inline | `[tag \|> prop:valor]` | `[div \|> padding:16px]` |
| Atributo HTML | `$attr:valor` | `$href:"/docs"` |
| Evento | `@evento:acao` | `@click:submit` |
| Namespace | `@evento:ns.acao` | `@click:hero.open` |
| Responsivo | `bp.prop:valor` | `md.grid-template-columns:1fr 1fr` |
| Componente (def) | `[>>Nome ...]` | `[>>Card ...]` |
| Componente (call) | `[>Nome ...]` | `[>Card]` |
| Slot de prop | `<slot>prop:default` | `<bg>background:#1E1E1E` |
| Slot de nó | `[<slot>tag "texto"]` | `[<title>h2 "Padrão"]` |
| Lógica externa | `@logic "arquivo"` | `@logic "./page.logic.ts"` |

**Breakpoints:** `sm` (640px) · `md` (768px) · `lg` (1024px) · `xl` (1280px)

---

## Scripts de Desenvolvimento

```bash
npm test              # Roda 18 testes de integração
npm run test:watch    # Testes em modo watch
npm run test:coverage # Cobertura de código
npm run build         # Compila TypeScript para dist/
```

---

## Estrutura do Projeto

```
brackdy/
├── src/
│   ├── lexer/          → Tokenização (.by → tokens)
│   ├── parser/         → AST (tokens → árvore)
│   ├── resolver/       → Semântica (herança, componentes, eventos)
│   ├── generator/      → Saída (AST → HTML/CSS/TS)
│   ├── compiler/       → Orquestrador
│   ├── errors/         → Classes de erro por fase
│   └── index.ts        → API pública
├── cli/                → Interface de linha de comando
├── tests/              → Testes de integração (Vitest)
└── _brackdy-docs/      → Especificação e design do compilador
```
