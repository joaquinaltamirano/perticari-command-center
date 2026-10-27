import {normalize} from './catalog.mjs';
export const families=[
 ['canos_conduccion','Caños de conducción','Caños'],['canos_estructurales','Caños estructurales','Caños'],
 ['chapas_lisas','Chapas lisas / negras','Chapas'],['chapas_galvanizadas','Chapas galvanizadas','Chapas'],['chapas_semilladas','Chapas semilladas','Chapas'],['chapas_perforadas','Chapas perforadas','Chapas'],['chapas_techo','Chapas de techo','Chapas'],
 ['aletado','Hierro aletado','Obra'],['mallas','Mallas electrosoldadas','Obra'],['angulos','Ángulos','Perfiles'],['perfil_t','Perfil T','Perfiles'],['ipn','IPN','Perfiles'],['upn','UPN','Perfiles'],['perfil_ce','Perfil CE','Perfiles'],['macizo_redondo','Macizo redondo','Macizos'],['macizo_cuadrado','Macizo cuadrado','Macizos'],['planchuelas','Planchuelas lisas / perforadas','Macizos'],['desplegado','Metal desplegado / escalón','Metal desplegado']
].map(([id,name,group])=>({id,name,group,included:true}));
export function classify(product){
 const n=normalize(product.name||product.title), f=normalize(product.family);let id=null,pending=false;
 if(/^(CANO|CAÑO)\b/.test(n))id=/CONDUC|SCH\s*40|STD|EPOXI|MECANICO/.test(n)?'canos_conduccion':/CUADRADO|RECTANG|ESTRUCT|PASAMANO|REDONDO/.test(n)?'canos_estructurales':/GALVAN/.test(n)?'canos_conduccion':null;
 else if(/CHAPA/.test(n))id=/SINUS|TRAPEZ|T.?101|TECHO|CINCALUM|PREPINT|PLASTICA/.test(n)?'chapas_techo':/SEMILL/.test(n)?'chapas_semilladas':/PERFOR/.test(n)?'chapas_perforadas':/GALVAN/.test(n)?'chapas_galvanizadas':/LISA|NEGRA|GRUESA|FINA/.test(n)?'chapas_lisas':null;
 else if(/ALETAD/.test(n))id='aletado';
 else if(/^MALLA\b/.test(n)){id='mallas';pending=/GALVAN/.test(n);}
 else if(/EXPANM|METAL DESPLEGADO|ESCALON/.test(n))id='desplegado';
 else if(/^(PERFIL|PERIL|ANGULO)\b/.test(n))id=/ANGULO/.test(n)?'angulos':/\bIPN\b/.test(n)?'ipn':/\bUPN\b/.test(n)?'upn':/\bCE\b|PERFIL C\b/.test(n)?'perfil_ce':/PERFIL T\b/.test(n)?'perfil_t':null;
 else if(/^(PLANCHUELA|PLANCH|PLANC)\b/.test(n))id='planchuelas';
 else if(/^(REDONDO|LAMINADO REDONDO)\b/.test(n))id='macizo_redondo';
 else if(/^(CUADRADO|LAMINADO CUADRADO)\b/.test(n))id='macizo_cuadrado';
 if(/ESTAMPAD/.test(n))pending=true;
 const definition=families.find(x=>x.id===id),finish=/GALVAN/.test(n)?'galvanizado':/EPOXI/.test(n)?'epoxi':/CINCALUM/.test(n)?'cincalum':/PREPINT/.test(n)?'prepintado':/PLASTICA/.test(n)?'plastico':'sin_terminacion_confirmada';
 const shape=(n.match(/CUADRADO|RECTANGULAR|REDONDO|PASAMANO|SINUSOIDAL|TRAPEZOIDAL|PERFORADA|SEMILLADA/)||[])[0]||'';
 return {id,name:definition?.name||'Revisar clasificación',included:!!id&&!pending,pending:pending||(!id&&/CANO|CHAPA|PERFIL|MACIZO/.test(f)),media_key:id?[id,finish,shape].filter(Boolean).join(':'):null,reason:pending?'Variante pendiente de confirmar':id?'Familia del alcance V3':'Fuera del alcance o sin clasificación suficiente'};
}
export function descriptionFor(p){
 const unit=p.unit==='barra'&&p.length?`Una barra de ${p.length} metros por unidad de compra.`:p.unit==='hoja'?'Una hoja por unidad de compra. Medidas según la referencia indicada.':'Presentación pendiente de confirmar.';
 const t=typeof p.technical==='string'?JSON.parse(p.technical||'{}'):p.technical||{};
 const measures=Object.entries(t).filter(([k,v])=>/^(ancho|espesor|largo|diametro|trama|width|length|thickness)(_|$)/i.test(k)&&['string','number'].includes(typeof v)).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join('\n');
 return `PERTICARI & CIA\nMás de 50 años en el rubro\n\n${p.name}\n\nQUÉ INCLUYE\n${unit}\n\nMEDIDAS Y CARACTERÍSTICAS\n${measures||p.name}\n\nRETIRO Y ENVÍOS\nRetiro en nuestra sucursal de Barracas, CABA.\nAcarreo propio dentro de las zonas habilitadas. Consultá costo y plazo indicando localidad y código postal.\nPara otros destinos, entrega sin cargo en sucursales de transporte de La Boca o Barracas, previa coordinación y aceptación de la carga. El transporte posterior es a cargo del comprador.\n\nPAGO Y FACTURACIÓN\nMedios de pago habilitados por Mercado Libre al comprar.\nEmitimos factura A o B. Revisá tus datos antes de confirmar la compra.\n\nHORARIO DE ATENCIÓN\nLunes a viernes de 8 a 16 h.`;
}
