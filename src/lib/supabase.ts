import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fgdfvvydtnkzdnvqqsng.supabase.co";

const supabaseKey =
"sb_publishable_XgS4AhGWMdjf6RUDFhbJVg_7XSc3xNG";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);