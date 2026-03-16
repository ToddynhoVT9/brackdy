import {
  ComponentDef, ComponentCall, NodeDecl, SlotNodeDef,
  ChildNode, PropBlock, Prop, VisualProp, ComponentBodyNode,
} from "../parser/nodes/ASTNode";
import { ComponentRegistry } from "./ComponentRegistry";
import { SemanticError } from "../errors/CompilerError";

export class SlotResolver {
  private registry: ComponentRegistry;
  private expansionStack: Set<string> = new Set();

  constructor(registry: ComponentRegistry) {
    this.registry = registry;
  }

  expandAll(nodes: ChildNode[]): ChildNode[] {
    return nodes.map(node => this.expandNode(node)).flat();
  }

  private expandNode(node: ChildNode): ChildNode[] {
    if (node.kind === "ComponentCall") {
      return [this.expandComponentCall(node)];
    }
    if (node.kind === "NodeDecl") {
      return [this.expandNodeDecl(node)];
    }
    // PropBlock passa direto
    return [node];
  }

  private expandNodeDecl(node: NodeDecl): NodeDecl {
    const expandedChildren = node.children.map(child => this.expandNode(child)).flat();
    return { ...node, children: expandedChildren };
  }

  private expandComponentCall(call: ComponentCall): NodeDecl {
    // Detecção de ciclo
    if (this.expansionStack.has(call.name)) {
      throw new SemanticError(
        `Ciclo de componentes detectado: ${[...this.expansionStack, call.name].join(" → ")}`,
        call.line, call.col
      );
    }

    this.expansionStack.add(call.name);

    const def = this.registry.get(call.name, call.line, call.col);

    // Cópia profunda do corpo da definição
    const bodyClone = this.deepCloneBody(def.body);

    // Resolver slots de prop: montar o StyleMap efetivo
    const resolvedProps = this.resolvePropSlots(def, call);

    // Resolver slots de nó
    const resolvedNodeSlots = this.resolveNodeSlots(bodyClone, call);

    // O body[0] é o NodeDecl raiz do componente
    const rootNode = bodyClone[0] as NodeDecl;

    // Substituir SlotNodeDefs pelos nós resolvidos nos filhos
    const resolvedChildren = this.substituteSlotNodes(rootNode.children as ComponentBodyNode[], resolvedNodeSlots);

    // Montar PropBlock com os valores de slot resolvidos
    const propBlock: PropBlock = {
      kind: "PropBlock",
      props: resolvedProps,
      line: call.line,
      col: call.col,
    };

    // Expandir filhos extras da chamada
    const expandedExtras = call.extraChildren.map(child => this.expandNode(child)).flat();

    // Montar o NodeDecl final
    const result: NodeDecl = {
      kind: "NodeDecl",
      id: call.id || rootNode.id,
      tag: rootNode.tag,
      text: rootNode.text,
      inlineProps: rootNode.inlineProps,
      children: [propBlock, ...resolvedChildren, ...expandedExtras],
      line: call.line,
      col: call.col,
    };

    this.expansionStack.delete(call.name);

    return this.expandNodeDecl(result);
  }

  private resolvePropSlots(def: ComponentDef, call: ComponentCall): Prop[] {
    const props: VisualProp[] = [];

    for (const slot of def.propSlots) {
      const override = call.propOverrides.find(o => o.slotName === slot.slotName);
      props.push({
        kind: "VisualProp",
        key: slot.cssKey,
        value: override ? override.value : slot.defaultValue,
        line: slot.line,
        col: slot.col,
      });
    }

    return props;
  }

  private resolveNodeSlots(
    bodyNodes: ComponentBodyNode[],
    call: ComponentCall
  ): Map<string, { tag: string; text: string }> {
    const map = new Map<string, { tag: string; text: string }>();

    const collectSlots = (nodes: ComponentBodyNode[]) => {
      for (const node of nodes) {
        if (node.kind === "SlotNodeDef") {
          const override = call.slotOverrides.find(o => o.slotName === node.slotName);
          map.set(node.slotName, {
            tag: node.tag,
            text: override ? override.text : node.defaultText,
          });
        } else if (node.kind === "NodeDecl") {
          collectSlots(node.children as ComponentBodyNode[]);
        }
      }
    };

    collectSlots(bodyNodes);
    return map;
  }

  private substituteSlotNodes(
    children: ComponentBodyNode[],
    slots: Map<string, { tag: string; text: string }>
  ): ChildNode[] {
    const result: ChildNode[] = [];

    for (const child of children) {
      if (child.kind === "SlotNodeDef") {
        const resolved = slots.get(child.slotName);
        if (resolved) {
          result.push({
            kind: "NodeDecl",
            id: null,
            tag: resolved.tag,
            text: resolved.text,
            inlineProps: null,
            children: [],
            line: child.line,
            col: child.col,
          });
        }
      } else if (child.kind === "NodeDecl") {
        const newChildren = this.substituteSlotNodes(child.children as ComponentBodyNode[], slots);
        result.push({ ...child, children: newChildren });
      } else {
        result.push(child);
      }
    }

    return result;
  }

  private deepCloneBody(body: ComponentBodyNode[]): ComponentBodyNode[] {
    return JSON.parse(JSON.stringify(body));
  }
}
