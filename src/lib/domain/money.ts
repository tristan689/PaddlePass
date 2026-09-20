/**
 * Peso amounts, always as integer centavos.
 *
 * Nothing in this app stores money as a float. A ledger that drifts by a centavo
 * per rounding is a ledger people stop trusting, and you cannot reconstruct the
 * truth afterwards. Pesos exist only at the edges: parsed on input, formatted on
 * display, integers everywhere in between.
 */

/** Centavos in one peso. */
const CENTAVOS = 100

export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * CENTAVOS)
}

export function centavosToPesos(centavos: number): number {
  return centavos / CENTAVOS
}

/** `105000` -> `"₱1,050.00"` */
export function formatPeso(centavos: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(centavosToPesos(centavos))
}

/** `105000` -> `"₱1,050"`. Drops centavos when they're zero, for tight UI. */
export function formatPesoCompact(centavos: number): string {
  const hasCentavos = centavos % CENTAVOS !== 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: hasCentavos ? 2 : 0,
    maximumFractionDigits: hasCentavos ? 2 : 0,
  }).format(centavosToPesos(centavos))
}

/** `105000` -> `"1050.00"`. For CSV, where Excel must be able to sum the column. */
export function formatPesoPlain(centavos: number): string {
  return centavosToPesos(centavos).toFixed(2)
}

/**
 * Parse what a human typed into centavos. Tolerates `₱`, thousands separators and
 * stray spaces, because staff type fast. Returns `null` for anything unparseable
 * rather than silently yielding 0 -- a mistyped amount must not become free court time.
 */
export function parsePesoInput(raw: string): number | null {
  const cleaned = raw.replace(/[₱,\s]/g, '').trim()
  if (cleaned === '') return null
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null

  const pesos = Number(cleaned)
  if (!Number.isFinite(pesos)) return null

  return pesosToCentavos(pesos)
}
