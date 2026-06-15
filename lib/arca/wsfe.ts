import { createSOAPEnvelope } from './soap';
import { ComprobanteE, ComprobanteEItem, getPreferredPuntoVenta } from '../types/comprobante';
import { FacturaE } from '../types/factura';

const WSFEX_URL = 'https://servicios1.afip.gov.ar/wsfexv1/service.asmx';

/** Llamada a WSFEX. Si ARCA_AUTH_SERVICE_URL está configurado, usa el proxy (Railway) para evitar "fetch failed" en Vercel. */
async function wsfexFetch(soapAction: string, envelope: string): Promise<Response> {
  const proxyUrl = process.env.ARCA_AUTH_SERVICE_URL;
  if (proxyUrl) {
    const base = proxyUrl.startsWith('http') ? proxyUrl : `https://${proxyUrl}`;
    const url = `${base.replace(/\/$/, '')}/wsfex`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const apiKey = process.env.ARCA_AUTH_API_KEY;
    if (apiKey) headers['X-Api-Key'] = apiKey;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ soapAction, body: envelope }),
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'text/xml' } });
  }
  return fetch(WSFEX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: soapAction,
    },
    body: envelope,
  });
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractXmlTag(xml: string, ...tagNames: string[]): string | null {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i');
    const m = xml.match(re);
    if (m?.[1]) return m[1].trim() || null;
  }
  return null;
}

export interface Auth {
  token: string;
  sign: string;
  cuit: string;
}

