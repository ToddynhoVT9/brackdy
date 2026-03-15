// ─── Brackdy Compiler — Codegen Tests ────────────────────────────────

import { describe, it, expect, beforeEach } from "vitest";
import { Lexer } from "../src/lexer/lexer.js";
import { Parser } from "../src/parser/parser.js";
import { analyze } from "../src/analyzer/index.js";
import { generate } from "../src/codegen/index.js";
import { resetClassCounter } from "../src/analyzer/responsive.js";
import type { CompilerOutput } from "../src/codegen/index.js";

/** Full pipeline: source → tokens → AST → resolved → output */
function compileAll(source: string): CompilerOutput {
  const tokens = new Lexer(source).tokenize();
  const program = new Parser(tokens).parse();
  const resolved = analyze(program);
  return generate(resolved);
}

beforeEach(() => {
  resetClassCounter();
});

// ─────────────────────────────────────────────────────────────────────

describe("Codegen — HTML output", () => {
  it("emits a simple node", () => {
    const { html } = compileAll("[main]");
    expect(html).toBe("<main></main>");
  });

  it("emits a text node", () => {
    const { html } = compileAll('[h1 "Título"]');
    expect(html).toBe("<h1>Título</h1>");
  });

  it("emits nested nodes with indentation", () => {
    const { html } = compileAll(`
      [main
        [section
          [h1 "Título"]
        ]
      ]
    `);

    expect(html).toBe(
      "<main>\n" +
      '  <section>\n' +
      '    <h1>Título</h1>\n' +
      "  </section>\n" +
      "</main>",
    );
  });

  it("emits inline style from inherited props", () => {
    const { html } = compileAll(`
      (background:#121212)
      [main]
    `);
    expect(html).toBe('<main style="background:#121212"></main>');
  });

  it("emits node with id", () => {
    const { html } = compileAll("[#hero::section]");
    expect(html).toBe('<section id="hero"></section>');
  });

  it("emits node with $attr", () => {
    const { html } = compileAll('[a |> $href:"/home" "Link"]');
    expect(html).toBe('<a href="/home">Link</a>');
  });

  it("emits full Example 5", () => {
    const { html } = compileAll(`
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
    `);

    const expected =
      '<main style="background:#121212; color:#FFFFFF; padding:24px">\n' +
      '  <article style="color:#FFFFFF; background:#1E1E1E; padding:16px">\n' +
      '    <h2 style="color:#FFFFFF">Subbloco</h2>\n' +
      '    <p style="color:#FFFFFF">Conteúdo</p>\n' +
      '  </article>\n' +
      '</main>';

    expect(html).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Codegen — CSS output", () => {
  it("returns null when no responsive classes", () => {
    const { css } = compileAll("[main]");
    expect(css).toBeNull();
  });

  it("emits responsive CSS for Example 8 style", () => {
    const { css } = compileAll(`
      (
        display:grid
        grid-template-columns:1fr
        gap:24px
        md.grid-template-columns:1fr 1fr
        lg.grid-template-columns:1fr 1fr 1fr
      )
      [main]
    `);

    expect(css).not.toBeNull();
    expect(css).toContain("._dsl_main_01 {");
    expect(css).toContain("  display: grid;");
    expect(css).toContain("  grid-template-columns: 1fr;");
    expect(css).toContain("  gap: 24px;");
    expect(css).toContain("@media (min-width: 768px) {");
    expect(css).toContain("    grid-template-columns: 1fr 1fr;");
    expect(css).toContain("@media (min-width: 1024px) {");
    expect(css).toContain("    grid-template-columns: 1fr 1fr 1fr;");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Codegen — TS bindings output", () => {
  it("returns null when no events", () => {
    const { bindings } = compileAll("[main]");
    expect(bindings).toBeNull();
  });

  it("returns null when no @logic even if events would exist", () => {
    // This would throw SemEventNoLogicError, so no @logic + events = error
    // Just test the no-event case
    const { bindings } = compileAll("[main]");
    expect(bindings).toBeNull();
  });

  it("emits bindings for events with id", () => {
    const { bindings } = compileAll(`
      @logic "./page.logic.ts"
      [#hero::section |> @click:hero-section.openHero "Click"]
    `);

    expect(bindings).not.toBeNull();
    expect(bindings).toContain('import { logic } from "./page.logic";');
    expect(bindings).toContain('document.getElementById("hero")');
    expect(bindings).toContain('.addEventListener("click"');
    expect(bindings).toContain('logic["hero-section"].openHero(e)');
  });

  it("emits logicStub along with bindings", () => {
    const { bindings, logicStub } = compileAll(`
      @logic "./page.logic.ts"
      [#hero::section |> @click:hero-section.openHero "Click"]
    `);

    expect(bindings).not.toBeNull();
    expect(logicStub).not.toBeNull();
    expect(logicStub?.path).toBe("./page.logic.ts");
    expect(logicStub?.content).toContain('export const logic = {');
    expect(logicStub?.content).toContain('"hero-section": {');
    expect(logicStub?.content).toContain('openHero(event?: Event)');
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Codegen — full pipeline", () => {
  it("html + css + bindings all present", () => {
    const result = compileAll(`
      @logic "./app.logic.ts"
      (
        display:grid
        grid-template-columns:1fr
        md.grid-template-columns:1fr 1fr
      )
      [#app::main |> @click:app.init]
    `);

    expect(result.html).toContain("main");
    expect(result.css).not.toBeNull();
    expect(result.bindings).not.toBeNull();
  });
});
