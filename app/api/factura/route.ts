import { NextRequest, NextResponse } from 'next/server';
import { emitirFacturaE, getComprobanteARCA } from '@/lib/arca/wsfe';
import { parseAuthPayload, requireCuit } from '@/lib/api/parse-auth';
import { upsertStoredComprobante } from '@/lib/storage/facturas';
import { FacturaE } from '@/lib/types/factura';
import { FACTURA_E_TIPO } from '@/lib/types/comprobante';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authPayload = parseAuthPayload(body.auth);
    const factura = body.factura as FacturaE | undefined;

    if (!authPayload) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }
    if (!factura) {
      return NextResponse.json({ error: 'Missing factura payload' }, { status: 400 });
    }

    const cuit = requireCuit();
    const auth = { ...authPayload, cuit };

    const result = await emitirFacturaE(auth, factura);

    let stored = null;
    try {
      const comprobante = await getComprobanteARCA(
        auth,
        factura.puntoVenta,
        FACTURA_E_TIPO,
        result.numero
      );
      if (comprobante) {
        stored = await upsertStoredComprobante(comprobante);
      }
    } catch (storageError) {
      console.error('Factura saved in ARCA but storage upsert failed:', storageError);
    }

    return NextResponse.json({
      success: true,
      cae: result.cae,
      numero: result.numero,
      fechaVencimiento: result.fechaVencimiento,
      comprobante: stored,
      stored: Boolean(stored),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to emit invoice';
    console.error('Factura error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
