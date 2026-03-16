import { EventProp } from "../parser/nodes/ASTNode";
import { ResolvedNode, EventBinding } from "./ResolvedTypes";
import { SemanticError } from "../errors/CompilerError";

export class LogicResolver {
  resolve(nodes: ResolvedNode[], logicFile: string | null): EventBinding[] {
    const bindings: EventBinding[] = [];
    this.collectEvents(nodes, bindings, logicFile);
    return bindings;
  }

  private collectEvents(nodes: ResolvedNode[], bindings: EventBinding[], logicFile: string | null): void {
    for (const node of nodes) {
      const events: EventProp[] = (node as any)._events || [];

      for (const event of events) {
        // Validar que @logic existe se há eventos
        if (!logicFile) {
          throw new SemanticError(
            `Evento "@${event.event}:${event.action}" encontrado mas nenhum arquivo de lógica declarado. Adicione "@logic \\"./seu.logic.ts\\"" no topo do arquivo`,
            event.line, event.col
          );
        }

        if (event.namespace !== null) {
          // Caminho explícito: @click:hero-section.openHero
          bindings.push({
            targetId: node.id,
            querySelector: null,
            domEvent: event.event,
            logicPath: event.namespace,
            methodName: event.action,
          });
        } else {
          // Caminho implícito: @click:openHero — requer id
          if (node.id === null) {
            throw new SemanticError(
              `Evento "@${event.event}:${event.action}" em nó sem id — use caminho explícito "@${event.event}:namespace.${event.action}"`,
              event.line, event.col
            );
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

      // Limpar metadata temporária
      delete (node as any)._events;
      delete (node as any)._nodeId;

      this.collectEvents(node.children, bindings, logicFile);
    }
  }
}
