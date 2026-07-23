import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yzoxtjbduqwogagytkgg.supabase.co";

const supabaseKey =
"sb_publishable_WSTIqPTDCWmmqb1ntDcj0g_KSpwoeaA";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);