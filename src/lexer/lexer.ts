import { Token } from "./Token";
import { TokenType } from "./TokenType";
import { LexerError } from "../errors/CompilerError";

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const ch = this.peek();

      // String literal
      if (ch === '"') {
        this.tokens.push(this.readString());
        continue;
      }

      // @logic ou @
      if (ch === "@") {
        const startLine = this.line;
        const startCol = this.col;
        this.advance();
        // Verificar se é @logic
        if (this.matchWord("logic")) {
          this.tokens.push({ type: TokenType.KW_LOGIC, value: "@logic", line: startLine, col: startCol });
        } else {
          this.tokens.push({ type: TokenType.AT, value: "@", line: startLine, col: startCol });
        }
        continue;
      }

      // Operadores de dois caracteres (verificar antes dos de um caractere)
      if (ch === "|" && this.peek(1) === ">") {
        this.tokens.push({ type: TokenType.PIPE_ARROW, value: "|>", line: this.line, col: this.col });
        this.advance();
        this.advance();
        continue;
      }

      if (ch === ":" && this.peek(1) === ":") {
        this.tokens.push({ type: TokenType.DOUBLE_COLON, value: "::", line: this.line, col: this.col });
        this.advance();
        this.advance();
        continue;
      }

      if (ch === ">" && this.peek(1) === ">") {
        this.tokens.push({ type: TokenType.DOUBLE_RANGLE, value: ">>", line: this.line, col: this.col });
        this.advance();
        this.advance();
        continue;
      }

      // Tokens de um caractere
      switch (ch) {
        case "[":
          this.tokens.push({ type: TokenType.LBRACKET, value: "[", line: this.line, col: this.col });
          this.advance();
          continue;
        case "]":
          this.tokens.push({ type: TokenType.RBRACKET, value: "]", line: this.line, col: this.col });
          this.advance();
          continue;
        case "(":
          this.tokens.push({ type: TokenType.LPAREN, value: "(", line: this.line, col: this.col });
          this.advance();
          continue;
        case ")":
          this.tokens.push({ type: TokenType.RPAREN, value: ")", line: this.line, col: this.col });
          this.advance();
          continue;
        case "<":
          this.tokens.push({ type: TokenType.LANGLE, value: "<", line: this.line, col: this.col });
          this.advance();
          continue;
        case ">":
          this.tokens.push({ type: TokenType.RANGLE, value: ">", line: this.line, col: this.col });
          this.advance();
          continue;
        case "#":
          this.tokens.push({ type: TokenType.HASH, value: "#", line: this.line, col: this.col });
          this.advance();
          continue;
        case "$":
          this.tokens.push({ type: TokenType.DOLLAR, value: "$", line: this.line, col: this.col });
          this.advance();
          continue;
        case ".":
          this.tokens.push({ type: TokenType.DOT, value: ".", line: this.line, col: this.col });
          this.advance();
          continue;
        case ":":
          this.tokens.push({ type: TokenType.COLON, value: ":", line: this.line, col: this.col });
          this.advance();
          continue;
        case ",":
          this.tokens.push({ type: TokenType.COMMA, value: ",", line: this.line, col: this.col });
          this.advance();
          continue;
      }

      // Identificadores
      if (this.isIdentStart(ch)) {
        this.tokens.push(this.readIdent());
        continue;
      }

      // Caractere desconhecido
      this.error(`Caractere inesperado: '${ch}'`);
    }

    this.tokens.push({ type: TokenType.EOF, value: "", line: this.line, col: this.col });
    return this.tokens;
  }

  // --- Métodos auxiliares ---

  private advance(): string {
    const ch = this.source[this.pos];
    this.pos++;
    if (ch === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private peek(offset: number = 0): string {
    const idx = this.pos + offset;
    if (idx >= this.source.length) return "\0";
    return this.source[idx];
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
      } else {
        break;
      }
    }
  }

  private readString(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // consumir abertura "

    let value = "";
    while (!this.isAtEnd() && this.peek() !== '"') {
      value += this.advance();
    }

    if (this.isAtEnd()) {
      this.error("String literal não terminada");
    }

    this.advance(); // consumir fechamento "
    return { type: TokenType.STRING, value, line: startLine, col: startCol };
  }

  private readIdent(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = "";

    while (!this.isAtEnd() && this.isIdentChar(this.peek())) {
      value += this.advance();
    }

    return { type: TokenType.IDENT, value, line: startLine, col: startCol };
  }

  private matchWord(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
      if (this.peek(i) !== word[i]) return false;
    }
    // Verificar que o char seguinte não é parte de um ident
    const after = this.peek(word.length);
    if (this.isIdentChar(after)) return false;

    // Consumir os caracteres da palavra
    for (let i = 0; i < word.length; i++) {
      this.advance();
    }
    return true;
  }

  private isIdentStart(ch: string): boolean {
    return /[a-zA-Z_0-9]/.test(ch);
  }

  private isIdentChar(ch: string): boolean {
    return /[a-zA-Z0-9\-_]/.test(ch);
  }

  private error(msg: string): never {
    throw new LexerError(msg, this.line, this.col);
  }
}
