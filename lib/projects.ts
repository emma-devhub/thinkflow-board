import type { Project } from '@/types'
import { supabase } from '@/lib/supabase'

export const PROJECT_COLORS = [
  '#c8a96e', // amber
  '#6ea8c8', // blue
  '#6ec87a', // green
  '#c86e8e', // rose
  '#a06ec8', // purple
]

export async function loadProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('loadProjects:', error); return [] }
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    color: row.color,
    createdAt: row.created_at,
  }))
}

export async function createProject(title: string): Promise<Project> {
  const existing = await loadProjects()
  const color = PROJECT_COLORS[existing.length % PROJECT_COLORS.length]
  const project: Project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 60) || 'New project',
    color,
    createdAt: Date.now(),
  }
  const { error } = await supabase.from('projects').insert({
    id: project.id,
    title: project.title,
    color: project.color,
    created_at: project.createdAt,
  })
  if (error) console.error('createProject:', error)
  return project
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) console.error('deleteProject:', error)
}

export async function updateProjectTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ title: title.slice(0, 60) })
    .eq('id', id)
  if (error) console.error('updateProjectTitle:', error)
}
