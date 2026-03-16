import { Program } from "../parser/nodes/ASTNode";
import { ResolvedProgram } from "./ResolvedTypes";
import { ComponentRegistry } from "./ComponentRegistry";
import { SlotResolver } from "./SlotResolver";
import { InheritanceResolver } from "./InheritanceResolver";
import { LogicResolver } from "./LogicResolver";

export class Resolver {
  resolve(program: Program): ResolvedProgram {
    // Fase 1: Registrar componentes
    const registry = new ComponentRegistry();
    for (const def of program.definitions) {
      registry.register(def);
    }

    // Fase 2: Expandir chamadas de componentes
    const slotResolver = new SlotResolver(registry);
    const expandedBody = slotResolver.expandAll(program.body as any);

    // Fase 3: Resolver herança de propriedades + responsividade
    const inheritanceResolver = new InheritanceResolver();
    const { resolved, responsiveClasses } = inheritanceResolver.resolve(expandedBody);

    // Fase 4: Coletar e validar bindings de eventos
    const logicResolver = new LogicResolver();
    const eventBindings = logicResolver.resolve(resolved, program.logicFile);

    return {
      logicFile: program.logicFile,
      nodes: resolved,
      responsiveClasses,
      eventBindings,
    };
  }
}
