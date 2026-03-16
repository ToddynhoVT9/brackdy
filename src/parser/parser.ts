import { Token } from "../lexer/Token";
import { TokenType } from "../lexer/TokenType";
import { ParseError } from "../errors/CompilerError";
import {
  Program, PropBlock, Prop, VisualProp, EventProp, AttrProp, ResponsiveProp,
  NodeDecl, ChildNode, ComponentDef, ComponentCall,
  SlotPropDef, SlotNodeDef, ComponentBodyNode,
  SlotPropOverride, SlotNodeOverride, AstNode,
} from "./nodes/ASTNode";

const ALLOWED_TAGS = new Set([
  "main", "section", "article", "nav", "aside", "header", "footer", "div",
  "h1", "h2", "h3", "p",
  "button", "a",
]);

const BREAKPOINTS = new Set(["sm", "md", "lg", "xl"]);

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const startToken = this.current();
    let logicFile: string | null = null;
    const definitions: ComponentDef[] = [];
    const body: AstNode[] = [];

    // @logic opcional no topo
    if (this.check(TokenType.KW_LOGIC)) {
      logicFile = this.parseLogicDecl();
    }

    while (!this.isAtEnd()) {
      if (this.check(TokenType.LBRACKET) && this.peek(1).type === TokenType.DOUBLE_RANGLE) {
        definitions.push(this.parseComponentDef());
      } else if (this.check(TokenType.LBRACKET) && this.peek(1).type === TokenType.RANGLE) {
        body.push(this.parseComponentCall());
      } else if (this.check(TokenType.LPAREN)) {
        body.push(this.parsePropBlock());
      } else if (this.check(TokenType.LBRACKET)) {
        body.push(this.parseNodeDecl());
      } else {
        this.error(`Token inesperado: ${this.current().type} ("${this.current().value}")`);
      }
    }

    return {
      kind: "Program",
      logicFile,
      definitions,
      body,
      line: startToken.line,
      col: startToken.col,
    };
  }

  // ─── Logic Declaration ───

  private parseLogicDecl(): string {
    this.expect(TokenType.KW_LOGIC);
    const pathToken = this.expect(TokenType.STRING, "caminho do arquivo lógico");
    return pathToken.value;
  }

  // ─── PropBlock ───

  private parsePropBlock(): PropBlock {
    const start = this.expect(TokenType.LPAREN);
    const props: Prop[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      // Skip slot prop defs that appear in component def context
      if (this.check(TokenType.LANGLE)) {
        // This is a SlotPropDef — skip it (it's handled by parsePropSlotDefBlock)
        this.parseSlotPropInDef();
        continue;
      }
      props.push(this.parseOneProp());
    }

    this.expect(TokenType.RPAREN);
    return { kind: "PropBlock", props, line: start.line, col: start.col };
  }

  // ─── Prop Parsing ───

  private parseOneProp(): Prop {
    // Nota: SlotPropDef (<slotName>key:value) é tratado separadamente no parsePropBlock

    // Evento: @evento:acao  ou  @evento:ns.acao
    if (this.check(TokenType.AT)) {
      return this.parseEventProp();
    }

    // Atributo HTML: $attr:value
    if (this.check(TokenType.DOLLAR)) {
      return this.parseAttrProp();
    }

    // Responsiva: bp.prop:value  OU  Visual: prop:value
    const identToken = this.current();

    // Verificar se é responsiva: IDENT DOT IDENT COLON
    if (this.check(TokenType.IDENT) && BREAKPOINTS.has(identToken.value)) {
      const next1 = this.peek(1);
      if (next1.type === TokenType.DOT) {
        return this.parseResponsiveProp();
      }
    }

    return this.parseVisualProp();
  }

  private parseVisualProp(): VisualProp {
    const keyToken = this.expect(TokenType.IDENT, "nome de propriedade CSS");
    this.expect(TokenType.COLON);
    const value = this.parseValue();
    return { kind: "VisualProp", key: keyToken.value, value, line: keyToken.line, col: keyToken.col };
  }

  private parseResponsiveProp(): ResponsiveProp {
    const bpToken = this.expect(TokenType.IDENT, "breakpoint");
    this.expect(TokenType.DOT);
    const keyToken = this.expect(TokenType.IDENT, "nome de propriedade CSS");
    this.expect(TokenType.COLON);
    const value = this.parseValue();
    return {
      kind: "ResponsiveProp",
      breakpoint: bpToken.value as "sm" | "md" | "lg" | "xl",
      key: keyToken.value,
      value,
      line: bpToken.line,
      col: bpToken.col,
    };
  }

  private parseEventProp(): EventProp {
    const atToken = this.expect(TokenType.AT);
    const eventToken = this.expect(TokenType.IDENT, "nome de evento");
    this.expect(TokenType.COLON);
    const firstPart = this.expect(TokenType.IDENT, "ação do evento");

    let namespace: string | null = null;
    let action = firstPart.value;

    if (this.check(TokenType.DOT)) {
      this.advance(); // consumir DOT
      const actionToken = this.expect(TokenType.IDENT, "ação do evento");
      namespace = firstPart.value;
      action = actionToken.value;
    }

    return {
      kind: "EventProp",
      event: eventToken.value,
      action,
      namespace,
      line: atToken.line,
      col: atToken.col,
    };
  }

  private parseAttrProp(): AttrProp {
    const dollarToken = this.expect(TokenType.DOLLAR);
    const nameToken = this.expect(TokenType.IDENT, "nome de atributo HTML");
    this.expect(TokenType.COLON);

    let value: string;
    if (this.check(TokenType.STRING)) {
      value = this.advance().value;
    } else {
      value = this.parseValue();
    }

    return { kind: "AttrProp", name: nameToken.value, value, line: dollarToken.line, col: dollarToken.col };
  }

  private parseSlotPropInDef(): SlotPropDef {
    const start = this.expect(TokenType.LANGLE);
    const slotNameToken = this.expect(TokenType.IDENT, "nome do slot de prop");
    this.expect(TokenType.RANGLE);
    const cssKeyToken = this.expect(TokenType.IDENT, "nome da propriedade CSS");
    this.expect(TokenType.COLON);
    const defaultValue = this.parseValue();

    return {
      kind: "SlotPropDef",
      slotName: slotNameToken.value,
      cssKey: cssKeyToken.value,
      defaultValue,
      line: start.line,
      col: start.col,
    };
  }

  // ─── Value parsing ───

  private parseValue(): string {
    let parts: string[] = [];
    const startLine = this.current().line;

    while (!this.isAtEnd()) {
      const cur = this.current();

      // Terminadores
      if (
        cur.type === TokenType.RPAREN ||
        cur.type === TokenType.RBRACKET ||
        cur.type === TokenType.COMMA ||
        cur.type === TokenType.EOF ||
        cur.type === TokenType.RANGLE
      ) {
        break;
      }

      // Novos prefixos de prop sempre terminam o valor
      if (
        cur.type === TokenType.AT ||
        cur.type === TokenType.DOLLAR ||
        cur.type === TokenType.LANGLE
      ) {
        break;
      }

      // IDENT seguido de COLON ou DOT indica nova propriedade (se já temos algum valor)
      if (cur.type === TokenType.IDENT && parts.length > 0) {
        const next = this.peek(1);
        if (next.type === TokenType.COLON || next.type === TokenType.DOT) {
          break;
        }
      }

      // Se estamos numa nova linha e encontramos IDENT seguido de COLON/DOT — nova prop
      if (cur.line > startLine && cur.type === TokenType.IDENT) {
        const next = this.peek(1);
        if (next.type === TokenType.COLON || next.type === TokenType.DOT) {
          break;
        }
      }

      // Cor hexadecimal: HASH + IDENT
      if (cur.type === TokenType.HASH) {
        this.advance();
        const identToken = this.expect(TokenType.IDENT, "valor hexadecimal");
        parts.push("#" + identToken.value);
        continue;
      }

      if (cur.type === TokenType.IDENT) {
        parts.push(this.advance().value);
        continue;
      }

      // Fallback: qualquer outro token como parte do valor
      break;
    }

    if (parts.length === 0) {
      this.error("Valor esperado");
    }

    return parts.join(" ");
  }

  // ─── Node Parsing ───

  private parseNodeDecl(): NodeDecl {
    const start = this.expect(TokenType.LBRACKET);
    let id: string | null = null;
    let tag: string;

    // ID opcional: #id::tag
    if (this.check(TokenType.HASH)) {
      this.advance();
      const idToken = this.expect(TokenType.IDENT, "id do nó");
      id = idToken.value;
      this.expect(TokenType.DOUBLE_COLON, "separador :: entre id e tag");
      const tagToken = this.expect(TokenType.IDENT, "nome da tag");
      tag = tagToken.value;
    } else {
      const tagToken = this.expect(TokenType.IDENT, "nome da tag");
      tag = tagToken.value;
    }

    // Validar tag
    if (!ALLOWED_TAGS.has(tag)) {
      this.error(`Tag desconhecida: "${tag}". Permitidas: ${[...ALLOWED_TAGS].join(", ")}`);
    }

    let text: string | null = null;
    let inlineProps: Prop[] | null = null;
    const children: ChildNode[] = [];

    // Inline props |>
    if (this.check(TokenType.PIPE_ARROW)) {
      this.advance();
      inlineProps = this.parseInlineProps();
    }

    // Texto ou filhos
    if (this.check(TokenType.STRING)) {
      text = this.advance().value;
      // Verificar que não há filhos depois do texto
      if (this.check(TokenType.LBRACKET) || this.check(TokenType.LPAREN)) {
        this.error(`Nó "${tag}" não pode ter texto inline e filhos ao mesmo tempo`);
      }
    } else {
      // Filhos
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        if (this.check(TokenType.LPAREN)) {
          children.push(this.parsePropBlock());
        } else if (this.check(TokenType.LBRACKET) && this.peek(1).type === TokenType.RANGLE) {
          children.push(this.parseComponentCall());
        } else if (this.check(TokenType.LBRACKET) && this.peek(1).type === TokenType.DOUBLE_RANGLE) {
          this.error("Definições de componente não podem ser aninhadas. Use [>>Name] apenas no nível superior");
        } else if (this.check(TokenType.LBRACKET)) {
          children.push(this.parseNodeDecl());
        } else {
          this.error(`Token inesperado dentro de nó: ${this.current().type} ("${this.current().value}")`);
        }
      }
    }

    this.expect(TokenType.RBRACKET);

    return {
      kind: "NodeDecl",
      id, tag, text, inlineProps, children,
      line: start.line, col: start.col,
    };
  }

  private parseInlineProps(): Prop[] {
    const props: Prop[] = [];
    const startLine = this.current().line;

    while (!this.isAtEnd()) {
      const cur = this.current();

      // Parar ao mudar de construção
      if (
        cur.type === TokenType.RBRACKET ||
        cur.type === TokenType.LBRACKET ||
        cur.type === TokenType.STRING ||
        cur.type === TokenType.EOF
      ) {
        break;
      }

      // Se mudou de linha e não parece uma prop, parar
      if (cur.line > startLine) {
        if (
          cur.type !== TokenType.AT &&
          cur.type !== TokenType.DOLLAR &&
          cur.type !== TokenType.IDENT &&
          cur.type !== TokenType.LANGLE
        ) {
          break;
        }
        // Verificar se é início de nó ou prop
        if (cur.type === TokenType.IDENT) {
          const next = this.peek(1);
          if (next.type !== TokenType.COLON && next.type !== TokenType.DOT) {
            break;
          }
        }
      }

      props.push(this.parseOneProp());
    }

    return props;
  }

  // ─── Component Def ───

  private parseComponentDef(): ComponentDef {
    const start = this.expect(TokenType.LBRACKET);
    this.expect(TokenType.DOUBLE_RANGLE);

    const nameToken = this.expect(TokenType.IDENT, "nome do componente");
    if (!/^[A-Z]/.test(nameToken.value)) {
      this.error(`Nomes de componente devem começar com letra maiúscula: "${nameToken.value}"`);
    }

    let propSlots: SlotPropDef[] = [];
    let body: ComponentBodyNode[] = [];

    // PropSlotDefBlock opcional
    if (this.check(TokenType.LPAREN)) {
      propSlots = this.parsePropSlotDefBlock();
    }

    // NodeDefBody: um NodeDecl cujos filhos podem conter SlotNodeDefs
    if (this.check(TokenType.LBRACKET)) {
      body = [this.parseComponentBodyNode()];
    }

    this.expect(TokenType.RBRACKET);

    return {
      kind: "ComponentDef",
      name: nameToken.value,
      propSlots,
      body,
      line: start.line,
      col: start.col,
    };
  }

  private parsePropSlotDefBlock(): SlotPropDef[] {
    this.expect(TokenType.LPAREN);
    const slots: SlotPropDef[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      if (this.check(TokenType.LANGLE)) {
        slots.push(this.parseSlotPropInDef());
      } else {
        // Prop normal dentro de componente (sem slot)
        this.parseOneProp(); // descarta - não é slot
      }
    }

    this.expect(TokenType.RPAREN);
    return slots;
  }

  private parseComponentBodyNode(): NodeDecl {
    const start = this.expect(TokenType.LBRACKET);
    const tagToken = this.expect(TokenType.IDENT, "tag raiz do componente");

    if (!ALLOWED_TAGS.has(tagToken.value)) {
      this.error(`Tag desconhecida: "${tagToken.value}"`);
    }

    const children: ComponentBodyNode[] = [];

    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      // SlotNodeDef: [<slotName>tag "texto"]
      if (this.check(TokenType.LBRACKET) && this.peek(1).type === TokenType.LANGLE) {
        children.push(this.parseSlotNodeDef());
      } else if (this.check(TokenType.LBRACKET)) {
        children.push(this.parseNodeDecl());
      } else {
        this.error(`Token inesperado no corpo do componente: ${this.current().type}`);
      }
    }

    this.expect(TokenType.RBRACKET);

    return {
      kind: "NodeDecl",
      id: null,
      tag: tagToken.value,
      text: null,
      inlineProps: null,
      children: children as ChildNode[],
      line: start.line,
      col: start.col,
    };
  }

  private parseSlotNodeDef(): SlotNodeDef {
    const start = this.expect(TokenType.LBRACKET);
    this.expect(TokenType.LANGLE);
    const slotNameToken = this.expect(TokenType.IDENT, "nome do slot de nó");
    this.expect(TokenType.RANGLE);
    const tagToken = this.expect(TokenType.IDENT, "tag do slot de nó");

    let defaultText = "";
    if (this.check(TokenType.STRING)) {
      defaultText = this.advance().value;
    }

    this.expect(TokenType.RBRACKET);

    return {
      kind: "SlotNodeDef",
      slotName: slotNameToken.value,
      tag: tagToken.value,
      defaultText,
      line: start.line,
      col: start.col,
    };
  }

  // ─── Component Call ───

  private parseComponentCall(): ComponentCall {
    const start = this.expect(TokenType.LBRACKET);
    this.expect(TokenType.RANGLE);

    const nameToken = this.expect(TokenType.IDENT, "nome do componente");
    if (!/^[A-Z]/.test(nameToken.value)) {
      this.error(`Nomes de componente devem começar com letra maiúscula: "${nameToken.value}"`);
    }

    let id: string | null = null;
    const propOverrides: SlotPropOverride[] = [];
    const slotOverrides: SlotNodeOverride[] = [];
    const extraChildren: ChildNode[] = [];

    // ID opcional: #id
    if (this.check(TokenType.HASH)) {
      this.advance();
      id = this.expect(TokenType.IDENT, "id do componente").value;
    }

    // Parse do corpo da chamada
    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      // PropSlotCall: (<slot:val, ...>)
      if (this.check(TokenType.LPAREN) && this.peek(1).type === TokenType.LANGLE) {
        this.advance(); // (
        this.advance(); // <
        this.parsePropSlotCall(propOverrides);
        this.expect(TokenType.RANGLE);
        this.expect(TokenType.RPAREN);
      }
      // NodeSlotCall: [<slot "val", ...>]
      else if (this.check(TokenType.LBRACKET) && this.peek(1).type === TokenType.LANGLE) {
        this.advance(); // [
        this.advance(); // <
        this.parseNodeSlotCall(slotOverrides);
        this.expect(TokenType.RANGLE);
        this.expect(TokenType.RBRACKET);
      }
      // PropBlock extra
      else if (this.check(TokenType.LPAREN)) {
        extraChildren.push(this.parsePropBlock());
      }
      // ComponentCall aninhado
      else if (this.check(TokenType.LBRACKET) && this.peek(1).type === TokenType.RANGLE) {
        extraChildren.push(this.parseComponentCall());
      }
      // NodeDecl extra
      else if (this.check(TokenType.LBRACKET)) {
        extraChildren.push(this.parseNodeDecl());
      }
      else {
        this.error(`Token inesperado na chamada de componente: ${this.current().type}`);
      }
    }

    this.expect(TokenType.RBRACKET);

    return {
      kind: "ComponentCall",
      name: nameToken.value,
      id,
      propOverrides,
      slotOverrides,
      extraChildren,
      line: start.line,
      col: start.col,
    };
  }

  private parsePropSlotCall(overrides: SlotPropOverride[]): void {
    while (!this.check(TokenType.RANGLE) && !this.isAtEnd()) {
      const slotToken = this.expect(TokenType.IDENT, "nome do slot de prop");
      this.expect(TokenType.COLON);
      const value = this.parseValue();

      overrides.push({
        kind: "SlotPropOverride",
        slotName: slotToken.value,
        value,
        line: slotToken.line,
        col: slotToken.col,
      });

      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }
  }

  private parseNodeSlotCall(overrides: SlotNodeOverride[]): void {
    while (!this.check(TokenType.RANGLE) && !this.isAtEnd()) {
      const slotToken = this.expect(TokenType.IDENT, "nome do slot de nó");
      const textToken = this.expect(TokenType.STRING, "texto do slot");

      overrides.push({
        kind: "SlotNodeOverride",
        slotName: slotToken.value,
        text: textToken.value,
        line: slotToken.line,
        col: slotToken.col,
      });

      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }
  }

  // ─── Utility ───

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: "", line: 0, col: 0 };
  }

  private peek(offset: number = 0): Token {
    const idx = this.pos + offset;
    return this.tokens[idx] || { type: TokenType.EOF, value: "", line: 0, col: 0 };
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private expect(type: TokenType, hint?: string): Token {
    const token = this.current();
    if (token.type !== type) {
      const hintStr = hint ? ` (${hint})` : "";
      this.error(`Esperado ${type}${hintStr}, encontrado ${token.type} ("${token.value}")`);
    }
    return this.advance();
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private error(msg: string, token?: Token): never {
    const t = token || this.current();
    throw new ParseError(msg, t.line, t.col);
  }
}
