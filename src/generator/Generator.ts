import { ResolvedProgram } from "../resolver/ResolvedTypes";
import { HTMLGenerator } from "./HTMLGenerator";
import { CSSGenerator } from "./CSSGenerator";
import { JSGenerator } from "./JSGenerator";

export interface GeneratorOutput {
  html: string;
  css: string | null;
  bindings: string | null;
}

export class Generator {
  generate(resolved: ResolvedProgram): GeneratorOutput {
    const htmlGen = new HTMLGenerator();
    const cssGen = new CSSGenerator();
    const jsGen = new JSGenerator();

    const html = htmlGen.generate(resolved.nodes);

    const css = cssGen.generate(resolved.responsiveClasses);

    const bindings = (resolved.eventBindings.length > 0 && resolved.logicFile !== null)
      ? jsGen.generate(resolved.logicFile, resolved.eventBindings)
      : null;

    return { html, css, bindings };
  }
}
