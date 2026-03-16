export { Compiler, CompilerOptions, CompilerOutput } from "./compiler/Compiler";
export { Lexer } from "./lexer/Lexer";
export { Token } from "./lexer/Token";
export { TokenType } from "./lexer/TokenType";
export { Parser } from "./parser/Parser";
export { Resolver } from "./resolver/Resolver";
export { Generator } from "./generator/Generator";
export { CompilerError, LexerError, ParseError, SemanticError } from "./errors/CompilerError";
export * from "./parser/nodes/ASTNode";
export * from "./resolver/ResolvedTypes";

// Atalho de conveniência
import { Compiler } from "./compiler/Compiler";
import type { CompilerOptions, CompilerOutput } from "./compiler/Compiler";

export function compile(source: string, options?: CompilerOptions): CompilerOutput {
  const compiler = new Compiler();
  return compiler.compile(source, options);
}
