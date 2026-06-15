import { FACTURA_E_TIPO, StoredComprobante } from '@/lib/types/comprobante';

const QR_BASE_URL = 'https://www.arca.gob.ar/fe/qr/?p=';

/** ARCA QR spec v1 — field order matters for some validators. */
export interface AfipQrDataV1 {
  ver: 1;
  fecha: string;
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: string;
  ctz: number;
  tipoDocRec?: number;
  nroDocRec?: number;
  tipoCodAut: 'E';
  codAut: number;
}

function fechaCbteToIso(fechaCbte: string): string {
  if (fechaCbte.length !== 8) return fechaCbte;
  return `${fechaCbte.slice(0, 4)}-${fechaCbte.slice(4, 6)}-${fechaCbte.slice(6, 8)}`;
}

function parseCuitNumber(cuit: string): number {
  const digits = cuit.replace(/\D/g, '');
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('CUIT del emisor inválido para QR');
  }
  return parsed;
}

function parseCaeNumber(cae: string): number {
  const digits = cae.replace(/\D/g, '');
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('CAE inválido para QR');
  }
  return parsed;
}

/** Match authorized amounts: up to 13 integer + 2 decimal places. */
export function normalizeQrImporte(importe: number): number {
  return Number(importe.toFixed(2));
}

/** Match authorized cotización: up to 13 integer + 6 decimal places. */
export function normalizeQrCtz(ctz: number): number {
  return Number(ctz.toFixed(6));
}

const MONEDA_ALIASES: Record<string, string> = {
  USD: 'DOL',
  ARS: 'PES',
};

/** QR moneda must be the 3-char AFIP code (e.g. DOL, PES). */
export function normalizeQrMoneda(monedaId: string): string {
  const trimmed = monedaId.trim().toUpperCase();
  const aliased = MONEDA_ALIASES[trimmed] ?? trimmed;
  if (aliased.length !== 3) {
    throw new Error(`Moneda inválida para QR: ${monedaId}`);
  }
  return aliased;
}

function isExportComprobante(cbteTipo: number): boolean {
  return cbteTipo === FACTURA_E_TIPO || cbteTipo === 20 || cbteTipo === 21;
}

/**
 * Build QR JSON for ARCA verification.
 * Export invoices (WSFEX) omit receptor doc fields — foreign id impositivo is not tipo 80 CUIT.
 */
export function buildAfipQrData(
  comprobante: StoredComprobante,
  emisorCuit: string
): AfipQrDataV1 {
  const data: AfipQrDataV1 = {
    ver: 1,
    fecha: fechaCbteToIso(comprobante.fechaCbte),
    cuit: parseCuitNumber(emisorCuit),
    ptoVta: comprobante.puntoVta,
    tipoCmp: comprobante.cbteTipo,
    nroCmp: comprobante.cbteNro,
    importe: normalizeQrImporte(comprobante.impTotal),
    moneda: normalizeQrMoneda(comprobante.monedaId),
    ctz: normalizeQrCtz(comprobante.monedaCtz),
    tipoCodAut: 'E',
    codAut: parseCaeNumber(comprobante.cae),
  };

  // Only domestic-style receivers belong in QR. Export Factura E uses foreign clients
  // (id impositivo / cuit país) — including tipoDocRec 80 + id impositivo fails verification.
  if (!isExportComprobante(comprobante.cbteTipo)) {
    const digits = comprobante.idImpositivo.replace(/\D/g, '');
    const nroDocRec = Number(digits);
    if (digits && Number.isFinite(nroDocRec) && nroDocRec > 0) {
      data.tipoDocRec = 80;
      data.nroDocRec = nroDocRec;
    }
  }

  return data;
}

export function buildAfipQrPayload(comprobante: StoredComprobante, emisorCuit: string): string {
  const data = buildAfipQrData(comprobante, emisorCuit);
  const base64 = Buffer.from(JSON.stringify(data)).toString('base64');
  return `${QR_BASE_URL}${base64}`;
}
