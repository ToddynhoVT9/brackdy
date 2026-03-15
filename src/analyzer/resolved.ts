// ─── Brackdy Compiler — Resolved AST Types ──────────────────────────
// Output of the semantic analyzer, input to code generation.
// See: brackdy-compiler-plan/04-semantic-analysis.md

// ─── Style Map ───────────────────────────────────────────────────────

/** CSS property key → value, e.g. { background: "#121212", padding: "24px" } */
export type StyleMap = Record<string, string>;

// ─── Resolved Node ───────────────────────────────────────────────────

export interface ResolvedNode {
  id: string | null;
  tag: string;
  text: string | null;
  style: StyleMap | null;             // null when node uses a class (responsive)
  className: string | null;           // set when node has responsive props
  attrs: Record<string, string>;      // native HTML attributes ($key → value)
  children: ResolvedNode[];
}

// ─── Responsive Classes ──────────────────────────────────────────────

export interface BreakpointBlock {
  breakpoint: "sm" | "md" | "lg" | "xl";
  minWidth: number;                   // sm=640, md=768, lg=1024, xl=1280
  props: StyleMap;
}

export interface ResponsiveClass {
  className: string;                  // e.g. "_dsl_main_01"
  baseProps: StyleMap;                // non-responsive visual props
  breakpoints: BreakpointBlock[];
}

// ─── Event Bindings ──────────────────────────────────────────────────

export interface EventBinding {
  targetId: string | null;            // null = uses querySelector (future)
  querySelector: string | null;       // CSS selector if no id (future; always null for now)
  domEvent: string;                   // e.g. "click"
  logicPath: string;                  // e.g. "hero-section"
  methodName: string;                 // e.g. "openHero"
}

// ─── Resolved Program ────────────────────────────────────────────────

export interface ResolvedProgram {
  logicFile: string | null;
  nodes: ResolvedNode[];
  responsiveClasses: ResponsiveClass[];
  eventBindings: EventBinding[];
}

// ─── Breakpoint Width Constants ──────────────────────────────────────

export const BREAKPOINT_WIDTHS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};
