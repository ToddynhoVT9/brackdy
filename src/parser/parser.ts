// ─── Brackdy Compiler — Parser ───────────────────────────────────────
// See: brackdy-compiler-plan/03-parser.md
// See: brackdy-prompts/prompt-lexer-parser.md
//
// Hand-written recursive-descent parser.
// Consumes a Token[] (from the Lexer) and emits a Program AST node.

import { TokenType, type Token } from "../lexer/tokens.js";
import type {
  Program,
  PropBlock,
  Prop,
  VisualProp,
  ResponsiveProp,
  EventProp,
  AttrProp,
  NodeDecl,
  ChildNode,
  ComponentDef,
  ComponentCall,
  SlotPropDef,
  SlotNodeDef,
  ComponentBodyNode,
  SlotPropOverride,
  SlotNodeOverride,
} from "./ast.js";
import {
  BrackdyError,
  ParseExpectedTokenError,
  ParseUnknownTagError,
  ParseIdWithoutTagError,
  ParseTextAndChildrenError,
  ParseComponentLowercaseError,
  ParseNestedDefError,
  ParseUnexpectedEofError,
} from "../errors/errors.js";

// ─── Allowed tags ────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  "main", "section", "article", "nav", "aside", "header", "footer", "div",
  "h1", "h2", "h3", "p",
  "button", "a",
]);

// ─── Valid breakpoints ───────────────────────────────────────────────

const BREAKPOINTS = new Set(["sm", "md", "lg", "xl"]);

// ─── Parser class ────────────────────────────────────────────────────

export class Parser {
  private pos = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  // ── Public API ───────────────────────────────────────────────────

  parse(): Program {
    return this.parseProgram();
  }

  // ── Cursor helpers ───────────────────────────────────────────────

  /** Returns the current token without advancing. */
  private current(): Token {
    if (this.pos >= this.tokens.length) {
      // safety — should not happen because we always have an EOF token
      return { type: TokenType.EOF, value: "", line: 0, col: 0 };
    }
    return this.tokens[this.pos];
  }

