import { program } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname, basename, join } from "path";
import { Compiler } from "../src/compiler/Compiler";

program
  .name("brackdy")
  .description("Brackdy DSL Compiler — Compila arquivos .by em HTML, CSS e TypeScript bindings")
  .version("0.3.0")
  .argument("<input>", "Caminho para o arquivo .by")
  .option("--out-dir <dir>", "Diretório de saída (padrão: mesmo diretório)")
  .option("--logic <file>", "Substitui a declaração @logic")
  .option("--wrap", "Envolve a saída em um documento HTML completo", false)
  .option("--no-css", "Suprime a saída .css")
  .option("--no-bindings", "Suprime a saída .bindings.ts")
  .option("--verbose", "Imprime dados de debug no stdout", false)
  .action((input: string, opts: any) => {
    try {
      const inputPath = resolve(input);

      if (!existsSync(inputPath)) {
        console.error(`[ERRO] Arquivo não encontrado: ${inputPath}`);
        process.exit(2);
      }

      const source = readFileSync(inputPath, "utf-8");
      const baseName = basename(inputPath, ".by");
      const outDir = opts.outDir ? resolve(opts.outDir) : dirname(inputPath);

      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      const compiler = new Compiler();
      const result = compiler.compile(source, {
        filename: baseName,
        outDir,
        logicFileOverride: opts.logic,
      });

      if (opts.verbose) {
        console.log("[Brackdy] Compilação bem-sucedida");
      }

      // --- HTML ---
      let htmlOutput = result.html;

      if (opts.wrap) {
        const cssLink = result.css ? `  <link rel="stylesheet" href="${baseName}.css">` : "";
        const jsScript = result.bindings ? `  <script type="module" src="${baseName}.bindings.js"></script>` : "";

        htmlOutput = [
          `<!DOCTYPE html>`,
          `<html lang="pt-BR">`,
          `<head>`,
          `  <meta charset="UTF-8">`,
          `  <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
          `  <title>${baseName}</title>`,
          cssLink,
          `</head>`,
          `<body>`,
          htmlOutput.split("\n").map(l => "  " + l).join("\n"),
          jsScript,
          `</body>`,
          `</html>`,
        ].filter(l => l).join("\n");
      }

      writeFileSync(join(outDir, `${baseName}.html`), htmlOutput, "utf-8");
      if (opts.verbose) console.log(`  → ${baseName}.html`);

      // --- CSS ---
      if (result.css && opts.css !== false) {
        writeFileSync(join(outDir, `${baseName}.css`), result.css, "utf-8");
        if (opts.verbose) console.log(`  → ${baseName}.css`);
      }

      // --- Bindings ---
      if (result.bindings && opts.bindings !== false) {
        writeFileSync(join(outDir, `${baseName}.bindings.ts`), result.bindings, "utf-8");
        if (opts.verbose) console.log(`  → ${baseName}.bindings.ts`);
      }

      console.log(`✓ Compilado: ${baseName}.by`);
      process.exit(0);

    } catch (err: any) {
      console.error(err.message || err);
      process.exit(1);
    }
  });

program.parse();
