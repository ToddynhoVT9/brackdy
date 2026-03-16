// ─── Tipos do AST Resolvido ───

export type StyleMap = Record<string, string>;

export interface ResolvedNode {
  id: string | null;
  tag: string;
  text: string | null;
  style: StyleMap | null;
  className: string | null;
  attrs: Record<string, string>;
  children: ResolvedNode[];
}

export interface ResponsiveClass {
  className: string;
  baseProps: StyleMap;
  breakpoints: BreakpointBlock[];
}

export interface BreakpointBlock {
  breakpoint: "sm" | "md" | "lg" | "xl";
  minWidth: number;
  props: StyleMap;
}

export interface EventBinding {
  targetId: string | null;
  querySelector: string | null;
  domEvent: string;
  logicPath: string;
  methodName: string;
}

export interface ResolvedProgram {
  logicFile: string | null;
  nodes: ResolvedNode[];
  responsiveClasses: ResponsiveClass[];
  eventBindings: EventBinding[];
}
