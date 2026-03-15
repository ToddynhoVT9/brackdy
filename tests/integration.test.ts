// ─── Brackdy Compiler — Integration Tests ─────────────────────────────
// Tests the full compile() pipeline against spec examples 1-17.

import { describe, it, expect, beforeEach } from "vitest";
import { compile } from "../src/index.js";
import { resetClassCounter } from "../src/analyzer/responsive.js";
import { BrackdyError } from "../src/errors/errors.js";

beforeEach(() => {
  resetClassCounter();
});

// ─── Helper ────────────────────────────────────────────────────────────

/** Card component definition, shared across tests 11-16 */
const CARD_DEF = `
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
`;

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 1: Simple node", () => {
  it("compiles [section] to <section></section>", () => {
    const { html, css, bindings } = compile("[section]");
    expect(html).toBe("<section></section>");
    expect(css).toBeNull();
    expect(bindings).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 2: Text node", () => {
  it("compiles text nodes", () => {
    const { html } = compile(`
      [h1 "Título principal"]
      [p "Texto introdutório"]
    `);
    expect(html).toBe(
      "<h1>Título principal</h1>\n" +
      "<p>Texto introdutório</p>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 3: Node with id", () => {
  it("compiles #id::tag syntax", () => {
    const { html } = compile(`
      [#hero-section::section
        [#hero-title::h1 "Título"]
      ]
    `);
    expect(html).toBe(
      '<section id="hero-section">\n' +
      '  <h1 id="hero-title">Título</h1>\n' +
      "</section>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 4: Properties with ()", () => {
  it("propagates inheritable visual props to descendants (but not layout props)", () => {
    const { html } = compile(`
      (
        background:#121212
        color:#FFFFFF
        padding:24px
      )
      [main
        [section
          [h1 "Título"]
          [p "Texto"]
        ]
      ]
    `);
    expect(html).toBe(
      '<main style="background:#121212; color:#FFFFFF; padding:24px">\n' +
      '  <section style="color:#FFFFFF">\n' +
      '    <h1 style="color:#FFFFFF">Título</h1>\n' +
      '    <p style="color:#FFFFFF">Texto</p>\n' +
      "  </section>\n" +
      "</main>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 5: Inheritance override", () => {
  it("child PropBlock overrides inherited props and keeps layout props contained", () => {
    const { html } = compile(`
      (
        background:#121212
        color:#FFFFFF
        padding:24px
      )
      [main
        (
          background:#1E1E1E
          padding:16px
          color:#AAAAAA
        )
        [article
          [h2 "Subbloco"]
          [p "Conteúdo"]
        ]
      ]
    `);
    expect(html).toBe(
      "<main style=\"background:#121212; color:#FFFFFF; padding:24px\">\n" +
      "  <article style=\"color:#AAAAAA; background:#1E1E1E; padding:16px\">\n" +
      "    <h2 style=\"color:#AAAAAA\">Subbloco</h2>\n" +
      "    <p style=\"color:#AAAAAA\">Conteúdo</p>\n" +
      "  </article>\n" +
      "</main>"
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 6: Inline |> props", () => {
  it("applies inline props and inherits them", () => {
    const { html } = compile(`
      [section |> background:#181818 padding:32px color:#FFFFFF
        [h1 "Título"]
        [p "Descrição"]
      ]
    `);
    expect(html).toBe(
      '<section style="background:#181818; padding:32px; color:#FFFFFF">\n' +
      '  <h1 style="color:#FFFFFF">Título</h1>\n' +
      '  <p style="color:#FFFFFF">Descrição</p>\n' +
      "</section>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 7: Native $attrs", () => {
  it("emits $attr as HTML attribute, does not cascade", () => {
    const { html } = compile(`
      (
        $href:"/home"
        color:#00AAFF
      )
      [a "Home"]
    `);
    // Attr order: style first (from visual prop), then native attrs
    expect(html).toBe('<a style="color:#00AAFF" href="/home">Home</a>');
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 8: Responsive", () => {
  it("generates CSS classes and assigns them to nodes", () => {
    const { html, css } = compile(`
      (
        display:grid
        grid-template-columns:1fr
        gap:24px
        md.grid-template-columns:1fr 1fr
        lg.grid-template-columns:1fr 1fr 1fr
      )
      [main
        [article [h2 "Card A"]]
        [article [h2 "Card B"]]
        [article [h2 "Card C"]]
      ]
    `);

    // HTML: main and children get the class
    expect(html).toContain('class="_dsl_main_01"');

    // CSS: base + 2 breakpoints
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

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 9: Event binding (auto id)", () => {
  it("generates bindings with implicit path", () => {
    const { html, bindings } = compile(`
      @logic "./page.logic.ts"
      [#hero-section::section |> @click:openHero
        [h1 "Título"]
      ]
    `);

    expect(html).toContain('id="hero-section"');
    expect(bindings).not.toBeNull();
    expect(bindings).toContain('import { logic } from "./page.logic"');
    expect(bindings).toContain('document.getElementById("hero-section")');
    expect(bindings).toContain('.addEventListener("click"');
    expect(bindings).toContain('logic["hero-section"].openHero(e)');
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 10: Event binding (explicit path)", () => {
  it("generates bindings with explicit namespace", () => {
    const { bindings } = compile(`
      @logic "./page.logic.ts"
      [section |> @click:hero-section.openHero
        [h1 "Título sem id"]
      ]
    `);

    // Node has no id → explicit path → targetId is null → warning comment
    expect(bindings).not.toBeNull();
    expect(bindings).toContain("WARNING");
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 12: Component call (default slots)", () => {
  it("uses default slot values", () => {
    const { html } = compile(CARD_DEF + "[>Card]");

    expect(html).toBe(
      '<article style="background:#1E1E1E; padding:16px">\n' +
      '  <h2>Título padrão</h2>\n' +
      '  <p>Conteúdo padrão</p>\n' +
      "</article>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 13: Component call (full slot override)", () => {
  it("overrides all slots", () => {
    const { html } = compile(
      CARD_DEF +
      '[>Card (<bg:#ffffff, pad:20px>) [<title "Outro título", body "Outro conteúdo">]]',
    );

    expect(html).toBe(
      '<article style="background:#ffffff; padding:20px">\n' +
      '  <h2>Outro título</h2>\n' +
      '  <p>Outro conteúdo</p>\n' +
      "</article>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 14: Component call (partial override)", () => {
  it("overrides only bg, keeps pad default", () => {
    const { html } = compile(CARD_DEF + "[>Card (<bg:#2A2A2A>)]");

    expect(html).toBe(
      '<article style="background:#2A2A2A; padding:16px">\n' +
      '  <h2>Título padrão</h2>\n' +
      '  <p>Conteúdo padrão</p>\n' +
      "</article>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 15: Component call with id", () => {
  it("assigns id from call site", () => {
    const { html } = compile(
      CARD_DEF + '[>Card #my-card (<bg:#ffffff>) [<title "Card com id">]]',
    );

    expect(html).toBe(
      '<article id="my-card" style="background:#ffffff; padding:16px">\n' +
      '  <h2>Card com id</h2>\n' +
      '  <p>Conteúdo padrão</p>\n' +
      "</article>",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Example 16: Component composition", () => {
  it("composes Layout + Card components with extra children", () => {
    const source = `
[>>Layout
  (
    <bg>background:#111111
    <pad>padding:32px
  )
  [section
    [<header>h1 "Título padrão do layout"]
  ]
]

${CARD_DEF}

[>Layout
  (<bg:#0a0a0a>)
  [<header "Página principal">]
  [h2 "Subtítulo fixo"]
  [>Card (<bg:#ffffff>) [<title "Card 1", body "Primeiro item">]]
  [p "Texto entre cards"]
  [>Card (<bg:#eeeeee>) [<title "Card 2", body "Segundo item">]]
]
    `;

    const { html } = compile(source);

    expect(html).toContain('<section style="background:#0a0a0a; padding:32px">');
    expect(html).toContain("Página principal</h1>");
    expect(html).toContain("Subtítulo fixo</h2>");
    expect(html).toContain('<article style="background:#ffffff; padding:16px">');
    expect(html).toContain("Card 1</h2>");
    expect(html).toContain("Primeiro item</p>");
    expect(html).toContain("Texto entre cards</p>");
    expect(html).toContain('<article style="background:#eeeeee; padding:16px">');
    expect(html).toContain("Card 2</h2>");
    expect(html).toContain("Segundo item</p>");
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — Error cases", () => {
  it("throws BrackdyError on unknown tag", () => {
    expect(() => compile("[span]")).toThrow(BrackdyError);
  });

  it("throws BrackdyError on unterminated string", () => {
    expect(() => compile('[h1 "unterminated')).toThrow(BrackdyError);
  });

  it("throws on event without @logic", () => {
    expect(() =>
      compile('[#btn::button |> @click:submit "Click"]'),
    ).toThrow(BrackdyError);
  });

  it("throws on unknown component", () => {
    expect(() => compile("[>Unknown]")).toThrow(BrackdyError);
  });
});

// ════════════════════════════════════════════════════════════════════════

describe("Integration — compile() options", () => {
  it("logicFileOverride replaces @logic path", () => {
    const { bindings } = compile(
      '@logic "./old.ts"\n[#btn::button |> @click:submit "OK"]',
      { logicFileOverride: "./new.ts" },
    );

    expect(bindings).not.toBeNull();
    expect(bindings).toContain('import { logic } from "./new"');
    expect(bindings).not.toContain("old.ts");
  });

  it("wrap: true generates a full HTML document with custom title and charset", () => {
    const { html } = compile('[h1 "Título"]', {
      wrap: true,
      title: "Página de Teste"
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    expect(html).toContain("<title>Página de Teste</title>");
    expect(html).toContain("<h1>Título</h1>");
  });

  it("wrap: true injects CSS and TS link/scripts when explicitly provided via options", () => {
    const { html } = compile(
      '@logic "./page.logic"\n(color:#FFFFFF\nmd.color:#000000)\n[#app::main |> @click:init]',
      {
        wrap: true,
        title: "App",
        cssFileName: "app.css",
        bindingsFileName: "app.bindings.js"
      }
    );

    expect(html).toContain('<link rel="stylesheet" href="app.css">');
    expect(html).toContain('<script type="module" src="app.bindings.js"></script>');
  });
});
