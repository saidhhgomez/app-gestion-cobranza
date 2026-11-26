import {
  dateLabel,
  money,
  periodRange,
  scaled,
  sumCents,
  unscale,
  validDate,
} from '@/shared/formatting';
test('decimales y moneda sin errores binarios', () => {
  expect(scaled('0.29')).toBe(29);
  expect(scaled('1,005', 3)).toBe(1005);
  expect(() => scaled('1.005')).toThrow();
  expect(() => scaled('-1')).toThrow();
  expect(() => scaled('9007199254740992')).toThrow();
  expect(money(1234)).toContain('12.34');
});
test('conserva el último céntimo y rechaza totales fuera del rango seguro', () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  expect(unscale(maximum)).toBe('90071992547409.91');
  expect(scaled(unscale(maximum))).toBe(maximum);
  expect(money(maximum)).toContain('.91');
  expect(money(-1)).toBe('S/ -0.01');
  expect(sumCents([maximum - 1, 1])).toBe(maximum);
  expect(() => sumCents([maximum, 1])).toThrow('total');
  expect(() => money(maximum + 1)).toThrow();
});
test('fechas civiles y bisiestos', () => {
  expect(validDate('2024-02-29')).toBe(true);
  expect(validDate('2025-02-29')).toBe(false);
  expect(dateLabel('2026-11-25')).toBe('25/11/2026');
  expect(periodRange('2024-02')).toEqual(['2024-02-01', '2024-02-29']);
  expect(() => periodRange('2026-13')).toThrow();
});
