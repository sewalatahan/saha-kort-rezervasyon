import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qlmlguvijqqoeyyxhidh.supabase.co'

const supabaseKey =
  'sb_publishable_Dk2CZORafdtxtpY_M48ZLA_OEwtY8tE'

export const supabase = createClient(supabaseUrl, supabaseKey)