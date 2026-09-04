import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://fgdfvvydtnkzdnvqqsng.supabase.co";

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_XgS4AhGWMdjf6RUDFhbJVg_7XSc3xNG";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist the session in the browser so a refresh keeps the user logged in.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof window !== "undefined",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
