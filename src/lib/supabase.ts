import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://fgdfvvydtnkzdnvqqsng.supabase.co";

export const supabaseKey = "sb_publishable_XgS4AhGWMdjf6RUDFhbJVg_7XSc3xNG";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist the session in the browser so a refresh keeps the user logged in.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof window !== "undefined",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
