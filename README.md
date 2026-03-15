# Brackdy

**Brackdy** is a modern UI DSL (Domain Specific Language) compiler designed to simplify web development. It transforms `.by` files into high-performance HTML, CSS, and TypeScript bindings.

## Features

- **Declarative UI**: Write UI components using a concise and expressive syntax.
- **Static Analysis**: Catch errors early with a built-in semantic analyzer.
- **Code Generation**: Generates clean, standard-compliant HTML and CSS.
- **Type-Safe Bindings**: Automatically generates TypeScript bindings for interactive elements.
- **CLI Support**: Easy-to-use command-line interface for compiling files and watching for changes.

## Installation

```bash
npm install
npm run build
```

## Usage

You can use the Brackdy CLI to compile your source files:

```bash
npx brackdy <source.by> --out-dir ./dist --wrap
```

### Options

- `--out-dir <path>`: Specify the output directory.
- `--wrap`: Wrap the output in a full HTML document.
- `--watch`: Watch for changes in the source file.
- `--no-css`: Do not generate CSS.
- `--no-bindings`: Do not generate TypeScript bindings.
- `--logic <path>`: Override the logic file declared in the source.

## Project Structure

- `src/`: Core compiler logic (Lexer, Parser, Analyzer, Codegen).
- `cli/`: Command-line interface implementation.
- `tests/`: Integration and unit tests.
- `scripts/`: Utility scripts for development.

## Development

- `npm run dev`: Run the compiler in development mode using `tsx`.
- `npm test`: Run the test suite using `vitest`.
- `npm run build`: Compile the TypeScript source into the `dist/` folder.

## License

MIT
