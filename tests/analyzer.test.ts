// ─── Brackdy Compiler — Analyzer Tests ───────────────────────────────

import { describe, it, expect, beforeEach } from "vitest";
import { Lexer } from "../src/lexer/lexer.js";
import { Parser } from "../src/parser/parser.js";
import { analyze } from "../src/analyzer/index.js";
import { resetClassCounter } from "../src/analyzer/responsive.js";
import type { Program } from "../src/parser/ast.js";
import type { ResolvedProgram, ResolvedNode } from "../src/analyzer/resolved.js";
import {
  SemDuplicateComponentError,
  SemUnknownComponentError,
  SemUnknownSlotError,
  SemEventNoIdError,
  SemEventNoLogicError,
} from "../src/errors/errors.js";

/** Helper: parse → analyze */
function compile(source: string): ResolvedProgram {
  const tokens = new Lexer(source).tokenize();
  const program = new Parser(tokens).parse();
  return analyze(program);
}

beforeEach(() => {
  resetClassCounter();
});

// ─────────────────────────────────────────────────────────────────────

describe("Analyzer — simple inheritance (Example 5)", () => {
  it("inherits visual props from parent PropBlock to children", () => {
    const result = compile(`
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

    expect(result.nodes.length).toBe(1); // main
    const main = result.nodes[0];
    expect(main.tag).toBe("main");

    // Main gets: top-level PropBlock (bg:#121212, color:#FFF, pad:24px)
    expect(main.style).toEqual({
      background: "#121212",
      color: "#FFFFFF",
      padding: "24px",
    });

    // Article gets: inherited(main) < child PropBlock (bg:#1E1E1E, pad:16px) -> but background and padding are not inherited, only color is inherited
    const article = main.children[0];
    expect(article.tag).toBe("article");
    expect(article.style).toEqual({
      background: "#1E1E1E",
      color: "#FFFFFF",
      padding: "16px",
    });

    // h2 inherits from article -> only color is inherited
    const h2 = article.children[0];
    expect(h2.text).toBe("Subbloco");
    expect(h2.style).toEqual({
      color: "#FFFFFF",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Analyzer — inline |> props override", () => {
  it("inline props override PropBlock and inherited", () => {
    const result = compile(`
      (background:#000000 color:#FFFFFF)
      [section |> background:#FF0000
        [p "Texto"]
      ]
    `);

    const section = result.nodes[0];
    expect(section.style!.background).toBe("#FF0000"); // inline overrides
    expect(section.style!.color).toBe("#FFFFFF"); // inherited

    const p = section.children[0];
    expect(p.style!.background).toBeUndefined(); // background is not inherited
    expect(p.style!.color).toBe("#FFFFFF"); // inherits from section
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Analyzer — attrs don't cascade", () => {
  it("$attrs are NOT inherited by children", () => {
    const result = compile(`
      [a |> $href:"/home"
        [p "Link text"]
      ]
    `);

    const a = result.nodes[0];
    expect(a.attrs.href).toBe("/home");

    const p = a.children[0];
    expect(p.attrs).toEqual({}); // not inherited
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Analyzer — component expansion", () => {
  it("expands a simple component call with slot defaults", () => {
    const result = compile(`
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
      [>Card]
    `);

    expect(result.nodes.length).toBe(1);
    const article = result.nodes[0];
    expect(article.tag).toBe("article");

    // The prop slots create a PropBlock inside article's children.
    // After inheritance, article gets the slot defaults as its style.
    expect(article.style).toBeDefined();
    expect(article.style!.background).toBe("#1E1E1E");
    expect(article.style!.padding).toBe("16px");

    // Children: h2 + p with default text (inheriting article's style)
    const h2 = article.children.find(c => c.text === "Título padrão");
    const p = article.children.find(c => c.text === "Conteúdo padrão");
    expect(h2).toBeDefined();
    expect(p).toBeDefined();
  });

  it("expands a component call with slot overrides", () => {
    const result = compile(`
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
      [>Card #my-card (<bg:#ffffff>)]
    `);

    const article = result.nodes[0];
    expect(article.id).toBe("my-card");
    // The prop slot overrides create a PropBlock inside article's children.
    // After inheritance: background overridden to #ffffff, padding default 16px.
    expect(article.style).toBeDefined();
    expect(article.style!.background).toBe("#ffffff");
    expect(article.style!.padding).toBe("16px");
  });

  it("expands a component call with node slot overrides", () => {
    const result = compile(`
      [>>Card
        (
          <bg>background:#1E1E1E
        )
        [article
          [<title>h2 "Título padrão"]
          [<body>p "Conteúdo padrão"]
        ]
      ]
      [>Card [<title "Novo título", body "Novo conteúdo">]]
    `);

    const article = result.nodes[0];
    expect(article.children[0].text).toBe("Novo título");
    expect(article.children[1].text).toBe("Novo conteúdo");
  });

  it("throws on unknown component", () => {
    expect(() => compile("[>Unknown]")).toThrow(SemUnknownComponentError);
  });

  it("throws on duplicate component definition", () => {
    expect(() =>
      compile(`
        [>>Card [article]]
        [>>Card [article]]
      `),
    ).toThrow(SemDuplicateComponentError);
  });

  it("throws on unknown slot name", () => {
    expect(() =>
      compile(`
        [>>Card
          (<bg>background:#1E1E1E)
          [article]
        ]
        [>Card (<nonexistent:#ffffff>)]
      `),
    ).toThrow(SemUnknownSlotError);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Analyzer — events", () => {
  it("collects event binding with implicit path", () => {
    const result = compile(`
      @logic "./page.logic.ts"
      [#btn::button |> @click:handleClick "Click"]
    `);

    expect(result.eventBindings.length).toBe(1);
    expect(result.eventBindings[0]).toEqual({
      targetId: "btn",
      querySelector: null,
      domEvent: "click",
      logicPath: "btn",
      methodName: "handleClick",
    });
  });

  it("collects event binding with explicit namespace", () => {
    const result = compile(`
      @logic "./page.logic.ts"
      [#hero::section |> @click:hero-section.openHero "Click"]
    `);

    expect(result.eventBindings[0]).toEqual({
      targetId: "hero",
      querySelector: null,
      domEvent: "click",
      logicPath: "hero-section",
      methodName: "openHero",
    });
  });

  it("throws when event on node without id", () => {
    expect(() =>
      compile(`
        @logic "./page.logic.ts"
        [button |> @click:submit "Click"]
      `),
    ).toThrow(SemEventNoIdError);
  });

  it("throws when events but no @logic", () => {
    expect(() =>
      compile(`
        [#btn::button |> @click:submit "Click"]
      `),
    ).toThrow(SemEventNoLogicError);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Analyzer — responsive classes", () => {
  it("generates responsive class for node with responsive props", () => {
    const result = compile(`
      (
        display:grid
        grid-template-columns:1fr
        gap:24px
        md.grid-template-columns:1fr 1fr
        lg.grid-template-columns:1fr 1fr 1fr
      )
      [main]
    `);

    expect(result.responsiveClasses.length).toBe(1);
    const rc = result.responsiveClasses[0];
    expect(rc.className).toBe("_dsl_main_01");
    expect(rc.baseProps).toEqual({
      display: "grid",
      "grid-template-columns": "1fr",
      gap: "24px",
    });
    expect(rc.breakpoints.length).toBe(2);
    expect(rc.breakpoints[0].breakpoint).toBe("md");
    expect(rc.breakpoints[0].minWidth).toBe(768);
    expect(rc.breakpoints[0].props).toEqual({ "grid-template-columns": "1fr 1fr" });
    expect(rc.breakpoints[1].breakpoint).toBe("lg");
    expect(rc.breakpoints[1].props).toEqual({ "grid-template-columns": "1fr 1fr 1fr" });

    // Node should have className, not style
    const main = result.nodes[0];
    expect(main.className).toBe("_dsl_main_01");
    expect(main.style).toBeNull();
  });

  it("does not generate class when no responsive props", () => {
    const result = compile(`
      (background:#121212)
      [main]
    `);

    expect(result.responsiveClasses.length).toBe(0);
    expect(result.nodes[0].className).toBeNull();
    expect(result.nodes[0].style).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Analyzer — no @logic, no events is fine", () => {
  it("returns empty events when no @logic and no events", () => {
    const result = compile("[main]");
    expect(result.eventBindings).toEqual([]);
    expect(result.logicFile).toBeNull();
  });
});
