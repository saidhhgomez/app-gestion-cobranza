import { brand } from '@/core/config/brand';
import type { Row } from '@/core/contracts';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
export function reportHtml(
  title: string,
  rows: Row[],
  context: { period?: string; property?: string },
) {
  const columns = Object.keys(rows[0] ?? {});
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>@page{size:A4 ${columns.length > 6 ? 'landscape' : 'portrait'};margin:16mm}body{font:12px Arial,sans-serif;color:#172B24}h1{color:#176B53;font-size:24px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{padding:7px;border-bottom:1px solid #DCE5DF;text-align:left;overflow-wrap:anywhere}th{background:#E3F2E9}tr{break-inside:avoid}thead{display:table-header-group}footer{margin-top:24px;color:#66756F;font-size:10px}</style></head><body><h1>${escapeHtml(brand.name)}</h1><h2>${escapeHtml(title)}</h2><p>${escapeHtml(context.property ?? 'Todos los inmuebles')} · Periodo ${escapeHtml(context.period ?? 'Todos')}</p><p>Generado: ${escapeHtml(new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: brand.timezone }).format(new Date()))}</p><table><thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length ? '' : '<p>Sin movimientos en el alcance seleccionado.</p>'}<footer>Documento de control interno. No es comprobante tributario ni documento autorizado por SUNAT.</footer></body></html>`;
}
export async function exportPdf(
  title: string,
  rows: Row[],
  context: { period?: string; property?: string } = {},
) {
  const { uri } = await Print.printToFileAsync({ html: reportHtml(title, rows, context) });
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      'El PDF se generó, pero este dispositivo no tiene opciones de compartir disponibles.',
    );
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: title,
  });
}
