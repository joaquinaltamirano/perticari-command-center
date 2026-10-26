import { build } from 'esbuild';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/client/main.jsx'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/app.js',loader:{'.css':'css'},logLevel:'warning'});
const [js,css,html]=await Promise.all([readFile('dist/app.js','utf8'),readFile('dist/app.css','utf8'),readFile('src/client/index.html','utf8')]);
const assets={'/app':{type:'text/html;charset=utf-8',body:html},'/app/assets/app.js':{type:'application/javascript;charset=utf-8',body:js},'/app/assets/app.css':{type:'text/css;charset=utf-8',body:css}};
await build({entryPoints:['src/server/worker.mjs'],bundle:true,format:'esm',target:'es2022',outfile:'dist/worker.js',loader:{'.sql':'text'},plugins:[{name:'assets',setup(b){b.onResolve({filter:/^virtual:assets$/},()=>({path:'assets',namespace:'assets'}));b.onLoad({filter:/.*/,namespace:'assets'},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}}],logLevel:'warning'});
console.log('Aplicación y Worker compilados en dist/. Sin datos comerciales incorporados.');
