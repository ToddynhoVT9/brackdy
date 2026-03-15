// ─── Brackdy Compiler — Token Types ──────────────────────────────────
// See: brackdy-compiler-plan/01-lexer.md

/**
 * Every possible token type emitted by the Brackdy lexer.
 */
export enum TokenType {
  // ── Structural ──────────────────────────────────────────────────
  LBRACKET,       // [
  RBRACKET,       // ]
  LPAREN,         // (
  RPAREN,         // )
  LANGLE,         // <   (slot open)
  RANGLE,         // >   (slot close / component call prefix)
  DOUBLE_RANGLE,  // >>  (component definition prefix)

  // ── Operators ───────────────────────────────────────────────────
  DOUBLE_COLON,   // ::
  PIPE_ARROW,     // |>
  HASH,           // #
  AT,             // @
  DOLLAR,         // $
  DOT,            // .
  COLON,          // :
  COMMA,          // ,

  // ── Literals ────────────────────────────────────────────────────
  STRING,         // "..." — value contains content WITHOUT quotes
  IDENT,          // identifiers: tag names, ids, prop names, CSS values, etc.

  // ── Keywords ────────────────────────────────────────────────────
  KW_LOGIC,       // @logic (the full keyword including @)

  // ── Special ─────────────────────────────────────────────────────
  EOF,            // end of input
}

/**
 * A single token produced by the lexer.
 *
 * - `type`  — the token category
 * - `value` — the literal text (empty string for structural tokens)
 * - `line`  — 1-indexed line number in source
 * - `col`   — 1-indexed column number in source
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}
