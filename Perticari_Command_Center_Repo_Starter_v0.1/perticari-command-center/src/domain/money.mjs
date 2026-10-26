export function cents(value) {
  if (value === null || value === undefined || value === '') return null;
  let text = String(value).trim().replace(/\bARS\b|\$|\s/g, '');
  if (!/^\d[\d.,]*$/.test(text)) throw new Error('Importe inválido');
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    text = /,\d{3}(?:,|$)/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text) && typeof value==='string') text=text.replace(/\./g,'');
  else if ((text.match(/\./g) || []).length > 1) text = text.replace(/\./g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Importe con precisión o formato inválido');
  const [whole, decimal = ''] = text.split('.');
  const result = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Importe fuera de rango');
  return Number(result);
}
export const multiplyBps = (amount, bps) => {
  const result = (BigInt(amount) * BigInt(bps) + 5000n) / 10000n;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Importe fuera de rango');
  return Number(result);
};
export const referenceBands = [
  {from:0,to:1500000,fixed:133000}, {from:1500000,to:2400000,fixed:274000},
  {from:2400000,to:3300000,fixed:332000}, {from:3300000,to:null,fixed:0},
];
export function simulatePrice(product, settings, now = Date.now()) {
  const reasons = [];
  if (!Number.isSafeInteger(product.base_cents) || product.base_cents <= 0) return { proposed_cents:null, reasons:['Falta precio de origen válido'], executable:false };
  let baseWithMarkup;
  try { baseWithMarkup = multiplyBps(product.base_cents, 10000 + settings.markup_bps); }
  catch { return { proposed_cents:null, reasons:['Importe fuera del rango de cálculo'], executable:false }; }
  const bands = settings.fee_bands || referenceBands;
  let candidate = null, fee = null;
  // Choose the lowest price that covers the agreed base+markup and its own final-price band.
  for (const band of bands) {
    const p = Math.max(baseWithMarkup + band.fixed, band.from);
    if ((band.to == null || p < band.to) && (candidate == null || p < candidate)) {candidate=p;fee=band.fixed;}
  }
  if (candidate == null) return {proposed_cents:null,reasons:['Franjas de cargo incompletas'],executable:false};
  if (!Number.isSafeInteger(candidate)) return {proposed_cents:null,reasons:['Importe fuera del rango de cálculo'],executable:false};
  if (!settings.fees_confirmed_at || now - settings.fees_confirmed_at > 86400000) reasons.push('Cargos fijos sin validación vigente');
  if(product.technical?.conflicto_origen)reasons.push('Resolver el código repetido en el maestro de origen');
  if (!product.price_confirmed) reasons.push('Confirmar vigencia y unidad del precio MEMOSOFT');
  if (!product.unit) reasons.push('Presentación sin confirmar');
  if (product.currency !== 'ARS') reasons.push('Moneda de origen sin confirmar en ARS');
  if (!product.source_at || now - product.source_at > 86400000) reasons.push('Precio de origen sin actualización en las últimas 24 h');
  return {base_cents:product.base_cents,markup_cents:baseWithMarkup-product.base_cents,fixed_cents:fee,
    proposed_cents:candidate,reasons,executable:reasons.length===0, margin_known:false,
    note:'Recargo del 15% más cargo fijo; precio público más recargo para costos del canal; no es costo de adquisición ni margen neto.'};
}
