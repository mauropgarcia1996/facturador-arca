import { NextRequest, NextResponse } from 'next/server';
import { getUltimoNumeroAutorizado, resolveFacturaEPuntoVenta } from '@/lib/arca/wsfe';
import { parseAuthPayload, requireCuit } from '@/lib/api/parse-auth';
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

    return NextResponse.json({
      success: true,
      lastNro,
      puntoVenta,
      tipoComprobante,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to read sync metadata';
    console.error('Sync meta error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
