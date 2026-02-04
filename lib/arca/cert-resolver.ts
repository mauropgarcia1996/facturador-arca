/**
 * Resuelve rutas de certificado y clave para ARCA.
 * Soporta dos modos:
 * 1. Archivos locales: ARCA_CERT_PATH + ARCA_KEY_PATH (desarrollo)
 * 2. Base64 en env: ARCA_CERT_BASE64 + ARCA_KEY_BASE64 (Vercel/serverless)
 *
 * En modo base64, escribe a /tmp (disponible en Vercel) y retorna esas rutas.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export function resolveCertPaths(): { certPath: string; keyPath: string } {
  const certBase64 = process.env.ARCA_CERT_BASE64;
  const keyBase64 = process.env.ARCA_KEY_BASE64;
  const certPath = process.env.ARCA_CERT_PATH;
  const keyPath = process.env.ARCA_KEY_PATH;

  if (certBase64 && keyBase64) {
    try {
      const certPem = Buffer.from(certBase64.replace(/\s/g, ''), 'base64').toString('utf-8');
      const keyPem = Buffer.from(keyBase64.replace(/\s/g, ''), 'base64').toString('utf-8');

      if (!certPem.includes('-----BEGIN') || !keyPem.includes('-----BEGIN')) {
        throw new Error(
          'ARCA_CERT_BASE64/ARCA_KEY_BASE64 deben ser PEM en base64. Ej: echo -n "$(cat certificado.crt)" | base64 -w0'
        );
      }

      const tmpBase = join(tmpdir(), 'arca-' + Date.now() + '-');
      const tmpCert = tmpBase + 'cert.pem';
      const tmpKey = tmpBase + 'key.pem';
      writeFileSync(tmpCert, certPem, { mode: 0o600 });
      writeFileSync(tmpKey, keyPem, { mode: 0o600 });
      return { certPath: tmpCert, keyPath: tmpKey };
    } catch (e: any) {
      throw new Error(
        `Error con ARCA_CERT_BASE64/ARCA_KEY_BASE64: ${e.message}. Ver README.`
      );
    }
  }

  if (certPath && keyPath) {
    return { certPath, keyPath };
  }

  throw new Error(
    'Configura ARCA_CERT_PATH + ARCA_KEY_PATH (local) o ARCA_CERT_BASE64 + ARCA_KEY_BASE64 (Vercel). Ver README.'
  );
}
