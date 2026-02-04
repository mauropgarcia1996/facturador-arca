import { ClienteExportacion } from '../types/factura';

export const clientesGuardados: ClienteExportacion[] = [
  {
    id: "deel-inc",
    nombre: "Deel Inc.",
    direccion: "425 1st St",
    ciudad: "San Francisco",
    estado: "CA",
    codigoPostal: "94105",
    pais: {
      nombre: "ESTADOS UNIDOS",
      codigoCUIT: "55000002126",
      codigoISO: "US",
      codigoDestino: 555
    },
    idImpositivo: "00611852855",
    servicioDefault: "software developing services",
    moneda: "USD"
  }
];

export function getClienteById(id: string): ClienteExportacion | undefined {
  return clientesGuardados.find(cliente => cliente.id === id);
}

export function getAllClientes(): ClienteExportacion[] {
  return clientesGuardados;
}
