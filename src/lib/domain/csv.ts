/**
 * RFC 4180 CSV, the way Excel and Google Sheets actually read it.
 *
 * Values containing a comma, a quote, or a line break are quoted, and quotes are
 * doubled. A leading `=`, `+`, `-`, `@`, tab or CR is prefixed with an apostrophe
 * guard so a customer named `=HYPERLINK(...)` cannot become a formula when the
 * logbook is opened in a spreadsheet -- CSV injection is a real attack on exactly
 * this kind of export.
 */

const NEEDS_QUOTING = /[",\r\n]/
const FORMULA_LEAD = /^[=+\-@\t\r]/

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = String(value)

  if (FORMULA_LEAD.test(text)) text = `'${text}`

  if (NEEDS_QUOTING.test(text) || text.startsWith("'")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(',')
}

/** Whole document with CRLF line endings, which is what Excel expects. */
export function csvDocument(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const lines = [csvRow(header), ...rows.map(csvRow)]
  // Byte-order mark so Excel opens ₱ and accented names as UTF-8 by default.
  return '﻿' + lines.join('\r\n') + '\r\n'
}
