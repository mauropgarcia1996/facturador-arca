import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const { authenticateWSAA } = await import('../lib/arca/wsaa');
  const { resolveCertPaths } = await import('../lib/arca/cert-resolver');
  const {
    getPuntosVentaARCA,
    getUltimoNumeroAutorizado,
    getComprobanteARCA,
    resolveFacturaEPuntoVenta,
  } = await import('../lib/arca/wsfe');
  const { getPreferredPuntoVenta, FACTURA_E_TIPO } = await import('../lib/types/comprobante');

  const cuit = process.env.ARCA_CUIT!;
  const wsaaUrl = process.env.ARCA_WSAA_URL!;
  const { certPath, keyPath } = await resolveCertPaths();
  const auth = await authenticateWSAA(cuit, certPath, keyPath, wsaaUrl);
  const arcaAuth = { token: auth.token, sign: auth.sign, cuit };

  const puntos = await getPuntosVentaARCA(arcaAuth);
  const preferido = getPreferredPuntoVenta();
  const puntoVenta = await resolveFacturaEPuntoVenta(arcaAuth);

  console.log('Preferido (env/UI):', preferido);
  console.log('Puntos FEEWS en ARCA:', puntos.map((p) => p.numero));
  console.log('Punto resuelto para sync:', puntoVenta);

  const lastNro = await getUltimoNumeroAutorizado(arcaAuth, puntoVenta, FACTURA_E_TIPO);
  console.log('Último comprobante:', lastNro);

  if (lastNro > 0) {
    console.log('Comprobantes en ARCA:');
    let found = 0;
    for (let n = 1; n <= lastNro; n += 1) {
      const cmp = await getComprobanteARCA(arcaAuth, puntoVenta, FACTURA_E_TIPO, n);
      if (cmp) {
        found += 1;
        console.log(`  ${n}: OK $${cmp.impTotal} CAE ${cmp.cae}`);
      } else {
        console.log(`  ${n}: (no existe)`);
      }
    }
    console.log(`Total encontrados: ${found}/${lastNro}`);
  }
}

main().catch(console.error);
