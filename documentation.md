# Documentação Oficial — Linguagem Brackdy (v0.3)

Brackdy é uma DSL (Domain Specific Language) concebida para a descrição declarativa de interfaces. Ela foca na separação explícita entre estrutura semântica, estilo visual, eventos e atributos HTML, mantendo uma sintaxe limpa e sem overhead de runtime.

---

## 1. Estrutura Fundamental

A unidade fundamental da linguagem funciona na relação entre blocos de **propriedades** e blocos **estruturais**.
Toda construção nasce da sequência:

```txt
(propriedades opcionais)
[nó obrigatório]
```

O bloco `()` opcional SEMPRE modifica o bloco estrutural `[]` imediatamente a seguir. Sem um nó `[]`, o bloco `()` é inválido.

**Exemplo Básico:**
```txt
(
  background:#121212
  color:#FFFFFF
)
[main]
```

---

## 2. Definindo Nós Estruturais

Os nós representam as tags HTML que serão renderizadas. Você estrutura a interface com nós simples, textos, ou aninhamento de filhos.

**Nó Simples**
```txt
[section]
```

**Nó de Texto**
Formato: `[tag "texto interno"]`
```txt
[h1 "Bem-vindo ao Brackdy"]
[p "Parágrafo simples."]
```

**Nó com Filhos**
Nós podem conter outros nós aninhados.
```txt
[main
  [section
    [h1 "Meu Título"]
    [p "Nó filho aninhado dentro do section."]
  ]
]
```

---

## 3. Identificadores Explicitos (IDs)

Os identificadores são inseridos imediatamente após a abertura do bloco do nó, utilizando o prefixo `#` e separados do nome da tag por `::`.
*(Nota técnica: Antigamente usava-se o hífen `-`, na versão atual v0.3 consolidada utiliza-se o separador duplo dois-pontos `::`).*

**Forma Canônica:**
```txt
[#meunomedeid::tag]
```

**Características do ID:**
- Inicia com `#`
- Pode conter letras (a-z, A-Z), números (0-9) e underscores `_`
- Separado da tag por `::` (como `#hero-section::section`)

Exemplos Válidos:
```txt
[#heroMain::section]
[#btn_submit::button]
```

---

## 4. Ordem Canônica Interna do Nó

Dentro de um `[]`, a declaração segue obrigatoriamente esta ordem:
1. `#id` opcional e separador `::`
2. `tag` obrigatória
3. Bloco de propriedades inline `|>` opcional
4. Texto `"texto"` opcional
5. Nós filhos opcionais (um nó não pode ter texto inline e filhos simultaneamente)

Exemplo com todos os elementos opcionais (exceto filhos):
```txt
[#meu-id::section |> background:#000 color:#FFF "Meu texto"]
```

---

## 5. Propriedades e Sintaxe Inline

### Bloco `()`
Estilos e modificadores clássicos. Cada linha representa uma nova propriedade.
```txt
(
  background:#121212
  color:#FFFFFF
  padding:24px
)
[main]
```

### Propriedades Inline `|>`
Sintaxe rápida para quando o nó possui poucas modificações visuais, atributos ou eventos. As propriedades definidas no `|>` têm **prioridade de mesclagem superior** às propriedades agrupadas no `()`.

```txt
[section |> background:#181818 padding:32px]
```

---

## 6. Famílias de Propriedades

O Brackdy classifica de forma visual o tipo de modificador a ser aplicado no nó.

### 6.1 Propriedades Visuais (CSS)
Escritas de forma tradicional, essas propriedades vão compor as regras CSS exclusivas do elemento.
```txt
background:#121212
padding:24px
display:grid
gap:16px
```

### 6.2 Eventos (`@`)
Diretivas interativas que mapeiam ações JS nativas para o seu controlador.
Formato: `@evento:acao` ou `@evento:namespace.acao`
```txt
@click:submit
@change:syncInput
@input:form.atualizarCampo
```

### 6.3 Atributos HTML Extensos (`$`)
Diretivas mapeadas diretamente como propriedades e atributos HTML nativos.
```txt
$href:"/home"
$type:"button"
$alt:"Descrição da Imagem"
```

---

## 7. Herança Semântica e Restrições

Diferente de sistemas de frontend reativos padrão, o Brackdy aplica herança de maneira muito estrita para proteger a integridade dos layouts.
O nó filho herda referências do seu pai **APENAS** para propriedades visuais de texto.

**São herdáveis:**
- `color`
- `font-size`
- `font-family`
- `font-weight`
- `text-align`
- `line-height`

