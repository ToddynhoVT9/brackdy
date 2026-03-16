import { Lexer } from "../lexer/Lexer";
import { Parser } from "../parser/Parser";
import { Resolver } from "../resolver/Resolver";
import { Generator, GeneratorOutput } from "../generator/Generator";

export interface CompilerOptions {
  filename?: string;
  outDir?: string;
  logicFileOverride?: string;
}

export interface CompilerOutput extends GeneratorOutput {
  // html, css, bindings herdados de GeneratorOutput
}

export class Compiler {
  compile(source: string, options?: CompilerOptions): CompilerOutput {
    // Fase 1: Lexer
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // Fase 2: Parser
    const parser = new Parser(tokens);
    const program = parser.parse();

    // Override de logicFile se passado via opções
    if (options?.logicFileOverride) {
      program.logicFile = options.logicFileOverride;
    }

    // Fase 3: Resolver
    const resolver = new Resolver();
    const resolved = resolver.resolve(program);

    // Fase 4: Generator
    const generator = new Generator();
    return generator.generate(resolved);
  }
}
