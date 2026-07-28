import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { User as AppUser } from "./types";

interface AuthResult {
  error: string | null;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: AppUser["role"];
  branch_id: string | null;
  status: "active" | "inactive";
}

function rowToAppUser(r: UserRow): AppUser {
  return {
    id: r.id,
    name: r.name ?? "",
    email: r.email,
    role: r.role,
    branchId: r.branch_id ?? undefined,
    status: r.status,
  };
}

interface AuthContextValue {
  session: Session | null;
  user: SupabaseUser | null;
  /** The caller's own row in public.users (role/status), matched by email. */
  appUser: AppUser | null;
  /** true until the initial session check has completed */
  loading: boolean;
  /** true while (re)loading `appUser` for the current session */
  appUserLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [appUserLoading, setAppUserLoading] = useState(false);

  // public.users is not linked to auth.users by id, so the caller's row is
  // looked up by email.
  const loadAppUser = async (email: string | null | undefined) => {
    if (!email) {
      setAppUser(null);
      return;
    }
    setAppUserLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      const next = data ? rowToAppUser(data as UserRow) : null;

      // A disabled account is blocked at sign-in time too (see signIn
      // below), but this also catches the case where an Owner/Admin
      // disables someone who already has an open session/tab.
      if (next?.status === "inactive") {
        await supabase.auth.signOut();
        setAppUser(null);
        return;
      }
      setAppUser(next);
    } catch {
      setAppUser(null);
    } finally {
      setAppUserLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
        if (data.session?.user) void loadAppUser(data.session.user.email);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setLoading(false);
      if (newSession?.user) {
        void loadAppUser(newSession.user.email);
      } else {
        setAppUser(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    if (data.user?.email) {
      const { data: row } = await supabase
        .from("users")
        .select("status")
        .eq("email", data.user.email)
        .maybeSingle();
      if (row?.status === "inactive") {
        await supabase.auth.signOut();
        return { error: "This account has been disabled. Contact an administrator." };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAppUser(null);
  };

  const refreshAppUser = async () => {
    if (session?.user) await loadAppUser(session.user.email);
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    appUser,
    loading,
    appUserLoading,
    signIn,
    signOut,
    refreshAppUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
