// ─── Brackdy Compiler — Entry Point ─────────────────────────────────
// Programmatic API: compile(source) → { html, css, bindings }

import { Lexer } from "./lexer/lexer.js";
import { Parser } from "./parser/parser.js";
import { analyze } from "./analyzer/index.js";
import { generate } from "./codegen/index.js";
import { wrapHtml } from "./codegen/html.js";
import type { CompilerOutput } from "./codegen/index.js";

// ─── Options ─────────────────────────────────────────────────────────

export interface CompilerOptions {
  filename?: string;          // filename for error messages
  outDir?: string;            // output directory (used by CLI)
  logicFileOverride?: string; // override @logic declared in source
  wrap?: boolean;             // whether to wrap output in a full HTML document
  title?: string;             // title for the HTML document
  cssFileName?: string;       // name of the CSS file to link in the wrapper
  bindingsFileName?: string;  // name of the bindings file to link in the wrapper
}

// Re-export CompilerOutput for convenience
export type { CompilerOutput };

// ─── compile() ───────────────────────────────────────────────────────

/**
 * Compiles Brackdy source code into HTML, CSS, and TypeScript bindings.
 *
 * Pipeline: Lex → Parse → Analyze → Generate
 *
 * Does NOT write files — the CLI handles that.
 */
export function compile(
  source: string,
  options?: CompilerOptions,
): CompilerOutput {
  // 1. Lex
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  // 2. Parse
  const parser = new Parser(tokens);
  const program = parser.parse();

  // 3. Override logic file if requested
  if (options?.logicFileOverride) {
    program.logicFile = options.logicFileOverride;
  }

  // 4. Analyze (semantic)
  const resolved = analyze(program);

  // 5. Generate output
  const output = generate(resolved);

  // 6. Wrap HTML if requested
  if (options?.wrap) {
    output.html = wrapHtml(output.html, {
      title: options.title || "Brackdy Page",
      cssFileName: output.css ? options.cssFileName : undefined,
      bindingsFileName: output.bindings ? options.bindingsFileName : undefined,
    });
  }

  return output;
}
