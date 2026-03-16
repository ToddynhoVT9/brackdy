import { describe, it, expect } from "vitest";
import { compile } from "../../src/index";

describe("Brackdy Compiler — Testes de Integração", () => {

  // ─── Exemplo Básico: nó simples ───
  it("deve compilar um nó simples sem propriedades", () => {
    const { html } = compile(`[section]`);
    expect(html).toBe(`<section></section>`);
  });

  // ─── Nó com texto ───
  it("deve compilar nó com texto inline", () => {
    const { html } = compile(`[h1 "Título"]`);
    expect(html).toBe(`<h1>Título</h1>`);
  });

  // ─── Nó com filhos ───
  it("deve compilar nó com filhos aninhados", () => {
    const { html } = compile(`
[main
  [h1 "Título"]
  [p "Descrição"]
]
    `);
    expect(html).toContain(`<main>`);
    expect(html).toContain(`<h1>Título</h1>`);
    expect(html).toContain(`<p>Descrição</p>`);
    expect(html).toContain(`</main>`);
  });

  // ─── PropBlock com estilo ───
  it("deve aplicar propriedades visuais via PropBlock", () => {
    const { html } = compile(`
(
  background:#121212
  color:#FFFFFF
)
[main]
    `);
    expect(html).toContain(`style="background:#121212; color:#FFFFFF"`);
  });

  // ─── Herança de propriedades ───
  it("deve herdar propriedades visuais do pai para o filho", () => {
    const { html } = compile(`
(
  color:#FFFFFF
)
[main
  [p "Texto"]
]
    `);
    expect(html).toContain(`<p style="color:#FFFFFF">Texto</p>`);
  });

  // ─── Sobrescrita ───
  it("deve sobrescrever propriedades do pai com as do filho", () => {
    const { html } = compile(`
(
  background:#121212
  color:#FFFFFF
  padding:24px
)
[main
  (
    background:#1E1E1E
    padding:16px
  )
  [article
    [h2 "Subbloco"]
    [p "Conteúdo"]
  ]
]
    `);
    // article deve ter background:#1E1E1E (sobrescrito) e color:#FFFFFF (herdado)
    expect(html).toContain(`background:#1E1E1E`);
    expect(html).toContain(`color:#FFFFFF`);
  });

  // ─── Nó com ID ───
  it("deve compilar nó com id explícito", () => {
    const { html } = compile(`[#hero-section::section]`);
    expect(html).toBe(`<section id="hero-section"></section>`);
  });

  // ─── Props Inline |> ───
  it("deve suportar propriedades inline com |>", () => {
    const { html } = compile(`[section |> background:#181818 padding:32px]`);
    expect(html).toContain(`style="background:#181818; padding:32px"`);
  });

  // ─── Atributos HTML nativos ───
  it("deve emitir atributos HTML nativos com $", () => {
    const { html } = compile(`
(
  $href:"/docs"
)
[a "Documentação"]
    `);
    expect(html).toContain(`href="/docs"`);
    expect(html).toContain(`Documentação`);
  });

  // ─── Responsividade ───
  it("deve gerar CSS responsivo para breakpoints", () => {
    const { html, css } = compile(`
(
  display:grid
  grid-template-columns:1fr
  md.grid-template-columns:1fr 1fr
  lg.grid-template-columns:1fr 1fr 1fr
)
[main]
    `);
    expect(css).not.toBeNull();
    expect(css).toContain(`@media (min-width: 768px)`);
    expect(css).toContain(`@media (min-width: 1024px)`);
    expect(html).toContain(`class="`);
  });

  // ─── Eventos com @logic ───
  it("deve gerar bindings de eventos quando @logic declarado", () => {
    const { bindings } = compile(`
@logic "./page.logic.ts"
[#hero-section::section |> @click:openHero
  [h1 "Título"]
]
    `);
    expect(bindings).not.toBeNull();
    expect(bindings).toContain(`addEventListener("click"`);
    expect(bindings).toContain(`logic["hero-section"].openHero()`);
    expect(bindings).toContain(`getElementById("hero-section")`);
  });

  // ─── Evento com namespace explícito ───
  it("deve gerar bindings para eventos com namespace explícito", () => {
    const { bindings } = compile(`
@logic "./page.logic.ts"
[section |> @click:hero-section.openHero
  [h1 "Título"]
]
    `);
    expect(bindings).not.toBeNull();
    // Nó sem id com namespace explícito: JSGenerator emite aviso
    expect(bindings).toContain(`hero-section`);
    expect(bindings).toContain(`openHero`);
  });

  // ─── Erro: evento sem id e sem namespace ───
  it("deve lançar erro semântico para evento sem id e sem namespace", () => {
    expect(() => compile(`
@logic "./page.logic.ts"
[section |> @click:openHero
  [h1 "Título"]
]
    `)).toThrow(/sem id/);
  });

  // ─── Erro: evento sem @logic ───
  it("deve lançar erro quando eventos existem sem @logic", () => {
    expect(() => compile(`
[#btn::button |> @click:submit]
    `)).toThrow(/nenhum arquivo de lógica/);
  });

  // ─── Componentes: definição e chamada simples ───
  it("deve expandir componentes com slots de prop e nó", () => {
    const { html } = compile(`
[>>Card
  (
    <bg>background:#1E1E1E
    <pad>padding:16px
  )
  [article
    [<title>h2 "Título padrão"]
    [<body>p "Conteúdo padrão"]
  ]
]

[>Card]
    `);
    expect(html).toContain(`<article`);
    expect(html).toContain(`background:#1E1E1E`);
    expect(html).toContain(`Título padrão`);
    expect(html).toContain(`Conteúdo padrão`);
  });

  // ─── Componente com sobrescrita de slots ───
  it("deve sobrescrever slots na chamada do componente", () => {
    const { html } = compile(`
[>>Card
  (
    <bg>background:#1E1E1E
  )
  [article
    [<title>h2 "Título padrão"]
    [<body>p "Conteúdo padrão"]
  ]
]

[>Card
  (<bg:#ffffff>)
  [<title "Novo Título", body "Novo Conteúdo">]
]
    `);
    expect(html).toContain(`background:#ffffff`);
    expect(html).toContain(`Novo Título`);
    expect(html).toContain(`Novo Conteúdo`);
  });

  // ─── CSS null quando sem responsividade ───
  it("não deve gerar CSS quando não há props responsivas", () => {
    const { css } = compile(`
(
  background:#121212
)
[main]
    `);
    expect(css).toBeNull();
  });

  // ─── Bindings null quando sem eventos ───
  it("não deve gerar bindings quando não há eventos", () => {
    const { bindings } = compile(`[main [h1 "Hello"]]`);
    expect(bindings).toBeNull();
  });

});
