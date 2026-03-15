// ─── Brackdy Analyzer — Property Inheritance ────────────────────────
// See: brackdy-compiler-plan/04-semantic-analysis.md §Phase 2
//
// Walks the expanded AST, resolving property inheritance.
// Priority: inherited < PropBlock < inline |> props.
// Visual props cascade to children; attrs and events do NOT.

import type {
  AstNode,
  ChildNode,
  NodeDecl,
  PropBlock,
  Prop,
  EventProp,
} from "../parser/ast.js";
import type { ResolvedNode, StyleMap } from "./resolved.js";

// ─── Collected props during inheritance ──────────────────────────────

interface CollectedProps {
  visual: StyleMap;
  attrs: Record<string, string>;
  events: EventProp[];
  responsive: { breakpoint: string; key: string; value: string }[];
}

// ─── Inheritable CSS Properties Whitelist ────────────────────────────
// See: https://www.w3.org/TR/CSS21/propidx.html (properties where Inherited? is 'yes')
const INHERITABLE_PROPS = new Set([
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "font",
  "letter-spacing",
  "line-height",
  "list-style-type",
  "list-style-position",
  "list-style-image",
  "list-style",
  "text-align",
  "text-indent",
  "text-transform",
  "visibility",
  "white-space",
  "word-spacing",
  "cursor",
  "quotes",
]);

/**
 * Filters a StyleMap to keep only properties that are naturally inheritable.
 */
function filterInheritable(style: StyleMap): StyleMap {
  const filtered: StyleMap = {};
  for (const [key, value] of Object.entries(style)) {
    if (INHERITABLE_PROPS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Resolves property inheritance for an expanded AST.
 * Returns a flat list of ResolvedNode (already resolved, with style maps).
 * Responsive props are stored on each node for later class assignment.
 */
export function resolveInheritance(
  nodes: AstNode[],
  inherited: StyleMap = {},
): { nodes: ResolvedNode[]; allEvents: { event: EventProp; node: ResolvedNode }[] } {
  const result: ResolvedNode[] = [];
  const allEvents: { event: EventProp; node: ResolvedNode }[] = [];

  let pendingPropBlock: PropBlock | null = null;

  for (const node of nodes) {
    if (node.kind === "PropBlock") {
      pendingPropBlock = node;
      continue;
    }

    if (node.kind === "NodeDecl") {
      const resolved = resolveNode(node, inherited, pendingPropBlock);
      result.push(resolved.node);
      allEvents.push(...resolved.events);
      pendingPropBlock = null;
      continue;
    }

    // ComponentDef and ComponentCall should not appear after expansion
    pendingPropBlock = null;
  }

  return { nodes: result, allEvents };
}

// ─── Internal ────────────────────────────────────────────────────────

function resolveNode(
  node: NodeDecl,
  inherited: StyleMap,
  propBlock: PropBlock | null,
): { node: ResolvedNode; events: { event: EventProp; node: ResolvedNode }[] } {
  // Collect props from different sources
  const propBlockProps = propBlock ? classifyProps(propBlock.props) : emptyCollected();
  const inlinePropsCollected = node.inlineProps
    ? classifyProps(node.inlineProps)
    : emptyCollected();

  // Merge visual: inherited < propBlock < inline
  const mergedVisual: StyleMap = {
    ...inherited,
    ...propBlockProps.visual,
    ...inlinePropsCollected.visual,
  };

  // Attrs: propBlock + inline only (NOT inherited)
  const mergedAttrs: Record<string, string> = {
    ...propBlockProps.attrs,
    ...inlinePropsCollected.attrs,
  };

  // Responsive props: propBlock + inline
  const responsive = [
    ...propBlockProps.responsive,
    ...inlinePropsCollected.responsive,
  ];

  // Events: propBlock + inline only (NOT inherited)
  const events = [
    ...propBlockProps.events,
    ...inlinePropsCollected.events,
  ];

  // Separate visual props into base (non-responsive) and responsive
  const hasResponsive = responsive.length > 0;

  // Build the resolved node (style will be replaced by className later if responsive)
  const resolvedNode: ResolvedNode = {
    id: node.id,
    tag: node.tag,
    text: node.text,
    style: mergedVisual,
    className: null,
    attrs: mergedAttrs,
    children: [],
  };

  // Store responsive props on the node for later processing
  if (hasResponsive) {
    (resolvedNode as any)._responsiveProps = responsive;
  }

  // Collect events for this node
  const collectedEvents: { event: EventProp; node: ResolvedNode }[] = [];
  for (const ev of events) {
    collectedEvents.push({ event: ev, node: resolvedNode });
  }

  // Recurse on children (pass filtered mergedVisual as inherited context)
  const inheritableVisual = filterInheritable(mergedVisual);
  const { nodes: resolvedChildren, allEvents: childEvents } =
    resolveChildNodes(node.children, inheritableVisual);

  resolvedNode.children = resolvedChildren;
  collectedEvents.push(...childEvents);

  return { node: resolvedNode, events: collectedEvents };
}

function resolveChildNodes(
  children: ChildNode[],
  inherited: StyleMap,
): { nodes: ResolvedNode[]; allEvents: { event: EventProp; node: ResolvedNode }[] } {
  const result: ResolvedNode[] = [];
  const allEvents: { event: EventProp; node: ResolvedNode }[] = [];

  let pendingPropBlock: PropBlock | null = null;

  for (const child of children) {
    if (child.kind === "PropBlock") {
      pendingPropBlock = child;
      continue;
    }

    if (child.kind === "NodeDecl") {
      const resolved = resolveNode(child, inherited, pendingPropBlock);
      result.push(resolved.node);
      allEvents.push(...resolved.events);
      pendingPropBlock = null;
      continue;
    }

    // ComponentCall should not appear after expansion
    pendingPropBlock = null;
  }

  return { nodes: result, allEvents };
}

// ─── Prop Classification ─────────────────────────────────────────────

function classifyProps(props: Prop[]): CollectedProps {
  const visual: StyleMap = {};
  const attrs: Record<string, string> = {};
  const events: EventProp[] = [];
  const responsive: { breakpoint: string; key: string; value: string }[] = [];

  for (const prop of props) {
    switch (prop.kind) {
      case "VisualProp":
        visual[prop.key] = prop.value;
        break;
      case "AttrProp":
        attrs[prop.name] = prop.value;
        break;
      case "EventProp":
        events.push(prop);
        break;
      case "ResponsiveProp":
        responsive.push({
          breakpoint: prop.breakpoint,
          key: prop.key,
          value: prop.value,
        });
        break;
    }
  }

  return { visual, attrs, events, responsive };
}

function emptyCollected(): CollectedProps {
  return { visual: {}, attrs: {}, events: [], responsive: [] };
}