function parseDecimal(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntSafe(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseComprobanteItems(block: string): ComprobanteEItem[] {
  const items: ComprobanteEItem[] = [];
  const itemRegex = /<Item[^>]*>([\s\S]*?)<\/Item>/gi;
  let match;
  while ((match = itemRegex.exec(block)) !== null) {
    const itemBlock = match[1];
    const proDs = extractXmlTag(itemBlock, 'Pro_ds', 'pro_ds');
    if (!proDs) continue;
    items.push({
      proDs,
      proQty: parseDecimal(extractXmlTag(itemBlock, 'Pro_qty', 'pro_qty')),
      proUmed: parseIntSafe(extractXmlTag(itemBlock, 'Pro_umed', 'pro_umed')),
      proPrecioUni: parseDecimal(extractXmlTag(itemBlock, 'Pro_precio_uni', 'pro_precio_uni')),
      proTotalItem: parseDecimal(extractXmlTag(itemBlock, 'Pro_total_item', 'pro_total_item')),
    });
  }
  return items;
}

function parseComprobanteBlock(block: string): ComprobanteE | null {
  const cbteNro = parseIntSafe(extractXmlTag(block, 'Cbte_nro', 'Cbt_nro', 'cbte_nro'));
  const cae = extractXmlTag(block, 'Cae', 'cae');
  if (!cbteNro || !cae) return null;

  return {
    id: parseIntSafe(extractXmlTag(block, 'Id')),
    fechaCbte: extractXmlTag(block, 'Fecha_cbte', 'fecha_cbte') ?? '',
    cbteTipo: parseIntSafe(extractXmlTag(block, 'Cbte_tipo', 'Cbte_Tipo', 'cbte_tipo')),
    puntoVta: parseIntSafe(extractXmlTag(block, 'Punto_vta', 'punto_vta')),
    cbteNro,
    tipoExpo: parseIntSafe(extractXmlTag(block, 'Tipo_expo', 'tipo_expo')),
    cliente: extractXmlTag(block, 'Cliente', 'cliente') ?? '',
    domicilioCliente: extractXmlTag(block, 'Domicilio_cliente', 'domicilio_cliente') ?? '',
    cuitPaisCliente:
      extractXmlTag(block, 'Cuit_pais_cliente', 'Cuit_pais_Cliente', 'cuit_pais_cliente') ?? '',
    idImpositivo: extractXmlTag(block, 'Id_impositivo', 'id_impositivo') ?? '',
    monedaId: extractXmlTag(block, 'Moneda_Id', 'Moneda_id', 'moneda_id') ?? '',
    monedaCtz: parseDecimal(extractXmlTag(block, 'Moneda_ctz', 'Moneda_Ctz', 'moneda_ctz')),
    impTotal: parseDecimal(extractXmlTag(block, 'Imp_total', 'imp_total')),
    obsComerciales: extractXmlTag(block, 'Obs_comerciales', 'obs_comerciales') ?? '',
    formaPago: extractXmlTag(block, 'Forma_pago', 'forma_pago') ?? '',
    fechaPago: extractXmlTag(block, 'Fecha_pago', 'fecha_pago') ?? '',
    cae,
    fchVencCae: extractXmlTag(block, 'Fch_venc_Cae', 'Fch_venc_cae', 'fch_venc_cae') ?? '',
    fechaCbteCae: extractXmlTag(block, 'Fecha_cbte_cae', 'fecha_cbte_cae') ?? '',
    items: parseComprobanteItems(block),
  };
}

function assertWsfeOk(xmlResponse: string, label: string): void {
  if (!responseOk(xmlResponse)) {
    const errMsg = extractXmlTag(xmlResponse, 'ErrMsg', 'Err_msg');
    const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
    throw new Error(errMsg ? `[${errCode}] ${errMsg}` : `${label}: ${errCode ?? 'error desconocido'}`);
  }
}

function responseOk(xmlResponse: string): boolean {
  const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
  return !errCode || errCode === '0';
}

export async function getComprobanteARCA(
  auth: Auth,
  puntoVenta: number,
  tipoComprobante: number,
  cbteNro: number
): Promise<ComprobanteE | null> {
  const soapBody = `
    <FEXGetCMP xmlns="http://ar.gov.afip.dif.fexv1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${auth.cuit}</Cuit>
      </Auth>
      <Cmp>
        <Cbte_tipo>${tipoComprobante}</Cbte_tipo>
        <Punto_vta>${puntoVenta}</Punto_vta>
        <Cbte_nro>${cbteNro}</Cbte_nro>
      </Cmp>
    </FEXGetCMP>
  `;

  const envelope = createSOAPEnvelope(soapBody);
  const response = await wsfexFetch('"http://ar.gov.afip.dif.fexv1/FEXGetCMP"', envelope);
  const xmlResponse = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}\n${xmlResponse}`);
  }

  const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
  if (errCode === '1020') {
    return null;
  }

  assertWsfeOk(xmlResponse, 'FEXGetCMP');

  const resultBlock =
    xmlResponse.match(/<FEXResultGet[^>]*>([\s\S]*?)<\/FEXResultGet>/i)?.[1] ??
    xmlResponse.match(/<ResultGet[^>]*>([\s\S]*?)<\/ResultGet>/i)?.[1] ??
    xmlResponse;

  const parsed = parseComprobanteBlock(resultBlock);
  if (!parsed) {
    throw new Error(`FEXGetCMP: no se pudo interpretar el comprobante ${cbteNro}`);
  }
  return parsed;
}

export async function getUltimoNumeroAutorizado(
  auth: Auth,
  puntoVenta: number,
  tipoComprobante: number
): Promise<number> {
  return getUltimoComprobante(auth, puntoVenta, tipoComprobante);
}

export async function getUltimoComprobante(
  auth: Auth,
  puntoVenta: number,
  tipoComprobante: number
): Promise<number> {
  const soapBody = `
    <FEXGetLast_CMP xmlns="http://ar.gov.afip.dif.fexv1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${auth.cuit}</Cuit>
        <Pto_venta>${puntoVenta}</Pto_venta>
        <Cbte_Tipo>${tipoComprobante}</Cbte_Tipo>
      </Auth>
    </FEXGetLast_CMP>
  `;

  const envelope = createSOAPEnvelope(soapBody);
  const response = await wsfexFetch('"http://ar.gov.afip.dif.fexv1/FEXGetLast_CMP"', envelope);
  const xmlResponse = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}\n${xmlResponse}`);
  }

  assertWsfeOk(xmlResponse, 'FEXGetLast_CMP');

  const cbteNroMatch = xmlResponse.match(/<Cbte_nro>(\d+)<\/Cbte_nro>/i);
  return cbteNroMatch ? parseInt(cbteNroMatch[1], 10) : 0;
}

interface PaisARCA {
  codigo: string;
  descripcion: string;
}

