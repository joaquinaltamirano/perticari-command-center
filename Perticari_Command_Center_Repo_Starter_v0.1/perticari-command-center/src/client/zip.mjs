// Read only ordinary ZIP archives, with bounded streaming decompression.
export async function readImageZip(file){
 if(file.size>10*1024*1024)throw new Error('ZIP máximo de 10 MB');const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw new Error('ZIP inválido o dividido en varios volúmenes');const count=view.getUint16(end+10,true);if(count>100||count===65535)throw new Error('Máximo 100 entradas, sin ZIP64');let at=view.getUint32(end+16,true),sum=0;const entries=[],seen=new Set();
 for(let n=0;n<count;n++){
  if(at+46>end||view.getUint32(at,true)!==0x02014b50)throw new Error('Índice ZIP inválido');const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),compressed=view.getUint32(at+20,true),size=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),offset=view.getUint32(at+42,true);
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(at+46,at+46+nameLength));at+=46+nameLength+extra+comment;
  if(flags&1||![0,8].includes(method)||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||seen.has(name))throw new Error('ZIP con nombres o compresión no admitidos');seen.add(name);if(name.endsWith('/'))continue;
  if(!/\.(png|jpe?g|webp)$/i.test(name)&&name!=='manifest.json')continue;
  if(size>450*1024||(sum+=size)>3*1024*1024)throw new Error('Máximo 450 KB por archivo y 3 MB descomprimidos');
  if(offset+30>bytes.length||view.getUint32(offset,true)!==0x04034b50)throw new Error('Archivo ZIP dañado');const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+compressed>bytes.length)throw new Error('Datos ZIP incompletos');entries.push({name,method,size,data:bytes.slice(start,start+compressed)});
 }
 const files=[];let manifest=null;
 for(const entry of entries){let data=entry.data;if(entry.method===8){const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let length=0;while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>450*1024||length>entry.size){await reader.cancel();throw new Error('Tamaño ZIP descomprimido no coincide');}parts.push(r.value);}data=new Uint8Array(length);let o=0;for(const p of parts){data.set(p,o);o+=p.length;}}
  if(data.length!==entry.size)throw new Error('ZIP incompleto');if(entry.name==='manifest.json'){manifest=JSON.parse(new TextDecoder().decode(data));continue;}let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));files.push({filename:entry.name,base64:btoa(binary)});
 }
 if(!files.length||files.length>30)throw new Error('El ZIP debe contener entre 1 y 30 imágenes');if(manifest&&(!Array.isArray(manifest.images)||manifest.images.length>100||manifest.images.some(i=>!files.some(f=>f.filename===i.filename)||typeof i.sku!=='string'||!Number.isInteger(i.position)||i.position<1||i.position>12)))throw new Error('manifest.json: images debe indicar filename, sku y position de cada imagen');return {files,manifest};
}
