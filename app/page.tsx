'use client';

import { useState, useEffect } from 'react';
import { ClienteExportacion, FacturaE } from '@/lib/types/factura';
import { clientesGuardados, getClienteById } from '@/lib/db/clientes';

interface AuthData {
  token: string;
  sign: string;
  expirationTime: string;
}

export default function Home() {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Formulario Factura E
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('deel-inc');
  const [descripcion, setDescripcion] = useState<string>('software developing services');
  const [montoUSD, setMontoUSD] = useState<string>('1600');
  const [cantidad, setCantidad] = useState<string>('1');
  const [tipoCambio, setTipoCambio] = useState<number>(1000);
  const [fechaPago, setFechaPago] = useState<string>(new Date().toISOString().split('T')[0]);
  const [resultado, setResultado] = useState<{ cae: string; numero: number } | null>(null);
  
  // Autenticación automática al cargar
  useEffect(() => {
    authenticate();
  }, []);
  
  // Obtener tipo de cambio automático
  useEffect(() => {
    if (auth) {
      fetchTipoCambio();
    }
  }, [auth]);
  
  const authenticate = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setAuth(data);
        setError(null);
      } else {
        setError('Error de autenticación con ARCA');
      }
    } catch (err) {
      setError('No se pudo conectar con ARCA');
    } finally {
      setLoading(false);
    }
  };
  
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
  
  const handleEmitirFacturaE = async () => {
    if (!auth) {
      setError('No autenticado. Espere...');
      return;
    }
    
    const cliente = getClienteById(clienteSeleccionado);
    if (!cliente) {
      setError('Cliente no encontrado');
      return;
    }
    
    const monto = parseFloat(montoUSD);
    const qty = parseFloat(cantidad);
    
    if (isNaN(monto) || monto <= 0) {
      setError('Monto inválido');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const factura: FacturaE = {
        cliente,
        descripcion,
        cantidad: qty,
        precioUnitario: monto,
        moneda: 'USD',
        tipoCambio,
        fechaPago,
        puntoVenta: 5, // Punto de venta para Factura E
      };
      
      const response = await fetch('/api/factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth, factura }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResultado({ cae: data.cae, numero: data.numero });
        setSuccess(`Factura E emitida correctamente`);
      } else {
        setError(data.error || 'Error al emitir factura');
      }
    } catch (err: any) {
      setError(err.message || 'Error al emitir factura');
    } finally {
      setLoading(false);
    }
  };
  
  const clienteActual = getClienteById(clienteSeleccionado);
  
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 p-4 text-white">
          <h1 className="text-2xl font-bold text-center">💰 ARCA Facturador</h1>
          <p className="text-center text-sm opacity-90">Monotributo - Exportación</p>
          {auth ? (
            <div className="mt-2 text-xs text-center bg-blue-700 rounded py-1">
              ✅ Conectado a ARCA
            </div>
          ) : (
            <div className="mt-2 text-xs text-center bg-yellow-500 rounded py-1 text-yellow-900">
              ⏳ Conectando...
            </div>
          )}
        </div>
        
        <div className="p-6 space-y-6">
          {/* Selección de Cliente */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">🧑‍💼 Cliente Frecuente</label>
            <div className="grid grid-cols-1 gap-2">
              {clientesGuardados.map((cliente) => (
                <button
                  key={cliente.id}
                  onClick={() => setClienteSeleccionado(cliente.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
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
          
          {/* Info del cliente seleccionado */}
          {clienteActual && (
            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 space-y-1">
              <div><strong>Dirección:</strong> {clienteActual.direccion}</div>
              <div><strong>ID:</strong> {clienteActual.idImpositivo}</div>
            </div>
          )}
          
          {/* Descripción del servicio */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">📝 Descripción Servicio</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              rows={2}
            />
          </div>
          
          {/* Cantidad y Monto */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Cantidad</label>
              <input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Monto USD</label>
              <input
                type="number"
                value={montoUSD}
                onChange={(e) => setMontoUSD(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="1600"
              />
            </div>
          </div>
          
          {/* Tipo de cambio (automático) */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">💱 Tipo de cambio (Bluelytics):</span>
              <span className="font-semibold text-blue-700">{tipoCambio.toFixed(2)} ARS/USD</span>
            </div>
          </div>
          
          {/* Fecha de pago */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">📅 Fecha de Pago</label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Total estimado */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">Total USD:</span>
              <span className="text-2xl font-bold text-green-700">
                ${(parseFloat(montoUSD || '0') * parseFloat(cantidad || '1')).toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">
              ≈ {((parseFloat(montoUSD || '0') * parseFloat(cantidad || '1')) * tipoCambio).toFixed(0)} ARS
            </div>
          </div>
          
          {/* Botón Emitir */}
          <button
            onClick={handleEmitirFacturaE}
            disabled={loading || !auth}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform active:scale-95 transition-all text-lg"
          >
            {loading ? '⏳ Procesando...' : '🚀 EMITIR FACTURA E'}
          </button>
          
          {/* Mensajes */}
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded">
              <p className="text-green-700 font-semibold">{success}</p>
              {resultado && (
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <div><strong>CAE:</strong> {resultado.cae}</div>
                  <div><strong>Número:</strong> 00005-{String(resultado.numero).padStart(8, '0')}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
