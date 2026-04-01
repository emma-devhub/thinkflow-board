import type { SessionMeta, TaskStatus } from '@/types'

const INDEX_KEY = 'thinkflow-sessions'
const CURRENT_KEY = 'thinkflow-current'
export const canvasKey = (id: string) => `thinkflow-canvas-${id}`

export function loadSessionsIndex(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as SessionMeta[]
    // backfill legacy sessions missing new fields
    return arr
      .map((s) => ({ ...s, status: s.status ?? ('todo' as TaskStatus), updatedAt: s.updatedAt ?? s.createdAt }))
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  } catch { return [] }
}

export function saveSessionsIndex(sessions: SessionMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(sessions))
  } catch { /* ignore */ }
}

export function loadCurrentSessionId(): string | null {
  return localStorage.getItem(CURRENT_KEY)
}

export function saveCurrentSessionId(id: string): void {
  localStorage.setItem(CURRENT_KEY, id)
}

export function createSession(
  title = 'New session',
  opts: { projectId?: string; status?: TaskStatus; columnId?: string } = {}
): SessionMeta {
  const now = Date.now()
  const session: SessionMeta = {
    id: `sess-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 60) || 'New session',
    createdAt: now,
    updatedAt: now,
    status: opts.status ?? 'todo',
    projectId: opts.projectId,
    columnId: opts.columnId,
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

export function updateSessionStatus(id: string, status: TaskStatus): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.map((s) => s.id === id ? { ...s, status } : s))
}

export function updateSessionProject(id: string, projectId: string | undefined): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.map((s) => s.id === id ? { ...s, projectId } : s))
}

export function updateSessionColumn(id: string, columnId: string): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.map((s) => s.id === id ? { ...s, columnId } : s))
}

export function updateSessionChecked(id: string, checked: boolean): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.map((s) => s.id === id ? { ...s, checked } : s))
}

export function updateSessionSchedule(id: string, dueDate: string | undefined, estimatedMins: number | undefined): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.map((s) => s.id === id ? { ...s, dueDate, estimatedMins } : s))
}

export function touchSession(id: string): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(existing.map((s) => s.id === id ? { ...s, updatedAt: Date.now() } : s))
}
