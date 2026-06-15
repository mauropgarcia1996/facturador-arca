import { StoredComprobante } from '@/lib/types/comprobante';

const QR_BASE_URL = 'https://www.arca.gob.ar/fe/qr/?p=';

function fechaCbteToIso(fechaCbte: string): string {
  if (fechaCbte.length !== 8) return fechaCbte;
  return `${fechaCbte.slice(0, 4)}-${fechaCbte.slice(4, 6)}-${fechaCbte.slice(6, 8)}`;
}

function parseCuitNumber(cuit: string): number {
  const digits = cuit.replace(/\D/g, '');
  const parsed = parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('CUIT del emisor inválido para QR');
  }
  return parsed;
}

function parseReceptorDoc(idImpositivo: string): { tipoDocRec: number; nroDocRec: number } | null {
  const digits = idImpositivo.replace(/\D/g, '');
  if (!digits) return null;
  const nroDocRec = parseInt(digits, 10);
  if (!Number.isFinite(nroDocRec) || nroDocRec <= 0) return null;
  return { tipoDocRec: 80, nroDocRec };
}

export function buildAfipQrPayload(comprobante: StoredComprobante, emisorCuit: string): string {
  const payload: Record<string, string | number> = {
    ver: 1,
    fecha: fechaCbteToIso(comprobante.fechaCbte),
    cuit: parseCuitNumber(emisorCuit),
    ptoVta: comprobante.puntoVta,
    tipoCmp: comprobante.cbteTipo,
    nroCmp: comprobante.cbteNro,
    importe: comprobante.impTotal,
    moneda: comprobante.monedaId,
    ctz: comprobante.monedaCtz,
    tipoCodAut: 'E',
    codAut: parseInt(comprobante.cae.replace(/\D/g, ''), 10),
  };

  const receptor = parseReceptorDoc(comprobante.idImpositivo);
  if (receptor) {
    payload.tipoDocRec = receptor.tipoDocRec;
    payload.nroDocRec = receptor.nroDocRec;
  }

  return `${QR_BASE_URL}${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
}
