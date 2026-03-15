// ─── Brackdy Compiler — Error Classes ────────────────────────────────
// See: brackdy-compiler-plan/07-errors.md

export type Phase = "Lex" | "Parse" | "Semantic" | "Codegen";

/**
 * Base error class for all Brackdy compiler errors.
 * Every error carries the compiler phase, a human-readable message,
 * and the source position (line + column) where the error was detected.
 */
export class BrackdyError extends Error {
  constructor(
    public readonly phase: Phase,
    public override readonly message: string,
    public readonly line: number,
    public readonly col: number,
    public readonly source?: string, // original source line for context
  ) {
    super(`[${phase}] Line ${line}:${col} — ${message}`);
    this.name = "BrackdyError";
  }
}

// ─── Lexer Errors ────────────────────────────────────────────────────

export class LexUnterminatedStringError extends BrackdyError {
  constructor(line: number, col: number, source?: string) {
    super("Lex", "Unterminated string literal", line, col, source);
    this.name = "LexUnterminatedStringError";
  }
}

export class LexUnexpectedCharError extends BrackdyError {
  constructor(char: string, line: number, col: number, source?: string) {
    super("Lex", `Unexpected character: '${char}'`, line, col, source);
    this.name = "LexUnexpectedCharError";
  }
}

// ─── Parser Errors ───────────────────────────────────────────────────

export class ParseExpectedTokenError extends BrackdyError {
  constructor(
    expected: string,
    actualType: string,
    actualValue: string,
    line: number,
    col: number,
    source?: string,
  ) {
    super(
      "Parse",
      `Expected ${expected}, got ${actualType} ("${actualValue}")`,
      line, col, source,
    );
    this.name = "ParseExpectedTokenError";
  }
}

export class ParseUnknownTagError extends BrackdyError {
  constructor(name: string, line: number, col: number, source?: string) {
    super(
      "Parse",
      `Unknown tag: "${name}". Allowed: main, section, article, nav, aside, header, footer, div, h1, h2, h3, p, button, a`,
      line, col, source,
    );
    this.name = "ParseUnknownTagError";
  }
}

export class ParseInvalidIdError extends BrackdyError {
  constructor(line: number, col: number, source?: string) {
    super(
      "Parse",
      "Invalid id: ids may contain letters, digits, - and _",
      line, col, source,
    );
    this.name = "ParseInvalidIdError";
  }
}

export class ParseIdWithoutTagError extends BrackdyError {
  constructor(id: string, line: number, col: number, source?: string) {
    super(
      "Parse",
      `Id declaration "#${id}" must be followed by "::" and a tag name`,
      line, col, source,
    );
    this.name = "ParseIdWithoutTagError";
  }
}

export class ParseTextAndChildrenError extends BrackdyError {
  constructor(tag: string, line: number, col: number, source?: string) {
    super(
      "Parse",
      `Node "${tag}" cannot have both inline text and children`,
      line, col, source,
    );
    this.name = "ParseTextAndChildrenError";
  }
}

export class ParseComponentLowercaseError extends BrackdyError {
  constructor(name: string, line: number, col: number, source?: string) {
    super(
      "Parse",
      `Component names must start with an uppercase letter: "${name}"`,
      line, col, source,
    );
    this.name = "ParseComponentLowercaseError";
  }
}

export class ParseNestedDefError extends BrackdyError {
  constructor(line: number, col: number, source?: string) {
    super(
      "Parse",
      "Component definitions cannot be nested. Use [>>Name] only at the top level",
      line, col, source,
    );
    this.name = "ParseNestedDefError";
  }
}

export class ParseUnexpectedEofError extends BrackdyError {
  constructor(context: string, line: number, col: number, source?: string) {
    super(
      "Parse",
      `Unexpected end of file while parsing ${context}`,
      line, col, source,
    );
    this.name = "ParseUnexpectedEofError";
  }
}

// ─── Semantic Errors ─────────────────────────────────────────────────

export class SemDuplicateComponentError extends BrackdyError {
  constructor(name: string, line: number, col: number, source?: string) {
    super(
      "Semantic",
      `Duplicate component definition: "${name}"`,
      line, col, source,
    );
    this.name = "SemDuplicateComponentError";
  }
}

export class SemUnknownComponentError extends BrackdyError {
  constructor(name: string, line: number, col: number, source?: string) {
    super(
      "Semantic",
      `Unknown component: "${name}". No definition found`,
      line, col, source,
    );
    this.name = "SemUnknownComponentError";
  }
}

export class SemUnknownSlotError extends BrackdyError {
  constructor(slotName: string, componentName: string, line: number, col: number, source?: string) {
    super(
      "Semantic",
      `Unknown slot "${slotName}" in component "${componentName}"`,
      line, col, source,
    );
    this.name = "SemUnknownSlotError";
  }
}

export class SemEventNoIdError extends BrackdyError {
  constructor(event: string, action: string, line: number, col: number, source?: string) {
    super(
      "Semantic",
      `Event @${event}:${action} on node without id — use explicit path @${event}:namespace.${action}`,
      line, col, source,
    );
    this.name = "SemEventNoIdError";
  }
}

export class SemEventNoLogicError extends BrackdyError {
  constructor(line: number, col: number, source?: string) {
    super(
      "Semantic",
      "Events found but no @logic file declared. Add @logic \"./path.ts\" at the top of the file",
      line, col, source,
    );
    this.name = "SemEventNoLogicError";
  }
}
