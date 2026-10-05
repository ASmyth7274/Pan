// Builds a single self-contained HTML file of the game (inlined script,
// styles and font). Used for the instant-play link; the PWA itself is
// served from the repo as-is.
//   node tools/build-single.mjs [out.html] [--fragment]
// --fragment omits <!doctype>/<html>/<head>/<body> (for hosts that add them).
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || path.join(root, 'dist', 'pan-single.html');
fs.mkdirSync(path.dirname(out), { recursive: true });

const bundlePath = path.join(path.dirname(out), 'pan-bundle.js');
execSync(`npx --yes esbuild@0.24.0 "${path.join(root, 'js/main.js')}" --bundle --format=iife --target=es2020,safari15 --minify --legal-comments=none --outfile="${bundlePath}"`, { stdio: 'inherit' });
let js = fs.readFileSync(bundlePath, 'utf8');
fs.unlinkSync(bundlePath);
js = js.replace(/<\/script/gi, '<\\/script');

const font = fs.readFileSync(path.join(root, 'assets/fonts/fredoka.woff2')).toString('base64');
let css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')
  .replace("url('../assets/fonts/fredoka.woff2')", `url(data:font/woff2;base64,${font})`);

const markup = `<canvas id="world" aria-label="Game world"></canvas>
<div id="app"></div>
<div id="loading"><div class="logo">Pan!</div><div class="tagline">Prospecting Simulator</div><div class="bar"><i></i></div></div>`;

const head = `<title>Pan! Prospecting Simulator</title>
<meta name="description" content="Dig, pan and prospect for 160+ minerals across 13 shores.">
<style>${css}</style>`;
const html = fragment
  ? `${head}\n${markup}\n<script>${js}</script>\n`
  : `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n${head}</head>\n<body>\n${markup}\n<script>${js}</script>\n</body></html>\n`;
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
