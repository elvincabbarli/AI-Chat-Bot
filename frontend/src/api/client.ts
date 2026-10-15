import { supabase } from "../auth/supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    method,
    signal,
    headers: {
      ...(await authHeaders()),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error("Your session has expired. Please sign in again.");
    if (response.status === 404)
      throw new Error("The conversation or message was not found.");
    throw new Error("The request failed. Please try again.");
  }
  return response.json() as Promise<T>;
}

export const apiGet = <T>(path: string, signal?: AbortSignal) =>
  request<T>(path, "GET", undefined, signal);
export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, "POST", body);
export const apiPatch = <T>(path: string, body: unknown) =>
  request<T>(path, "PATCH", body);
export const apiDelete = <T>(path: string) => request<T>(path, "DELETE");
export { API_BASE_URL };
