// ─── Brackdy Codegen — TypeScript Bindings Emitter ──────────────────
// See: brackdy-compiler-plan/05-codegen.md

import type { EventBinding } from "../analyzer/resolved.js";

/**
 * Emits TypeScript event binding code and generates a stub for the logic file.
 * Returns null if there are no bindings or no logic file.
 */
export function emitBindings(
  logicFile: string,
  bindings: EventBinding[],
): { code: string; logicStub: { path: string; content: string } } | null {
  if (bindings.length === 0) return null;

  const lines: string[] = [];

  // Remove .ts extension if present, so we don't end up with import "...logic.ts.ts"
  const importPath = logicFile.endsWith(".ts") 
    ? logicFile.slice(0, -3) 
    : logicFile;

  // ESM import
  lines.push(`import { logic } from "${importPath}";`);
  lines.push("");

  for (const b of bindings) {
    if (b.targetId !== null) {
      // Standard binding with getElementById
      lines.push(
        `document.getElementById("${b.targetId}")` +
        `\n  ?.addEventListener("${b.domEvent}", (e) => logic["${b.logicPath}"].${b.methodName}(e));`,
      );
    } else {
      // No targetId — emit warning comment (v0.3 limitation)
      lines.push(
        `// WARNING: Event @${b.domEvent}:${b.logicPath}.${b.methodName} on node without id — manual wiring required`,
      );
    }
  }

  // Generate logic stub content
  const stubLines: string[] = [];
  stubLines.push(`// Stub de lógica gerado automaticamente pelo compilador Brackdy`);
  stubLines.push(`// Implemente aqui os handlers de eventos usados no componente`);
  stubLines.push(``);
  stubLines.push(`export const logic = {`);

  // Group by logicPath
  const paths = new Set<string>();
  bindings.forEach(b => paths.add(b.logicPath));

  paths.forEach(p => {
    stubLines.push(`  "${p}": {`);
    
    // Find unique methods for this path
    const methods = new Set<string>();
    bindings.filter(b => b.logicPath === p).forEach(b => methods.add(b.methodName));

    methods.forEach(m => {
      stubLines.push(`    ${m}(event?: Event) {`);
      stubLines.push(`      // TODO: implemente a lógica`);
      stubLines.push(`    },`);
    });

    stubLines.push(`  },`);
  });

  stubLines.push(`};`);

  return {
    code: lines.join("\n"),
    logicStub: {
      path: logicFile.endsWith(".ts") ? logicFile : `${logicFile}.ts`,
      content: stubLines.join("\n")
    }
  };
}
