// ─── Brackdy Codegen — CSS Emitter ──────────────────────────────────
// See: brackdy-compiler-plan/05-codegen.md

import type { ResponsiveClass } from "../analyzer/resolved.js";

/**
 * Emits CSS for responsive classes.
 * Returns null if there are no responsive classes.
 */
export function emitCss(classes: ResponsiveClass[]): string | null {
  if (classes.length === 0) return null;
  return classes.map(emitResponsiveClass).join("\n\n");
}

/**
 * Emits a single ResponsiveClass as CSS text.
 *
 * Format:
 *   .className {
 *     key: value;
 *   }
 *   @media (min-width: Xpx) {
 *     .className {
 *       key: value;
 *     }
 *   }
 */
export function emitResponsiveClass(rc: ResponsiveClass): string {
  const lines: string[] = [];

  // Base class block
  lines.push(`.${rc.className} {`);
  for (const [k, v] of Object.entries(rc.baseProps)) {
    lines.push(`  ${k}: ${v};`);
  }
  lines.push(`}`);

  // Breakpoint blocks (order: sm → md → lg → xl)
  const bpOrder = ["sm", "md", "lg", "xl"];
  for (const bp of bpOrder) {
    const block = rc.breakpoints.find(b => b.breakpoint === bp);
    if (!block) continue;

    lines.push(`@media (min-width: ${block.minWidth}px) {`);
    lines.push(`  .${rc.className} {`);
    for (const [k, v] of Object.entries(block.props)) {
      lines.push(`    ${k}: ${v};`);
    }
    lines.push(`  }`);
    lines.push(`}`);
  }

  return lines.join("\n");
}
