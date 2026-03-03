import { ApiResponse } from "../../shared/types"
import { useAuthStore } from "@/stores/authStore"

function resolveApiUrl(path: string): string {
  const hasWindow = typeof window !== 'undefined';
  const isFile = hasWindow && window.location.protocol === 'file:';
  const isCapacitorLocalhost = hasWindow && window.location.protocol === 'https:' && window.location.hostname === 'localhost';
  const configuredBase = import.meta.env.VITE_API_BASE?.trim();
  
  // Determine the base URL
  let base = '';
  if (isFile) {
    // Desktop/Electron app
    base = configuredBase || 'http://localhost:3000';
  } else if (isCapacitorLocalhost) {
    // Capacitor Android/iOS local webview origin (https://localhost)
    // Must use absolute backend URL to avoid calling https://localhost/api/*
    base = configuredBase || 'http://192.168.0.180:3000';
  } else if (configuredBase) {
    // Use explicitly configured base URL (useful for production or custom servers)
    base = configuredBase;
  } else {
    // Web app or mobile - no base URL, use relative paths
    // Make sure your backend serves the app and API on the same origin
    base = '';
  }
  
  return base ? new URL(path, base).toString() : path;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = resolveApiUrl(path);
  const user = useAuthStore.getState().user;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (user?.id) {
    headers['X-User-Id'] = user.id;
  }
  
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers || {}) } })
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    const snippet = text.replace(/\s+/g, ' ').slice(0, 200)
    throw new Error(
      `Expected JSON from API but received ${contentType || 'unknown content type'} at ${url}. ` +
        `Response starts with: ${snippet}`
    )
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