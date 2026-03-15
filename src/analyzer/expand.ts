// ─── Brackdy Analyzer — Component Expansion ─────────────────────────
// See: brackdy-compiler-plan/04-semantic-analysis.md §Phase 1
// See: brackdy-compiler-plan/06-components.md
//
// Expands all ComponentCall nodes into plain NodeDecl trees.
// This must run BEFORE inheritance resolution.

import type {
  AstNode,
  ChildNode,
  ComponentDef,
  ComponentCall,
  NodeDecl,
  PropBlock,
  Prop,
  SlotNodeDef,
  ComponentBodyNode,
  VisualProp,
} from "../parser/ast.js";
import {
  SemDuplicateComponentError,
  SemUnknownComponentError,
  SemUnknownSlotError,
} from "../errors/errors.js";

// ─── Component Registry ──────────────────────────────────────────────

export class ComponentRegistry {
  private defs = new Map<string, ComponentDef>();

  register(def: ComponentDef): void {
    if (this.defs.has(def.name)) {
      throw new SemDuplicateComponentError(def.name, def.line, def.col);
    }
    this.defs.set(def.name, def);
  }

  get(name: string): ComponentDef | undefined {
    return this.defs.get(name);
  }
}

export function buildRegistry(defs: ComponentDef[]): ComponentRegistry {
  const registry = new ComponentRegistry();
  for (const def of defs) {
    registry.register(def);
  }
  return registry;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Expands all ComponentCall nodes in the body into plain NodeDecl trees.
 * ComponentDef nodes are stripped from the output.
 */
export function expandComponents(
  nodes: AstNode[],
  registry: ComponentRegistry,
): AstNode[] {
  const result: AstNode[] = [];
  for (const node of nodes) {
    if (node.kind === "ComponentDef") continue;
    if (node.kind === "ComponentCall") {
      result.push(expandCall(node, registry));
    } else if (node.kind === "NodeDecl") {
      result.push(expandNodeChildren(node, registry));
    } else {
      result.push(node); // PropBlock
    }
  }
  return result;
}

// ─── Internal ────────────────────────────────────────────────────────

function expandNodeChildren(node: NodeDecl, registry: ComponentRegistry): NodeDecl {
  const children: ChildNode[] = [];
  for (const child of node.children) {
    if (child.kind === "ComponentCall") {
      children.push(expandCall(child, registry));
    } else if (child.kind === "NodeDecl") {
      children.push(expandNodeChildren(child, registry));
    } else {
      children.push(child);
    }
  }
  return { ...node, children };
}

function expandCall(call: ComponentCall, registry: ComponentRegistry): NodeDecl {
  const def = registry.get(call.name);
  if (!def) {
    throw new SemUnknownComponentError(call.name, call.line, call.col);
  }

  // 1. Resolve slots
  const propMap = resolvePropSlots(def, call);
  const nodeSlotMap = resolveNodeSlots(def, call);

  // 2. Find root NodeDecl in the definition body
  const bodyRoot = findBodyRoot(def);

  // 3. Expand body children (handles SlotNodeDef substitution)
  const expandedBody = expandBodyChildren(
    bodyRoot.children as (ChildNode | ComponentBodyNode)[],
    nodeSlotMap,
    registry,
  );

  // 4. Build resolved slot props as inline props for the root node
  const slotInlineProps: VisualProp[] = [...propMap.entries()].map(
    ([cssKey, value]): VisualProp => ({
      kind: "VisualProp",
      key: cssKey,
      value,
      line: call.line,
      col: call.col,
    }),
  );

  // Merge with any existing inlineProps from the body root
  const mergedInlineProps: Prop[] = [
    ...(slotInlineProps),
    ...(bodyRoot.inlineProps ?? []),
  ];

  // 5. Assemble children: body + extraChildren
  const children: ChildNode[] = [...expandedBody];

  for (const extra of call.extraChildren) {
    if (extra.kind === "ComponentCall") {
      children.push(expandCall(extra, registry));
    } else if (extra.kind === "NodeDecl") {
      children.push(expandNodeChildren(extra, registry));
    } else {
      children.push(extra);
    }
  }

  return {
    kind: "NodeDecl",
    id: call.id ?? bodyRoot.id,
    tag: bodyRoot.tag,
    text: bodyRoot.text,
    inlineProps: mergedInlineProps.length > 0 ? mergedInlineProps : null,
    children,
    line: call.line,
    col: call.col,
  };
}

// ─── Slot Resolution ─────────────────────────────────────────────────

function resolvePropSlots(def: ComponentDef, call: ComponentCall): Map<string, string> {
  const result = new Map<string, string>();
  const nameToKey = new Map<string, string>();

  for (const slot of def.propSlots) {
    result.set(slot.cssKey, slot.defaultValue);
    nameToKey.set(slot.slotName, slot.cssKey);
  }

  for (const ovr of call.propOverrides) {
    const cssKey = nameToKey.get(ovr.slotName);
    if (cssKey === undefined) {
      throw new SemUnknownSlotError(ovr.slotName, def.name, ovr.line, ovr.col);
    }
    result.set(cssKey, ovr.value);
  }

  return result;
}

function resolveNodeSlots(def: ComponentDef, call: ComponentCall): Map<string, string> {
  const result = new Map<string, string>();
  collectSlotDefs(def.body, result);

  for (const ovr of call.slotOverrides) {
    if (!result.has(ovr.slotName)) {
      throw new SemUnknownSlotError(ovr.slotName, def.name, ovr.line, ovr.col);
    }
    result.set(ovr.slotName, ovr.text);
  }

  return result;
}

function collectSlotDefs(nodes: ComponentBodyNode[], out: Map<string, string>): void {
  for (const node of nodes) {
    if (node.kind === "SlotNodeDef") {
      out.set(node.slotName, node.defaultText);
    } else if (node.kind === "NodeDecl") {
      for (const child of node.children) {
        if ((child as any).kind === "SlotNodeDef") {
          const s = child as unknown as SlotNodeDef;
          out.set(s.slotName, s.defaultText);
        } else if (child.kind === "NodeDecl") {
          collectSlotDefs([child], out);
        }
      }
    }
  }
}

function findBodyRoot(def: ComponentDef): NodeDecl {
  for (const node of def.body) {
    if (node.kind === "NodeDecl") return node;
  }
  throw new Error(`Component "${def.name}" has no root NodeDecl`);
}

// ─── Body Expansion (handles SlotNodeDef) ────────────────────────────

function expandBodyChildren(
  children: (ChildNode | ComponentBodyNode)[],
  slots: Map<string, string>,
  registry: ComponentRegistry,
): ChildNode[] {
  const result: ChildNode[] = [];

  for (const child of children) {
    if ((child as any).kind === "SlotNodeDef") {
      const s = child as unknown as SlotNodeDef;
      const text = slots.get(s.slotName) ?? s.defaultText;
      result.push({
        kind: "NodeDecl",
        id: null,
        tag: s.tag,
        text,
        inlineProps: null,
        children: [],
        line: s.line,
        col: s.col,
      });
    } else if (child.kind === "NodeDecl") {
      const expanded = expandBodyChildren(
        child.children as (ChildNode | ComponentBodyNode)[],
        slots,
        registry,
      );
      result.push({ ...child, children: expanded });
    } else if (child.kind === "ComponentCall") {
      result.push(expandCall(child as ComponentCall, registry));
    } else {
      result.push(child as ChildNode);
    }
  }

  return result;
}
