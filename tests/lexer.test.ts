// ─── Brackdy Compiler — Lexer Tests ──────────────────────────────────

import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer/lexer.js";
import { TokenType } from "../src/lexer/tokens.js";
import { LexUnterminatedStringError, LexUnexpectedCharError } from "../src/errors/errors.js";

/** Helper: tokenize a string and return the token array (without EOF). */
function tokenize(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  // Drop EOF for easier assertions
  return tokens.filter(t => t.type !== TokenType.EOF);
}

/** Helper: tokenize and return just the types. */
function types(source: string) {
  return tokenize(source).map(t => t.type);
}

/** Helper: tokenize and return [type, value] pairs. */
function pairs(source: string) {
  return tokenize(source).map(t => [t.type, t.value] as const);
}

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — single-char tokens", () => {
  it("tokenizes structural brackets", () => {
    expect(types("[ ] ( )")).toEqual([
      TokenType.LBRACKET,
      TokenType.RBRACKET,
      TokenType.LPAREN,
      TokenType.RPAREN,
    ]);
  });

  it("tokenizes angle brackets", () => {
    expect(types("< >")).toEqual([
      TokenType.LANGLE,
      TokenType.RANGLE,
    ]);
  });

  it("tokenizes hash, at, dollar, dot, colon, comma", () => {
    expect(types("# @ $ . : ,")).toEqual([
      TokenType.HASH,
      TokenType.AT,
      TokenType.DOLLAR,
      TokenType.DOT,
      TokenType.COLON,
      TokenType.COMMA,
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — two-char operators", () => {
  it("tokenizes :: as DOUBLE_COLON", () => {
    expect(types("::")).toEqual([TokenType.DOUBLE_COLON]);
  });

  it("tokenizes |> as PIPE_ARROW", () => {
    expect(types("|>")).toEqual([TokenType.PIPE_ARROW]);
  });

  it("tokenizes >> as DOUBLE_RANGLE", () => {
    expect(types(">>")).toEqual([TokenType.DOUBLE_RANGLE]);
  });

  it("DOUBLE_RANGLE takes priority over single RANGLE", () => {
    // ">>" should produce one DOUBLE_RANGLE, not two RANGLEs
    const tokens = tokenize(">>");
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.DOUBLE_RANGLE);
  });

  it(">>> produces DOUBLE_RANGLE + RANGLE", () => {
    expect(types(">>>")).toEqual([
      TokenType.DOUBLE_RANGLE,
      TokenType.RANGLE,
    ]);
  });

  it("single > after something else stays as RANGLE", () => {
    expect(types("[>")).toEqual([
      TokenType.LBRACKET,
      TokenType.RANGLE,
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — @logic keyword", () => {
  it("tokenizes @logic as a single KW_LOGIC token", () => {
    const tokens = tokenize('@logic "./file.ts"');
    expect(tokens[0].type).toBe(TokenType.KW_LOGIC);
    expect(tokens[0].value).toBe("@logic");
    expect(tokens[1].type).toBe(TokenType.STRING);
    expect(tokens[1].value).toBe("./file.ts");
  });

  it("plain @ is AT when not followed by 'logic'", () => {
    expect(types("@click")).toEqual([
      TokenType.AT,
      TokenType.IDENT,
    ]);
  });

  it("@logicExtra is AT + IDENT (not KW_LOGIC)", () => {
    // "logicExtra" starts with "logic" but continues with more chars
    const tokens = tokenize("@logicExtra");
    expect(tokens[0].type).toBe(TokenType.AT);
    expect(tokens[1].type).toBe(TokenType.IDENT);
    expect(tokens[1].value).toBe("logicExtra");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — strings", () => {
  it("tokenizes a quoted string and strips quotes", () => {
    const tokens = tokenize('"Hello World"');
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe("Hello World");
  });

  it("handles empty strings", () => {
    const tokens = tokenize('""');
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe("");
  });

  it("throws on unterminated string", () => {
    expect(() => tokenize('"unterminated')).toThrow(LexUnterminatedStringError);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — identifiers", () => {
  it("tokenizes simple identifiers", () => {
    const tokens = tokenize("section");
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("section");
  });

  it("allows hyphens inside identifiers", () => {
    const tokens = tokenize("hero-section");
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("hero-section");
  });

  it("allows underscores inside identifiers", () => {
    const tokens = tokenize("hero_main");
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("hero_main");
  });

  it("allows digits after first character", () => {
    const tokens = tokenize("card-01");
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("card-01");
  });

  it("allows CSS property names", () => {
    const tokens = tokenize("grid-template-columns");
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("grid-template-columns");
  });

  it("tokenizes values like 24px as IDENT", () => {
    // Digit-starting values like "24px" are lexed as identifiers.
    // The parser disambiguates by context.
    const tokens = tokenize("24px");
    expect(tokens[0].type).toBe(TokenType.IDENT);
    expect(tokens[0].value).toBe("24px");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — # is always separate", () => {
  it("hash and identifier are always separate tokens", () => {
    const tokens = tokenize("#hero-section");
    expect(tokens[0].type).toBe(TokenType.HASH);
    expect(tokens[0].value).toBe("#");
    expect(tokens[1].type).toBe(TokenType.IDENT);
    expect(tokens[1].value).toBe("hero-section");
  });

  it("hash in color context: #121212 → HASH + IDENT", () => {
    // The spec says hex colors are lexed as HASH + IDENT.
    // The parser recombines them into "#121212" in value contexts.
    const tokens = tokenize("#121212");
    expect(tokens[0].type).toBe(TokenType.HASH);
    expect(tokens[1].type).toBe(TokenType.IDENT);
    expect(tokens[1].value).toBe("121212");
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — complex token sequences", () => {
  it("tokenizes #id::tag sequence", () => {
    expect(types("#hero-section::section")).toEqual([
      TokenType.HASH,
      TokenType.IDENT,
      TokenType.DOUBLE_COLON,
      TokenType.IDENT,
    ]);
  });

  it("tokenizes inline props with |>", () => {
    expect(types("[section |> background:#181818")).toEqual([
      TokenType.LBRACKET,
      TokenType.IDENT,      // section
      TokenType.PIPE_ARROW,
      TokenType.IDENT,      // background
      TokenType.COLON,
      TokenType.HASH,
      TokenType.IDENT,      // 181818
    ]);
  });

  it("tokenizes component definition [>>Card", () => {
    expect(types("[>>Card")).toEqual([
      TokenType.LBRACKET,
      TokenType.DOUBLE_RANGLE,
      TokenType.IDENT,       // Card
    ]);
  });

  it("tokenizes component call [>Card]", () => {
    expect(types("[>Card]")).toEqual([
      TokenType.LBRACKET,
      TokenType.RANGLE,
      TokenType.IDENT,       // Card
      TokenType.RBRACKET,
    ]);
  });

  it("tokenizes slot syntax (<bg:#ffffff>)", () => {
    expect(types("(<bg:#ffffff>)")).toEqual([
      TokenType.LPAREN,
      TokenType.LANGLE,
      TokenType.IDENT,       // bg
      TokenType.COLON,
      TokenType.HASH,
      TokenType.IDENT,       // ffffff
      TokenType.RANGLE,
      TokenType.RPAREN,
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — line/col tracking", () => {
  it("tracks line numbers across newlines", () => {
    const tokens = tokenize("[\nsection\n]");
    expect(tokens[0].line).toBe(1); // [
    expect(tokens[1].line).toBe(2); // section
    expect(tokens[2].line).toBe(3); // ]
  });

  it("tracks column numbers", () => {
    const tokens = tokenize("[section]");
    expect(tokens[0].col).toBe(1); // [
    expect(tokens[1].col).toBe(2); // section
    expect(tokens[2].col).toBe(9); // ]
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — unknown characters", () => {
  it("throws on unknown character", () => {
    expect(() => tokenize("~")).toThrow(LexUnexpectedCharError);
  });

  it("throws on `|` not followed by `>`", () => {
    expect(() => tokenize("|")).toThrow(LexUnexpectedCharError);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("Lexer — EOF token", () => {
  it("always ends with EOF", () => {
    const lexer = new Lexer("");
    const tokens = lexer.tokenize();
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.EOF);
  });

  it("EOF carries correct position", () => {
    const lexer = new Lexer("abc");
    const tokens = lexer.tokenize();
    const eof = tokens[tokens.length - 1];
    expect(eof.type).toBe(TokenType.EOF);
    expect(eof.line).toBe(1);
    expect(eof.col).toBe(4); // after "abc"
  });
});
