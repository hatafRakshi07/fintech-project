const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  return localStorage.getItem("collector_token");
}

export function setToken(token: string): void {
  localStorage.setItem("collector_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("collector_token");
  localStorage.removeItem("collector_user");
}

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  branchId: number | null;
  phone?: string | null;
};

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("collector_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem("collector_user", JSON.stringify(user));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.error ?? body.message ?? msg;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const fmt = {
  currency: (n: string | number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(typeof n === "string" ? parseFloat(n) : n),

  date: (s: string | Date) =>
    new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),

  shortDate: (s: string | Date) =>
    new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
};
