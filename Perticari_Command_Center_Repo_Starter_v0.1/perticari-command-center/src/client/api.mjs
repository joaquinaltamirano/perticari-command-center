export async function call(path,data){
 const response=await fetch('/api/pcc/'+path,{method:data===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.timeout(45000),headers:data===undefined?{}:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 let result;try{result=await response.json();}catch{throw new Error('El servidor no devolvió datos válidos. Volvé a consultar.');}
 if(!response.ok){const error=new Error(result.error||'No se pudo completar la acción');error.status=response.status;throw error;}return result;
}
