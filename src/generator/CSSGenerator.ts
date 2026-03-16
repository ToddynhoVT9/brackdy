import { ResponsiveClass } from "../resolver/ResolvedTypes";

export class CSSGenerator {
  generate(classes: ResponsiveClass[]): string | null {
    if (classes.length === 0) return null;
    return classes.map(rc => this.emitResponsiveClass(rc)).join("\n\n");
  }

  private emitResponsiveClass(rc: ResponsiveClass): string {
    const lines: string[] = [];

    // Bloco base
    lines.push(`.${rc.className} {`);
    for (const [k, v] of Object.entries(rc.baseProps)) {
      lines.push(`  ${k}: ${v};`);
    }
    lines.push(`}`);

    // Blocos de breakpoint (já ordenados pelo InheritanceResolver)
    for (const block of rc.breakpoints) {
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
}
