import { NextRequest, NextResponse } from 'next/server';
import { getPuntosVentaARCA } from '@/lib/arca/wsfe';

export async function POST(request: NextRequest) {
  try {
    const { auth } = await request.json();

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

    const puntos = await getPuntosVentaARCA({ ...auth, cuit });
    const habilitados = puntos.filter(
      (p) => p.bloqueado?.toUpperCase() !== 'S' && !p.fechaBaja?.trim()
    );

    return NextResponse.json({
      success: true,
      puntos,
      habilitados,
    });
  } catch (error: any) {
    console.error('Puntos venta error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get points of sale' },
      { status: 500 }
    );
  }
}
