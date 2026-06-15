'use client';

import {
  formatFechaARCA,
  formatNumeroComprobante,
  copyToClipboard,
} from '@/lib/utils/comprobante';
import { BottomSheet } from './BottomSheet';

interface EmitSuccessSheetProps {
  open: boolean;
  onClose: () => void;
  puntoVenta: number;
  numero: number;
  cae: string;
  fechaVencimiento: string;
  importeUsd: number;
  onViewHistorial: () => void;
  onEmitAnother: () => void;
}

export function EmitSuccessSheet({
  open,
  onClose,
  puntoVenta,
  numero,
  cae,
  fechaVencimiento,
  importeUsd,
  onViewHistorial,
  onEmitAnother,
}: EmitSuccessSheetProps) {
  const handleCopy = async (label: string, value: string) => {
    const ok = await copyToClipboard(value);
    if (!ok) {
      window.alert(`No se pudo copiar ${label}`);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Factura E emitida">
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <div className="text-2xl">✓</div>
          <div className="mt-1 text-lg font-bold text-green-800">
            {formatNumeroComprobante(puntoVenta, numero)}
          </div>
          <div className="text-sm text-green-700">${importeUsd.toFixed(2)} USD</div>
        </div>

        <div className="space-y-3 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">CAE</div>
              <div className="font-mono">{cae}</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('CAE', cae)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold"
            >
              Copiar
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">Vencimiento CAE</div>
              <div>{formatFechaARCA(fechaVencimiento)}</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('vencimiento CAE', fechaVencimiento)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold"
            >
              Copiar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={onViewHistorial}
            className="min-h-[48px] rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Ver en historial
          </button>
          <button
            type="button"
            onClick={onEmitAnother}
            className="min-h-[48px] rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700"
          >
            Emitir otra
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
