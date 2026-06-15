'use client';

import { useCallback, useEffect, useState } from 'react';
import { StoredComprobante } from '@/lib/types/comprobante';
import {
  formatFechaARCA,
  formatNumeroComprobante,
} from '@/lib/utils/comprobante';
import { AuthData } from '@/lib/types/auth';

interface HistorialTabProps {
  auth: AuthData | null;
  refreshToken: number;
  selectedComprobante: StoredComprobante | null;
  onSelectComprobante: (comprobante: StoredComprobante | null) => void;
  onError: (message: string | null) => void;
}

function formatSyncedAt(value: string | null): string {
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function HistorialTab({
  auth,
  refreshToken,
  selectedComprobante,
  onSelectComprobante,
  onError,
}: HistorialTabProps) {
  const [items, setItems] = useState<StoredComprobante[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  const loadFacturas = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch('/api/facturas');
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'No se pudo cargar el historial');
      }
      setItems(data.items ?? []);
      setLastSyncedAt(data.lastSyncedAt ?? null);
      onError(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cargar historial';
      onError(message);
    } finally {
      setLoadingList(false);
    }
  }, [onError]);

  useEffect(() => {
    loadFacturas();
  }, [loadFacturas, refreshToken]);

  const handleSync = async () => {
    if (!auth) {
      onError('No autenticado. Espere la conexión con ARCA.');
      return;
    }

    setSyncing(true);
    setSyncProgress(null);
    onError(null);

    try {
      const response = await fetch('/api/facturas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'No se pudo sincronizar desde ARCA');
      }

      await loadFacturas();
      onError(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al sincronizar';
      onError(message);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const progressPercent =
    syncProgress && syncProgress.total > 0
      ? Math.round((syncProgress.current / syncProgress.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-6 border-b border-gray-100 bg-white px-6 pb-4 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Historial</h2>
            <p className="text-xs text-gray-500">Última sync: {formatSyncedAt(lastSyncedAt)}</p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || !auth}
            className="min-h-[44px] rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-gray-400"
          >
            {syncing ? 'Sync...' : 'Sync ARCA'}
          </button>
        </div>

        {syncing && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Importando desde ARCA</span>
              {syncProgress && syncProgress.total > 0 && (
                <span>
                  {syncProgress.current}/{syncProgress.total}
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full bg-blue-600 ${
                  syncProgress && syncProgress.total > 0 ? 'transition-all' : 'w-1/2 animate-pulse'
                }`}
                style={
                  syncProgress && syncProgress.total > 0
                    ? { width: `${progressPercent}%` }
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </div>

      {loadingList ? (
        <div className="py-8 text-center text-sm text-gray-500">Cargando historial...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="font-medium text-gray-800">No hay facturas guardadas</p>
          <p className="mt-2 text-sm text-gray-500">
            Importá tu historial desde ARCA para ver CAE, números e importes en cualquier
            dispositivo.
          </p>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || !auth}
            className="mt-4 min-h-[48px] w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
          >
            Import from ARCA
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const selected =
              selectedComprobante?.puntoVta === item.puntoVta &&
              selectedComprobante?.cbteNro === item.cbteNro;
            return (
              <button
                key={`${item.puntoVta}-${item.cbteTipo}-${item.cbteNro}`}
                type="button"
                onClick={() => onSelectComprobante(item)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium text-gray-900">
                  {formatFechaARCA(item.fechaCbte)} ·{' '}
                  {formatNumeroComprobante(item.puntoVta, item.cbteNro)} · $
                  {item.impTotal.toFixed(2)} {item.monedaId}
                </div>
                <div className="mt-1 text-xs text-gray-500">{item.cliente}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
