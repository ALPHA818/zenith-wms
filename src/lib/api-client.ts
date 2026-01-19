import { ApiResponse } from "../../shared/types"

function resolveApiUrl(path: string): string {
  const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const configuredBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  const base = isFile ? (configuredBase || 'http://localhost:3000') : '';
  return base ? new URL(path, base).toString() : path;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = resolveApiUrl(path);
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  
  const json = (await res.json()) as ApiResponse<T>
  
  if (!json.success) {
    throw new Error(json.error || 'Request failed')
  }
  
  if (json.data === undefined || json.data === null) {
    throw new Error('No data returned from API')
  }
  
  return json.data
}