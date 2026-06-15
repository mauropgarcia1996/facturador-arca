import { NextRequest, NextResponse } from 'next/server';
import {
  getComprobanteARCA,
  getUltimoNumeroAutorizado,
  resolveFacturaEPuntoVenta,
} from '@/lib/arca/wsfe';
import { parseAuthPayload, requireCuit } from '@/lib/api/parse-auth';
import { getStorageMode, replaceSyncedComprobantes } from '@/lib/storage/facturas';
import { FACTURA_E_TIPO } from '@/lib/types/comprobante';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authPayload = parseAuthPayload(body.auth);
    if (!authPayload) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    const cuit = requireCuit();
    const auth = { ...authPayload, cuit };
    const puntoVenta = await resolveFacturaEPuntoVenta(auth, body.puntoVenta);
    const tipoComprobante = body.tipoComprobante ?? FACTURA_E_TIPO;

    const lastNro = await getUltimoNumeroAutorizado(auth, puntoVenta, tipoComprobante);
    const comprobantes = [];
    let skipped = 0;

    for (let numero = 1; numero <= lastNro; numero += 1) {
      const comprobante = await getComprobanteARCA(
        auth,
        puntoVenta,
        tipoComprobante,
        numero
      );
      if (comprobante) {
        comprobantes.push(comprobante);
      } else {
        skipped += 1;
      }
    }

    const index = await replaceSyncedComprobantes(
      puntoVenta,
      tipoComprobante,
      comprobantes
    );

    return NextResponse.json({
      success: true,
      storageMode: getStorageMode(),
      puntoVenta,
      lastNro,
      imported: comprobantes.length,
      skipped,
      lastSyncedAt: index.lastSyncedAt,
      count: index.items.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to sync facturas';
    console.error('Facturas sync error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
