import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { EmisorConfig } from '@/lib/config/emisor';
import { StoredComprobante } from '@/lib/types/comprobante';
import { formatFechaARCA, formatNumeroComprobante } from '@/lib/utils/comprobante';
import { buildAfipQrPayload } from './afip-qr';

const PAGE_MARGIN = 48;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;

function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number
): number {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#666666').text(label, PAGE_MARGIN, y);
  doc.font('Helvetica').fontSize(10).fillColor('#111111').text(value, PAGE_MARGIN, y + 12, {
    width: CONTENT_WIDTH,
  });
  return y + 34;
}

function drawItemsTable(doc: PDFKit.PDFDocument, comprobante: StoredComprobante, startY: number): number {
  const colWidths = [CONTENT_WIDTH * 0.52, CONTENT_WIDTH * 0.12, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.18];
  const headers = ['Descripción', 'Cant.', 'Precio unit.', 'Total'];
  let y = startY;

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111');
  headers.forEach((header, index) => {
    const x =
      PAGE_MARGIN +
      colWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
    doc.text(header, x, y, { width: colWidths[index] });
  });

  y += 16;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).strokeColor('#dddddd').stroke();
  y += 8;

  doc.font('Helvetica').fontSize(9).fillColor('#222222');
  for (const item of comprobante.items) {
    const values = [
      item.proDs,
      item.proQty.toString(),
      `${item.proPrecioUni.toFixed(2)} ${comprobante.monedaId}`,
      `${item.proTotalItem.toFixed(2)} ${comprobante.monedaId}`,
    ];
    values.forEach((value, index) => {
      const x =
        PAGE_MARGIN +
        colWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
      doc.text(value, x, y, { width: colWidths[index] });
    });
    y += 18;
  }

  return y + 8;
}

export async function generateFacturaEPdf(
  comprobante: StoredComprobante,
  emisor: EmisorConfig
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
  const bufferPromise = docToBuffer(doc);

  const numero = formatNumeroComprobante(comprobante.puntoVta, comprobante.cbteNro);
  const qrUrl = buildAfipQrPayload(comprobante, emisor.cuit);
  const qrImage = await QRCode.toBuffer(qrUrl, {
    type: 'png',
    margin: 1,
    width: 160,
    errorCorrectionLevel: 'M',
  });

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text('FACTURA E', PAGE_MARGIN, PAGE_MARGIN);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#444444')
    .text('Comprobante de exportación de servicios', PAGE_MARGIN, doc.y + 4);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111111')
    .text(`Nº ${numero}`, PAGE_MARGIN, doc.y + 12);

  let y = doc.y + 24;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text('Emisor', PAGE_MARGIN, y);
  y += 16;
  doc.font('Helvetica').fontSize(10).fillColor('#222222');
  doc.text(emisor.razonSocial, PAGE_MARGIN, y);
  y += 14;
  doc.text(`CUIT: ${emisor.cuit}`, PAGE_MARGIN, y);
  if (emisor.domicilio) {
    y += 14;
    doc.text(emisor.domicilio, PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.62 });
  }

  const rightColumnX = PAGE_MARGIN + CONTENT_WIDTH * 0.62;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text('Comprobante', rightColumnX, y - (emisor.domicilio ? 42 : 28));
  doc.font('Helvetica').fontSize(10).fillColor('#222222');
  doc.text(`Fecha: ${formatFechaARCA(comprobante.fechaCbte)}`, rightColumnX, doc.y + 4);
  doc.text(`Fecha de pago: ${formatFechaARCA(comprobante.fechaPago)}`, rightColumnX, doc.y + 2);
  doc.text(`Forma de pago: ${comprobante.formaPago}`, rightColumnX, doc.y + 2);

  y = Math.max(y + 24, doc.y + 16);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text('Cliente', PAGE_MARGIN, y);
  y += 16;
  doc.font('Helvetica').fontSize(10).fillColor('#222222');
  doc.text(comprobante.cliente, PAGE_MARGIN, y);
  y += 14;
  doc.text(comprobante.domicilioCliente, PAGE_MARGIN, y, { width: CONTENT_WIDTH });
  if (comprobante.idImpositivo) {
    y += 14;
    doc.text(`ID impositivo: ${comprobante.idImpositivo}`, PAGE_MARGIN, y);
  }

  y += 28;
  y = drawItemsTable(doc, comprobante, y);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111111')
    .text('Importe total', PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.7, align: 'left' });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#166534')
    .text(
      `${comprobante.impTotal.toFixed(2)} ${comprobante.monedaId}`,
      PAGE_MARGIN,
      y,
      { width: CONTENT_WIDTH, align: 'right' }
    );

  y += 22;
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#666666')
    .text(
      `Cotización ARCA: ${comprobante.monedaCtz.toFixed(2)}`,
      PAGE_MARGIN,
      y,
      { width: CONTENT_WIDTH, align: 'right' }
    );

  y += 28;
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 92, 8).fillAndStroke('#f8fafc', '#e5e7eb');
  const boxY = y + 14;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Autorización ARCA', PAGE_MARGIN + 14, boxY);
  doc.font('Helvetica').fontSize(10).fillColor('#222222');
  doc.text(`CAE: ${comprobante.cae}`, PAGE_MARGIN + 14, boxY + 18);
  doc.text(`Vencimiento CAE: ${formatFechaARCA(comprobante.fchVencCae)}`, PAGE_MARGIN + 14, boxY + 34);
  doc.text(`Fecha CAE: ${formatFechaARCA(comprobante.fechaCbteCae)}`, PAGE_MARGIN + 14, boxY + 50);

  doc.image(qrImage, PAGE_MARGIN + CONTENT_WIDTH - 126, boxY - 2, { width: 72, height: 72 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#666666')
    .text('Verificar en ARCA', PAGE_MARGIN + CONTENT_WIDTH - 126, boxY + 74, {
      width: 72,
      align: 'center',
    });

  if (comprobante.obsComerciales) {
    y += 108;
    y = drawLabelValue(doc, 'Observaciones', comprobante.obsComerciales, y);
  }

  doc.end();
  return bufferPromise;
}

export function pdfFilename(comprobante: StoredComprobante): string {
  const numero = formatNumeroComprobante(comprobante.puntoVta, comprobante.cbteNro);
  return `factura-e-${numero.replace('/', '-')}.pdf`;
}
