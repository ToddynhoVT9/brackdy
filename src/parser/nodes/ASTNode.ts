// ─── Tipos de Propriedade ───

export interface VisualProp {
  kind: "VisualProp";
  key: string;
  value: string;
  line: number;
  col: number;
}

export interface EventProp {
  kind: "EventProp";
  event: string;
  action: string;
  namespace: string | null;
  line: number;
  col: number;
}

export interface AttrProp {
  kind: "AttrProp";
  name: string;
  value: string;
  line: number;
  col: number;
}

export interface ResponsiveProp {
  kind: "ResponsiveProp";
  breakpoint: "sm" | "md" | "lg" | "xl";
  key: string;
  value: string;
  line: number;
  col: number;
}

export type Prop = VisualProp | EventProp | AttrProp | ResponsiveProp;

// ─── Blocos de Propriedades ───

export interface PropBlock {
  kind: "PropBlock";
  props: Prop[];
  line: number;
  col: number;
}

// ─── Nós ───

export interface NodeDecl {
  kind: "NodeDecl";
  id: string | null;
  tag: string;
  text: string | null;
  inlineProps: Prop[] | null;
  children: ChildNode[];
  line: number;
  col: number;
}

export type ChildNode = PropBlock | NodeDecl | ComponentCall;

// ─── Componentes ───

export interface ComponentDef {
  kind: "ComponentDef";
  name: string;
  propSlots: SlotPropDef[];
  body: ComponentBodyNode[];
  line: number;
  col: number;
}

export interface SlotPropDef {
  kind: "SlotPropDef";
  slotName: string;
  cssKey: string;
  defaultValue: string;
  line: number;
  col: number;
}

export interface SlotNodeDef {
  kind: "SlotNodeDef";
  slotName: string;
  tag: string;
  defaultText: string;
  line: number;
  col: number;
}

export type ComponentBodyNode = NodeDecl | SlotNodeDef;

export interface ComponentCall {
  kind: "ComponentCall";
  name: string;
  id: string | null;
  propOverrides: SlotPropOverride[];
  slotOverrides: SlotNodeOverride[];
  extraChildren: ChildNode[];
  line: number;
  col: number;
}

export interface SlotPropOverride {
  kind: "SlotPropOverride";
  slotName: string;
  value: string;
  line: number;
  col: number;
}

export interface SlotNodeOverride {
  kind: "SlotNodeOverride";
  slotName: string;
  text: string;
  line: number;
  col: number;
}

// ─── Programa (Raiz) ───

export interface Program {
  kind: "Program";
  logicFile: string | null;
  definitions: ComponentDef[];
  body: AstNode[];
  line: number;
  col: number;
}

export type AstNode = PropBlock | NodeDecl | ComponentCall | ComponentDef;
