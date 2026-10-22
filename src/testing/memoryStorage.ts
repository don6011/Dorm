import type { DeviceStorage } from '../account/service.ts';

/** Device storage for tests: one per test, and everything in it can be inspected. */
export function memoryStorage(): DeviceStorage & { dump(): string } {
  const items = new Map<string, string>();
  return {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
    dump: () => JSON.stringify([...items]),
  };
}

/** A date of birth (yyyy-mm-dd) `years` back from `now`, shifted by `days`. */
export function birthday(now: number, years: number, days = 0): string {
  const d = new Date(now);
  const b = new Date(d.getFullYear() - years, d.getMonth(), d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${b.getFullYear()}-${pad(b.getMonth() + 1)}-${pad(b.getDate())}`;
}
