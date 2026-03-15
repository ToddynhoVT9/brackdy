// ─── Brackdy Codegen — Entry Point ──────────────────────────────────
// Orchestrates: HTML emit + CSS emit + TS bindings emit
// See: brackdy-compiler-plan/05-codegen.md

import type { ResolvedProgram } from "../analyzer/resolved.js";
import { emitHtml } from "./html.js";
import { emitCss } from "./css.js";
import { emitBindings } from "./ts.js";

/** Output of the code generator. */
export interface CompilerOutput {
  html: string;
  css: string | null;
  bindings: string | null;
  logicStub?: { path: string; content: string } | null;
}

/**
 * Generates HTML, CSS, and TypeScript bindings from a ResolvedProgram.
 */
export function generate(resolved: ResolvedProgram): CompilerOutput {
  const html = emitHtml(resolved.nodes);

  const css = resolved.responsiveClasses.length > 0
    ? emitCss(resolved.responsiveClasses)
    : null;

  const tsOutput =
    resolved.eventBindings.length > 0 && resolved.logicFile !== null
      ? emitBindings(resolved.logicFile, resolved.eventBindings)
      : null;

  return { 
    html, 
    css, 
    bindings: tsOutput ? tsOutput.code : null,
    logicStub: tsOutput ? tsOutput.logicStub : null
  };
}
