"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const PROFILE_CACHE_KEY = "ph_profile_v1";
const ORG_CACHE_KEY = "ph_org_v1";

function readCache<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function writeCache(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function clearCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); localStorage.removeItem(ORG_CACHE_KEY); } catch {}
}

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  organizationName: string | null;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  refresh: async () => {},
  organizationName: null,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe: démarre toujours avec null/true pour éviter les erreurs d'hydratation
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { clearCache(); setProfile(null); setOrganizationName(null); setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) { setProfile(data); writeCache(PROFILE_CACHE_KEY, data); }
    if (data?.organization_id) {
      const { data: org } = await supabase.from("organizations").select("name").eq("id", data.organization_id).single();
      const name = org?.name ?? null;
      setOrganizationName(name);
      if (name) writeCache(ORG_CACHE_KEY, name);
    }
    setLoading(false);
  }, [supabase]);

  useIsomorphicLayoutEffect(() => {
    const cached = readCache<Profile>(PROFILE_CACHE_KEY);
    if (cached) {
      setProfile(cached);
      setOrganizationName(readCache<string>(ORG_CACHE_KEY));
      setLoading(false);
    }
    fetchProfile();
  }, [fetchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh: fetchProfile, organizationName }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
