import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tjesfbvknnodbsmyouss.supabase.co'
const SUPABASE_KEY = 'sb_publishable_BB6F9pdkD-vJaH0ZFGldQw_mSMs5UNH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY
export const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null
