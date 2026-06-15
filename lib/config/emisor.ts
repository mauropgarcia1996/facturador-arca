export interface EmisorConfig {
  cuit: string;
  razonSocial: string;
  domicilio: string;
}

export function getEmisorConfig(): EmisorConfig {
  const cuit = process.env.ARCA_CUIT?.trim();
  if (!cuit) {
    throw new Error('ARCA_CUIT no configurado');
  }

  return {
    cuit,
    razonSocial: process.env.EMISOR_RAZON_SOCIAL?.trim() || 'Contribuyente',
    domicilio: process.env.EMISOR_DOMICILIO?.trim() || '',
  };
}
