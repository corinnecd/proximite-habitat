"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
    if (data?.organization_id) {
      const { data: org } = await supabase.from("organizations").select("name").eq("id", data.organization_id).single();
      setOrganizationName(org?.name ?? null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh: fetchProfile, organizationName }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
