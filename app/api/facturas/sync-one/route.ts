import { NextRequest, NextResponse } from 'next/server';
import { getComprobanteARCA, resolveFacturaEPuntoVenta } from '@/lib/arca/wsfe';
import { parseAuthPayload, requireCuit } from '@/lib/api/parse-auth';
import { upsertStoredComprobante } from '@/lib/storage/facturas';
import { FACTURA_E_TIPO } from '@/lib/types/comprobante';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authPayload = parseAuthPayload(body.auth);
    if (!authPayload) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    const numero = Number(body.numero);
    if (!Number.isInteger(numero) || numero <= 0) {
      return NextResponse.json({ error: 'Invalid numero' }, { status: 400 });
    }

    const cuit = requireCuit();
    const auth = { ...authPayload, cuit };
    const puntoVenta = await resolveFacturaEPuntoVenta(auth, body.puntoVenta);
    const tipoComprobante = body.tipoComprobante ?? FACTURA_E_TIPO;

    const comprobante = await getComprobanteARCA(
      auth,
      puntoVenta,
      tipoComprobante,
      numero
    );

    if (!comprobante) {
      return NextResponse.json({
        success: true,
        skipped: true,
        numero,
        puntoVenta,
        reason: 'not_found',
      });
    }

    const stored = await upsertStoredComprobante(comprobante);
    return NextResponse.json({
      success: true,
      skipped: false,
      puntoVenta,
      comprobante: stored,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to sync comprobante';
    console.error('Sync one error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
