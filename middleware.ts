import { NextRequest, NextResponse } from 'next/server';

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ARCA Facturador", charset="UTF-8"',
    },
  });
}

function getExpectedCredentials() {
  const username = process.env.APP_LOGIN_USER || 'arca';
  const password = process.env.APP_LOGIN_PASSWORD || 'changeme';
  return { username, password };
}

function parseBasicAuth(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header) return null;

  const [scheme, encoded] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'basic' || !encoded) return null;

  try {
    const decoded = atob(encoded);
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const expected = getExpectedCredentials();
  const provided = parseBasicAuth(req);

  if (!provided) return unauthorized();
  if (provided.username !== expected.username || provided.password !== expected.password) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

