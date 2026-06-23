import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tjesfbvknnodbsmyouss.supabase.co'
const SUPABASE_KEY = 'sb_publishable_BB6F9pdkD-vJaH0ZFGldQw_mSMs5UNH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
