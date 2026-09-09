import type { ApiError, ApiSuccess, PaginatedApiSuccess } from "@scrapo/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("scrapo.access-token");
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiSuccess<T> | ApiError;
  if (!response.ok || !payload.success) {
    const error = payload as ApiError;
    throw new ApiClientError(
      error.error?.code ?? "REQUEST_FAILED",
      error.error?.message ?? "The request failed.",
      response.status,
    );
  }
  return payload.data;
}

export async function apiList<T>(
  path: string,
): Promise<PaginatedApiSuccess<T>> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const payload = (await response.json()) as PaginatedApiSuccess<T> | ApiError;
  if (!response.ok || !payload.success) {
    const error = payload as ApiError;
    throw new ApiClientError(
      error.error?.code ?? "REQUEST_FAILED",
      error.error?.message ?? "The request failed.",
      response.status,
    );
  }
  return payload as PaginatedApiSuccess<T>;
}
