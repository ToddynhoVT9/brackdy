import { compile } from '../src/index.js';
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
console.log(html);
