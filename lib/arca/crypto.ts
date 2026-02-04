import { readFileSync } from 'fs';
import forge from 'node-forge';

/** Firma el LoginTicketRequest con PKCS#7/CMS usando node-forge (sin OpenSSL, funciona en Vercel) */
export async function signCMS(
  certPath: string,
  keyPath: string,
  data: string
): Promise<string> {
  const certPem = readFileSync(certPath, 'utf-8');
  const keyPem = readFileSync(keyPath, 'utf-8');

  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(data, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: false });

  const asn1 = p7.toAsn1();
  const der = forge.asn1.toDer(asn1).getBytes();
  return forge.util.encode64(der).replace(/\s/g, '');
}

function formatARCADate(date: Date): string {
  // ARCA requiere formato específico: YYYY-MM-DDTHH:MM:SS-03:00 (zona horaria Argentina)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
}

export function createAuthRequest(
  cuit: string,
  service: string,
  certPath: string,
  keyPath: string
): Promise<string> {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutos antes (para evitar desfases)
  const expirationTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas después

  const uniqueId = Math.floor(Date.now() / 1000);

  // XML exacto que ARCA espera (sin espacios extras, formato específico)
  const loginTicketRequest = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${formatARCADate(generationTime)}</generationTime>
    <expirationTime>${formatARCADate(expirationTime)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;

  console.log('LoginTicketRequest:', loginTicketRequest);

  return signCMS(certPath, keyPath, loginTicketRequest);
}
