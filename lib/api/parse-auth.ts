export interface AuthPayload {
  token: string;
  sign: string;
}

export function parseAuthPayload(auth: unknown): AuthPayload | null {
  if (!auth || typeof auth !== 'object') return null;
  const { token, sign } = auth as Record<string, unknown>;
  if (typeof token !== 'string' || typeof sign !== 'string') return null;
  if (!token || !sign) return null;
  return { token, sign };
}

export function requireCuit(): string {
  const cuit = process.env.ARCA_CUIT;
  if (!cuit) {
    throw new Error('Missing CUIT configuration');
  }
  return cuit;
}
