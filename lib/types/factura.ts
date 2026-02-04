export interface ClienteExportacion {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  pais: {
    nombre: string;
    codigoCUIT: string;
    codigoISO: string;
    codigoDestino: number; // Código Dst_cmp de FEXGetPARAM_DST_pais (ej: 555 USA)
  };
  idImpositivo: string;
  servicioDefault: string;
  moneda: string;
}

export interface FacturaE {
  cliente: ClienteExportacion;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
  tipoCambio: number;
  fechaPago: string;
  puntoVenta: number;
  numeroComprobante?: number;
  cae?: string;
  fechaVencimientoCae?: string;
}

export interface FacturaC {
  clienteNombre: string;
  clienteDni?: string;
  concepto: string;
  montoTotal: number;
  puntoVenta: number;
  numeroComprobante?: number;
  cae?: string;
  fechaVencimientoCae?: string;
}

export interface TipoCambio {
  moneda: string;
  tipoCambio: number;
  fecha: string;
}
