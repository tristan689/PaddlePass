import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/domain/settings'

export interface PublicSettings extends Settings {
  /** False until the owner enters a real hourly rate. Drives the setup banner. */
  isConfigured: boolean
}

/**
 * Court settings for rendering any page.
 *
 * Reads through get_public_settings(), a SECURITY DEFINER projection, rather than
 * selecting from the table -- `anon` has no privileges on public.settings, and the
 * projection is a hand-listed column set so a future sensitive column cannot be
 * published by accident.
 *
 * Not cached yet. Caching arrives with the availability work, where it actually
 * matters; settings are one indexed row and caching them now would only add a
 * tag-invalidation path with nothing to show for it.
 */
export async function getSettings(): Promise<PublicSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_public_settings').maybeSingle()

  if (error) throw new Error(`Could not load court settings: ${error.message}`)

  // Before the first migration runs there is no row. Fall back to defaults so the
  // page renders its "not set up yet" state instead of a 500.
  if (!data) return { ...DEFAULT_SETTINGS, isConfigured: false }

  const row = data as Record<string, unknown>

  return {
    openHour: Number(row.open_hour),
    closeHour: Number(row.close_hour),
    minHours: Number(row.min_hours),
    maxHours: Number(row.max_hours),
    closedWeekdays: (row.closed_weekdays as number[] | null) ?? [],
    rateCents: Number(row.rate_cents),
    downpaymentCents: Number(row.downpayment_cents),
    paddleFeeCents: Number(row.paddle_fee_cents),
    paddlesOwned: Number(row.paddles_owned),
    holdMinutes: Number(row.hold_minutes),
    facebookPage: String(row.facebook_page),
    courtName: String(row.court_name),
    isConfigured: Boolean(row.is_configured),
  }
}
