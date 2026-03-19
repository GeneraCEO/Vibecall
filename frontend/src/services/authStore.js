/**
 * authStore.js — Global auth state (Zustand)
 * Stores the logged-in user across the entire app.
 * Persists to sessionStorage so page refresh keeps you logged in.
 */
import { create } from "zustand";

const API = import.meta.env.VITE_API_URL || "";

export const useAuthStore = create((set, get) => ({
  user:    null,
  loading: false,
  error:   null,

  // ── Login ────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      set({ user: data.user || data, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  // ── Register ─────────────────────────────────────────────────────────────
  register: async (name, email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      set({ user: data.user || data, loading: false });
      return true;
    } catch (err) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  // ── Check session (call on app load) ─────────────────────────────────────
  checkSession: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user || data, loading: false });
      } else {
        set({ user: null, loading: false });
      }
    } catch {
      set({ user: null, loading: false });
    }
  },

  // ── Logout ───────────────────────────────────────────────────────────────
  logout: async () => {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
