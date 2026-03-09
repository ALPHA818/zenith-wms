import { ApiResponse } from "../../shared/types"
import { useAuthStore } from "@/stores/authStore"

const API_BASE_STORAGE_KEY = 'zenith-api-base';
const API_HEALTH_PATH = '/api/health';

let inMemoryApiBase: string | null = null;

interface ApiRequestInit extends RequestInit {
  timeoutMs?: number;
}

function buildUrl(base: string, path: string): string {
  return base ? new URL(path, base).toString() : path;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (value == null) {
      continue;
    }

    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

function resolveApiCandidates(path: string): string[] {
  if (/^https?:\/\//i.test(path)) {
    return [path];
  }

  const hasWindow = typeof window !== 'undefined';
  const isFile = hasWindow && window.location.protocol === 'file:';
  const isCapacitorLocalhost = hasWindow && window.location.protocol === 'https:' && window.location.hostname === 'localhost';
  const configuredBase = import.meta.env.VITE_API_BASE?.trim();
  const rememberedBase = hasWindow ? window.localStorage.getItem(API_BASE_STORAGE_KEY)?.trim() : undefined;

  const bases: string[] = [];

  if (isFile || isCapacitorLocalhost) {
    if (inMemoryApiBase) {
      bases.push(inMemoryApiBase);
    }
    if (configuredBase) {
      bases.push(configuredBase);
    }
    if (rememberedBase && rememberedBase !== configuredBase) {
      bases.push(rememberedBase);
    }
  }

  if (isFile) {
    bases.push('http://localhost:3000');
  } else if (isCapacitorLocalhost) {
    bases.push('http://10.0.2.2:3000');
    bases.push('http://127.0.0.1:3000');
    bases.push('http://localhost:3000');
  } else {
    bases.push('');
    if (inMemoryApiBase) {
      bases.push(inMemoryApiBase);
    }
    if (configuredBase) {
      bases.push(configuredBase);
    }
    if (rememberedBase && rememberedBase !== configuredBase) {
      bases.push(rememberedBase);
    }
  }

  return unique(bases).map((base) => buildUrl(base, path));
}

function toOrigin(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return '';
  }
  return new URL(url).origin;
}

function rememberWorkingOrigin(url: string): void {
  const origin = toOrigin(url);
  if (!origin) {
    return;
  }

  inMemoryApiBase = origin;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(API_BASE_STORAGE_KEY, origin);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMaybeTimed(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  if (typeof timeoutMs !== 'number' || timeoutMs <= 0) {
    return fetch(url, init);
  }

  return fetchWithTimeout(url, init, timeoutMs);
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new Error('Request timed out while connecting to the API server.');
    }
    return error;
  }

  return new Error('Network request failed.');
}

function shouldAttachUserHeader(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}

async function findReachableApiUrl(candidates: string[], timeoutMs?: number): Promise<string> {
  if (candidates.length <= 1) {
    return candidates[0];
  }

  const absoluteOrigins = unique(candidates.map(toOrigin).filter((origin) => origin.length > 0));
  if (absoluteOrigins.length === 0) {
    return candidates[0];
  }

  const probeTimeout = Math.min(timeoutMs ?? 1800, 1800);
  const probes = absoluteOrigins.map(async (origin) => {
    try {
      await fetchWithTimeout(`${origin}${API_HEALTH_PATH}`, { method: 'GET' }, probeTimeout);
      return origin;
    } catch {
      throw new Error(`unreachable:${origin}`);
    }
  });

  try {
    const fastestOrigin = await Promise.any(probes);
    inMemoryApiBase = fastestOrigin;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, fastestOrigin);
    }
    const preferred = candidates.find((candidate) => toOrigin(candidate) === fastestOrigin);
    return preferred || candidates[0];
  } catch {
    return candidates[0];
  }
}

export async function api<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  let urls = resolveApiCandidates(path);
  const user = useAuthStore.getState().user;
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const { timeoutMs, ...requestOptions } = init || {};

  if (method !== 'GET' && urls.length > 1) {
    const bestCandidate = await findReachableApiUrl(urls, timeoutMs);
    urls = [bestCandidate, ...urls.filter((url) => url !== bestCandidate)];
  }

  let networkError: Error | null = null;
  let res: Response | null = null;
  let url = urls[0];

  for (const candidate of urls) {
    url = candidate;

    try {
      const candidateHeaders: Record<string, string> = {
        ...baseHeaders,
        ...toHeaderRecord(requestOptions.headers),
      };

      if (user?.id && shouldAttachUserHeader(candidate)) {
        candidateHeaders['X-User-Id'] = user.id;
      }

      const requestInit: RequestInit = {
        ...requestOptions,
        headers: candidateHeaders,
      };

      res = await fetchMaybeTimed(candidate, requestInit, timeoutMs);
      rememberWorkingOrigin(candidate);
      networkError = null;
      break;
    } catch (error) {
      networkError = normalizeError(error);
    }
  }

  if (!res) {
    throw networkError || new Error('Unable to reach API server.');
  }

  if (!res.ok) {
    let apiError = '';
    const errorContentType = res.headers.get('content-type') || '';
    if (errorContentType.includes('application/json')) {
      try {
        const errorJson = (await res.json()) as ApiResponse<unknown>;
        apiError = errorJson.error || '';
      } catch {
        apiError = '';
      }
    }
    throw new Error(apiError || `HTTP ${res.status}: ${res.statusText}`)
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