// ⚠️ ARCHIVO GENERADO desde /shared/src — no lo edites aquí. Ejecutá: node scripts/sync-shared.mjs
import type { Cents } from './types';

/** $1.25 */
export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** $1 si es exacto, $1.25 si no. Útil para chips de “$1 de tomate”. */
export function formatCentsCorto(cents: Cents): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatCents(cents);
}

/** "1.25" o "$1.25" → 125. Devuelve null si no es válido. */
export function parseCents(texto: string): Cents | null {
  const limpio = texto.replace(/[$\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const [entero, dec = ''] = limpio.split('.');
  return Number(entero) * 100 + Number(dec.padEnd(2, '0'));
}
