import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabaseKey } from "@/lib/supabase";
import type { Profile, ProfileRole } from "@/lib/types";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  active: boolean;
  created_at: string;
}

function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name ?? "",
    role: r.role,
    active: r.active,
    createdAt: r.created_at,
  };
}

/** Loads every user record from public.profiles (RLS limits this to "just me" for non-admins). */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToProfile);
}

/** The signed-in caller's own profile (role/active), or null if it hasn't been created yet. */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export interface CreateProfileInput {
  fullName: string;
  email: string;
  role: ProfileRole;
}

/**
 * Creates a real Supabase Auth account for the new user, then sets their
 * chosen role on the profile row public.handle_new_user() automatically
 * creates for every new auth.users row.
 *
 * The browser only ever holds the anon/publishable key, so it cannot call
 * the Auth Admin API (that needs the service role key, which must stay
 * server-side). To still create a real account without disturbing the
 * signed-in admin's own session, this uses a throwaway Supabase client with
 * persistSession/autoRefreshToken disabled purely for the signUp() call --
 * the main `supabase` client (and the existing login flow in
 * src/lib/auth.tsx) is never touched.
 */
export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const tempClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const tempPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { data, error } = await tempClient.auth.signUp({
    email: input.email,
    password: tempPassword,
    options: { data: { full_name: input.fullName } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Sign up did not return a new user.");

  await tempClient.auth.signOut().catch(() => {});

  // handle_new_user() already inserted the row with role 'staff'; apply the
  // role actually chosen in the form using the admin's own (RLS-checked) session.
  const { data: row, error: updateError } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName, role: input.role })
    .eq("id", data.user.id)
    .select()
    .single();
  if (updateError) throw updateError;
  return rowToProfile(row as ProfileRow);
}

export interface UpdateProfileInput {
  fullName?: string;
  role?: ProfileRole;
}

export async function updateProfile(id: string, patch: UpdateProfileInput): Promise<Profile> {
  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.role !== undefined) row.role = patch.role;

  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data as ProfileRow);
}

/** Disable/re-enable a user. */
export async function setProfileActive(id: string, active: boolean): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data as ProfileRow);
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}
