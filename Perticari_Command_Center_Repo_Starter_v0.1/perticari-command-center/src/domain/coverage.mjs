import {multiplyBps} from './money.mjs';
export function channelCoverage(input){
 const monetary=['public_cents','sale_cents','fixed_cents','shipping_cents','ads_cents','other_cents'];
 for(const k of monetary)if(input[k]!=null&&(!Number.isSafeInteger(input[k])||input[k]<0))throw new Error('Importe inválido: '+k);
 if(!input.public_cents||!input.sale_cents)throw new Error('Indicá precio público de referencia y precio de venta');
 if(input.commission_bps!=null&&(!Number.isInteger(input.commission_bps)||input.commission_bps<0||input.commission_bps>10000))throw new Error('Comisión inválida');
 const commission=input.commission_bps==null?null:multiplyBps(input.sale_cents,input.commission_bps),known=[commission,input.fixed_cents,input.shipping_cents,input.ads_cents,input.other_cents].filter(n=>n!=null),total=known.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(total))throw new Error('Costos fuera del rango de cálculo');
 const missing=['commission_bps','fixed_cents','shipping_cents','ads_cents','other_cents'].filter(k=>input[k]==null);if(input.comparable_tax_basis!==true)missing.push('comparable_tax_basis');
 return {public_cents:input.public_cents,sale_cents:input.sale_cents,commission_cents:commission,known_costs_cents:total,remaining_after_known_costs_cents:input.sale_cents-total,difference_against_public_cents:input.sale_cents-total-input.public_cents,complete:missing.length===0,missing,note:'Comparación contra precio público MEMOSOFT, no ganancia ni costo de adquisición. Importes del escenario suministrados por el operador; no son tarifas oficiales consultadas.'};
}
