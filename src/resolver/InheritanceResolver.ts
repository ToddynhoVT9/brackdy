import { NodeDecl, PropBlock, Prop, ChildNode } from "../parser/nodes/ASTNode";
import { ResolvedNode, StyleMap, ResponsiveClass, BreakpointBlock } from "./ResolvedTypes";

const BREAKPOINT_WIDTHS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

let classCounter = 0;

export function resetClassCounter(): void {
  classCounter = 0;
}

function generateClassName(tag: string): string {
  classCounter++;
  const n = String(classCounter).padStart(2, "0");
  return `_dsl_${tag}_${n}`;
}

export class InheritanceResolver {
  private responsiveClasses: ResponsiveClass[] = [];

  resolve(nodes: ChildNode[]): { resolved: ResolvedNode[]; responsiveClasses: ResponsiveClass[] } {
    classCounter = 0;
    this.responsiveClasses = [];
    const resolved = this.resolveChildren(nodes, {});
    return { resolved, responsiveClasses: this.responsiveClasses };
  }

  private resolveChildren(children: ChildNode[], inherited: StyleMap): ResolvedNode[] {
    const result: ResolvedNode[] = [];
    let pendingPropBlock: PropBlock | null = null;

    for (const child of children) {
      if (child.kind === "PropBlock") {
        pendingPropBlock = child;
        continue;
      }

      if (child.kind === "NodeDecl") {
        result.push(this.resolveNode(child, inherited, pendingPropBlock));
        pendingPropBlock = null;
        continue;
      }

      // ComponentCall não deveria chegar aqui (já expandido pelo SlotResolver)
      pendingPropBlock = null;
    }

    return result;
  }

  private resolveNode(node: NodeDecl, inherited: StyleMap, propBlock: PropBlock | null): ResolvedNode {
    // Coletar props do PropBlock
    const blockVisual: StyleMap = {};
    const blockAttrs: Record<string, string> = {};
    const blockResponsive: Record<string, StyleMap> = {};
    let blockEvents: Prop[] = [];

    if (propBlock) {
      this.classifyProps(propBlock.props, blockVisual, blockAttrs, blockResponsive, blockEvents);
    }

    // Coletar props inline
    const inlineVisual: StyleMap = {};
    const inlineAttrs: Record<string, string> = {};
    const inlineResponsive: Record<string, StyleMap> = {};
    let inlineEvents: Prop[] = [];

    if (node.inlineProps) {
      this.classifyProps(node.inlineProps, inlineVisual, inlineAttrs, inlineResponsive, inlineEvents);
    }

    // Mesclar: Herdado < PropBlock < Inline
    const mergedVisual: StyleMap = { ...inherited, ...blockVisual, ...inlineVisual };
    const mergedAttrs: Record<string, string> = { ...blockAttrs, ...inlineAttrs }; // attrs NÃO herdam
    const allEvents = [...blockEvents, ...inlineEvents];

    // Verificar se há props responsivas
    const hasResponsive = Object.keys(blockResponsive).length > 0 || Object.keys(inlineResponsive).length > 0;
    const mergedResponsive: Record<string, StyleMap> = {};

    if (hasResponsive) {
      for (const [bp, props] of Object.entries(blockResponsive)) {
        mergedResponsive[bp] = { ...(mergedResponsive[bp] || {}), ...props };
      }
      for (const [bp, props] of Object.entries(inlineResponsive)) {
        mergedResponsive[bp] = { ...(mergedResponsive[bp] || {}), ...props };
      }
    }

    let style: StyleMap | null = mergedVisual;
    let className: string | null = null;

    if (hasResponsive) {
      className = generateClassName(node.tag);
      const breakpoints: BreakpointBlock[] = [];

      for (const [bp, props] of Object.entries(mergedResponsive)) {
        breakpoints.push({
          breakpoint: bp as "sm" | "md" | "lg" | "xl",
          minWidth: BREAKPOINT_WIDTHS[bp],
          props,
        });
      }

      // Ordenar breakpoints
      breakpoints.sort((a, b) => a.minWidth - b.minWidth);

      this.responsiveClasses.push({
        className,
        baseProps: mergedVisual,
        breakpoints,
      });

      style = null; // Nó responsivo usa class em vez de style
    }

    // Recursar nos filhos — passando mergedVisual como contexto herdado
    const resolvedChildren = this.resolveChildren(node.children, mergedVisual);

    // Guardar eventos nos resolved nodes via propriedade temporária guardada em attrs especiais
    // (os eventos serão coletados pelo LogicResolver posteriormente)
    const resolvedNode: ResolvedNode & { _events?: Prop[]; _nodeId?: string | null } = {
      id: node.id,
      tag: node.tag,
      text: node.text,
      style,
      className,
      attrs: mergedAttrs,
      children: resolvedChildren,
    };

    // Anexar eventos como metadata temporária
    if (allEvents.length > 0) {
      (resolvedNode as any)._events = allEvents;
      (resolvedNode as any)._nodeId = node.id;
    }

    return resolvedNode;
  }

  private classifyProps(
    props: Prop[],
    visual: StyleMap,
    attrs: Record<string, string>,
    responsive: Record<string, StyleMap>,
    events: Prop[]
  ): void {
    for (const prop of props) {
      switch (prop.kind) {
        case "VisualProp":
          visual[prop.key] = prop.value;
          break;
        case "AttrProp":
          attrs[prop.name] = prop.value;
          break;
        case "ResponsiveProp":
          if (!responsive[prop.breakpoint]) responsive[prop.breakpoint] = {};
          responsive[prop.breakpoint][prop.key] = prop.value;
          break;
        case "EventProp":
          events.push(prop);
          break;
      }
    }
  }
}
