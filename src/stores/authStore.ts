import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@shared/types';
import { api } from '@/lib/api-client';

// Session storage for non-persistent sessions
const sessionStorage = {
  getItem: (name: string) => {
    return window.sessionStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    window.sessionStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    window.sessionStorage.removeItem(name);
  },
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
  login: (credentials: { name: string; password: string; rememberMe: boolean }) => Promise<void>;
  logout: () => void;
  revalidate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      rememberMe: false,
      login: async ({ name, password, rememberMe }) => {
        try {
          const user = await api<User>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ name, password }),
          });
          set({ user, isAuthenticated: true, rememberMe });
        } catch (error) {
          console.error("Login failed:", error);
          throw error;
        }
      },
      logout: () => {
        // Clear both storage types
        localStorage.removeItem('auth-storage');
        sessionStorage.removeItem('auth-storage');
        set({ user: null, isAuthenticated: false, rememberMe: false });
      },
      revalidate: async () => {
        try {
          const user = await api<User>('/api/auth/me');
          set({ user, isAuthenticated: true });
        } catch (error) {
          console.error("Revalidation failed:", error);
          set({ user: null, isAuthenticated: false, rememberMe: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        const state = useAuthStore.getState();
        // Use localStorage only if rememberMe is true, otherwise use sessionStorage
        return state.rememberMe ? localStorage : sessionStorage;
      }),
    }
  )
);

if (useAuthStore.getState().isAuthenticated) {
  useAuthStore.getState().revalidate();
}