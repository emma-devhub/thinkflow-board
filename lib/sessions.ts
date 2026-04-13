import type { SessionMeta, TaskStatus } from '@/types'
import { supabase } from '@/lib/supabase'

const CURRENT_KEY = 'thinkflow-current'

// ── Current session (UI preference only, stays in localStorage) ──────────────

export function loadCurrentSessionId(): string | null {
  try { return localStorage.getItem(CURRENT_KEY) } catch { return null }
}

export function saveCurrentSessionId(id: string): void {
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* ignore */ }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): SessionMeta {
  return {
    id: row.id as string,
    title: row.title as string,
    createdAt: row.created_at as number,
    updatedAt: (row.updated_at as number) ?? (row.created_at as number),
    status: (row.status as TaskStatus) ?? 'todo',
    projectId: (row.project_id as string | null) ?? undefined,
    columnId: (row.column_id as string | null) ?? undefined,
    checked: (row.checked as boolean) ?? false,
    checkedAt: (row.checked_at as number | null) ?? undefined,
    dueDate: (row.due_date as string | null) ?? undefined,
    startTime: (row.start_time as string | null) ?? undefined,
    estimatedMins: (row.estimated_mins as number | null) ?? undefined,
    weekOrder: (row.week_order as number | null) ?? undefined,
    recurringGroupId: (row.recurring_group_id as string | null) ?? undefined,
    weeklyTarget: (row.weekly_target as number | null) ?? undefined,
    hasCanvas: (row.has_canvas as boolean | null) ?? false,
    deletedAt: (row.deleted_at as number | null) ?? undefined,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadSessionsIndex(): Promise<SessionMeta[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) { console.error('loadSessionsIndex:', error); return [] }
  return (data ?? []).map(rowToSession)
}

export async function createSession(
  title = 'New session',
  opts: { projectId?: string; status?: TaskStatus; columnId?: string; hasCanvas?: boolean } = {}
): Promise<SessionMeta> {
  const now = Date.now()
  const session: SessionMeta = {
    id: `sess-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 60) || 'New session',
    createdAt: now,
    updatedAt: now,
    status: opts.status ?? 'todo',
    projectId: opts.projectId,
    columnId: opts.columnId,
    hasCanvas: opts.hasCanvas ?? false,
  }
  const { error } = await supabase.from('sessions').insert({
    id: session.id,
    title: session.title,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    status: session.status,
    project_id: session.projectId ?? null,
    column_id: session.columnId ?? null,
    has_canvas: session.hasCanvas ?? false,
  })
  if (error) console.error('createSession:', error)
  saveCurrentSessionId(session.id)
  return session
}

// Soft-delete: marks deleted_at so the item disappears from normal queries
// but can be restored from the trash panel.
export async function softDeleteSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ deleted_at: Date.now(), updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('softDeleteSession:', error)
}

// Hard-delete: permanently removes from DB (used from trash panel).
export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) console.error('deleteSession:', error)
}

// Restore a soft-deleted session back to the board.
export async function restoreSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ deleted_at: null, updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('restoreSession:', error)
}

// Hard-delete soft-deleted sessions older than 7 days. Call once on app mount.
export async function cleanupOldTrashedSessions(): Promise<void> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const { error } = await supabase
    .from('sessions')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
  if (error) console.error('cleanupOldTrashedSessions:', error)
}

// Load sessions that have been soft-deleted, most recently deleted first.
export async function loadTrashedSessions(): Promise<SessionMeta[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(50)
  if (error) { console.error('loadTrashedSessions:', error); return [] }
  return (data ?? []).map(rowToSession)
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ title: title.slice(0, 60), updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('updateSessionTitle:', error)
}

export async function updateSessionStatus(id: string, status: TaskStatus): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status, updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('updateSessionStatus:', error)
}

export async function updateSessionProject(id: string, projectId: string | undefined): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ project_id: projectId ?? null, updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('updateSessionProject:', error)
}

export async function updateSessionColumn(id: string, columnId: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ column_id: columnId, updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('updateSessionColumn:', error)
}

export async function updateSessionChecked(id: string, checked: boolean): Promise<void> {
  const now = Date.now()
  const { error } = await supabase
    .from('sessions')
    .update({ checked, checked_at: checked ? now : null, updated_at: now })
    .eq('id', id)
  if (error) console.error('updateSessionChecked:', error)
}

export async function updateSessionHasCanvas(id: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ has_canvas: true, updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('updateSessionHasCanvas:', error)
}

export async function updateSessionSchedule(
  id: string,
  dueDate: string | undefined,
  estimatedMins: number | undefined
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({
      due_date: dueDate ?? null,
      estimated_mins: estimatedMins ?? null,
      updated_at: Date.now(),
    })
    .eq('id', id)
  if (error) console.error('updateSessionSchedule:', error)
}

export async function updateSessionsWeekOrder(updates: { id: string; weekOrder: number }[]): Promise<void> {
  await Promise.all(
    updates.map(({ id, weekOrder }) =>
      supabase
        .from('sessions')
        .update({ week_order: weekOrder, updated_at: Date.now() })
        .eq('id', id)
    )
  )
}

export async function touchSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ updated_at: Date.now() })
    .eq('id', id)
  if (error) console.error('touchSession:', error)
}

// General-purpose field updater used by the AI assistant for task modifications.
// Only writes fields that are explicitly present in `updates`.
export async function updateSessionFull(
  id: string,
  updates: Partial<{
    title: string
    projectId: string | null
    columnId: string | null
    dueDate: string | null
    startTime: string | null
    estimatedMins: number | null
  }>
): Promise<void> {
  const dbUpdate: Record<string, unknown> = { updated_at: Date.now() }
  if ('title' in updates) dbUpdate.title = (updates.title ?? '').slice(0, 60) || 'New session'
  if ('projectId' in updates) dbUpdate.project_id = updates.projectId ?? null
  if ('columnId' in updates) dbUpdate.column_id = updates.columnId ?? null
  if ('dueDate' in updates) dbUpdate.due_date = updates.dueDate ?? null
  if ('startTime' in updates) dbUpdate.start_time = updates.startTime ?? null
  if ('estimatedMins' in updates) dbUpdate.estimated_mins = updates.estimatedMins ?? null
  const { error } = await supabase.from('sessions').update(dbUpdate).eq('id', id)
  if (error) console.error('updateSessionFull:', error)
}

export async function createRecurringSessions(
  title: string,
  weeklyTarget: number,
  plannedDays: string[],
  opts: { projectId?: string; columnId?: string } = {}
): Promise<SessionMeta[]> {
  const groupId = `rg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const now = Date.now()
  const rows = plannedDays.map((dueDate, i) => {
    const id = `sess-${now + i}-${Math.random().toString(36).slice(2, 7)}`
    return {
      id,
      title: title.trim().slice(0, 60) || 'New session',
      created_at: now + i,
      updated_at: now + i,
      status: 'todo' as TaskStatus,
      project_id: opts.projectId ?? null,
      column_id: opts.columnId ?? null,
      due_date: dueDate,
      recurring_group_id: groupId,
      weekly_target: weeklyTarget,
      has_canvas: false,
    }
  })

  const { error } = await supabase.from('sessions').insert(rows)
  if (error) console.error('createRecurringSessions:', error)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    projectId: opts.projectId,
    columnId: opts.columnId,
    checked: false,
    dueDate: row.due_date,
    recurringGroupId: groupId,
    weeklyTarget,
    hasCanvas: false,
  }))
}
