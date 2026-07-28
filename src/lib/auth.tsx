import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthResult {
  error: string | null;
}

// NOTE: this local shape intentionally does NOT reuse the `Profile`/
// `ProfileRole` types from ./types — those back the current
// `public.profiles` schema (see supabase/migrations/013_profiles.sql and
// src/services/profiles.ts), which no longer has auth_user_id/status/
// branch_id columns. This file's own sign-in/session logic is unchanged
// from before; only these type names were kept local so the two don't
// collide.
type LegacyProfileRole = "owner" | "admin" | "manager" | "staff";

interface LegacyProfile {
  id: string;
  authUserId: string | null;
  fullName: string;
  email: string;
  role: LegacyProfileRole;
  branchId?: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** The caller's own row in public.profiles (role/status), or null if not yet loaded/linked. */
  profile: LegacyProfile | null;
  /** true until the initial session check has completed */
  loading: boolean;
  /** true while (re)loading `profile` for the current session */
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface ProfileRow {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string;
  role: LegacyProfileRole;
  branch_id: string | null;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
}

function rowToProfile(r: ProfileRow): LegacyProfile {
  return {
    id: r.id,
    authUserId: r.auth_user_id,
    fullName: r.full_name ?? "",
    email: r.email,
    role: r.role,
    branchId: r.branch_id ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LegacyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const next = data ? rowToProfile(data as ProfileRow) : null;

      // A disabled account is blocked at sign-in time too (see signIn below),
      // but this also catches the case where an Owner/Admin disables someone
      // who already has an open session/tab.
      if (next?.status === "disabled") {
        await supabase.auth.signOut();
        setProfile(null);
        return;
      }
      setProfile(next);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
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
        if (data.session?.user) void loadProfile(data.session.user.id);
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
        void loadProfile(newSession.user.id);
      } else {
        setProfile(null);
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

    if (data.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("status")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();
      if (prof?.status === "disabled") {
        await supabase.auth.signOut();
        return { error: "This account has been disabled. Contact an administrator." };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
