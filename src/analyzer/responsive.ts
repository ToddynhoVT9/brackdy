// ─── Brackdy Analyzer — Responsive Class Generation ─────────────────
// See: brackdy-compiler-plan/04-semantic-analysis.md §Phase 3
//
// Scans resolved nodes for responsive props, generates CSS class names,
// and produces ResponsiveClass entries for the CSS emitter.

import type { ResolvedNode, ResponsiveClass, StyleMap, BreakpointBlock } from "./resolved.js";
import { BREAKPOINT_WIDTHS } from "./resolved.js";

// ─── Class Name Generator ────────────────────────────────────────────

let classCounter = 0;

/** Reset counter (for testing). */
export function resetClassCounter(): void {
  classCounter = 0;
}

function generateClassName(tag: string): string {
  classCounter++;
  const n = String(classCounter).padStart(2, "0");
  return `_dsl_${tag}_${n}`;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Scans resolved nodes for responsive props (stored as `_responsiveProps`).
 * For each node with responsive props:
 * - Generates a unique className
 * - Separates base (non-responsive) props from breakpoint-specific props
 * - Sets node.className and node.style = null
 * - Returns the generated ResponsiveClass entries
 */
export function assignResponsiveClasses(nodes: ResolvedNode[]): ResponsiveClass[] {
  const classes: ResponsiveClass[] = [];

  for (const node of nodes) {
    processNode(node, classes);
  }

  return classes;
}

// ─── Internal ────────────────────────────────────────────────────────

function processNode(node: ResolvedNode, classes: ResponsiveClass[]): void {
  const responsiveProps = (node as any)._responsiveProps as
    | { breakpoint: string; key: string; value: string }[]
    | undefined;

  if (responsiveProps && responsiveProps.length > 0) {
    // Generate a class name
    const className = generateClassName(node.tag);

    // Base props = the visual style map (non-responsive)
    const baseProps: StyleMap = { ...(node.style ?? {}) };

    // Group responsive props by breakpoint
    const bpMap = new Map<string, StyleMap>();
    for (const rp of responsiveProps) {
      if (!bpMap.has(rp.breakpoint)) {
        bpMap.set(rp.breakpoint, {});
      }
      bpMap.get(rp.breakpoint)![rp.key] = rp.value;
    }

    // Convert to ordered BreakpointBlock array
    const bpOrder = ["sm", "md", "lg", "xl"] as const;
    const breakpoints: BreakpointBlock[] = [];
    for (const bp of bpOrder) {
      const props = bpMap.get(bp);
      if (props) {
        breakpoints.push({
          breakpoint: bp,
          minWidth: BREAKPOINT_WIDTHS[bp],
          props,
        });
      }
    }

    // Store the class
    classes.push({ className, baseProps, breakpoints });

    // Update the node: set className, clear style
    node.className = className;
    node.style = null;

    // Clean up internal property
    delete (node as any)._responsiveProps;
  }

  // Recurse on children
  for (const child of node.children) {
    processNode(child, classes);
  }
}
