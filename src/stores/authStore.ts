import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@shared/types';
import { api } from '@/lib/api-client';
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: { name: string; password: string }) => Promise<void>;
  logout: () => void;
  revalidate: () => Promise<void>;
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      login: async ({ name, password }) => {
        try {
          const user = await api<User>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ name, password }),
          });
          set({ user, isAuthenticated: true });
        } catch (error) {
          console.error("Login failed:", error);
          throw error;
        }
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      revalidate: async () => {
        try {
          const user = await api<User>('/api/auth/me');
          set({ user, isAuthenticated: true });
        } catch (error) {
          console.error("Revalidation failed:", error);
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

if (useAuthStore.getState().isAuthenticated) {
  useAuthStore.getState().revalidate();
}