'use client';

import { StoredComprobante } from '@/lib/types/comprobante';
import {
  copyToClipboard,
  formatFechaARCA,
  formatNumeroComprobante,
} from '@/lib/utils/comprobante';
import { BottomSheet } from './BottomSheet';

interface FacturaDetailSheetProps {
  open: boolean;
  comprobante: StoredComprobante | null;
  onClose: () => void;
}

export function FacturaDetailSheet({ open, comprobante, onClose }: FacturaDetailSheetProps) {
  if (!comprobante) return null;

  const descripcion =
    comprobante.items[0]?.proDs || comprobante.obsComerciales || 'Servicio exportación';

  const handleCopy = async (label: string, value: string) => {
    const ok = await copyToClipboard(value);
    if (!ok) {
      window.alert(`No se pudo copiar ${label}`);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Detalle factura">
      <div className="space-y-4 text-sm text-gray-700">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Número</div>
          <div className="text-lg font-semibold text-gray-900">
            {formatNumeroComprobante(comprobante.puntoVta, comprobante.cbteNro)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500">Fecha comprobante</div>
            <div>{formatFechaARCA(comprobante.fechaCbte)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Fecha pago</div>
            <div>{formatFechaARCA(comprobante.fechaPago)}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Cliente</div>
          <div className="font-medium">{comprobante.cliente}</div>
          <div className="text-xs text-gray-500">{comprobante.domicilioCliente}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Descripción</div>
          <div>{descripcion}</div>
        </div>

        <div className="rounded-lg bg-green-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">Importe total</div>
              <div className="text-xl font-bold text-green-700">
                ${comprobante.impTotal.toFixed(2)} {comprobante.monedaId}
              </div>
              <div className="text-xs text-gray-500">
                Cotización ARCA: {comprobante.monedaCtz.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">CAE</div>
              <div className="font-mono text-sm">{comprobante.cae}</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('CAE', comprobante.cae)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700"
            >
              Copiar
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">Vencimiento CAE</div>
              <div>{formatFechaARCA(comprobante.fchVencCae)}</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('vencimiento CAE', comprobante.fchVencCae)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700"
            >
              Copiar
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
