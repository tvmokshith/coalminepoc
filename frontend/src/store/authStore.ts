import { create } from 'zustand';
import type { AuthState, User } from '@/types';
import { authApi } from '@/services/api';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    const user = data.user as User;
    const token = data.access_token as string;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setAuth: (user: User, token: string) => {
    set({ user, token, isAuthenticated: true });
  },
}));
