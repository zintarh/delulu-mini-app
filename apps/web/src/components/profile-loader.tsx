"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useUserStore } from "@/stores/useUserStore";

/**
 * Fetches the current user's profile from Supabase on wallet connect
 * and hydrates the user store with username, email, pfpUrl.
 * Renders nothing — purely a side-effect component.
 */
export function ProfileLoader() {
  const { address } = useAccount();
  const { updateProfile, updateUsername, setProfileLoaded, isProfileLoaded, user } =
    useUserStore();

  const lastAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) {
      lastAddressRef.current = null;
      return;
    }

    // Re-fetch when address changes or profile hasn't been loaded yet
    if (lastAddressRef.current === address && isProfileLoaded) return;
    lastAddressRef.current = address;

    const load = async () => {
      try {
        const res = await fetch(`/api/profile/${address.toLowerCase()}`);
        if (!res.ok) return;
        const { profile } = await res.json();
        if (!profile) return;

        if (profile.username) {
          updateUsername(profile.username, profile.email ?? user?.email);
        }

        updateProfile({
          email: profile.email ?? undefined,
          pfpUrl: profile.pfp_url ?? undefined,
          referralCode: profile.referral_code ?? undefined,
        });

        setProfileLoaded(true);
      } catch {
        // Network error — silently ignore, store keeps previous state
      }
    };

    load();
  }, [address, isProfileLoaded, updateProfile, updateUsername, setProfileLoaded, user?.email]);

  return null;
}
