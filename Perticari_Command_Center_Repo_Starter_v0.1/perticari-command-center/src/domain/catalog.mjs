export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
export function familyOf(name, sku = '') {
  const n = normalize(name), s = normalize(sku);
  if (/^(SERVICIO|AJUSTE|ALQUILER|GASTOS|INTERESES|ENTREGA|RECUPERO|FORD|CAMION)\b/.test(n)) return 'Revisar exclusión';
  if (/^(CAÑO|CANO)\b/.test(n)) return 'Caños';
  if (/^(PERFIL|PERIL|ANGULO)\b/.test(n)) return 'Perfiles';
  if (/^(PLANCHUELA|PLANCH|PLANC)\b/.test(n)) return 'Planchuelas';
  if (/^CHAPA\b/.test(n)) return 'Chapas';
  if (/EXPANMETAL|EXPANMEATAL|METAL DESPLEGADO/.test(n)) return 'Metal desplegado';
  if (/^MALLA\b/.test(n)) return 'Mallas';
  if (/^REDONDO.*ALET/.test(n)) return 'Hierro aletado';
  if (/^(LAMINADO|CUADRADO|REDONDO)\b/.test(n)) return 'Macizos';
  if (/^(PISO|ESCALON)\b/.test(n)) return 'Rejillas y escalones';
  if (/^(ELECTRODO|PINZA)|ALAMBRE.*SOLDAD/.test(n)) return 'Soldadura';
  if (/^ALAMBRE/.test(n)) return 'Alambres';
  if (/^(DISCO|FLAP|CEPILLO)/.test(n)) return 'Abrasivos';
  if (/^(TORNILLO|TUERCA|ARANDELA|CLAVO|REMACHE|TARUGO|VARILLA)/.test(n)) return 'Fijaciones';
  if (/^(MECHA|AMOLADORA|ALICATE|NIVEL|CINTA|TALADRO|REMACHADORA|CUTTER|JUEGO|ESCUADRA|ALINEADOR|APLICADOR|CORTADORA)/.test(n)) return 'Herramientas';
  if (/^(MASCARA|CARETA|GUANTE|DELANTAL|CRISTAL|ANTIPARRA|LENTE|ANTEOJO|FAJA)/.test(n)) return 'Protección personal';
  if (/^(BISAGRA|RUEDA|REGATON|PASADOR|CARRO|RIEL|CERRADURA|CAJA|CERROJO|CANDADO|CAPUCHA|TOPE|SOPORTE|GANCHO|GUIA|RODILLO|RULEMAN|BOCHA|PUNTA|ARO|TAPA)/.test(n)) return 'Herrajes y accesorios';
  if (/PENETRYT|SILICONA|LUBRICANTE|CREMA/.test(n)) return 'Lubricantes';
  return 'Por clasificar';
}
export function presentationOf(name, family = familyOf(name)) {
  // A sheet can be six metres long; length alone must not turn it into a bar.
  if (['Chapas', 'Metal desplegado', 'Mallas'].includes(family)) return { unit: 'hoja', length: null, label: 'Por hoja', confidence: 'business_rule' };
  const match = normalize(name).match(/\bX\s*(6|12)\s*(?:MTS?|METROS?)\b/);
  if (match) return { unit: 'barra', length: Number(match[1]), label: `Barra de ${match[1]} m`, confidence: 'title' };
  return { unit: null, length: null, label: 'Presentación por confirmar', confidence: 'pending' };
}
export function quality(product) {
  const issues = [];
  if (!product.sku) issues.push('Falta código');
  if (!product.name) issues.push('Falta descripción');
  if (product.base_cents == null) issues.push('Sin precio de origen');
  if (!product.unit) issues.push('Confirmar presentación');
  if (!product.price_confirmed) issues.push('Confirmar vigencia y unidad del precio');
  if (product.family === 'Por clasificar' || product.family === 'Revisar exclusión') issues.push('Revisar familia');
  return issues;
}
export function draftFrom(product, settings = {}) {
  return { sku: product.sku, title: product.name, category_id: '', price_cents: null,
    currency_id: 'ARS', quantity: settings.default_quantity ?? 100, listing_type_id: 'gold_special',
    condition: 'new', buying_mode: 'buy_it_now', pictures: [], attributes: [],
    description: `${product.name}\nPresentación: ${presentationOf(product.name, product.family).label}.\nRetiro y entrega a coordinar.`,
    source: 'catalog', presentation_confirmed: false, media_pending: true, video_pending: true };
}
export function draftIssues(draft) {
  const issues = [];
  if (!draft.title?.trim()) issues.push('Falta título');
  if (!/^MLA\d+$/.test(draft.category_id || '')) issues.push('Elegir categoría de Mercado Libre');
  if (!Number.isSafeInteger(draft.price_cents) || draft.price_cents <= 0) issues.push('Confirmar precio');
  if (!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 100000) issues.push('Cantidad comercial inválida');
  if (!draft.presentation_confirmed) issues.push('Confirmar presentación y unidad del precio');
  if (!draft.pictures?.length || draft.pictures.some(p => !/^https:\/\//.test(p.source || ''))) issues.push('Agregar imágenes HTTPS representativas');
  if (draft.currency_id !== 'ARS') issues.push('Moneda no habilitada');
  return issues;
}
