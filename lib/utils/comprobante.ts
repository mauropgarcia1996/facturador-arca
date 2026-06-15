export function formatNumeroComprobante(puntoVta: number, cbteNro: number): string {
  return `${String(puntoVta).padStart(5, '0')}-${String(cbteNro).padStart(8, '0')}`;
}

export function formatFechaARCA(fecha: string): string {
  if (fecha.length !== 8) return fecha;
  return `${fecha.slice(6, 8)}/${fecha.slice(4, 6)}/${fecha.slice(0, 4)}`;
}

export function comprobanteKey(puntoVta: number, cbteTipo: number, cbteNro: number): string {
  return `${puntoVta}-${cbteTipo}-${cbteNro}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
