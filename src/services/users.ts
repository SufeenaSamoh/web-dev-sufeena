import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabaseKey } from "@/lib/supabase";
import type { User, UserRole } from "@/lib/types";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  branch_id: string | null;
  status: "active" | "inactive";
}

function rowToUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name ?? "",
    email: r.email,
    role: r.role,
    branchId: r.branch_id ?? undefined,
    status: r.status,
  };
}

/** Loads every user record from the existing public.users table. */
export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase.from("users").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(rowToUser);
}

/**
 * The signed-in caller's own row in public.users, or null if none exists.
 * public.users is not linked to auth.users by id, so this matches on email.
 */
export async function getMyUser(): Promise<User | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.email) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToUser(data as UserRow) : null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  branchId?: string;
  status: "active" | "inactive";
}

/**
 * Creates a real Supabase Auth account for the new user (so they can
 * actually sign in with the email/password entered in the form), then adds
 * their business record to public.users with the chosen role/branch/status.
 *
 * The browser only ever holds the anon/publishable key, so it cannot call
 * the Auth Admin API (that needs the service role key, which must stay
 * server-side). To still create a real account without disturbing the
 * signed-in admin's own session, this uses a throwaway Supabase client with
 * persistSession/autoRefreshToken disabled purely for the signUp() call --
 * the main `supabase` client (and the existing login flow) is never
 * touched.
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const tempClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error: authError } = await tempClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.name } },
  });
  if (authError) throw authError;

  await tempClient.auth.signOut().catch(() => {});

  const { data, error } = await supabase
    .from("users")
    .insert({
      name: input.name,
      email: input.email,
      role: input.role,
      branch_id: input.branchId || null,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToUser(data as UserRow);
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  branchId?: string | null;
  status?: "active" | "inactive";
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<User> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.branchId !== undefined) row.branch_id = patch.branchId || null;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await supabase.from("users").update(row).eq("id", id).select().single();
  if (error) throw error;
  return rowToUser(data as UserRow);
}

/** Disable/re-enable a user by toggling public.users.status. */
export async function setUserStatus(id: string, status: "active" | "inactive"): Promise<User> {
  const { data, error } = await supabase
    .from("users")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToUser(data as UserRow);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
}
