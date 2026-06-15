export interface ComprobanteEItem {
  proDs: string;
  proQty: number;
  proUmed: number;
  proPrecioUni: number;
  proTotalItem: number;
}

/** Authorized Factura E as returned by FEXGetCMP (ARCA payload). */
export interface ComprobanteE {
  id: number;
  fechaCbte: string;
  cbteTipo: number;
  puntoVta: number;
  cbteNro: number;
  tipoExpo: number;
  cliente: string;
  domicilioCliente: string;
  idImpositivo: string;
  monedaId: string;
  monedaCtz: number;
  impTotal: number;
  obsComerciales: string;
  formaPago: string;
  fechaPago: string;
  cae: string;
  fchVencCae: string;
  fechaCbteCae: string;
  items: ComprobanteEItem[];
}

export interface StoredComprobante extends ComprobanteE {
  syncedAt: string;
}

export interface FacturasIndex {
  lastSyncedAt: string | null;
  items: StoredComprobante[];
}

export const FACTURA_E_PUNTO_VENTA = 5;
export const FACTURA_E_TIPO = 19;
