import { ApiResponse } from "../../shared/types"

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  
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