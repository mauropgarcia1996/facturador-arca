import { NextRequest, NextResponse } from 'next/server';
import { getEmisorConfig } from '@/lib/config/emisor';
import { generateFacturaEPdf, pdfFilename } from '@/lib/pdf/factura-e';
import { getStoredComprobante } from '@/lib/storage/facturas';
import { FACTURA_E_TIPO } from '@/lib/types/comprobante';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const puntoVta = parsePositiveInt(params.get('puntoVta'));
    const cbteTipo = parsePositiveInt(params.get('cbteTipo')) ?? FACTURA_E_TIPO;
    const cbteNro = parsePositiveInt(params.get('cbteNro'));

    if (!puntoVta || !cbteNro) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: puntoVta, cbteNro' },
        { status: 400 }
      );
    }

    const comprobante = await getStoredComprobante(puntoVta, cbteTipo, cbteNro);
    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }

    const emisor = getEmisorConfig();
    const pdf = await generateFacturaEPdf(comprobante, emisor);
    const filename = pdfFilename(comprobante);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el PDF';
    console.error('Factura PDF error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
