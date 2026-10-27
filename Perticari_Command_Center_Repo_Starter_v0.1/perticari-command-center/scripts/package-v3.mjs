import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const target='/workspace/perticari-delivery/v3',release=resolve('../../releases/v3');await mkdir(target,{recursive:true});await mkdir(release,{recursive:true});
await copyFile('dist/worker.js',join(target,'Worker_Perticari_V3.js'));await copyFile('dist/worker.js',join(release,'Worker_Perticari_V3.js'));
for(const name of ['PROBAR_V3.md','ENTREGA_V3.md','ESTADO_V3.md','V3_INTEGRACIONES_FUENTES.md','VALIDACION_V3.md'])await copyFile('docs/'+name,join(target,name));
const bundle=await readFile('dist/worker.js');const manifest={version:'3.0.0',created_at:new Date().toISOString(),sha256:createHash('sha256').update(bundle).digest('hex'),bytes:bundle.length,production_deployed:false,contains_customer_data:false};
await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2));await writeFile(join(release,'manifest.json'),JSON.stringify(manifest,null,2));
await copyFile('docs/PROBAR_V3.md',join(release,'LEEME.md'));
execFileSync('python',['-c',`import zipfile,pathlib
root=pathlib.Path('/workspace/perticari-delivery/v3')
with zipfile.ZipFile(root.parent/'Perticari_V3_actualizacion.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.iterdir()):
  if p.is_file(): z.write(p,p.name)
`]);
const sourceRoot=process.cwd();execFileSync('python',['-c',`import zipfile,pathlib
root=pathlib.Path(${JSON.stringify(sourceRoot)})
with zipfile.ZipFile('/workspace/perticari-delivery/Perticari_V3_codigo.zip','w',zipfile.ZIP_DEFLATED) as z:
 for folder in ['src','scripts','test','docs','migrations','specs']:
  for p in sorted((root/folder).rglob('*')):
   if p.is_file():z.write(p,p.relative_to(root))
 for name in ['package.json','package-lock.json','wrangler.json','README.md','AGENTS.md']:
  p=root/name
  if p.exists():z.write(p,name)
`]);
await copyFile('/workspace/perticari-delivery/Perticari_V3_actualizacion.zip',join(release,'Perticari_V3_actualizacion.zip'));
console.log(JSON.stringify({target,release,...manifest}));