export async function getPaisesARCA(auth: Auth): Promise<PaisARCA[]> {
  const soapBody = `
    <FEXGetPARAM_DST_pais xmlns="http://ar.gov.afip.dif.fexv1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${auth.cuit}</Cuit>
      </Auth>
    </FEXGetPARAM_DST_pais>
  `;

  const envelope = createSOAPEnvelope(soapBody);
  const response = await wsfexFetch('"http://ar.gov.afip.dif.fexv1/FEXGetPARAM_DST_pais"', envelope);
  const xmlResponse = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}\n${xmlResponse}`);
  }

  const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
  if (errCode && errCode !== '0') {
    const errMsg = extractXmlTag(xmlResponse, 'ErrMsg', 'Err_msg');
    throw new Error(errMsg ? `[${errCode}] ${errMsg}` : `Error FEXGetPARAM_DST_pais: ${errCode}`);
  }

  const paises: PaisARCA[] = [];
  const itemRegex = /<ClsFEXResponse_DST_pais[^>]*>([\s\S]*?)<\/ClsFEXResponse_DST_pais>/gi;
  let match;
  while ((match = itemRegex.exec(xmlResponse)) !== null) {
    const block = match[1];
    const codigo = extractXmlTag(block, 'DST_Codigo', 'Dst_codigo');
    const descripcion = extractXmlTag(block, 'DST_Ds', 'Dst_ds');
    if (codigo && descripcion) {
      paises.push({ codigo: codigo.trim(), descripcion: descripcion.trim() });
    }
  }

  if (paises.length === 0) {
    const pairRegex = /<DST_Codigo>([^<]*)<\/DST_Codigo>\s*<DST_Ds>([^<]*)<\/DST_Ds>/gi;
    let pairMatch;
    while ((pairMatch = pairRegex.exec(xmlResponse)) !== null) {
      paises.push({
        codigo: pairMatch[1].trim(),
        descripcion: pairMatch[2].trim(),
      });
    }
  }

  return paises;
}

function resolverDstCmp(
  paises: PaisARCA[],
  paisCliente: { nombre: string; codigoISO: string }
): string {
  const nombre = paisCliente.nombre.toUpperCase();
  const iso = paisCliente.codigoISO.toUpperCase();
  const terminosUSA = ['ESTADOS UNIDOS', 'UNITED STATES', 'EE.UU.', 'EEUU', 'USA', 'US'];

  for (const p of paises) {
    const desc = p.descripcion.toUpperCase();
    if (
      desc.includes(nombre) ||
      nombre.includes(desc) ||
      (iso === 'US' && terminosUSA.some((t) => desc.includes(t)))
    ) {
      return p.codigo;
    }
  }
  throw new Error(
    `País no encontrado en ARCA: ${paisCliente.nombre} (${paisCliente.codigoISO}). Consulte FEXGetPARAM_DST_pais.`
  );
}

interface PuntoVentaARCA {
  numero: number;
  bloqueado: string;
  fechaBaja: string;
}

export async function getPuntosVentaARCA(auth: Auth): Promise<PuntoVentaARCA[]> {
  const soapBody = `
    <FEXGetPARAM_PtoVenta xmlns="http://ar.gov.afip.dif.fexv1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${auth.cuit}</Cuit>
      </Auth>
    </FEXGetPARAM_PtoVenta>
  `;

  const envelope = createSOAPEnvelope(soapBody);
  const response = await wsfexFetch('"http://ar.gov.afip.dif.fexv1/FEXGetPARAM_PtoVenta"', envelope);
  const xmlResponse = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}\n${xmlResponse}`);
  }

  const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
  if (errCode && errCode !== '0') {
    const errMsg = extractXmlTag(xmlResponse, 'ErrMsg', 'Err_msg');
    throw new Error(errMsg ? `[${errCode}] ${errMsg}` : `Error FEXGetPARAM_PtoVenta: ${errCode}`);
  }

  const puntos: PuntoVentaARCA[] = [];
  const itemRegex = /<ClsFEXResponse_PtoVenta[^>]*>([\s\S]*?)<\/ClsFEXResponse_PtoVenta>/gi;
  let match;
  while ((match = itemRegex.exec(xmlResponse)) !== null) {
    const block = match[1];
    const numeroStr = extractXmlTag(block, 'Pve_Nro', 'Pve_nro');
    const bloqueado = extractXmlTag(block, 'Pve_Bloqueado', 'Pve_bloqueado') ?? 'N';
    const fechaBaja = extractXmlTag(block, 'Pve_FchBaja', 'Pve_fchBaja') ?? '';
    if (numeroStr) {
      const numero = parseInt(numeroStr, 10);
      if (!isNaN(numero)) {
        puntos.push({ numero, bloqueado, fechaBaja });
      }
    }
  }

  if (puntos.length === 0) {
    const pairRegex = /<Pve_Nro>([^<]*)<\/Pve_Nro>/gi;
    let pairMatch;
    while ((pairMatch = pairRegex.exec(xmlResponse)) !== null) {
      const numero = parseInt(pairMatch[1].trim(), 10);
      if (!isNaN(numero)) {
        puntos.push({ numero, bloqueado: 'N', fechaBaja: '' });
      }
    }
  }

  return puntos;
}

