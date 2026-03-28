import type { SessionMeta } from '@/types'

const INDEX_KEY = 'thinkflow-sessions'
const CURRENT_KEY = 'thinkflow-current'
export const canvasKey = (id: string) => `thinkflow-canvas-${id}`

export function loadSessionsIndex(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as SessionMeta[]
    return arr.sort((a, b) => b.createdAt - a.createdAt)
  } catch { return [] }
}

export function saveSessionsIndex(sessions: SessionMeta[]): void {
  try {
    const sorted = [...sessions].sort((a, b) => b.createdAt - a.createdAt)
    localStorage.setItem(INDEX_KEY, JSON.stringify(sorted))
  } catch { /* ignore */ }
}

export function loadCurrentSessionId(): string | null {
  return localStorage.getItem(CURRENT_KEY)
}

export function saveCurrentSessionId(id: string): void {
  localStorage.setItem(CURRENT_KEY, id)
}

export function createSession(title = 'New session'): SessionMeta {
  const session: SessionMeta = {
    id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 60) || 'New session',
    createdAt: Date.now(),
  }
  const existing = loadSessionsIndex()
  saveSessionsIndex([session, ...existing])
  saveCurrentSessionId(session.id)
  return session
}

export function deleteSession(id: string): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.filter((s) => s.id !== id))
  try { localStorage.removeItem(canvasKey(id)) } catch { /* ignore */ }
}

export function updateSessionTitle(id: string, title: string): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.map((s) => s.id === id ? { ...s, title: title.slice(0, 60) } : s))
}
