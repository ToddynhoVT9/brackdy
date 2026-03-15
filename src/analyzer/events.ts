// ─── Brackdy Analyzer — Event Validation ─────────────────────────────
// See: brackdy-compiler-plan/04-semantic-analysis.md §Phase 4
//
// Collects EventProp bindings and validates them.
// Events are NOT inherited — only the declaring node gets a binding.

import type { EventProp } from "../parser/ast.js";
import type { ResolvedNode, EventBinding } from "./resolved.js";
import { SemEventNoIdError, SemEventNoLogicError } from "../errors/errors.js";

/**
 * Collects and validates all event bindings.
 *
 * Rules:
 * - If namespace is null, node MUST have an id → SemEventNoIdError otherwise
 * - If logicFile is null but events exist → SemEventNoLogicError
 * - If logicFile exists but no events → warning (non-fatal, logged to console)
 */
export function collectEvents(
  eventPairs: { event: EventProp; node: ResolvedNode }[],
  logicFile: string | null,
): EventBinding[] {
  // Validate: events require @logic
  if (eventPairs.length > 0 && logicFile === null) {
    const first = eventPairs[0].event;
    throw new SemEventNoLogicError(first.line, first.col);
  }

  // Warning: @logic but no events
  if (eventPairs.length === 0 && logicFile !== null) {
    console.warn("[Brackdy] Warning: @logic declared but no events found (SEM_LOGIC_UNUSED)");
    return [];
  }

  const bindings: EventBinding[] = [];

  for (const { event, node } of eventPairs) {
    if (event.namespace !== null) {
      // Explicit path: @click:hero-section.openHero
      bindings.push({
        targetId: node.id,         // may be null — v0.3 will emit a warning
        querySelector: null,
        domEvent: event.event,
        logicPath: event.namespace,
        methodName: event.action,
      });
    } else {
      // Implicit path: @click:openHero — requires node.id
      if (node.id === null) {
        throw new SemEventNoIdError(event.event, event.action, event.line, event.col);
      }
      bindings.push({
        targetId: node.id,
        querySelector: null,
        domEvent: event.event,
        logicPath: node.id,
        methodName: event.action,
      });
    }
  }

  return bindings;
}