  /** Peeks at a token ahead of the cursor without advancing. */
  private peek(offset: number = 1): Token {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) {
      return { type: TokenType.EOF, value: "", line: 0, col: 0 };
    }
    return this.tokens[idx];
  }

  /** Consumes and returns the current token, advancing the cursor. */
  private advance(): Token {
    const tok = this.current();
    this.pos++;
    return tok;
  }

  /** Returns true if the current token matches the given type. */
  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  /** Returns true if the current token has the given type AND value. */
  private checkValue(type: TokenType, value: string): boolean {
    const tok = this.current();
    return tok.type === type && tok.value === value;
  }

  /**
   * Expects the current token to be of the given type.
   * If it matches, advances and returns it.
   * Otherwise, throws `ParseExpectedTokenError`.
   */
  private expect(type: TokenType, hint?: string): Token {
    const tok = this.current();
    if (tok.type !== type) {
      const expected = hint ?? TokenType[type];
      throw new ParseExpectedTokenError(
        expected,
        TokenType[tok.type],
        tok.value,
        tok.line,
        tok.col,
      );
    }
    return this.advance();
  }

  /** True when the current token is EOF. */
  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  /** Throws a Parse-phase BrackdyError. */
  private error(msg: string, token?: Token): never {
    const t = token ?? this.current();
    throw new BrackdyError("Parse", msg, t.line, t.col);
  }

  // ── Top-level parse ──────────────────────────────────────────────

  /**
   * Program := LogicDecl? (ComponentDef | ComponentCall | PropBlock | NodeDecl)*
   */
  private parseProgram(): Program {
    const startTok = this.current();
    let logicFile: string | null = null;
    const definitions: ComponentDef[] = [];
    const body: (PropBlock | NodeDecl | ComponentCall | ComponentDef)[] = [];

    // Optional @logic declaration
    if (this.check(TokenType.KW_LOGIC)) {
      logicFile = this.parseLogicDecl();
    }

    // Loop until EOF
    while (!this.isAtEnd()) {
      if (this.check(TokenType.LBRACKET)) {
        const next = this.peek(1);

        if (next.type === TokenType.DOUBLE_RANGLE) {
          // [>>Name ...] → component definition
          const def = this.parseComponentDef();
          definitions.push(def);
          body.push(def);
        } else if (next.type === TokenType.RANGLE) {
          // [>Name ...] → component call
          body.push(this.parseComponentCall());
        } else {
          // [tag ...] → node declaration
          body.push(this.parseNodeDecl());
        }
      } else if (this.check(TokenType.LPAREN)) {
        body.push(this.parsePropBlock());
      } else {
        this.error(
          `Unexpected token ${TokenType[this.current().type]} ("${this.current().value}")`,
        );
      }
    }

    return {
      kind: "Program",
      logicFile,
      definitions,
      body,
      line: startTok.line,
      col: startTok.col,
    };
  }

  // ── Logic declaration ────────────────────────────────────────────

  /**
   * LogicDecl := KW_LOGIC STRING
   */
  private parseLogicDecl(): string {
    this.expect(TokenType.KW_LOGIC);
    const str = this.expect(TokenType.STRING, "STRING (logic file path)");
    return str.value;
  }

  // ── Prop blocks ──────────────────────────────────────────────────

  /**
   * PropBlock := LPAREN Prop* RPAREN
   */
  private parsePropBlock(): PropBlock {
    const openTok = this.expect(TokenType.LPAREN);
    const props: Prop[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      props.push(this.parseOneProp());
    }

    this.expect(TokenType.RPAREN, "RPAREN ')'");

    return {
      kind: "PropBlock",
      props,
      line: openTok.line,
      col: openTok.col,
    };
  }

  /**
   * Prop := EventProp | AttrProp | ResponsiveProp | VisualProp
   */
  private parseOneProp(): Prop {
    // @event:action
    if (this.check(TokenType.AT)) {
      return this.parseEventProp();
    }

    // $attr:value
    if (this.check(TokenType.DOLLAR)) {
      return this.parseAttrProp();
    }

    // Check for responsive prop: IDENT DOT IDENT COLON
    if (this.check(TokenType.IDENT)) {
      const maybeBreakpoint = this.current().value;
      if (
        BREAKPOINTS.has(maybeBreakpoint) &&
        this.peek(1).type === TokenType.DOT &&
        this.peek(2).type === TokenType.IDENT
      ) {
        return this.parseResponsiveProp();
      }

      // Regular visual prop: IDENT COLON value
      return this.parseVisualProp();
    }

    // Slot prop definitions inside component ( <slot>key:value )
    // This is handled by parseSlotPropDefBlock, should not reach here
    this.error(`Unexpected token in property block: ${TokenType[this.current().type]} ("${this.current().value}")`);
  }

  /**
   * VisualProp := IDENT COLON ValueTokens
   */
  private parseVisualProp(): VisualProp {
    const keyTok = this.expect(TokenType.IDENT, "property name");
    this.expect(TokenType.COLON);
    const value = this.parseValue();

    return {
      kind: "VisualProp",
      key: keyTok.value,
      value,
      line: keyTok.line,
      col: keyTok.col,
    };
  }

  /**
   * ResponsiveProp := IDENT DOT IDENT COLON ValueTokens
   */
  private parseResponsiveProp(): ResponsiveProp {
    const bpTok = this.expect(TokenType.IDENT, "breakpoint");
    this.expect(TokenType.DOT);
    const keyTok = this.expect(TokenType.IDENT, "CSS property name");
    this.expect(TokenType.COLON);
    const value = this.parseValue();

    return {
      kind: "ResponsiveProp",
      breakpoint: bpTok.value as "sm" | "md" | "lg" | "xl",
      key: keyTok.value,
      value,
      line: bpTok.line,
      col: bpTok.col,
    };
  }

  /**
   * EventProp := AT IDENT COLON IDENT (DOT IDENT)?
   */
  private parseEventProp(): EventProp {
    const atTok = this.advance(); // consume @
    const eventTok = this.expect(TokenType.IDENT, "event name");
    this.expect(TokenType.COLON);
    const firstIdent = this.expect(TokenType.IDENT, "action or namespace");

    let namespace: string | null = null;
    let action: string;

    if (this.check(TokenType.DOT)) {
      // @event:namespace.action
      this.advance(); // consume DOT
      const actionTok = this.expect(TokenType.IDENT, "action name");
      namespace = firstIdent.value;
      action = actionTok.value;
    } else {
      // @event:action
      namespace = null;
      action = firstIdent.value;
    }

    return {
      kind: "EventProp",
      event: eventTok.value,
      action,
      namespace,
      line: atTok.line,
      col: atTok.col,
    };
  }

  /**
   * AttrProp := DOLLAR IDENT COLON (STRING | ValueTokens)
   */
  private parseAttrProp(): AttrProp {
    const dollarTok = this.advance(); // consume $
    const nameTok = this.expect(TokenType.IDENT, "attribute name");
    this.expect(TokenType.COLON);

    let value: string;
    if (this.check(TokenType.STRING)) {
      value = this.advance().value;
    } else {
      value = this.parseValue();
    }

    return {
      kind: "AttrProp",
      name: nameTok.value,
      value,
      line: dollarTok.line,
      col: dollarTok.col,
    };
  }

  // ── Value parsing ────────────────────────────────────────────────

  /**
   * Reads a CSS / attribute value.
   *
   * Accumulates tokens into a string buffer.
   * Terminators: RPAREN, RBRACKET, COMMA, EOF,
   * or a new line with IDENT COLON (= new property starts).
   *
   * Handles:
   *  - IDENT → plain value token
   *  - HASH + IDENT → "#value" (hex colour)
   *  - STRING → quoted value
   */
  private parseValue(): string {
    const parts: string[] = [];

    while (!this.isAtEnd()) {
      const tok = this.current();

      // Terminators
      if (
        tok.type === TokenType.RPAREN ||
        tok.type === TokenType.RBRACKET ||
        tok.type === TokenType.COMMA ||
        tok.type === TokenType.RANGLE
      ) {
        break;
      }

      // IDENT followed by COLON means a new property is starting → stop
      // This handles both same-line and multi-line props.
      if (tok.type === TokenType.IDENT && this.peek(1).type === TokenType.COLON) {
        // Only stop if we already have at least one part (the value for the current prop).
        // If parts is empty, this IS the value (e.g. single-word value like "flex").
        // Wait — actually if parts is empty we haven't consumed ANY value yet,
        // and `IDENT COLON` here means *this token* is the start of a new property,
        // not our value. This is actually correct: we should stop and the single-word
        // value case is handled before reaching here. But if we get here with no parts,
        // we should NOT consume it — it means value was empty (shouldn't happen in practice).
        if (parts.length > 0) {
          break;
        }
        // If parts is empty, this ident IS our value (unusual but possible).
        // Fall through so it gets consumed as a value token.
        // But actually IDENT COLON in value position with empty parts means
        // the value is empty — we shouldn't consume the next property key.
        // Let's just break — the caller already consumed colon before calling us.
        break;
      }

      // Responsive prop starting: IDENT(bp) DOT → stop
      if (
        tok.type === TokenType.IDENT &&
        BREAKPOINTS.has(tok.value) &&
        this.peek(1).type === TokenType.DOT &&
        this.peek(2).type === TokenType.IDENT
      ) {
        break;
      }

      // @event or $attr starting → stop
      if (tok.type === TokenType.AT || tok.type === TokenType.DOLLAR) {
        break;
      }

      // HASH + IDENT → "#value"
      if (tok.type === TokenType.HASH) {
        this.advance(); // consume HASH
        const identTok = this.expect(TokenType.IDENT, "hex color value");
        parts.push("#" + identTok.value);
        continue;
      }

      // IDENT → plain value
      if (tok.type === TokenType.IDENT) {
        parts.push(this.advance().value);
        continue;
      }

      // STRING → quoted value (for $attr values, etc.)
      if (tok.type === TokenType.STRING) {
        parts.push(this.advance().value);
        continue;
      }

      // DOT inside a value
      if (tok.type === TokenType.DOT) {
        this.advance();
        if (this.check(TokenType.IDENT)) {
          const prev = parts.length > 0 ? parts.pop()! : "";
          parts.push(prev + "." + this.advance().value);
        } else {
          parts.push(".");
        }
        continue;
      }

      // Anything else → stop
      break;
    }

    return parts.join(" ");
  }

  // ── Node declaration ─────────────────────────────────────────────

  /**
   * NodeDecl := LBRACKET NodeHead NodeBody RBRACKET
   */
  private parseNodeDecl(): NodeDecl {
    const bracketTok = this.expect(TokenType.LBRACKET);

    // ── Head ───────────────────────────────────────────────────────

    let id: string | null = null;
    let tag: string;

    if (this.check(TokenType.HASH)) {
      // #id::tag
      this.advance(); // consume HASH
      const idTok = this.expect(TokenType.IDENT, "node id");
      id = idTok.value;

      // Must be followed by ::
      if (!this.check(TokenType.DOUBLE_COLON)) {
        throw new ParseIdWithoutTagError(id, idTok.line, idTok.col);
      }
      this.advance(); // consume ::

      const tagTok = this.expect(TokenType.IDENT, "tag name");
      tag = tagTok.value;
    } else {
      const tagTok = this.expect(TokenType.IDENT, "tag name");
      tag = tagTok.value;
    }

    // Validate tag
    if (!ALLOWED_TAGS.has(tag)) {
      throw new ParseUnknownTagError(tag, bracketTok.line, bracketTok.col);
    }

    // ── Inline props |> ────────────────────────────────────────────

    let inlineProps: Prop[] | null = null;

    if (this.check(TokenType.PIPE_ARROW)) {
      this.advance(); // consume |>
      inlineProps = [];

      // Read props until we reach RBRACKET, STRING, LBRACKET, LPAREN, or new-line
      while (
        !this.isAtEnd() &&
        !this.check(TokenType.RBRACKET) &&
        !this.check(TokenType.STRING) &&
        !this.check(TokenType.LBRACKET) &&
        !this.check(TokenType.LPAREN)
      ) {
        // If we've moved to a new line and see something that doesn't look like a prop, stop
        inlineProps.push(this.parseOneProp());
      }
    }

    // ── Body: text or children ─────────────────────────────────────

    let text: string | null = null;
    const children: ChildNode[] = [];

    if (this.check(TokenType.STRING)) {
      text = this.advance().value;
    } else {
      // Parse children until RBRACKET
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        if (this.check(TokenType.LPAREN)) {
          children.push(this.parsePropBlock());
        } else if (this.check(TokenType.LBRACKET)) {
          const next = this.peek(1);
          if (next.type === TokenType.DOUBLE_RANGLE) {
            throw new ParseNestedDefError(this.current().line, this.current().col);
          } else if (next.type === TokenType.RANGLE) {
            children.push(this.parseComponentCall());
          } else {
            children.push(this.parseNodeDecl());
          }
        } else {
          this.error(
            `Unexpected token inside node body: ${TokenType[this.current().type]} ("${this.current().value}")`,
          );
        }
      }
    }

    this.expect(TokenType.RBRACKET, "RBRACKET ']'");

    // Validate: cannot have both text and children
    if (text !== null && children.length > 0) {
      throw new ParseTextAndChildrenError(tag, bracketTok.line, bracketTok.col);
    }

    return {
      kind: "NodeDecl",
      id,
      tag,
      text,
      inlineProps,
      children,
      line: bracketTok.line,
      col: bracketTok.col,
    };
  }

  // ── Component definition ─────────────────────────────────────────

  /**
   * ComponentDef := LBRACKET DOUBLE_RANGLE IDENT PropSlotDefBlock? NodeDefBody RBRACKET
   */
  private parseComponentDef(): ComponentDef {
    const bracketTok = this.expect(TokenType.LBRACKET);
    this.expect(TokenType.DOUBLE_RANGLE);

    const nameTok = this.expect(TokenType.IDENT, "component name");
    const name = nameTok.value;

    // Component names must start uppercase
    if (name[0] !== name[0].toUpperCase() || !/^[A-Z]/.test(name)) {
      throw new ParseComponentLowercaseError(name, nameTok.line, nameTok.col);
    }

    // ── Optional prop slot definitions ─────────────────────────────

    let propSlots: SlotPropDef[] = [];

    if (this.check(TokenType.LPAREN)) {
      propSlots = this.parseSlotPropDefBlock();
    }

    // ── Body: structural nodes (may contain SlotNodeDefs) ──────────

    const body: ComponentBodyNode[] = [];

    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      if (this.check(TokenType.LBRACKET)) {
        const next = this.peek(1);

        if (next.type === TokenType.DOUBLE_RANGLE) {
          throw new ParseNestedDefError(this.current().line, this.current().col);
        }

        // Check for SlotNodeDef: [<slotName>tag "text"]
        if (next.type === TokenType.LANGLE) {
          body.push(this.parseSlotNodeDef());
        } else {
          body.push(this.parseComponentBodyNode());
        }
      } else {
        this.error(
          `Unexpected token in component body: ${TokenType[this.current().type]} ("${this.current().value}")`,
        );
      }
    }

    this.expect(TokenType.RBRACKET, "RBRACKET ']'");

    return {
      kind: "ComponentDef",
      name,
      propSlots,
      body,
      line: bracketTok.line,
      col: bracketTok.col,
    };
  }

  /**
   * Parses a `NodeDecl` inside a `ComponentDef`'s body.
   * Children can be either regular `NodeDecl` or `SlotNodeDef`.
   */
  private parseComponentBodyNode(): NodeDecl {
    const bracketTok = this.expect(TokenType.LBRACKET);

    let id: string | null = null;
    let tag: string;

    if (this.check(TokenType.HASH)) {
      this.advance();
      const idTok = this.expect(TokenType.IDENT, "node id");
      id = idTok.value;
      if (!this.check(TokenType.DOUBLE_COLON)) {
        throw new ParseIdWithoutTagError(id, idTok.line, idTok.col);
      }
      this.advance();
      tag = this.expect(TokenType.IDENT, "tag name").value;
    } else {
      tag = this.expect(TokenType.IDENT, "tag name").value;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      throw new ParseUnknownTagError(tag, bracketTok.line, bracketTok.col);
    }

    // Inline props
    let inlineProps: Prop[] | null = null;
    if (this.check(TokenType.PIPE_ARROW)) {
      this.advance();
      inlineProps = [];
      while (
        !this.isAtEnd() &&
        !this.check(TokenType.RBRACKET) &&
        !this.check(TokenType.STRING) &&
        !this.check(TokenType.LBRACKET) &&
        !this.check(TokenType.LPAREN)
      ) {
        inlineProps.push(this.parseOneProp());
      }
    }

    let text: string | null = null;
    const children: ChildNode[] = [];

    if (this.check(TokenType.STRING)) {
      text = this.advance().value;
    } else {
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        if (this.check(TokenType.LPAREN)) {
          children.push(this.parsePropBlock());
        } else if (this.check(TokenType.LBRACKET)) {
          const next = this.peek(1);
          if (next.type === TokenType.DOUBLE_RANGLE) {
            throw new ParseNestedDefError(this.current().line, this.current().col);
          }
          // Check for SlotNodeDef: [<slotName>tag "text"]
          if (next.type === TokenType.LANGLE) {
            children.push(this.parseSlotNodeDef() as unknown as ChildNode);
          } else if (next.type === TokenType.RANGLE) {
            children.push(this.parseComponentCall());
          } else {
            children.push(this.parseComponentBodyNode());
          }
        } else {
          this.error(
            `Unexpected token in component body node: ${TokenType[this.current().type]}`,
          );
        }
      }
    }

    this.expect(TokenType.RBRACKET, "RBRACKET ']'");

    return {
      kind: "NodeDecl",
      id,
      tag,
      text,
      inlineProps,
      children,
      line: bracketTok.line,
      col: bracketTok.col,
    };
  }

  /**
   * PropSlotDefBlock := LPAREN SlotPropDefEntry+ RPAREN
   * SlotPropDefEntry := LANGLE IDENT RANGLE IDENT COLON Value
   */
  private parseSlotPropDefBlock(): SlotPropDef[] {
    this.expect(TokenType.LPAREN);
    const slots: SlotPropDef[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      const angleTok = this.expect(TokenType.LANGLE, "'<' for slot definition");
      const slotNameTok = this.expect(TokenType.IDENT, "slot name");
      this.expect(TokenType.RANGLE, "'>' closing slot name");
      const cssKeyTok = this.expect(TokenType.IDENT, "CSS property name");
      this.expect(TokenType.COLON);
      const defaultValue = this.parseValue();

      slots.push({
        kind: "SlotPropDef",
        slotName: slotNameTok.value,
        cssKey: cssKeyTok.value,
        defaultValue,
        line: angleTok.line,
        col: angleTok.col,
      });
    }

    this.expect(TokenType.RPAREN, "RPAREN ')'");
    return slots;
  }

  /**
   * SlotNodeDef := LBRACKET LANGLE IDENT RANGLE IDENT STRING? RBRACKET
   * i.e. [<slotName>tag "defaultText"]
   */
  private parseSlotNodeDef(): SlotNodeDef {
    const bracketTok = this.expect(TokenType.LBRACKET);
    this.expect(TokenType.LANGLE);
    const slotNameTok = this.expect(TokenType.IDENT, "slot name");
    this.expect(TokenType.RANGLE);
    const tagTok = this.expect(TokenType.IDENT, "tag name");

    let defaultText = "";
    if (this.check(TokenType.STRING)) {
      defaultText = this.advance().value;
    }

    this.expect(TokenType.RBRACKET, "RBRACKET ']'");

    return {
      kind: "SlotNodeDef",
      slotName: slotNameTok.value,
      tag: tagTok.value,
      defaultText,
      line: bracketTok.line,
      col: bracketTok.col,
    };
  }

  // ── Component call ───────────────────────────────────────────────

  /**
   * ComponentCall := LBRACKET RANGLE IDENT
   *                  (HASH IDENT)?
   *                  PropSlotCall?
   *                  NodeSlotCall?
   *                  ExtraChild*
   *                  RBRACKET
   */
  private parseComponentCall(): ComponentCall {
    const bracketTok = this.expect(TokenType.LBRACKET);
    this.expect(TokenType.RANGLE);

    const nameTok = this.expect(TokenType.IDENT, "component name");
    const name = nameTok.value;

    // Component names must start uppercase
    if (!/^[A-Z]/.test(name)) {
      throw new ParseComponentLowercaseError(name, nameTok.line, nameTok.col);
    }

    // Optional #id
    let id: string | null = null;
    if (this.check(TokenType.HASH)) {
      this.advance(); // consume HASH
      const idTok = this.expect(TokenType.IDENT, "component call id");
      id = idTok.value;
    }

    // Optional PropSlotCall: (<slot:val, ...>)
    let propOverrides: SlotPropOverride[] = [];
    if (
      this.check(TokenType.LPAREN) &&
      this.peek(1).type === TokenType.LANGLE
    ) {
      propOverrides = this.parsePropSlotCall();
    }

    // Optional NodeSlotCall: [<slot "val", ...>]
    let slotOverrides: SlotNodeOverride[] = [];
    if (
      this.check(TokenType.LBRACKET) &&
      this.peek(1).type === TokenType.LANGLE
    ) {
      slotOverrides = this.parseNodeSlotCall();
    }

    // ExtraChild* — plain nodes, prop blocks, or nested component calls
    const extraChildren: ChildNode[] = [];
    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      if (this.check(TokenType.LPAREN)) {
        extraChildren.push(this.parsePropBlock());
      } else if (this.check(TokenType.LBRACKET)) {
        const next = this.peek(1);
        if (next.type === TokenType.DOUBLE_RANGLE) {
          throw new ParseNestedDefError(this.current().line, this.current().col);
        }
        if (next.type === TokenType.RANGLE) {
          extraChildren.push(this.parseComponentCall());
        } else {
          extraChildren.push(this.parseNodeDecl());
        }
      } else {
        this.error(
          `Unexpected token in component call body: ${TokenType[this.current().type]} ("${this.current().value}")`,
        );
      }
    }

    this.expect(TokenType.RBRACKET, "RBRACKET ']'");

    return {
      kind: "ComponentCall",
      name,
      id,
      propOverrides,
      slotOverrides,
      extraChildren,
      line: bracketTok.line,
      col: bracketTok.col,
    };
  }

  /**
   * PropSlotCall := LPAREN LANGLE SlotPropPair (COMMA SlotPropPair)* RANGLE RPAREN
   * SlotPropPair := IDENT COLON Value
   */
  private parsePropSlotCall(): SlotPropOverride[] {
    this.expect(TokenType.LPAREN);
    this.expect(TokenType.LANGLE);

    const overrides: SlotPropOverride[] = [];

    // First pair
    overrides.push(this.parseOneSlotPropOverride());

    // Subsequent pairs separated by COMMA
    while (this.check(TokenType.COMMA)) {
      this.advance(); // consume COMMA
      overrides.push(this.parseOneSlotPropOverride());
    }

    this.expect(TokenType.RANGLE, "'>' closing slot overrides");
    this.expect(TokenType.RPAREN, "RPAREN ')'");

    return overrides;
  }

  private parseOneSlotPropOverride(): SlotPropOverride {
    const nameTok = this.expect(TokenType.IDENT, "slot name");
    this.expect(TokenType.COLON);
    const value = this.parseValue();

    return {
      kind: "SlotPropOverride",
      slotName: nameTok.value,
      value,
      line: nameTok.line,
      col: nameTok.col,
    };
  }

  /**
   * NodeSlotCall := LBRACKET LANGLE SlotNodePair (COMMA SlotNodePair)* RANGLE RBRACKET
   * SlotNodePair := IDENT STRING
   */
  private parseNodeSlotCall(): SlotNodeOverride[] {
    this.expect(TokenType.LBRACKET);
    this.expect(TokenType.LANGLE);

    const overrides: SlotNodeOverride[] = [];

    // First pair
    overrides.push(this.parseOneSlotNodeOverride());

    // Subsequent pairs separated by COMMA
    while (this.check(TokenType.COMMA)) {
      this.advance(); // consume COMMA
      overrides.push(this.parseOneSlotNodeOverride());
    }

    this.expect(TokenType.RANGLE, "'>' closing slot overrides");
    this.expect(TokenType.RBRACKET, "RBRACKET ']'");

    return overrides;
  }

  private parseOneSlotNodeOverride(): SlotNodeOverride {
    const nameTok = this.expect(TokenType.IDENT, "slot name");
    const textTok = this.expect(TokenType.STRING, "slot text override");

    return {
      kind: "SlotNodeOverride",
      slotName: nameTok.value,
      text: textTok.value,
      line: nameTok.line,
      col: nameTok.col,
    };
  }
}
