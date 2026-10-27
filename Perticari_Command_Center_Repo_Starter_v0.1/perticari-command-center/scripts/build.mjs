import { build } from 'esbuild';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/client/main.jsx'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:'dist/app.js',loader:{'.css':'css','.png':'dataurl','.svg':'dataurl'},logLevel:'warning'});
const [js,css,html]=await Promise.all([readFile('dist/app.js','utf8'),readFile('dist/app.css','utf8'),readFile('src/client/index.html','utf8')]);
const assets={'/app/assets/version.json':{type:'application/json',body:JSON.stringify({version:'3.0.0',built_at:new Date().toISOString()})},'/app':{type:'text/html;charset=utf-8',body:html},'/app/assets/app.js':{type:'application/javascript;charset=utf-8',body:js},'/app/assets/app.css':{type:'text/css;charset=utf-8',body:css}};
for(const [name,type] of [['pcc-sw.js','application/javascript;charset=utf-8'],['pcc-manifest.webmanifest','application/manifest+json'],['pcc-icon.svg','image/svg+xml']])assets['/app/assets/'+name]={type,body:await readFile('src/client/'+name,'utf8')};
await build({entryPoints:['src/server/worker.mjs'],bundle:true,format:'esm',target:'es2022',outfile:'dist/worker.js',loader:{'.sql':'text'},plugins:[{name:'assets',setup(b){b.onResolve({filter:/^virtual:assets$/},()=>({path:'assets',namespace:'assets'}));b.onLoad({filter:/.*/,namespace:'assets'},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}}],logLevel:'warning'});
console.log('Aplicación y Worker compilados en dist/. Sin datos comerciales incorporados.');
