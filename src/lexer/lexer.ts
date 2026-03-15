// ─── Brackdy Compiler — Lexer ────────────────────────────────────────
// See: brackdy-compiler-plan/01-lexer.md

import { TokenType, type Token } from "./tokens.js";
import {
  LexUnterminatedStringError,
  LexUnexpectedCharError,
} from "../errors/errors.js";

/**
 * Transforms a raw source string into a flat array of `Token` objects.
 *
 * Rules (priority order):
 *  1. Skip whitespace / newlines (track line + col)
 *  2. Two-char operators: `::`, `|>`, `>>` — checked BEFORE single-char
 *  3. `@logic` keyword
 *  4. Single-char tokens
 *  5. Quoted strings
 *  6. Identifiers
 *  7. Unknown char → error
 */
export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  // ── Public API ─────────────────────────────────────────────────

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.source.length) {
      // 1. Skip whitespace
      if (this.isWhitespace(this.current())) {
        this.skipWhitespace();
        continue;
      }

      const ch = this.current();
      const startLine = this.line;
      const startCol = this.col;

      // 2. Two-char operators (must be checked before single-char)
      if (ch === ":" && this.peek() === ":") {
        tokens.push(this.makeToken(TokenType.DOUBLE_COLON, "::", startLine, startCol));
        this.advance();
        this.advance();
        continue;
      }

      if (ch === "|") {
        if (this.peek() === ">") {
          tokens.push(this.makeToken(TokenType.PIPE_ARROW, "|>", startLine, startCol));
          this.advance();
          this.advance();
          continue;
        }
        // Bare | without > is an unknown character
        throw new LexUnexpectedCharError(ch, startLine, startCol, this.getSourceLine(startLine));
      }

      if (ch === ">" && this.peek() === ">") {
        tokens.push(this.makeToken(TokenType.DOUBLE_RANGLE, ">>", startLine, startCol));
        this.advance();
        this.advance();
        continue;
      }

      // 3. @logic keyword
      if (ch === "@") {
        // Peek ahead to see if followed by "logic"
        if (this.matchAhead("logic")) {
          // Verify that the char after "logic" is NOT an ident char
          const afterLogic = this.pos + 6; // @ = 1 + logic = 5 → 6 chars total
          if (afterLogic >= this.source.length || !this.isIdentChar(this.source[afterLogic])) {
            tokens.push(this.makeToken(TokenType.KW_LOGIC, "@logic", startLine, startCol));
            // advance past "@logic"
            for (let i = 0; i < 6; i++) this.advance();
            continue;
          }
        }
        // Plain @
        tokens.push(this.makeToken(TokenType.AT, "@", startLine, startCol));
        this.advance();
        continue;
      }

      // 4. Single-char tokens
      switch (ch) {
        case "[":
          tokens.push(this.makeToken(TokenType.LBRACKET, "[", startLine, startCol));
          this.advance();
          continue;
        case "]":
          tokens.push(this.makeToken(TokenType.RBRACKET, "]", startLine, startCol));
          this.advance();
          continue;
        case "(":
          tokens.push(this.makeToken(TokenType.LPAREN, "(", startLine, startCol));
          this.advance();
          continue;
        case ")":
          tokens.push(this.makeToken(TokenType.RPAREN, ")", startLine, startCol));
          this.advance();
          continue;
        case "<":
          tokens.push(this.makeToken(TokenType.LANGLE, "<", startLine, startCol));
          this.advance();
          continue;
        case ">":
          // >> was already handled above; this is a single >
          tokens.push(this.makeToken(TokenType.RANGLE, ">", startLine, startCol));
          this.advance();
          continue;
        case "#":
          tokens.push(this.makeToken(TokenType.HASH, "#", startLine, startCol));
          this.advance();
          continue;
        case "$":
          tokens.push(this.makeToken(TokenType.DOLLAR, "$", startLine, startCol));
          this.advance();
          continue;
        case ".":
          tokens.push(this.makeToken(TokenType.DOT, ".", startLine, startCol));
          this.advance();
          continue;
        case ":":
          // :: was already handled above; this is a single :
          tokens.push(this.makeToken(TokenType.COLON, ":", startLine, startCol));
          this.advance();
          continue;
        case ",":
          tokens.push(this.makeToken(TokenType.COMMA, ",", startLine, startCol));
          this.advance();
          continue;
      }

      // 5. Quoted strings
      if (ch === '"') {
        tokens.push(this.readString());
        continue;
      }

      // 6. Identifiers
      if (this.isIdentStart(ch)) {
        tokens.push(this.readIdent());
        continue;
      }

      // 7. Unknown character
      throw new LexUnexpectedCharError(
        ch,
        startLine,
        startCol,
        this.getSourceLine(startLine),
      );
    }

    // EOF token
    tokens.push(this.makeToken(TokenType.EOF, "", this.line, this.col));
    return tokens;
  }

  // ── Private helpers ────────────────────────────────────────────

  /**
   * Returns the character at the current position, or "\0" if past end.
   */
  private current(): string {
    return this.pos < this.source.length ? this.source[this.pos] : "\0";
  }

  /**
   * Returns the character at offset positions ahead, or "\0" if past end.
   */
  private peek(offset: number = 1): string {
    const idx = this.pos + offset;
    return idx < this.source.length ? this.source[idx] : "\0";
  }

  /**
   * Advances the cursor by one character, updating line/col tracking.
   */
  private advance(): string {
    const ch = this.source[this.pos];
    if (ch === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    this.pos++;
    return ch;
  }

  /**
   * Skips all contiguous whitespace characters.
   */
  private skipWhitespace(): void {
    while (this.pos < this.source.length && this.isWhitespace(this.current())) {
      this.advance();
    }
  }

  /**
   * Reads a quoted string literal.
   * The opening `"` has already been identified but NOT consumed.
   * Consumes everything up to and including the closing `"`.
   * Returns a STRING token whose value is the text between quotes.
   */
  private readString(): Token {
    const startLine = this.line;
    const startCol = this.col;

    // consume opening "
    this.advance();

    let value = "";
    while (this.pos < this.source.length && this.current() !== '"') {
      value += this.current();
      this.advance();
    }

    if (this.pos >= this.source.length) {
      throw new LexUnterminatedStringError(
        startLine,
        startCol,
        this.getSourceLine(startLine),
      );
    }

    // consume closing "
    this.advance();

    return this.makeToken(TokenType.STRING, value, startLine, startCol);
  }

  /**
   * Reads an identifier token.
   * First char: letter or `_`.
   * Subsequent: letter, digit, `-`, `_`.
   */
  private readIdent(): Token {
    const startLine = this.line;
    const startCol = this.col;

    let value = "";
    value += this.current();
    this.advance();

    while (this.pos < this.source.length && this.isIdentChar(this.current())) {
      value += this.current();
      this.advance();
    }

    return this.makeToken(TokenType.IDENT, value, startLine, startCol);
  }

  /**
   * Check if the characters starting at pos+1 match the given word.
   * Used to detect `@logic`.
   */
  private matchAhead(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
      if (this.pos + 1 + i >= this.source.length) return false;
      if (this.source[this.pos + 1 + i] !== word[i]) return false;
    }
    return true;
  }

  // ── Character class helpers ────────────────────────────────────

  private isWhitespace(ch: string): boolean {
    return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
  }

  private isIdentStart(ch: string): boolean {
    // Digits are allowed as ident start because the lexer treats CSS values
    // like "24px", "1fr", "181818" (hex color digits) as identifiers.
    // The parser disambiguates by context.
    return /^[a-zA-Z0-9_]$/.test(ch);
  }

  private isIdentChar(ch: string): boolean {
    return /^[a-zA-Z0-9\-_]$/.test(ch);
  }

  // ── Token creation ─────────────────────────────────────────────

  private makeToken(type: TokenType, value: string, line: number, col: number): Token {
    return { type, value, line, col };
  }

  /**
   * Retrieves the full source line at the given 1-indexed line number.
   * Used for error context display.
   */
  private getSourceLine(lineNumber: number): string {
    const lines = this.source.split("\n");
    return lines[lineNumber - 1] ?? "";
  }
}