function resolverPuntoVenta(
  puntos: PuntoVentaARCA[],
  preferido?: number
): number {
  const validos = puntos.filter(
    (p) => p.bloqueado?.toUpperCase() !== 'S' && !p.fechaBaja?.trim()
  );
  if (validos.length === 0) {
    throw new Error(
      'No hay puntos de venta habilitados para Factura E. Consulte FEXGetPARAM_PtoVenta y registre un punto con código FEEWS.'
    );
  }
  const preferidoValido = preferido != null && validos.some((p) => p.numero === preferido);
  return preferidoValido ? preferido! : validos[0].numero;
}

export async function resolveFacturaEPuntoVenta(
  auth: Auth,
  preferido?: number
): Promise<number> {
  const puntos = await getPuntosVentaARCA(auth);
  return resolverPuntoVenta(puntos, preferido ?? getPreferredPuntoVenta());
}

interface MonedaConCotizacion {
  monId: string;
  monCtz: number;
  monFecha: string;
}

export async function getMonedasConCotizacionARCA(
  auth: Auth,
  fecha: string
): Promise<MonedaConCotizacion[]> {
  const soapBody = `
    <FEXGetPARAM_MON_CON_COTIZACION xmlns="http://ar.gov.afip.dif.fexv1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${auth.cuit}</Cuit>
      </Auth>
      <Fecha_CTZ>${fecha}</Fecha_CTZ>
    </FEXGetPARAM_MON_CON_COTIZACION>
  `;

  const envelope = createSOAPEnvelope(soapBody);
  const response = await wsfexFetch('"http://ar.gov.afip.dif.fexv1/FEXGetPARAM_MON_CON_COTIZACION"', envelope);
  const xmlResponse = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}\n${xmlResponse}`);
  }

  const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
  if (errCode && errCode !== '0') {
    const errMsg = extractXmlTag(xmlResponse, 'ErrMsg', 'Err_msg');
    throw new Error(errMsg ? `[${errCode}] ${errMsg}` : `Error FEXGetPARAM_MON_CON_COTIZACION: ${errCode}`);
  }

  const monedas: MonedaConCotizacion[] = [];
  const itemRegex = /<ClsFEXResponse_Mon_CON_Cotizacion[^>]*>([\s\S]*?)<\/ClsFEXResponse_Mon_CON_Cotizacion>/gi;
  let match;
  while ((match = itemRegex.exec(xmlResponse)) !== null) {
    const block = match[1];
    const monId = extractXmlTag(block, 'Mon_id', 'Mon_Id');
    const monCtzStr = extractXmlTag(block, 'Mon_ctz', 'Mon_Ctz');
    const monFecha = extractXmlTag(block, 'Mon_fecha', 'Mon_Fecha', 'Fecha_ctz') ?? '';
    if (monId && monCtzStr) {
      const monCtz = parseFloat(monCtzStr);
      if (!isNaN(monCtz)) {
        monedas.push({ monId, monCtz, monFecha });
      }
    }
  }

  if (monedas.length === 0) {
    const pairRegex = /<Mon_Id>([^<]*)<\/Mon_Id>\s*<Mon_Ctz>([^<]*)<\/Mon_Ctz>/gi;
    let pairMatch;
    while ((pairMatch = pairRegex.exec(xmlResponse)) !== null) {
      const monId = pairMatch[1].trim();
      const monCtz = parseFloat(pairMatch[2].trim());
      if (monId && !isNaN(monCtz)) {
        monedas.push({ monId, monCtz, monFecha: '' });
      }
    }
  }
  if (monedas.length === 0) {
    const monCtzStr = extractXmlTag(xmlResponse, 'Mon_ctz', 'Mon_Ctz');
    const monId = extractXmlTag(xmlResponse, 'Mon_id', 'Mon_Id');
    if (monId && monCtzStr) {
      monedas.push({
        monId,
        monCtz: parseFloat(monCtzStr),
        monFecha: extractXmlTag(xmlResponse, 'Mon_fecha', 'Mon_Fecha', 'Fecha_ctz') ?? '',
      });
    }
  }

  return monedas;
}

/** Retorna YYYYMMDD del día hábil anterior (excluye sábado y domingo en Argentina) */
function getDiaHabilAnterior(fecha: Date): string {
  // Usar hora Argentina para que coincida con ARCA (evita errores en Vercel/UTC)
  const argDateStr = fecha.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const [y, m, day] = argDateStr.split('-');
  let d = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(day!, 10));
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Busca USD en la lista. Código 012 = Real (BRL); USD = DOL, 002, o descripción "estadounidense". */
function encontrarDolarEnMonedas(monedas: MonedaConCotizacion[]): MonedaConCotizacion | null {
  const usdKeywords = ['dol', '002', 'usd', 'estadounidense']; // No usar 012 = Real
  for (const m of monedas) {
    const key = (m.monId + '').toLowerCase();
    if (usdKeywords.some((k) => key.includes(k) || key === k)) return m;
  }
  return null; // No devolver monedas[0]: podría ser Real u otra moneda
}

export async function getCotizacionARCA(
  auth: Auth,
  monedaId: string = 'DOL',
  fecha?: string
): Promise<{ cotizacion: number; fecha: string; monedaId: string }> {
  const fechaPart = fecha ? `\n        <FchCotiz>${fecha}</FchCotiz>` : '';
  const soapBody = `
    <FEXGetPARAM_Ctz xmlns="http://ar.gov.afip.dif.fexv1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${auth.cuit}</Cuit>
      </Auth>
      <Mon_id>${monedaId}</Mon_id>${fechaPart}
    </FEXGetPARAM_Ctz>
  `;

  const envelope = createSOAPEnvelope(soapBody);
  const response = await wsfexFetch('"http://ar.gov.afip.dif.fexv1/FEXGetPARAM_Ctz"', envelope);
  const xmlResponse = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}\n${xmlResponse}`);
  }

  const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
  if (errCode && errCode !== '0') {
    const errMsg = extractXmlTag(xmlResponse, 'ErrMsg', 'Err_msg');
    throw new Error(errMsg ? `[${errCode}] ${errMsg}` : `Error FEXGetPARAM_Ctz: ${errCode}`);
  }

  const cotizacionStr = extractXmlTag(xmlResponse, 'Mon_ctz', 'mon_ctz');
  const fechaCotiz = extractXmlTag(xmlResponse, 'Mon_fecha', 'Mon_Fecha') ?? '';

  if (!cotizacionStr) {
    throw new Error('FEXGetPARAM_Ctz: no se obtuvo cotización');
  }

  const cotizacion = parseFloat(cotizacionStr);
  if (isNaN(cotizacion)) {
    throw new Error('FEXGetPARAM_Ctz: cotización inválida');
  }

  return { cotizacion, fecha: fechaCotiz, monedaId };
}

