const SESSION_TOKEN_KEY = "sessionToken";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {}
}

export function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

export function isAuthenticated(): boolean {
  const token = getSessionToken();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    return !payload.exp || payload.exp > now;
  } catch {
    return false;
  }
}

export function getUserIdFromToken(): string | null {
  const token = getSessionToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
}
