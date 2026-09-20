'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/lib/actions/state'
import { requireOwner } from '@/lib/auth/require-staff'
import { parsePesoInput } from '@/lib/domain/money'
import { validateSettings, type Settings } from '@/lib/domain/settings'
import { createClient } from '@/lib/supabase/server'

const int = z.coerce.number().int()

/**
 * Owner-only: hours and rates change what customers are charged. The domain
 * validator runs first so the owner gets every problem in one go; the database
 * check constraints are the backstop.
 */
export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()

  const text = (name: string) => String(formData.get(name) ?? '').trim()
  const money = (name: string) => parsePesoInput(text(name))

  const rate = money('rate')
  const downpayment = money('downpayment')
  const paddleFee = money('paddle_fee')
  if (rate === null || downpayment === null || paddleFee === null) {
    return { error: 'Enter every peso amount as a number (e.g. 450 or 450.00).' }
  }

  const numbers = z
    .object({
      open_hour: int,
      close_hour: int,
      min_hours: int,
      max_hours: int,
      paddles_owned: int,
      hold_minutes: int,
    })
    .safeParse({
      open_hour: text('open_hour'),
      close_hour: text('close_hour'),
      min_hours: text('min_hours'),
      max_hours: text('max_hours'),
      paddles_owned: text('paddles_owned'),
      hold_minutes: text('hold_minutes'),
    })
  if (!numbers.success) return { error: 'Hours, paddles and hold time must be whole numbers.' }
  const n = numbers.data

  const closedWeekdays = formData
    .getAll('closed_weekdays')
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)

  // Accept a pasted URL or an @handle; store the bare page handle m.me expects.
  const facebookPage = text('facebook_page')
    .replace(/^https?:\/\/(www\.|m\.)?(facebook\.com|m\.me)\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')

  const settings: Settings = {
    openHour: n.open_hour,
    closeHour: n.close_hour,
    minHours: n.min_hours,
    maxHours: n.max_hours,
    closedWeekdays,
    rateCents: rate,
    downpaymentCents: downpayment,
    paddleFeeCents: paddleFee,
    paddlesOwned: n.paddles_owned,
    holdMinutes: n.hold_minutes,
    facebookPage,
    courtName: text('court_name') || 'Undefeated Pickleball',
  }

  const issues = validateSettings(settings)
  if (issues.length > 0) return { error: issues.join(' ') }

  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .update({
      open_hour: settings.openHour,
      close_hour: settings.closeHour,
      min_hours: settings.minHours,
      max_hours: settings.maxHours,
      closed_weekdays: settings.closedWeekdays,
      rate_cents: settings.rateCents,
      downpayment_cents: settings.downpaymentCents,
      paddle_fee_cents: settings.paddleFeeCents,
      paddles_owned: settings.paddlesOwned,
      hold_minutes: settings.holdMinutes,
      facebook_page: settings.facebookPage,
      court_name: settings.courtName,
      updated_by: owner.id,
    })
    .eq('id', 1)

  if (error) {
    console.error('saveSettings failed', error)
    return { error: 'Could not save. Please check the values and try again.' }
  }

  refresh()
  return {
    ok: true,
    message:
      settings.rateCents > 0
        ? 'Saved. The public calendar is live with these rules.'
        : 'Saved. Online booking stays closed until the hourly rate is above zero.',
  }
}
