export function money(cents: number): string {
  const decimal = unscale(Math.abs(cents));
  const [whole = '0', fraction] = decimal.split('.');
  return `S/ ${cents < 0 ? '-' : ''}${BigInt(whole).toLocaleString('es-PE')}.${fraction}`;
}
export function sumCents(values: readonly number[]): number {
  const sum = values.reduce((total, value) => {
    if (!Number.isSafeInteger(value)) throw new Error('El importe es demasiado grande.');
    return total + BigInt(value);
  }, 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('El total es demasiado grande. Reduce el rango de la consulta.');
  return Number(sum);
}
export function unscale(value: number, digits = 2): string {
  if (!Number.isSafeInteger(value)) throw new Error('El importe es demasiado grande.');
  const magnitude = BigInt(value < 0 ? -value : value);
  const factor = 10n ** BigInt(digits);
  return `${value < 0 ? '-' : ''}${magnitude / factor}.${String(magnitude % factor).padStart(digits, '0')}`;
}
export function scaled(value: string, digits = 2): number {
  const normalized = value.trim().replace(',', '.');
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`).test(normalized))
    throw new Error(`Ingresa un número positivo con hasta ${digits} decimales.`);
  const [whole = '0', fraction = ''] = normalized.split('.');
  const result = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El importe es demasiado grande.');
  return Number(result);
}
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function currentPeriod(): string {
  return today().slice(0, 7);
}
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function periodRange(period: string): [string, string] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    throw new Error('El periodo debe tener formato AAAA-MM.');
  const [y = 0, m = 0] = period.split('-').map(Number);
  return [`${period}-01`, `${period}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`];
}
