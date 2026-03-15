import { compile } from '../src/index.js';
import * as fs from 'fs';

const { html, bindings } = compile(
  '@logic "./page.logic"\n(color:#FFFFFF)\n[#app::main |> @click:init]',
  {
    wrap: true,
    title: "App",
    cssFileName: "app.css",
    bindingsFileName: "app.bindings.js"
  }
);

fs.writeFileSync('dump4.html', html, 'utf-8');
