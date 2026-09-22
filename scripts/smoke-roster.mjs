// End-to-end check of the member roster against the live project, then cleanup.
//
//   node scripts/smoke-roster.mjs <staff-login> <staff-password> <host-email> <date>
//
// 1. creates a throwaway member (password account, no role -> customer + profile)
// 2. as staff: create_staff_booking on <date> 15-17 filed under <host-email>
// 3. as the member: join_booking
// 4. anonymously: get_day_roster and print what the public would see
// 5. deletes the booking (owner) and the member (admin API)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)
const [staffLogin, staffPassword, hostEmail, date] = process.argv.slice(2)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, env.SUPABASE_SECRET_KEY, opts)

const staffEmail = staffLogin.includes('@') ? staffLogin : `${staffLogin}@undefeated.local`
const memberEmail = `roster.smoke.${Date.now()}@example.com`
const memberPassword = 'smoke-test-password-1'
let memberId, bookingId

const step = (label, ok, extra = '') => console.log(`${ok ? 'OK ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`)

try {
  const created = await admin.auth.admin.createUser({
    email: memberEmail,
    password: memberPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Maya Test' },
  })
  if (created.error) throw new Error('createUser: ' + created.error.message)
  memberId = created.data.user.id
  const { data: prof } = await admin.from('profiles').select('display_name, show_on_calendar').eq('id', memberId).single()
  const { data: staffRow } = await admin.from('staff').select('id').eq('id', memberId).maybeSingle()
  step('member created with a profile and NO staff row', !!prof && !staffRow, JSON.stringify(prof))

  const staff = createClient(url, anonKey, opts)
  const s = await staff.auth.signInWithPassword({ email: staffEmail, password: staffPassword })
  if (s.error) throw new Error('staff sign-in: ' + s.error.message)
  const b = await staff.rpc('create_staff_booking', {
    p_date: date, p_start_hour: 15, p_end_hour: 17, p_paddle_count: 0,
    p_customer_name: 'Host Member', p_contact: '', p_facebook_name: '', p_note: 'roster smoke test',
    p_customer_email: hostEmail,
  })
  if (b.error) throw new Error('create_staff_booking: ' + b.error.message)
  bookingId = b.data.id
  step('staff booking created', true, `${b.data.reference_code} ${b.data.status}`)

  const member = createClient(url, anonKey, opts)
  const m = await member.auth.signInWithPassword({ email: memberEmail, password: memberPassword })
  if (m.error) throw new Error('member sign-in: ' + m.error.message)
  const j = await member.rpc('join_booking', { p_booking_id: bookingId })
  step('member joined', !j.error, j.error?.message)
  const again = await member.rpc('join_booking', { p_booking_id: bookingId })
  step('joining twice is harmless', !again.error, again.error?.message)
  const mine = await member.from('bookings').select('id')
  step('member cannot read the booking table beyond their own', !mine.error && mine.data.length === 0, `${mine.data?.length ?? '?'} rows visible`)

  const anon = createClient(url, anonKey, opts)
  const r = await anon.rpc('get_day_roster', { p_date: date })
  if (r.error) throw new Error('get_day_roster: ' + r.error.message)
  const row = r.data.find((x) => x.booking_id === bookingId)
  step('public roster row', !!row, JSON.stringify(row))
  step('host shown by profile name (not contact)', row?.host_name != null && !JSON.stringify(row).includes(hostEmail))
  step('participant listed', row?.participant_count === 1 && row?.participants?.[0]?.name === 'Maya Test')
  step('anonymous caller: joined=false, is_host=false', row?.joined === false && row?.is_host === false)

  const asMember = await member.rpc('get_day_roster', { p_date: date })
  step('member sees joined=true', asMember.data?.find((x) => x.booking_id === bookingId)?.joined === true)

  const l = await member.rpc('leave_booking', { p_booking_id: bookingId })
  step('member left', !l.error, l.error?.message)
  const after = await anon.rpc('get_day_roster', { p_date: date })
  step('count back to 0', after.data?.find((x) => x.booking_id === bookingId)?.participant_count === 0)

  // Re-join so the screenshot has someone on the roster; cleanup removes it.
  await member.rpc('join_booking', { p_booking_id: bookingId })
  console.log('BOOKING_ID=' + bookingId)
  console.log('MEMBER_ID=' + memberId)
} catch (e) {
  console.error('ERROR', e.message)
  process.exitCode = 1
}

if (process.argv.includes('--keep')) {
  console.log('(kept for screenshot; run cleanup separately)')
} else {
  await cleanup()
}

async function cleanup() {
  if (bookingId) {
    const del = await admin.from('bookings').delete().eq('id', bookingId)
    step('cleanup: booking deleted', !del.error, del.error?.message)
  }
  if (memberId) {
    const del = await admin.auth.admin.deleteUser(memberId)
    step('cleanup: member deleted', !del.error, del.error?.message)
  }
}
