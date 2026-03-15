// ─── Brackdy Compiler — AST Node Types ───────────────────────────────
// See: brackdy-compiler-plan/02-ast.md
//
// Every node carries `line` and `col` for error reporting.
// Discriminated unions use `kind` as the tag field.

// ─── Prop types ──────────────────────────────────────────────────────

export interface VisualProp {
  kind: "VisualProp";
  key: string;       // e.g. "background", "padding", "grid-template-columns"
  value: string;     // e.g. "#121212", "24px", "1fr 1fr 1fr"
  line: number;
  col: number;
}

export interface EventProp {
  kind: "EventProp";
  event: string;           // e.g. "click", "change", "input"
  action: string;          // e.g. "openHero"
  namespace: string | null; // e.g. "hero-section" if path is "hero-section.openHero"
  line: number;
  col: number;
}

export interface AttrProp {
  kind: "AttrProp";
  name: string;      // e.g. "href", "src", "alt", "type"
  value: string;     // e.g. "/home", "/img/logo.png"
  line: number;
  col: number;
}

export interface ResponsiveProp {
  kind: "ResponsiveProp";
  breakpoint: "sm" | "md" | "lg" | "xl";
  key: string;       // e.g. "grid-template-columns"
  value: string;     // e.g. "1fr 1fr"
  line: number;
  col: number;
}

export type Prop = VisualProp | EventProp | AttrProp | ResponsiveProp;

// ─── Property Blocks ─────────────────────────────────────────────────

/**
 * A standalone `()` block appearing BEFORE a node.
 */
export interface PropBlock {
  kind: "PropBlock";
  props: Prop[];
  line: number;
  col: number;
}

// ─── Nodes ───────────────────────────────────────────────────────────

/**
 * A regular `[tag ...]` node.
 */
export interface NodeDecl {
  kind: "NodeDecl";
  id: string | null;              // from #id::tag syntax; null if no id
  tag: string;                    // e.g. "section", "h1", "main"
  text: string | null;            // inline text content; null if children present
  inlineProps: Prop[] | null;     // from |> syntax; null if not present
  children: ChildNode[];          // interleaved PropBlocks and NodeDecls/ComponentCalls
  line: number;
  col: number;
}

// ─── Components ──────────────────────────────────────────────────────

/**
 * A slot inside a component's `()` block.
 * Defined as `<slotName>cssKey:defaultValue`
 */
export interface SlotPropDef {
  kind: "SlotPropDef";
  slotName: string;        // e.g. "bg", "pad"
  cssKey: string;          // e.g. "background", "padding"
  defaultValue: string;    // e.g. "#1E1E1E", "16px"
  line: number;
  col: number;
}

/**
 * A slot inside a component's structural body.
 * Defined as `[<slotName>tag "defaultText"]`
 */
export interface SlotNodeDef {
  kind: "SlotNodeDef";
  slotName: string;        // e.g. "title", "body", "header"
  tag: string;             // e.g. "h2", "p", "h1"
  defaultText: string;     // e.g. "Título padrão"
  line: number;
  col: number;
}

/**
 * A `[>>Name ...]` definition block.
 */
export interface ComponentDef {
  kind: "ComponentDef";
  name: string;                        // e.g. "Card", "Layout"
  propSlots: SlotPropDef[];            // slots inside the () block
  body: ComponentBodyNode[];           // the structural body (NodeDecl + SlotNodeDef)
  line: number;
  col: number;
}

/**
 * A slot value passed in a `(<...>)` call block.
 */
export interface SlotPropOverride {
  kind: "SlotPropOverride";
  slotName: string;    // e.g. "bg"
  value: string;       // e.g. "#ffffff"
  line: number;
  col: number;
}

/**
 * A slot text value passed in a `[<...>]` call block.
 */
export interface SlotNodeOverride {
  kind: "SlotNodeOverride";
  slotName: string;    // e.g. "title"
  text: string;        // e.g. "Outro título"
  line: number;
  col: number;
}

/**
 * A `[>Name ...]` invocation.
 */
export interface ComponentCall {
  kind: "ComponentCall";
  name: string;                          // e.g. "Card"
  id: string | null;                     // #id assigned at call site
  propOverrides: SlotPropOverride[];     // from (<slot:val, ...>)
  slotOverrides: SlotNodeOverride[];     // from [<slot "text", ...>]
  extraChildren: ChildNode[];            // non-slot children (plain nodes, nested calls)
  line: number;
  col: number;
}

// ─── Union types ─────────────────────────────────────────────────────

/** Items that can appear as children of a NodeDecl or ComponentCall body */
export type ChildNode = PropBlock | NodeDecl | ComponentCall;

/** Nodes allowed inside a ComponentDef body */
export type ComponentBodyNode = NodeDecl | SlotNodeDef;

/** All top-level AST nodes */
export type AstNode = PropBlock | NodeDecl | ComponentCall | ComponentDef;

// ─── Program (root) ──────────────────────────────────────────────────

export interface Program {
  kind: "Program";
  logicFile: string | null;        // value from @logic "..." or null
  definitions: ComponentDef[];    // all [>>Name ...] definition blocks
  body: AstNode[];                 // top-level nodes and property blocks
  line: number;
  col: number;
}
