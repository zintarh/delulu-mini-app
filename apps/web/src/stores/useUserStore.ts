import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserData {
  fid: number;
  address?: string;
  username?: string;
  email?: string;
  displayName?: string;
  pfpUrl?: string;
  referralCode?: string;
}

interface UserStore {
  user: UserData | null;
  isLoading: boolean;
  isProfileLoaded: boolean;
  setUser: (_user: UserData | null) => void;
  updateUsername: (_username: string, _email?: string) => void;
  updateAddress: (_address: string) => void;
  updateProfile: (_data: Partial<Pick<UserData, "pfpUrl" | "referralCode" | "email" | "username">>) => void;
  setProfileLoaded: (_loaded: boolean) => void;
  setLoading: (_isLoading: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isProfileLoaded: false,
      setUser: (user) => set({ user, isLoading: false }),
      updateUsername: (username: string, email?: string) => 
        set((state) => ({
          user: state.user 
            ? { ...state.user, username, email, address: state.user.address }
            : { fid: 0, username, email },
          isLoading: false,
        })),
      updateAddress: (address: string) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, address }
            : { fid: 0, address },
          isLoading: false,
        })),
      updateProfile: (data) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, ...data }
            : { fid: 0, ...data },
          isLoading: false,
        })),
      setProfileLoaded: (isProfileLoaded) => set({ isProfileLoaded }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => {
        if (typeof window !== 'undefined') {
          // Explicitly clear the Zustand persisted store key.
          window.localStorage.removeItem('delulu-user-storage');
          // Clear any other app-owned keys (underscore-prefixed convention).
          const localKeys = Object.keys(window.localStorage);
          for (const key of localKeys) {
            if (key.startsWith('delulu_')) {
              window.localStorage.removeItem(key);
            }
          }
          const sessionKeys = Object.keys(window.sessionStorage);
          for (const key of sessionKeys) {
            if (key.startsWith('delulu_')) {
              window.sessionStorage.removeItem(key);
            }
          }
        }
        set({ user: null, isLoading: false, isProfileLoaded: false });
      },
    }),
    {
      name: 'delulu-user-storage',
    }
  )
);

