import { NextRequest, NextResponse } from 'next/server';
import { authenticateWSAA } from '@/lib/arca/wsaa';
import { resolveCertPaths } from '@/lib/arca/cert-resolver';

export async function POST(request: NextRequest) {
  try {
    const authServiceUrl = process.env.ARCA_AUTH_SERVICE_URL;

    // Si hay auth service (Railway/Render), delegar ahí
    if (authServiceUrl) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.ARCA_AUTH_API_KEY;
      if (apiKey) headers['X-Api-Key'] = apiKey;

      const res = await fetch(`${authServiceUrl.replace(/\/$/, '')}/auth`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data.error || 'Auth service error', message: data.message },
          { status: res.status }
        );
      }
      return NextResponse.json(data);
    }

    // Flujo local (desarrollo)
    const cuit = process.env.ARCA_CUIT;
    const wsaaUrl = process.env.ARCA_WSAA_URL;

    if (!cuit || !wsaaUrl) {
      return NextResponse.json(
        {
          error: 'Missing ARCA configuration',
          details: { cuit: !!cuit, wsaaUrl: !!wsaaUrl },
        },
        { status: 500 }
      );
    }

    const { certPath, keyPath } = resolveCertPaths();
    const auth = await authenticateWSAA(cuit, certPath, keyPath, wsaaUrl);

    return NextResponse.json({
      success: true,
      token: auth.token,
      sign: auth.sign,
      expirationTime: auth.expirationTime,
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', message: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