export async function getTipoCambio(
  auth: Auth,
  moneda: string = 'DOL'
): Promise<number> {
  if (moneda === 'USD' || moneda === 'DOL') {
    const diaHabil = getDiaHabilAnterior(new Date());
    const monedas = await getMonedasConCotizacionARCA(auth, diaHabil);
    const dolar = encontrarDolarEnMonedas(monedas);
    if (dolar) return dolar.monCtz;
    throw new Error('No se encontró cotización de dólar en AFIP');
  }
  const monedaId = moneda; // Para monedas distintas de USD
  const diaHabil = getDiaHabilAnterior(new Date());
  const fechaCtz = `${diaHabil.slice(0, 4)}-${diaHabil.slice(4, 6)}-${diaHabil.slice(6, 8)}`;
  const { cotizacion } = await getCotizacionARCA(auth, monedaId, fechaCtz);
  return cotizacion;
}

export async function emitirFacturaE(
  auth: Auth,
  factura: FacturaE
): Promise<{ cae: string; fechaVencimiento: string; numero: number }> {
  const tipoComprobante = 19;
  const puntos = await getPuntosVentaARCA(auth);
  const puntoVenta = resolverPuntoVenta(puntos, factura.puntoVenta);
  const ultimo = await getUltimoComprobante(auth, puntoVenta, tipoComprobante);
  const numeroComprobante = ultimo + 1;

  const fechaEmision = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const fechaPago = (factura.fechaPago || fechaEmision).replace(/-/g, '');
  const importeTotal = factura.cantidad * factura.precioUnitario;

  // Para Tipo_expo=2 (Servicios), ARCA exige cotización del día hábil anterior (validación 2053)
  const diaHabilCotiz = getDiaHabilAnterior(new Date());

  const paises = await getPaisesARCA(auth);
  const dstCmp = resolverDstCmp(paises, factura.cliente.pais);

  let monedaId: string;
  let cotizacionARCA: number;
  if (factura.moneda === 'USD') {
    const monedas = await getMonedasConCotizacionARCA(auth, diaHabilCotiz);
    const dolar = encontrarDolarEnMonedas(monedas);
    if (!dolar) {
      throw new Error('No se encontró cotización de dólar para la fecha. Verifique FEXGetPARAM_MON_CON_COTIZACION.');
    }
    monedaId = dolar.monId;
    cotizacionARCA = dolar.monCtz;
  } else {
    monedaId = factura.moneda;
    const fechaParaCtz = `${diaHabilCotiz.slice(0, 4)}-${diaHabilCotiz.slice(4, 6)}-${diaHabilCotiz.slice(6, 8)}`;
    const res = await getCotizacionARCA(auth, monedaId, fechaParaCtz);
    cotizacionARCA = res.cotizacion;
  }

  // El ID debe ser un long, usamos un timestamp corto
  const idRequest = Math.floor(Date.now() / 1000);

  const soapBody = `
    <FEXAuthorize xmlns="http://ar.gov.afip.dif.fexv1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${auth.cuit}</Cuit>
      </Auth>
      <Cmp>
        <Id>${idRequest}</Id>
        <Fecha_cbte>${fechaEmision}</Fecha_cbte>
        <Cbte_Tipo>${tipoComprobante}</Cbte_Tipo>
        <Punto_vta>${puntoVenta}</Punto_vta>
        <Cbte_nro>${numeroComprobante}</Cbte_nro>
        <Tipo_expo>2</Tipo_expo>
        <Permiso_existente></Permiso_existente>
        <Dst_cmp>${dstCmp}</Dst_cmp>
        <Cliente>${escapeXml(factura.cliente.nombre)}</Cliente>
        <Cuit_pais_cliente>${factura.cliente.pais.codigoCUIT}</Cuit_pais_cliente>
        <Domicilio_cliente>${escapeXml(factura.cliente.direccion)}</Domicilio_cliente>
        <Id_impositivo>${escapeXml(factura.cliente.idImpositivo)}</Id_impositivo>
        <Moneda_Id>${monedaId}</Moneda_Id>
        <Moneda_ctz>${cotizacionARCA.toFixed(6)}</Moneda_ctz>
        <Imp_total>${importeTotal.toFixed(2)}</Imp_total>
        <Obs_comerciales>${escapeXml(factura.descripcion)}</Obs_comerciales>
        <Forma_pago>Transferencia</Forma_pago>
        <Idioma_cbte>1</Idioma_cbte>
        <Fecha_pago>${fechaPago}</Fecha_pago>
        <Items>
          <Item>
            <Pro_ds>${escapeXml(factura.descripcion)}</Pro_ds>
            <Pro_qty>${factura.cantidad}</Pro_qty>
            <Pro_umed>7</Pro_umed>
            <Pro_precio_uni>${factura.precioUnitario.toFixed(2)}</Pro_precio_uni>
            <Pro_total_item>${importeTotal.toFixed(2)}</Pro_total_item>
          </Item>
        </Items>
      </Cmp>
    </FEXAuthorize>
  `;

  const envelope = createSOAPEnvelope(soapBody);
  const response = await wsfexFetch('"http://ar.gov.afip.dif.fexv1/FEXAuthorize"', envelope);
  const xmlResponse = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}\n${xmlResponse}`);
  }

  const cae = extractXmlTag(xmlResponse, 'Cae', 'cae');
  const fechaVencimiento = extractXmlTag(xmlResponse, 'Fch_venc_Cae', 'Fch_venc_cae') ?? '';

  if (!cae) {
    const errMsg = extractXmlTag(xmlResponse, 'ErrMsg', 'Err_msg');
    const errCode = extractXmlTag(xmlResponse, 'ErrCode', 'Err_code');
    const motivosObs = extractXmlTag(xmlResponse, 'Motivos_Obs', 'MotivosObs');
    const parts = [
      errCode && `[${errCode}]`,
      errMsg,
      motivosObs && `Motivos: ${motivosObs}`,
    ].filter(Boolean);
    if (process.env.NODE_ENV === 'development') {
      const safeXml = xmlResponse.replace(/<Token>[^<]*<\/Token>/i, '<Token>***</Token>').replace(/<Sign>[^<]*<\/Sign>/i, '<Sign>***</Sign>');
      console.error('[FEXAuthorize] No CAE. Response (truncated):', safeXml.slice(0, 1500));
    }
    throw new Error(parts.length ? parts.join(' - ') : 'Error en FEXAuthorize - No se recibió CAE');
  }

  return { cae, fechaVencimiento, numero: numeroComprobante };
}
