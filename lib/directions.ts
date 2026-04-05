import type { Direction } from '@/types'
import { supabase } from '@/lib/supabase'

export type { Direction }

export const DEFAULT_DIRS: Direction[] = [
  { id: 'todo',       label: '主业', color: 'hsl(0,0%,72%)' },
  { id: 'inprogress', label: '副业', color: '#f0a843' },
  { id: 'done',       label: '生活', color: '#4caf86' },
]

export const EXTRA_COLORS = ['#a06ec8', '#c86e6e', '#6ec8c0', '#6e8ec8']

export async function loadDirections(): Promise<Direction[]> {
  const { data, error } = await supabase
    .from('directions')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) { console.error('loadDirections:', error); return [...DEFAULT_DIRS] }
  if (!data || data.length === 0) {
    // Seed defaults on first run
    await saveDirections(DEFAULT_DIRS)
    return [...DEFAULT_DIRS]
  }
  return data.map((row) => ({
    id: row.id as string,
    label: row.label as string,
    color: row.color as string,
  }))
}

export async function saveDirections(dirs: Direction[]): Promise<void> {
  // Simple replace strategy: delete all then insert all
  const { error: delErr } = await supabase.from('directions').delete().neq('id', '')
  if (delErr) { console.error('saveDirections (delete):', delErr); return }
  if (dirs.length === 0) return
  const { error: insErr } = await supabase.from('directions').insert(
    dirs.map((d, i) => ({ id: d.id, label: d.label, color: d.color, sort_order: i }))
  )
  if (insErr) console.error('saveDirections (insert):', insErr)
}
