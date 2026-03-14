import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserData {
  fid: number;
  address?: string;
  username?: string;
  email?: string; // Email hash stored on-chain
  displayName?: string;
  pfpUrl?: string;
}

interface UserStore {
  user: UserData | null;
  isLoading: boolean;
  setUser: (_user: UserData | null) => void;
  updateUsername: (_username: string, _email?: string) => void;
  updateAddress: (_address: string) => void;
  setLoading: (_isLoading: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
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
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isLoading: false }),
    }),
    {
      name: 'delulu-user-storage',
    }
  )
);

