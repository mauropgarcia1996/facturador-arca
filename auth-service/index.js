/**
 * ARCA Auth Proxy - Microservice para autenticación WSAA con OpenSSL
 *
 * Desplegar en Railway, Render o Fly.io. Usa certificados locales o base64 en env.
 * La app en Vercel llama a este servicio para obtener token/sign.
 */
const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

/** Formato fecha ARCA: YYYY-MM-DDTHH:MM:SS-03:00 (hora Argentina) */
function formatARCADate(date) {
  const s = date.toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  return s.replace(' ', 'T') + '-03:00';
}

/** Resuelve rutas de cert/key: env paths o base64 -> /tmp */
function resolveCertPaths() {
  const certBase64 = process.env.ARCA_CERT_BASE64;
  const keyBase64 = process.env.ARCA_KEY_BASE64;
  const certPath = process.env.ARCA_CERT_PATH;
  const keyPath = process.env.ARCA_KEY_PATH;

  if (certBase64 && keyBase64) {
    const certPem = Buffer.from(certBase64.replace(/\s/g, ''), 'base64').toString('utf-8');
    const keyPem = Buffer.from(keyBase64.replace(/\s/g, ''), 'base64').toString('utf-8');
    if (!certPem.includes('-----BEGIN') || !keyPem.includes('-----BEGIN')) {
      throw new Error('ARCA_CERT_BASE64/ARCA_KEY_BASE64 must be PEM in base64');
    }
    const tmpBase = path.join(os.tmpdir(), `arca-${Date.now()}-`);
    const tmpCert = tmpBase + 'cert.pem';
    const tmpKey = tmpBase + 'key.pem';
    fs.writeFileSync(tmpCert, certPem, { mode: 0o600 });
    fs.writeFileSync(tmpKey, keyPem, { mode: 0o600 });
    return { certPath: tmpCert, keyPath: tmpKey };
  }

  if (certPath && keyPath) {
    return { certPath, keyPath };
  }

  throw new Error('Set ARCA_CERT_PATH+ARCA_KEY_PATH or ARCA_CERT_BASE64+ARCA_KEY_BASE64');
}

/** Firma LoginTicketRequest con OpenSSL CMS */
function signCMS(certPath, keyPath, data) {
  const tmpDir = os.tmpdir();
  const inputFile = path.join(tmpDir, `login-${Date.now()}.xml`);
  const outputFile = path.join(tmpDir, `signed-${Date.now()}.der`);

  try {
    fs.writeFileSync(inputFile, data, 'utf-8');
    execSync(
      `openssl cms -sign -in "${inputFile}" -signer "${certPath}" -inkey "${keyPath}" -nodetach -outform DER -out "${outputFile}"`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const der = fs.readFileSync(outputFile);
    return der.toString('base64').replace(/\s/g, '');
  } finally {
    try { fs.unlinkSync(inputFile); } catch (_) { }
    try { fs.unlinkSync(outputFile); } catch (_) { }
  }
}

/** Autentica con WSAA */
async function authenticateWSAA(cuit, certPath, keyPath, wsaaUrl) {
  const now = new Date();
  const generationTime = now;
  const expirationTime = new Date(now.getTime() + 12 * 60 * 60 * 1000); // AFIP max 12h
  const uniqueId = Math.floor(Date.now() / 1000);

  const loginTicketRequest = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${formatARCADate(generationTime)}</generationTime>
    <expirationTime>${formatARCADate(expirationTime)}</expirationTime>
  </header>
  <service>wsfex</service>
</loginTicketRequest>`;

  const cms = signCMS(certPath, keyPath, loginTicketRequest);

  const soapBody = `
      <loginCms xmlns="http://wsaa.afip.gov.ar/ws/services/LoginCms">
        <in0>${cms}</in0>
      </loginCms>
    `;

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>${soapBody}</soap:Body>
</soap:Envelope>`;

  const response = await fetch(wsaaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      SOAPAction: '""',
    },
    body: envelope,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`WSAA HTTP ${response.status}: ${errBody}`);
  }

  const xmlResponse = await response.text();
  let xmlToParse = xmlResponse;

  const loginCmsReturnMatch = xmlResponse.match(/<loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/);
  if (loginCmsReturnMatch) {
    xmlToParse = loginCmsReturnMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  const tokenMatch = xmlToParse.match(/<(?:\w+:)?token>([^<]+)<\/(?:\w+:)?token>/);
  const signMatch = xmlToParse.match(/<(?:\w+:)?sign>([^<]+)<\/(?:\w+:)?sign>/);
  const expMatch = xmlToParse.match(/<(?:\w+:)?expirationTime>([^<]+)<\/(?:\w+:)?expirationTime>/);

  const token = tokenMatch ? tokenMatch[1] : null;
  const sign = signMatch ? signMatch[1] : null;
  const expirationTimeStr = expMatch ? expMatch[1] : '';

  if (!token || !sign) {
    throw new Error('WSAA: Token or Sign not found in response');
  }

  return { token, sign, expirationTime: expirationTimeStr };
}

/** Middleware: verifica API key si ARCA_AUTH_API_KEY está definido */
function requireApiKey(req, res, next) {
  const apiKey = process.env.ARCA_AUTH_API_KEY;
  if (!apiKey) return next();
  const provided = req.headers['x-api-key'] || req.body?.apiKey;
  if (provided !== apiKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

app.post('/auth', requireApiKey, async (req, res) => {
  try {
    const cuit = process.env.ARCA_CUIT;
    const wsaaUrl = process.env.ARCA_WSAA_URL;

    if (!cuit || !wsaaUrl) {
      return res.status(500).json({
        error: 'Missing config',
        details: 'Set ARCA_CUIT and ARCA_WSAA_URL',
      });
    }

    const { certPath, keyPath } = resolveCertPaths();
    const auth = await authenticateWSAA(cuit, certPath, keyPath, wsaaUrl);

    res.json({
      success: true,
      token: auth.token,
      sign: auth.sign,
      expirationTime: auth.expirationTime,
    });
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    res.status(500).json({
      error: 'Authentication failed',
      message: err.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'arca-auth' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ARCA Auth Service listening on 0.0.0.0:${PORT}`);
});
