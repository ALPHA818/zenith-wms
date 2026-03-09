import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, ALL_PERMISSIONS } from '@shared/types';
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

const DEMO_USERS: Array<{ password: string; user: User }> = [
  {
    password: 'password123',
    user: {
      id: 'u1',
      name: 'Admin User',
      email: 'admin@zenith.local',
      permissions: [...ALL_PERMISSIONS],
    },
  },
  {
    password: 'password123',
    user: {
      id: 'u2',
      name: 'Operator User',
      email: 'operator@zenith.local',
      permissions: [
        'manage:inventory',
        'manage:orders',
        'manage:shipments',
        'manage:locations',
        'manage:location-ids',
      ],
    },
  },
];

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /fetch|network|timed out|unable to reach|abort/i.test(message);
}

function resolveOfflineUser(name: string, password: string): User | null {
  const normalizedName = name.trim().toLowerCase();
  const match = DEMO_USERS.find((account) => account.user.name.toLowerCase() === normalizedName && account.password === password);
  return match ? match.user : null;
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
            timeoutMs: 2500,
          });
          set({ user, isAuthenticated: true, rememberMe });
        } catch (error) {
          if (isNetworkError(error)) {
            const offlineUser = resolveOfflineUser(name, password);
            if (offlineUser) {
              set({ user: offlineUser, isAuthenticated: true, rememberMe });
              return;
            }
          }
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
          const user = await api<User>('/api/auth/me', { timeoutMs: 4000 });
          set({ user, isAuthenticated: true });
        } catch (error) {
          const existingUser = get().user;
          if (existingUser && isNetworkError(error)) {
            set({ user: existingUser, isAuthenticated: true });
            return;
          }
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