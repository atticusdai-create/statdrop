import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tjesfbvknnodbsmyouss.supabase.co'
const SUPABASE_KEY = 'sb_publishable_BB6F9pdkD-vJaH0ZFGldQw_mSMs5UNH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// To enable auth user deletion on account delete, add the Supabase service role key:
// 1. Go to Supabase Dashboard → Project Settings → API
// 2. Copy the "service_role" key (starts with "eyJ...")
// 3. Add to your .env file: VITE_SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
// WARNING: Never commit this key or expose it publicly — it bypasses Row Level Security.
const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null
