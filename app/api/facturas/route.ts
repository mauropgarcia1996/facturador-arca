import { NextRequest, NextResponse } from 'next/server';
import { listStoredFacturas } from '@/lib/storage/facturas';

export async function GET() {
  try {
    const index = await listStoredFacturas();
    return NextResponse.json({
      success: true,
      lastSyncedAt: index.lastSyncedAt,
      items: index.items,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load facturas';
    console.error('Facturas list error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action !== 'complete-sync') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const { markFacturasSynced } = await import('@/lib/storage/facturas');
    const index = await markFacturasSynced();
    return NextResponse.json({
      success: true,
      lastSyncedAt: index.lastSyncedAt,
      count: index.items.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to complete sync';
    console.error('Facturas complete-sync error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
