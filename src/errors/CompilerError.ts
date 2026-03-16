export class CompilerError extends Error {
  constructor(
    public phase: "Lex" | "Parse" | "Semantic" | "Codegen",
    public message: string,
    public line: number,
    public col: number,
    public source?: string
  ) {
    super(`[${phase}] Linha ${line}:${col} — ${message}`);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class LexerError extends CompilerError {
  constructor(message: string, line: number, col: number, source?: string) {
    super("Lex", message, line, col, source);
  }
}

export class ParseError extends CompilerError {
  constructor(message: string, line: number, col: number, source?: string) {
    super("Parse", message, line, col, source);
  }
}

export class SemanticError extends CompilerError {
  constructor(message: string, line: number, col: number, source?: string) {
    super("Semantic", message, line, col, source);
  }
}
