import { createAuthRequest } from './crypto';
import { createSOAPEnvelope } from './soap';

interface AuthResponse {
  token: string;
  sign: string;
  expirationTime: string;
}

export async function authenticateWSAA(
  cuit: string,
  certPath: string,
  keyPath: string,
  wsaaUrl: string
): Promise<AuthResponse> {
  try {
    console.log('[WSAA] URL:', wsaaUrl);

    const cms = await createAuthRequest(cuit, 'wsfex', certPath, keyPath);

    const soapBody = `
      <loginCms xmlns="http://wsaa.afip.gov.ar/ws/services/LoginCms">
        <in0>${cms}</in0>
      </loginCms>
    `;

    const envelope = createSOAPEnvelope(soapBody);

    console.log('[WSAA] SOAP Envelope:', envelope);

    const response = await fetch(wsaaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '""',
      },
      body: envelope,
    });

    console.log('[WSAA] HTTP Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[WSAA] Error Response Body:', errorBody);
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}\nResponse: ${errorBody}`);
    }

    const xmlResponse = await response.text();

    console.log('[WSAA] Full XML Response:', xmlResponse.substring(0, 500) + '...');

    // ARCA envía el contenido dentro de <loginCmsReturn> con HTML entities codificadas
    // Necesitamos extraer y decodificar primero
    let xmlToParse = xmlResponse;

    const loginCmsReturnMatch = xmlResponse.match(/<loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/);
    if (loginCmsReturnMatch) {
      // Decodificar HTML entities: &lt; -> <, &gt; -> >, &quot; -> ", etc.
      xmlToParse = loginCmsReturnMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

      console.log('[WSAA] Decoded inner XML:', xmlToParse.substring(0, 200) + '...');
    }

    // Parse the XML response using regex (Node.js compatible)
    // Handle both namespaced and non-namespaced elements
    const tokenMatch = xmlToParse.match(/<(?:\w+:)?token>([^<]+)<\/(?:\w+:)?token>/);
    const signMatch = xmlToParse.match(/<(?:\w+:)?sign>([^<]+)<\/(?:\w+:)?sign>/);
    const expirationTimeMatch = xmlToParse.match(/<(?:\w+:)?expirationTime>([^<]+)<\/(?:\w+:)?expirationTime>/);

    const token = tokenMatch ? tokenMatch[1] : null;
    const sign = signMatch ? signMatch[1] : null;
    const expirationTime = expirationTimeMatch ? expirationTimeMatch[1] : null;

    console.log('[WSAA] Parsed token:', token ? token.substring(0, 50) + '...' : 'null');
    console.log('[WSAA] Parsed sign:', sign ? sign.substring(0, 50) + '...' : 'null');
    console.log('[WSAA] Parsed expirationTime:', expirationTime || 'null');

    if (!token || !sign) {
      console.error('[WSAA] Full XML Response (missing token/sign):', xmlResponse);
      throw new Error('Invalid authentication response from WSAA - Token or Sign not found in response');
    }

    console.log('[WSAA] Authentication successful');
    console.log('[WSAA] Token:', token.substring(0, 50) + '...');
    console.log('[WSAA] Sign:', sign.substring(0, 50) + '...');

    return {
      token,
      sign,
      expirationTime: expirationTime || '',
    };
  } catch (error) {
    console.error('[WSAA] Authentication error:', error);
    throw new Error('Failed to authenticate with WSAA');
  }
}
