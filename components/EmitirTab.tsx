'use client';

import { useEffect, useState } from 'react';
import { ClienteExportacion, FacturaE } from '@/lib/types/factura';
import { AuthData } from '@/lib/types/auth';
import { StoredComprobante } from '@/lib/types/comprobante';
import { clientesGuardados, getClienteById } from '@/lib/db/clientes';
import { getPreferredPuntoVenta } from '@/lib/types/comprobante';

export interface EmitSuccessPayload {
  cae: string;
  numero: number;
  puntoVenta: number;
  fechaVencimiento: string;
  importeUsd: number;
  comprobante: StoredComprobante | null;
}

interface EmitirTabProps {
  auth: AuthData | null;
  authLoading: boolean;
  onError: (message: string | null) => void;
  onSuccess: (payload: EmitSuccessPayload) => void;
}

export function EmitirTab({ auth, authLoading, onError, onSuccess }: EmitirTabProps) {
  const [emitting, setEmitting] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('deel-inc');
  const [descripcion, setDescripcion] = useState<string>('software developing services');
  const [montoUSD, setMontoUSD] = useState<string>('1600');
  const [cantidad, setCantidad] = useState<string>('1');
  const [tipoCambio, setTipoCambio] = useState<number>(1000);
  const [fechaPago, setFechaPago] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchTipoCambio = async () => {
    if (!auth) return;
    try {
      const response = await fetch('/api/tipocambio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, moneda: 'DOL' }),
      });
      const data = await response.json();
      if (data.success) {
        setTipoCambio(data.tipoCambio || 1000);
      }
    } catch (err) {
      console.error('Error fetching tipo de cambio:', err);
    }
  };

  useEffect(() => {
    if (auth) {
      fetchTipoCambio();
    }
  }, [auth]);

  const handleEmitirFacturaE = async () => {
    if (!auth) {
      onError('No autenticado. Espere...');
      return;
    }

    const cliente = getClienteById(clienteSeleccionado);
    if (!cliente) {
      onError('Cliente no encontrado');
      return;
    }

    const monto = parseFloat(montoUSD);
    const qty = parseFloat(cantidad);

    if (isNaN(monto) || monto <= 0) {
      onError('Monto inválido');
      return;
    }

    try {
      setEmitting(true);
      onError(null);

      const factura: FacturaE = {
        cliente,
        descripcion,
        cantidad: qty,
        precioUnitario: monto,
        moneda: 'USD',
        tipoCambio,
        fechaPago,
        puntoVenta: getPreferredPuntoVenta(),
      };

      const response = await fetch('/api/factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, factura }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess({
          cae: data.cae,
          numero: data.numero,
          puntoVenta: data.puntoVenta ?? getPreferredPuntoVenta(),
          fechaVencimiento: data.fechaVencimiento,
          importeUsd: qty * monto,
          comprobante: data.comprobante ?? null,
        });
      } else {
        onError(data.error || 'Error al emitir factura');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al emitir factura';
      onError(message);
    } finally {
      setEmitting(false);
    }
  };

  const clienteActual = getClienteById(clienteSeleccionado);
  const totalUsd = parseFloat(montoUSD || '0') * parseFloat(cantidad || '1');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Cliente frecuente</label>
        <div className="grid grid-cols-1 gap-2">
          {clientesGuardados.map((cliente: ClienteExportacion) => (
            <button
              key={cliente.id}
              type="button"
              onClick={() => setClienteSeleccionado(cliente.id)}
              className={`min-h-[56px] rounded-lg border-2 p-3 text-left transition-all ${
                clienteSeleccionado === cliente.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-800">{cliente.nombre}</div>
              <div className="text-xs text-gray-500">{cliente.pais.nombre}</div>
            </button>
          ))}
        </div>
      </div>

      {clienteActual && (
        <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <div>
            <strong>Dirección:</strong> {clienteActual.direccion}
          </div>
          <div>
            <strong>ID:</strong> {clienteActual.idImpositivo}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Descripción servicio</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Cantidad</label>
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-blue-500"
            min="1"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Monto USD</label>
          <input
            type="number"
            value={montoUSD}
            onChange={(e) => setMontoUSD(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-blue-500"
            placeholder="1600"
          />
        </div>
      </div>

      <div className="rounded-lg bg-blue-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Tipo de cambio (ARCA):</span>
          <span className="font-semibold text-blue-700">{tipoCambio.toFixed(2)} ARS/USD</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">Fecha de pago</label>
        <input
          type="date"
          value={fechaPago}
          onChange={(e) => setFechaPago(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-lg bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Total USD:</span>
          <span className="text-2xl font-bold text-green-700">${totalUsd.toFixed(2)}</span>
        </div>
        <div className="mt-1 text-right text-xs text-gray-500">
          ≈ {(totalUsd * tipoCambio).toFixed(0)} ARS
        </div>
      </div>

      <button
        type="button"
        onClick={handleEmitirFacturaE}
        disabled={emitting || authLoading || !auth}
        className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:bg-gray-400"
      >
        {emitting ? 'Procesando...' : 'Emitir Factura E'}
      </button>
    </div>
  );
}
