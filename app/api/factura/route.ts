import { NextRequest, NextResponse } from 'next/server';
import { emitirFacturaE } from '@/lib/arca/wsfe';
import { FacturaE } from '@/lib/types/factura';

export async function POST(request: NextRequest) {
  try {
    const { auth, factura }: { auth: any; factura: FacturaE } = await request.json();

    console.log('[Factura API] Auth present:', !!auth, 'Token:', auth?.token?.substring(0, 20) + '...', 'Sign:', auth?.sign?.substring(0, 20) + '...');
    console.log('[Factura API] Factura:', JSON.stringify(factura, null, 2));

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

    console.log('[Factura API] Calling emitirFacturaE with CUIT:', cuit);
    const result = await emitirFacturaE(
      { ...auth, cuit },
      factura
    );

    return NextResponse.json({
      success: true,
      cae: result.cae,
      numero: result.numero,
      fechaVencimiento: result.fechaVencimiento,
    });
  } catch (error: any) {
    console.error('Factura error:', error);
    console.error('Factura error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to emit invoice', details: error.stack },
      { status: 500 }
    );
  }
}
