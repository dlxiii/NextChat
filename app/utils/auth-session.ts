export type AuthSession = {
  accessToken: string;
  tokenType?: string;
  email?: string;
  userId?: string;
  roles?: string[];
  plan?: string;
};

const AUTH_SESSION_KEY = "hexagram-auth-session";

function canUseStorage() {
  return typeof window !== "undefined";
}

function readStorage(storage: Storage | undefined): AuthSession | null {
  if (!storage) return null;
  const raw = storage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch (error) {
    console.warn("[Auth] Failed to parse auth session", error);
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  if (!canUseStorage()) return null;
  return readStorage(window.localStorage) ?? readStorage(window.sessionStorage);
}

export function persistAuthSession(session: AuthSession, remember: boolean) {
  if (!canUseStorage()) return;
  const serialized = JSON.stringify(session);
  if (remember) {
    window.localStorage.setItem(AUTH_SESSION_KEY, serialized);
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  } else {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, serialized);
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  }
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  window.sessionStorage.removeItem(AUTH_SESSION_KEY);
}
