import type { Project } from '@/types'

const PROJECTS_KEY = 'thinkflow-projects'

export const PROJECT_COLORS = [
  '#c8a96e', // amber
  '#6ea8c8', // blue
  '#6ec87a', // green
  '#c86e8e', // rose
  '#a06ec8', // purple
]

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Project[]
  } catch { return [] }
}

function saveProjects(projects: Project[]): void {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)) } catch { /* ignore */ }
}

export function createProject(title: string): Project {
  const existing = loadProjects()
  const color = PROJECT_COLORS[existing.length % PROJECT_COLORS.length]
  const project: Project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 60) || 'New project',
    color,
    createdAt: Date.now(),
  }
  saveProjects([...existing, project])
  return project
}

export function deleteProject(id: string): void {
  saveProjects(loadProjects().filter((p) => p.id !== id))
}

export function updateProjectTitle(id: string, title: string): void {
  saveProjects(loadProjects().map((p) => p.id === id ? { ...p, title: title.slice(0, 60) } : p))
}
