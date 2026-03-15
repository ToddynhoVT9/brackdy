#!/usr/bin/env node
// ─── Brackdy Compiler — CLI Entry Point ──────────────────────────────
// Usage: brackdy <file.by> [options]
// See: prompt-cli-tests.md §2

import * as fs from "fs";
import * as path from "path";
import { compile } from "../src/index.js";
import { BrackdyError } from "../src/errors/errors.js";

// ─── Version ─────────────────────────────────────────────────────────

const VERSION = "0.3.0";

// ─── Argument Parsing ────────────────────────────────────────────────

interface CliFlags {
  inputFile: string | null;
  outDir: string | null;
  logic: string | null;
  wrap: boolean;
  noCss: boolean;
  noBindings: boolean;
  verbose: boolean;
  version: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {
    inputFile: null,
    outDir: null,
    logic: null,
    wrap: false,
    noCss: false,
    noBindings: false,
    verbose: false,
    version: false,
    help: false,
  };

  const args = argv.slice(2); // skip node + script
  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--version" || arg === "-v") {
      flags.version = true;
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--wrap") {
      flags.wrap = true;
    } else if (arg === "--no-css") {
      flags.noCss = true;
    } else if (arg === "--no-bindings") {
      flags.noBindings = true;
    } else if (arg === "--verbose") {
      flags.verbose = true;
    } else if (arg === "--out-dir") {
      i++;
      if (i >= args.length) {
        console.error("Error: --out-dir requires a directory argument");
        process.exit(2);
      }
      flags.outDir = args[i];
    } else if (arg === "--logic") {
      i++;
      if (i >= args.length) {
        console.error("Error: --logic requires a file argument");
        process.exit(2);
      }
      flags.logic = args[i];
    } else if (arg.startsWith("-")) {
      console.error(`Error: Unknown flag "${arg}"`);
      process.exit(2);
    } else {
      flags.inputFile = arg;
    }

    i++;
  }

  return flags;
}

// ─── Help Text ───────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
Brackdy Compiler v${VERSION}

Usage:
  brackdy <file.by> [options]

Options:
  --out-dir <dir>     Output directory (default: same as input file)
  --logic <file>      Override @logic path declared in source
  --wrap              Wrap HTML in a full document (<!DOCTYPE>, <head>, <body>)
  --no-css            Do not generate .css output file
  --no-bindings       Do not generate .bindings.ts output file
  --verbose           Print AST and ResolvedProgram to console
  --version, -v       Print version
  --help, -h          Show this help message
  `.trim());
}

// ─── Main ────────────────────────────────────────────────────────────

function main(): void {
  const flags = parseArgs(process.argv);

  if (flags.version) {
    console.log(`brackdy v${VERSION}`);
    process.exit(0);
  }

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (!flags.inputFile) {
    console.error("Error: No input file specified. Use --help for usage.");
    process.exit(2);
  }

  // Read input file
  const inputPath = path.resolve(flags.inputFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(2);
  }

  const source = fs.readFileSync(inputPath, "utf-8");
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outDir = flags.outDir
    ? path.resolve(flags.outDir)
    : path.dirname(inputPath);

  // Compile
  try {
    const output = compile(source, {
      filename: inputPath,
      outDir,
      logicFileOverride: flags.logic ?? undefined,
      wrap: flags.wrap,
      title: baseName,
      cssFileName: flags.noCss ? undefined : `${baseName}.css`,
      bindingsFileName: flags.noBindings ? undefined : `${baseName}.bindings.js`,
    });

    // Verbose output
    if (flags.verbose) {
      const { Lexer } = require("../src/lexer/lexer.js");
      const { Parser } = require("../src/parser/parser.js");
      const { analyze } = require("../src/analyzer/index.js");
      const tokens = new Lexer(source).tokenize();
      const program = new Parser(tokens).parse();
      const resolved = analyze(program);
      console.log("\n─── AST ───");
      console.dir(program, { depth: null });
      console.log("\n─── Resolved Program ───");
      console.dir(resolved, { depth: null });
    }

    // Create output directory
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Write HTML
    const hasCss = output.css !== null && !flags.noCss;
    const hasBindings = output.bindings !== null && !flags.noBindings;

    fs.writeFileSync(path.join(outDir, `${baseName}.html`), output.html, "utf-8");
    console.log(`✓ ${baseName}.html`);

    // Write CSS
    if (hasCss) {
      fs.writeFileSync(
        path.join(outDir, `${baseName}.css`),
        output.css!,
        "utf-8",
      );
      console.log(`✓ ${baseName}.css`);
    }

    // Write Bindings
    if (hasBindings) {
      fs.writeFileSync(
        path.join(outDir, `${baseName}.bindings.ts`),
        output.bindings!,
        "utf-8",
      );
      console.log(`✓ ${baseName}.bindings.ts`);
    }

    // Write Logic Stub if generated and file doesn't exist
    if (output.logicStub) {
      const stubPath = path.resolve(outDir, output.logicStub.path);
      if (!fs.existsSync(stubPath)) {
        // Ensure directory for logic stub exists (it might be in a subfolder relative to outDir)
        const stubDir = path.dirname(stubPath);
        if (!fs.existsSync(stubDir)) {
          fs.mkdirSync(stubDir, { recursive: true });
        }
        
        fs.writeFileSync(stubPath, output.logicStub.content, "utf-8");
        console.log(`✓ ${output.logicStub.path} (stub)`);
      }
    }

    process.exit(0);
  } catch (err) {
    if (err instanceof BrackdyError) {
      console.error(`\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}

main();
