export function createSOAPEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

// Nota: parseXMLResponse eliminado - usar regex para parsear XML en Node.js