**NÃO são herdáveis:**
Todo o resto! Atributos relacionados a caixa e layout, como `padding`, `margin`, `display`, `gap`, não "vazam" do pai para o filho.
Atributos nativos HTML (`$`) e Eventos (`@`) tampouco são herdados; aplicam-se apenas à tag declarante.

Além disso, um filho sempre pode sobrescrever propriedades usando seu próprio bloco de características.

```txt
(
  color:#FFFFFF
)
[main
  (color:#FF0000)
  [p "Serei vermelho. Sobrescrevi o Pai."]
]
```

---

## 8. Responsividade

Você pode descrever variações visuais atreladas a media queries apenas prefixando a propriedade com um breakpoint.

### Breakpoints Padrões
- `sm`: (min-width: 640px)
- `md`: (min-width: 768px)
- `lg`: (min-width: 1024px)
- `xl`: (min-width: 1280px)

```txt
(
  display:grid
  grid-template-columns:1fr
  md.grid-template-columns:1fr 1fr
  lg.grid-template-columns:1fr 1fr 1fr
)
[main]
```
As classes responsivas serão criadas e otimizadas de forma automática pelo compilador.

---

## 9. Eventos e Runtime Lógico

A vinculação interativa deve apontar para uma lógica de controle externa via a tag de carregamento:

```txt
@logic "./meucodigo.logic.ts"
```
Declara-se esta diretiva no topo do código. Pelo fato do parser avaliar estritamente dependências, todos os identificadores de eventos dispararão falha de compilação sem esta diretiva.

### Acoplamento por ID (Recomendado)
Eventos devem possuir um nó estrutural de origem claro. A resolução de métodos em arquivo buscará a entrada pelo `<id>` do Nó associado.

```txt
[#formSubmit::button |> @click:processar]
```
Isto resolve automaticamente para o ouvinte:
```ts
logic["formSubmit"].processar()
```

### Caminho de Namespace Explícito
Caso utilize eventos num nó "rápido" (sem ID configurado), é obrigatório o uso de sub-namespace absoluto indicando em que registro lógico do JS o evento deve ser invocado:

```txt
[button |> @click:btnGlobal.acaoSecundaria]
```
Irá resolver-se em `logic["btnGlobal"].acaoSecundaria()`.

**Atenção:** Em nós anônimos, a emissão de bindings ocorrerá com um AVISO (Warning) do Compilador para `wiring` (preensão JS manual), por se tratarem de nós órfãos de ID local para lookup via `document.getElementById()`.

---

## 10. Arquitetura de Componentes e Slots

Componentes isolam padrões de estrutura em abstrações reaproveitáveis, com o auxílio de varáveis (slots) expandidas estritamente durante o tempo de compilação.

### Definição (`>>`)
Componentes se definem usando prefixo `>>` e regras imperativas estritas **PascalCase**. Podem incluir um agrupamento `()` opcional de parâmetros de Slots de Propriedades, e filhos que possuam Slots de Nó.

```txt
[>>Card
  (
    <bg>background:#1E1E1E
  )
  [article
    [<title>h2 "Padrão"]
    [<body>p "Conteúdo Base"]
  ]
]
```
- `<nomeSlot>prop:valor` declara que `<nomeSlot>` atende a uma prop visual.
- `[<nomeSlot>tag "default"]` declara que `<nomeSlot>` compila no recheio literário daquela Tag estrutural.

### Chamada (Expandir: `>`)
Ao invocar o prefixo `>`, as posições são fundidas/sobrescritas no parser:
```txt
[>Card
  (<bg:#FF0000>)
  [<title "Título Diferente", body "Substituindo p">]
]
```

### Chamada Simples
Caso sem parâmetros, a declaração usa o Default definido:
```txt
[>Card] // Usa #1E1E1E "Padrão", "Conteúdo Base"
```

**Regras Vitais de Componentes (v0.3):**
- Proibida a declaração recursiva cruzada complexa em definições; falha no parse imediatamente.
- Componentes não geram tags agrupadoras vazias se não for parte explícita de seu root Node.
- Os Slots de nós modificam estritamente o `texto inline` da tag.

---

## 11. Boas Práticas Estéticas

- Evite filhos de bloco se estiver configurando strings inline num nó literário curit.
  ```txt
  [h1 "O melhor Título"] <!-- Sim -->
  [h1 "Ruim" [p "Evite"]] <!-- Não (Dispara erro de Parse) -->
  ```
- Exija coesão. O Brackdy quer ser "semântico primeiro", favorecendo que propriedades não estruturais evitem entulhar os blocos e favorecendo componentização se um nó exceder 4 repetições complexas.
