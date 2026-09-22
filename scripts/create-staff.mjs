// Bootstrap a staff account without the dashboard.
//
//   node scripts/create-staff.mjs <login> <password> "<Full Name>" [owner|staff]
//
// <login> is a username (becomes <username>@undefeated.local, which is what the
// sign-in form maps a bare username to) or a full email address. Uses the Auth
// Admin API with SUPABASE_SECRET_KEY from .env.local -- the same call the
// dashboard's "Add user" makes. The on_auth_user_created trigger reads full_name
// and role from the metadata, so no SQL step follows.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const STAFF_LOGIN_DOMAIN = 'undefeated.local'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)

const [login, password, fullName, role = 'owner'] = process.argv.slice(2)
if (!login || !password || !fullName) {
  console.error('usage: node scripts/create-staff.mjs <login> <password> "<Full Name>" [owner|staff]')
  process.exit(2)
}
const email = login.includes('@') ? login : `${login.toLowerCase()}@${STAFF_LOGIN_DOMAIN}`

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.')
  process.exit(2)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role },
})
if (error) {
  console.error('createUser failed:', error.message)
  process.exit(1)
}

const { data: staff } = await admin
  .from('staff')
  .select('full_name, role, active')
  .eq('id', data.user.id)
  .single()

console.log(`created ${email} ->`, JSON.stringify(staff))
