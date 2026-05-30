"use client";

import { create } from "zustand";
import type { User } from "@/lib/api";

const TOKEN_KEY = "dontbelate-token";
const USER_KEY = "dontbelate-user";

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (input: { token: string; user: User }) => void;
  clearAuth: () => void;
};

function readStoredUser() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null,
  user: readStoredUser(),
  setAuth: ({ token, user }) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ token, user });
  },
  clearAuth: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
    set({ token: null, user: null });
  }
}));
