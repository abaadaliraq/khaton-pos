"use client";

import { createClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import type { UserRole, UserSession } from "@/types/auth";

const LEGACY_STORAGE_KEYS = [
  "khatoun_pos_session",
  "khatoun_pos_cashier_state",
  "khatoun_pos_kitchen_state",
];

const allowedRoles: UserRole[] = ["captain", "cashier", "kitchen", "admin"];

type ProfileRow = {
  username: string;
  full_name: string;
  role: UserRole;
  status: "active" | "inactive" | "suspended";
};

export function isSupabaseConfigured() {
  return getSupabaseBrowserEnv().isConfigured;
}

export function getSupabaseSetupError() {
  const env = getSupabaseBrowserEnv();
  return env.isConfigured ? null : env.error;
}

export function clearLegacyMockStorage() {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function isUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && allowedRoles.includes(role as UserRole);
}

function profileToSession(profile: ProfileRow): UserSession | null {
  if (!isUserRole(profile.role) || profile.status !== "active") {
    return null;
  }

  return {
    username: profile.username,
    role: profile.role,
    name: profile.full_name,
  };
}

function usernameToEmail(username: string) {
  return `${username.trim()}@khatoun.local`;
}

export async function signInWithUsername(username: string, password: string): Promise<UserSession | null> {
  const normalizedUsername = username.trim();

  if (!normalizedUsername || !password) {
    return null;
  }

  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(normalizedUsername),
    password,
  });

  if (authError || !authData.user) {
    return null;
  }

  const session = await getCurrentSession();

  if (!session) {
    await supabase.auth.signOut();
  }

  return session;
}

export async function getCurrentSession(): Promise<UserSession | null> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, full_name, role, status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load Supabase profile", profileError);
    return null;
  }

  return profile ? profileToSession(profile as ProfileRow) : null;
}

export async function signOut() {
  clearLegacyMockStorage();

  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Supabase sign out failed", error);
  }
}
