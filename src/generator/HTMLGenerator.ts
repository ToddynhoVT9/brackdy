import { ResolvedNode, StyleMap } from "../resolver/ResolvedTypes";

export class HTMLGenerator {
  generate(nodes: ResolvedNode[], indent: number = 0): string {
    return nodes.map(node => this.emitNode(node, indent)).join("\n");
  }

  private emitNode(node: ResolvedNode, indent: number): string {
    const pad = " ".repeat(indent);
    const attrs = this.buildAttrString(node);
    const open = `${pad}<${node.tag}${attrs}>`;
    const close = `</${node.tag}>`;

    if (node.text !== null) {
      return `${open}${node.text}${close}`;
    }

    if (node.children.length === 0) {
      return `${open}${close}`;
    }

    const childLines = node.children
      .map(child => this.emitNode(child, indent + 2))
      .join("\n");

    return `${open}\n${childLines}\n${pad}${close}`;
  }

  private buildAttrString(node: ResolvedNode): string {
    const parts: string[] = [];

    if (node.id) {
      parts.push(`id="${node.id}"`);
    }

    if (node.className) {
      parts.push(`class="${node.className}"`);
    }

    if (node.style && Object.keys(node.style).length > 0) {
      const styleStr = this.buildStyleString(node.style);
      parts.push(`style="${styleStr}"`);
    }

    for (const [attr, val] of Object.entries(node.attrs)) {
      parts.push(`${attr}="${val}"`);
    }

    return parts.length > 0 ? " " + parts.join(" ") : "";
  }

  private buildStyleString(style: StyleMap): string {
    return Object.entries(style)
      .map(([k, v]) => `${k}:${v}`)
      .join("; ");
  }
}
