'use client';

import { useEffect, useState } from 'react';
import { BottomNav, AppTab } from '@/components/BottomNav';
import { EmitSuccessSheet } from '@/components/EmitSuccessSheet';
import { EmitSuccessPayload, EmitirTab } from '@/components/EmitirTab';
import { FacturaDetailSheet } from '@/components/FacturaDetailSheet';
import { HistorialTab } from '@/components/HistorialTab';
import { AuthData } from '@/lib/types/auth';
import { StoredComprobante } from '@/lib/types/comprobante';
import { FACTURA_E_PUNTO_VENTA } from '@/lib/types/comprobante';

export default function Home() {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('emitir');
  const [historialRefreshToken, setHistorialRefreshToken] = useState(0);
  const [successPayload, setSuccessPayload] = useState<EmitSuccessPayload | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [selectedComprobante, setSelectedComprobante] = useState<StoredComprobante | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const authenticate = async () => {
    try {
      setAuthLoading(true);
      const response = await fetch('/api/auth', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setAuth(data);
        setError(null);
      } else {
        setError('Error de autenticación con ARCA');
      }
    } catch {
      setError('No se pudo conectar con ARCA');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    authenticate();
  }, []);

  const handleEmitSuccess = (payload: EmitSuccessPayload) => {
    setSuccessPayload(payload);
    setSuccessOpen(true);
    setHistorialRefreshToken((value) => value + 1);
    setError(null);
  };

  const handleViewHistorial = () => {
    setSuccessOpen(false);
    setActiveTab('historial');
    if (successPayload?.comprobante) {
      setSelectedComprobante(successPayload.comprobante);
      setDetailOpen(true);
    }
  };

  const handleSelectComprobante = (comprobante: StoredComprobante | null) => {
    setSelectedComprobante(comprobante);
    setDetailOpen(Boolean(comprobante));
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="mx-auto max-w-md overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="bg-blue-600 p-4 text-white">
          <h1 className="text-center text-2xl font-bold">ARCA Facturador</h1>
          <p className="text-center text-sm opacity-90">Monotributo - Exportación</p>
          {auth ? (
            <div className="mt-2 rounded bg-blue-700 py-1 text-center text-xs">
              Conectado a ARCA
            </div>
          ) : (
            <div className="mt-2 rounded bg-yellow-500 py-1 text-center text-xs text-yellow-900">
              {authLoading ? 'Conectando...' : 'Sin conexión ARCA'}
            </div>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded border-l-4 border-red-500 bg-red-100 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {activeTab === 'emitir' ? (
            <EmitirTab
              auth={auth}
              authLoading={authLoading}
              onError={setError}
              onSuccess={handleEmitSuccess}
            />
          ) : (
            <HistorialTab
              auth={auth}
              refreshToken={historialRefreshToken}
              selectedComprobante={selectedComprobante}
              onSelectComprobante={handleSelectComprobante}
              onError={setError}
            />
          )}
        </div>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {successPayload && (
        <EmitSuccessSheet
          open={successOpen}
          onClose={() => setSuccessOpen(false)}
          puntoVenta={FACTURA_E_PUNTO_VENTA}
          numero={successPayload.numero}
          cae={successPayload.cae}
          fechaVencimiento={successPayload.fechaVencimiento}
          importeUsd={successPayload.importeUsd}
          onViewHistorial={handleViewHistorial}
          onEmitAnother={() => setSuccessOpen(false)}
        />
      )}

      <FacturaDetailSheet
        open={detailOpen}
        comprobante={selectedComprobante}
        onClose={() => {
          setDetailOpen(false);
          setSelectedComprobante(null);
        }}
      />
    </main>
  );
}
