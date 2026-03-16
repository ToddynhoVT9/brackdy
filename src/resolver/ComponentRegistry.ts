import { ComponentDef } from "../parser/nodes/ASTNode";
import { SemanticError } from "../errors/CompilerError";

export class ComponentRegistry {
  private defs = new Map<string, ComponentDef>();

  register(def: ComponentDef): void {
    if (this.defs.has(def.name)) {
      throw new SemanticError(
        `Componente "${def.name}" está definido mais de uma vez`,
        def.line, def.col
      );
    }
    this.defs.set(def.name, def);
  }

  get(name: string, line: number, col: number): ComponentDef {
    const def = this.defs.get(name);
    if (!def) {
      throw new SemanticError(
        `Componente desconhecido: "${name}". Ele está definido antes desta chamada?`,
        line, col
      );
    }
    return def;
  }

  has(name: string): boolean {
    return this.defs.has(name);
  }
}
