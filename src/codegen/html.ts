// ─── Brackdy Codegen — HTML Emitter ─────────────────────────────────
// See: brackdy-compiler-plan/05-codegen.md

import type { ResolvedNode, StyleMap } from "../analyzer/resolved.js";

/**
 * Emits HTML from a list of resolved nodes.
 * Output is a fragment (no <!DOCTYPE>, <html>, <head>, <body>).
 */
export function emitHtml(nodes: ResolvedNode[], indent: number = 0): string {
  return nodes.map(n => emitNode(n, indent)).join("\n");
}

/**
 * Emits a single ResolvedNode as HTML.
 */
function emitNode(node: ResolvedNode, indent: number): string {
  const pad = " ".repeat(indent);
  const attrs = buildAttrString(node);
  const open = `${pad}<${node.tag}${attrs}>`;
  const close = `</${node.tag}>`;

  // Text node: <tag attrs>text</tag> on one line
  if (node.text !== null) {
    return `${open}${node.text}${close}`;
  }

  // Empty node: <tag attrs></tag> on one line
  if (node.children.length === 0) {
    return `${open}${close}`;
  }

  // Node with children: multi-line
  const childLines = node.children
    .map(child => emitNode(child, indent + 2))
    .join("\n");

  return `${open}\n${childLines}\n${pad}${close}`;
}

/**
 * Builds the attribute string for a node's opening tag.
 * Order: id, class, style, then native attrs.
 */
function buildAttrString(node: ResolvedNode): string {
  const parts: string[] = [];

  if (node.id) {
    parts.push(`id="${node.id}"`);
  }

  if (node.className) {
    parts.push(`class="${node.className}"`);
  }

  if (node.style && Object.keys(node.style).length > 0) {
    const styleStr = buildStyleString(node.style);
    parts.push(`style="${styleStr}"`);
  }

  for (const [attr, val] of Object.entries(node.attrs)) {
    parts.push(`${attr}="${val}"`);
  }

  return parts.length > 0 ? " " + parts.join(" ") : "";
}

/**
 * Converts a StyleMap to an inline CSS string.
 * Format: "key:value; key:value"
 */
export function buildStyleString(style: StyleMap): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join("; ");
}

/**
 * Wraps an HTML fragment inside a full document HTML5 structure.
 */
export function wrapHtml(
  fragment: string,
  options: {
    title: string;
    cssFileName?: string;
    bindingsFileName?: string;
  }
): string {
  const cssLink = options.cssFileName
    ? `    <link rel="stylesheet" href="${options.cssFileName}">\n`
    : "";
  const bindingsScript = options.bindingsFileName
    ? `    <script type="module" src="${options.bindingsFileName}"></script>\n`
    : "";

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="pt-BR">\n' +
    "  <head>\n" +
    '    <meta charset="UTF-8">\n' +
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    `    <title>${options.title}</title>\n` +
    cssLink +
    "  </head>\n" +
    "  <body>\n" +
// indent the fragment somewhat, or just paste it
    fragment.replace(/^/gm, "    ") + "\n" +
    bindingsScript +
    "  </body>\n" +
    "</html>"
  );
}
