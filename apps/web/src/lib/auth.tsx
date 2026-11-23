"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiRequest, type CurrentUser, type TokenResponse } from "@/lib/api";

type AuthStatus = "loading" | "anonymous" | "authenticated";

interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  token: string | null;
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<CurrentUser>;
  signOut: () => Promise<void>;
  has: (permission: string) => boolean;
  updateUser: (user: CurrentUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let bootstrapPromise: Promise<TokenResponse | null> | null = null;

function beginBootstrap(): Promise<TokenResponse | null> {
  if (!bootstrapPromise) {
    const pending = apiRequest<TokenResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: {},
    })
      .catch(() => null)
      .finally(() => {
        if (bootstrapPromise === pending) {
          bootstrapPromise = null;
        }
      });
    bootstrapPromise = pending;
  }
  return bootstrapPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    token: null,
  });

  useEffect(() => {
    let cancelled = false;
    void beginBootstrap().then((session) => {
      if (cancelled) {
        return;
      }
      setState(
        session
          ? { status: "authenticated", user: session.user, token: session.access_token }
          : { status: "anonymous", user: null, token: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setState({
      status: "authenticated",
      user: response.user,
      token: response.access_token,
    });
    return response.user;
  }, []);

  const signOut = useCallback(async () => {
    const token = state.token;
    setState({ status: "anonymous", user: null, token: null });
    try {
      await apiRequest<void>("/api/v1/auth/logout", { method: "POST", body: {}, token });
    } catch {
      // The local session is cleared regardless of network state.
    }
    router.replace("/login");
  }, [router, state.token]);

  const has = useCallback(
    (permission: string) => state.user?.permissions.includes(permission) ?? false,
    [state.user],
  );

  const updateUser = useCallback((user: CurrentUser) => {
    setState((current) => ({ ...current, user }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, has, updateUser }),
    [state, signIn, signOut, has, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
