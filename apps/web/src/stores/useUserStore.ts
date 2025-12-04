import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserData {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface UserStore {
  user: UserData | null;
  isLoading: boolean;
  setUser: (user: UserData | null) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isLoading: false }),
    }),
    {
      name: 'delulu-user-storage',
    }
  )
);

