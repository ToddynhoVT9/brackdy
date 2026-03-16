import { compile } from "../src/index";

const { bindings } = compile(`
@logic "./page.logic.ts"
[#hero-section::section |> @click:openHero
  [h1 "Título"]
]
`);

console.log("=== BINDINGS OUTPUT ===");
console.log(bindings);
