import { NextRequest, NextResponse } from 'next/server';
import { getTipoCambio } from '@/lib/arca/wsfe';

export async function POST(request: NextRequest) {
  try {
    const { auth, moneda }: { auth: any; moneda?: string } = await request.json();

    if (!auth || !auth.token || !auth.sign) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      );
    }

    const cuit = process.env.ARCA_CUIT;
    if (!cuit) {
      return NextResponse.json(
        { error: 'Missing CUIT configuration' },
        { status: 500 }
      );
    }

    const tipoCambio = await getTipoCambio(
      { ...auth, cuit },
      moneda || 'DOL'
    );

    return NextResponse.json({
      success: true,
      tipoCambio,
      moneda: moneda || 'DOL',
      fecha: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Tipo cambio error:', error);
    return NextResponse.json(
      { error: 'Failed to get exchange rate' },
      { status: 500 }
    );
  }
}
