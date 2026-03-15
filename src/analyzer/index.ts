// ─── Brackdy Analyzer — Entry Point ─────────────────────────────────
// Orchestrates: component expansion → inheritance → events → responsive
// See: brackdy-compiler-plan/04-semantic-analysis.md

import type { Program } from "../parser/ast.js";
import type { ResolvedProgram } from "./resolved.js";
import { buildRegistry, expandComponents } from "./expand.js";
import { resolveInheritance } from "./inherit.js";
import { collectEvents } from "./events.js";
import { assignResponsiveClasses, resetClassCounter } from "./responsive.js";

/**
 * Runs the full semantic analysis pipeline on a parsed Program.
 *
 * Pipeline:
 *   1. Register component definitions
 *   2. Expand all component calls
 *   3. Resolve property inheritance
 *   4. Collect and validate events
 *   5. Assign responsive classes
 */
export function analyze(program: Program): ResolvedProgram {
  // Reset class counter for deterministic output
  resetClassCounter();

  // 1. Register all component definitions
  const registry = buildRegistry(program.definitions);

  // 2. Expand all component calls → plain NodeDecl tree
  const expanded = expandComponents(program.body, registry);

  // 3. Resolve property inheritance → ResolvedNode[]
  const { nodes, allEvents } = resolveInheritance(expanded);

  // 4. Collect and validate event bindings
  const eventBindings = collectEvents(allEvents, program.logicFile);

  // 5. Assign responsive classes
  const responsiveClasses = assignResponsiveClasses(nodes);

  return {
    logicFile: program.logicFile,
    nodes,
    responsiveClasses,
    eventBindings,
  };
}
