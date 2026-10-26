export const dispatch = 'San Antonio 1250, Barracas, CABA';
export const zones = [{id:1,max_km:8,usd_cents:2000},{id:2,max_km:16,usd_cents:3950},{id:3,max_km:25,usd_cents:7900}];
export function freightQuote(input, settings, now = Date.now()) {
  const distance = input.distance_km === '' || input.distance_km == null ? null : Number(input.distance_km);
  const weight = input.weight_kg === '' || input.weight_kg == null ? null : Number(input.weight_kg);
  if ((distance != null && (!Number.isFinite(distance) || distance < 0 || distance > 5000)) ||
      (weight != null && (!Number.isFinite(weight) || weight < 0))) throw new Error('Distancia o peso inválidos');
  const origin = dispatch;
  if (input.mode === 'agency') return {origin,status:'coordinar',options:[{title:'Entrega sin cargo en agencia de La Boca/Barracas',ars_cents:0,detail:'El cliente elige y coordina el transporte posterior y sus condiciones.'}]};
  const proposedZones = settings.freight_zones || zones;
  const zone = distance == null ? null : proposedZones.find(z=>distance<=z.max_km);
  const confirmed = Boolean(settings.coverage_confirmed_at) && input.coverage_checked === true;
  if (!zone) return {origin,status:'requiere_cotizacion',options:[],message:'Destino sin cobertura local determinada. Cotizar o coordinar agencia.'};
  const freshFx = settings.fx_cents > 0 && settings.fx_at && now - settings.fx_at <= 86400000;
  const amount = freshFx ? Number((BigInt(zone.usd_cents) * BigInt(settings.fx_cents) + 50n) / 100n) : null;
  const options = [{title:`Acarreo ${zone.id}`,usd_cents:zone.usd_cents,ars_cents:amount,detail: freshFx?'Conversión con la cotización registrada.':'Falta cotización USD/ARS vigente.'}];
  if (confirmed) {
    if(weight!=null && weight>300)options.push({title:'Sin cargo · dentro de 72 horas',ars_cents:0,detail:'Pedido superior a 300 kg. Coordinar entrega.'});
    options.push({title:'Sin cargo · dentro de 10 días',ars_cents:0,detail:'Sin mínimo. Coordinar entrega.'});
  }
  return {origin,zone:zone.id,status:confirmed && freshFx?'confirmada':'estimada',options,
    message:!confirmed?'Radios propuestos: confirmar cobertura antes de ofrecer una tarifa.':!freshFx?'Actualizar cotización del dólar.':'Cobertura confirmada para esta consulta.'};
}
