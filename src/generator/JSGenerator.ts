import { EventBinding } from "../resolver/ResolvedTypes";

export class JSGenerator {
  generate(logicFile: string, bindings: EventBinding[]): string | null {
    if (bindings.length === 0) return null;

    const lines: string[] = [];

    // Import do arquivo de lógica
    lines.push(`import { logic } from "${logicFile}";`);
    lines.push("");
    lines.push(`document.addEventListener("DOMContentLoaded", () => {`);

    for (const binding of bindings) {
      if (binding.targetId !== null) {
        lines.push(`  document.getElementById("${binding.targetId}")`);
        lines.push(`    .addEventListener("${binding.domEvent}", () => logic["${binding.logicPath}"].${binding.methodName}());`);
      } else {
        // Sem id — emitir aviso
        lines.push(`  // AVISO: evento @${binding.domEvent}:${binding.logicPath}.${binding.methodName} em nó sem id — wiring manual necessário`);
      }
    }

    lines.push(`});`);

    return lines.join("\n");
  }
}
