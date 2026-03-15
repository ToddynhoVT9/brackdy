// ─── Brackdy Compiler — Parser Tests ─────────────────────────────────

import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer/lexer.js";
import { Parser } from "../src/parser/parser.js";
import type {
  Program, NodeDecl, PropBlock, ComponentDef, ComponentCall,
  VisualProp, EventProp, AttrProp, ResponsiveProp,
} from "../src/parser/ast.js";
import {
  ParseUnknownTagError,
  ParseIdWithoutTagError,
  ParseComponentLowercaseError,
  ParseNestedDefError,
  BrackdyError,
} from "../src/errors/errors.js";

/** Helper: parse a source string and return the Program AST. */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

// ─────────────────────────────────────────────────────────────────────

describe("Parser — @logic declaration", () => {
  it("parses @logic with string path", () => {
    const prog = parse('@logic "./page.logic.ts"');
    expect(prog.logicFile).toBe("./page.logic.ts");
  });

  it("returns null logicFile when no @logic", () => {
    const prog = parse("[main]");
    expect(prog.logicFile).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — simple nodes", () => {
  it("parses a simple tag node", () => {
    const prog = parse("[section]");
    expect(prog.body.length).toBe(1);
    const node = prog.body[0] as NodeDecl;
    expect(node.kind).toBe("NodeDecl");
    expect(node.tag).toBe("section");
    expect(node.id).toBeNull();
    expect(node.text).toBeNull();
    expect(node.children).toEqual([]);
  });

  it("parses a text node", () => {
    const prog = parse('[h1 "Título principal"]');
    const node = prog.body[0] as NodeDecl;
    expect(node.tag).toBe("h1");
    expect(node.text).toBe("Título principal");
  });

  it("parses nested children", () => {
    const prog = parse(`
      [main
        [section
          [h1 "Título"]
          [p "Descrição"]
        ]
      ]
    `);
    const main = prog.body[0] as NodeDecl;
    expect(main.tag).toBe("main");
    expect(main.children.length).toBe(1);

    const section = main.children[0] as NodeDecl;
    expect(section.tag).toBe("section");
    expect(section.children.length).toBe(2);

    const h1 = section.children[0] as NodeDecl;
    expect(h1.tag).toBe("h1");
    expect(h1.text).toBe("Título");

    const p = section.children[1] as NodeDecl;
    expect(p.tag).toBe("p");
    expect(p.text).toBe("Descrição");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — node with id", () => {
  it("parses #id::tag syntax", () => {
    const prog = parse("[#hero-section::section]");
    const node = prog.body[0] as NodeDecl;
    expect(node.id).toBe("hero-section");
    expect(node.tag).toBe("section");
  });

  it("parses nested nodes with ids", () => {
    const prog = parse(`
      [#hero-section::section
        [#hero-title::h1 "Título"]
      ]
    `);
    const section = prog.body[0] as NodeDecl;
    expect(section.id).toBe("hero-section");
    const h1 = section.children[0] as NodeDecl;
    expect(h1.id).toBe("hero-title");
    expect(h1.text).toBe("Título");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — prop blocks", () => {
  it("parses standalone prop block with visual props", () => {
    const prog = parse(`
      (
        background:#121212
        color:#FFFFFF
        padding:24px
      )
      [main]
    `);
    expect(prog.body.length).toBe(2);
    const block = prog.body[0] as PropBlock;
    expect(block.kind).toBe("PropBlock");
    expect(block.props.length).toBe(3);

    const bg = block.props[0] as VisualProp;
    expect(bg.kind).toBe("VisualProp");
    expect(bg.key).toBe("background");
    expect(bg.value).toBe("#121212");

    const color = block.props[1] as VisualProp;
    expect(color.key).toBe("color");
    expect(color.value).toBe("#FFFFFF");

    const padding = block.props[2] as VisualProp;
    expect(padding.key).toBe("padding");
    expect(padding.value).toBe("24px");
  });

  it("parses child prop blocks", () => {
    const prog = parse(`
      [main
        (background:#1E1E1E padding:16px)
        [article]
      ]
    `);
    const main = prog.body[0] as NodeDecl;
    expect(main.children.length).toBe(2);

    const block = main.children[0] as PropBlock;
    expect(block.kind).toBe("PropBlock");
    expect(block.props.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — inline props |>", () => {
  it("parses visual props after |>", () => {
    const prog = parse("[section |> background:#181818 padding:32px]");
    const node = prog.body[0] as NodeDecl;
    expect(node.inlineProps).not.toBeNull();
    expect(node.inlineProps!.length).toBe(2);

    const bg = node.inlineProps![0] as VisualProp;
    expect(bg.key).toBe("background");
    expect(bg.value).toBe("#181818");

    const pad = node.inlineProps![1] as VisualProp;
    expect(pad.key).toBe("padding");
    expect(pad.value).toBe("32px");
  });

  it("parses |> with event prop", () => {
    const prog = parse("[#hero::section |> @click:openHero]");
    const node = prog.body[0] as NodeDecl;
    expect(node.inlineProps!.length).toBe(1);

    const event = node.inlineProps![0] as EventProp;
    expect(event.kind).toBe("EventProp");
    expect(event.event).toBe("click");
    expect(event.action).toBe("openHero");
    expect(event.namespace).toBeNull();
  });

  it("parses |> with $attr prop", () => {
    const prog = parse('[a |> $href:"/home" "Link"]');
    const node = prog.body[0] as NodeDecl;
    expect(node.inlineProps!.length).toBe(1);

    const attr = node.inlineProps![0] as AttrProp;
    expect(attr.name).toBe("href");
    expect(attr.value).toBe("/home");
    expect(node.text).toBe("Link");
  });

  it("parses inline props followed by children", () => {
    const prog = parse(`
      [#hero-section::section |> background:#181818 padding:32px
        [h1 "Título"]
        [p "Texto"]
      ]
    `);
    const node = prog.body[0] as NodeDecl;
    expect(node.inlineProps!.length).toBe(2);
    expect(node.children.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — event props", () => {
  it("parses event with simple action", () => {
    const prog = parse("(@click:submit)");
    const block = prog.body[0] as PropBlock;
    const event = block.props[0] as EventProp;
    expect(event.event).toBe("click");
    expect(event.action).toBe("submit");
    expect(event.namespace).toBeNull();
  });

  it("parses event with namespace.action", () => {
    const prog = parse("(@click:hero-section.openHero)");
    const block = prog.body[0] as PropBlock;
    const event = block.props[0] as EventProp;
    expect(event.event).toBe("click");
    expect(event.action).toBe("openHero");
    expect(event.namespace).toBe("hero-section");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — $ attributes", () => {
  it("parses attribute with quoted value", () => {
    const prog = parse('($href:"/home")');
    const block = prog.body[0] as PropBlock;
    const attr = block.props[0] as AttrProp;
    expect(attr.kind).toBe("AttrProp");
    expect(attr.name).toBe("href");
    expect(attr.value).toBe("/home");
  });

  it("parses attribute with unquoted value", () => {
    const prog = parse("($type:button)");
    const block = prog.body[0] as PropBlock;
    const attr = block.props[0] as AttrProp;
    expect(attr.name).toBe("type");
    expect(attr.value).toBe("button");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — responsive props", () => {
  it("parses responsive props with breakpoint prefix", () => {
    const prog = parse(`
      (
        display:grid
        grid-template-columns:1fr
        gap:24px
        md.grid-template-columns:1fr 1fr
        lg.grid-template-columns:1fr 1fr 1fr
      )
    `);
    const block = prog.body[0] as PropBlock;
    expect(block.props.length).toBe(5);

    const mdProp = block.props[3] as ResponsiveProp;
    expect(mdProp.kind).toBe("ResponsiveProp");
    expect(mdProp.breakpoint).toBe("md");
    expect(mdProp.key).toBe("grid-template-columns");
    expect(mdProp.value).toBe("1fr 1fr");

    const lgProp = block.props[4] as ResponsiveProp;
    expect(lgProp.breakpoint).toBe("lg");
    expect(lgProp.key).toBe("grid-template-columns");
    expect(lgProp.value).toBe("1fr 1fr 1fr");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — multi-word values", () => {
  it("parses multi-word CSS values like '1fr 1fr 1fr'", () => {
    const prog = parse("(grid-template-columns:1fr 1fr 1fr)");
    const block = prog.body[0] as PropBlock;
    const prop = block.props[0] as VisualProp;
    expect(prop.key).toBe("grid-template-columns");
    expect(prop.value).toBe("1fr 1fr 1fr");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — component definition", () => {
  it("parses a basic component definition", () => {
    const prog = parse(`
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
    `);

    expect(prog.definitions.length).toBe(1);
    const def = prog.definitions[0];
    expect(def.kind).toBe("ComponentDef");
    expect(def.name).toBe("Card");

    // Prop slots
    expect(def.propSlots.length).toBe(2);
    expect(def.propSlots[0].slotName).toBe("bg");
    expect(def.propSlots[0].cssKey).toBe("background");
    expect(def.propSlots[0].defaultValue).toBe("#1E1E1E");
    expect(def.propSlots[1].slotName).toBe("pad");
    expect(def.propSlots[1].cssKey).toBe("padding");
    expect(def.propSlots[1].defaultValue).toBe("16px");

    // Body
    expect(def.body.length).toBe(1);
    const article = def.body[0] as NodeDecl;
    expect(article.tag).toBe("article");

    // Slot nodes inside the article
    expect(article.children.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — component call", () => {
  it("parses a simple component call", () => {
    const prog = parse("[>Card]");
    expect(prog.body.length).toBe(1);
    const call = prog.body[0] as ComponentCall;
    expect(call.kind).toBe("ComponentCall");
    expect(call.name).toBe("Card");
    expect(call.id).toBeNull();
    expect(call.propOverrides).toEqual([]);
    expect(call.slotOverrides).toEqual([]);
    expect(call.extraChildren).toEqual([]);
  });

  it("parses a component call with id", () => {
    const prog = parse("[>Card #my-card]");
    const call = prog.body[0] as ComponentCall;
    expect(call.id).toBe("my-card");
  });

  it("parses a component call with prop slot overrides", () => {
    const prog = parse("[>Card (<bg:#ffffff, pad:20px>)]");
    const call = prog.body[0] as ComponentCall;
    expect(call.propOverrides.length).toBe(2);
    expect(call.propOverrides[0].slotName).toBe("bg");
    expect(call.propOverrides[0].value).toBe("#ffffff");
    expect(call.propOverrides[1].slotName).toBe("pad");
    expect(call.propOverrides[1].value).toBe("20px");
  });

  it("parses a component call with node slot overrides", () => {
    const prog = parse('[>Card [<title "Outro título", body "Outro conteúdo">]]');
    const call = prog.body[0] as ComponentCall;
    expect(call.slotOverrides.length).toBe(2);
    expect(call.slotOverrides[0].slotName).toBe("title");
    expect(call.slotOverrides[0].text).toBe("Outro título");
    expect(call.slotOverrides[1].slotName).toBe("body");
    expect(call.slotOverrides[1].text).toBe("Outro conteúdo");
  });

  it("parses a component call with extra children", () => {
    const prog = parse(`
      [>Card
        [h2 "Extra título"]
        [p "Extra texto"]
      ]
    `);
    const call = prog.body[0] as ComponentCall;
    expect(call.extraChildren.length).toBe(2);
    const h2 = call.extraChildren[0] as NodeDecl;
    expect(h2.tag).toBe("h2");
    const p = call.extraChildren[1] as NodeDecl;
    expect(p.tag).toBe("p");
  });

  it("parses nested component calls", () => {
    const prog = parse(`
      [>Layout
        [>Card]
        [p "Texto entre"]
        [>Card]
      ]
    `);
    const layout = prog.body[0] as ComponentCall;
    expect(layout.name).toBe("Layout");
    expect(layout.extraChildren.length).toBe(3);
    expect((layout.extraChildren[0] as ComponentCall).kind).toBe("ComponentCall");
    expect((layout.extraChildren[1] as NodeDecl).kind).toBe("NodeDecl");
    expect((layout.extraChildren[2] as ComponentCall).kind).toBe("ComponentCall");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — validation errors", () => {
  it("throws on unknown tag", () => {
    expect(() => parse("[span]")).toThrow(ParseUnknownTagError);
  });

  it("throws on #id without ::tag", () => {
    expect(() => parse("[#hero section]")).toThrow(ParseIdWithoutTagError);
  });

  it("throws on lowercase component name in definition", () => {
    expect(() => parse("[>>card]")).toThrow(ParseComponentLowercaseError);
  });

  it("throws on lowercase component name in call", () => {
    expect(() => parse("[>card]")).toThrow(ParseComponentLowercaseError);
  });

  it("throws on nested component definition", () => {
    expect(() => parse(`
      [main
        [>>Card]
      ]
    `)).toThrow(ParseNestedDefError);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Parser — full example (example 5)", () => {
  it("parses inheritance override example", () => {
    const prog = parse(`
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

    expect(prog.body.length).toBe(2);

    // First body item: PropBlock
    const block = prog.body[0] as PropBlock;
    expect(block.kind).toBe("PropBlock");
    expect(block.props.length).toBe(3);

    // Second body item: main NodeDecl
    const main = prog.body[1] as NodeDecl;
    expect(main.tag).toBe("main");
    expect(main.children.length).toBe(2); // PropBlock + article

    const childBlock = main.children[0] as PropBlock;
    expect(childBlock.props.length).toBe(2);

    const article = main.children[1] as NodeDecl;
    expect(article.tag).toBe("article");
    expect(article.children.length).toBe(2);
  });
});
