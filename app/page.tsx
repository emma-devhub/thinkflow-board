'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import ProjectRail from '@/components/ProjectRail'
import KanbanBoard from '@/components/KanbanBoard'
import {
  loadSessionsIndex,
  loadCurrentSessionId,
  saveCurrentSessionId,
  createSession,
  deleteSession,
  updateSessionTitle,
  updateSessionColumn,
  updateSessionChecked,
} from '@/lib/sessions'
import {
  loadProjects,
  createProject,
  deleteProject,
  updateProjectTitle,
} from '@/lib/projects'
import type { SessionMeta, Project } from '@/types'

const ThinkCanvas = dynamic(() => import('@/components/ThinkCanvas'), { ssr: false })

type View = 'kanban' | 'canvas'

export default function Home() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [view, setView] = useState<View>('canvas')
  const [canvasSessionId, setCanvasSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Bootstrap on mount
  useEffect(() => {
    setSessions(loadSessionsIndex())
    setProjects(loadProjects())
    const lastId = loadCurrentSessionId()
    if (lastId) setCanvasSessionId(lastId)
  }, [])

  // ── Project callbacks ──
  const handleCreateProject = useCallback((title: string) => {
    const p = createProject(title)
    setProjects((prev) => [...prev, p])
  }, [])

  const handleDeleteProject = useCallback((id: string) => {
    deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    // unassign sessions from deleted project
    setSessions((prev) => prev.map((s) => s.projectId === id ? { ...s, projectId: undefined } : s))
    if (selectedProjectId === id) setSelectedProjectId(null)
  }, [selectedProjectId])

  const handleRenameProject = useCallback((id: string, title: string) => {
    updateProjectTitle(id, title)
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, title } : p))
  }, [])

  // ── Session/subtask callbacks ──
  const handleCreateSession = useCallback((title: string, projectId?: string, columnId?: string) => {
    const s = createSession(title, { projectId, columnId })
    setSessions((prev) => [s, ...prev])
    setCanvasSessionId(s.id)
  }, [])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (canvasSessionId === id) setCanvasSessionId('')
  }, [canvasSessionId])

  const handleMoveSession = useCallback((id: string, columnId: string) => {
    updateSessionColumn(id, columnId)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, columnId } : s))
  }, [])

  const handleToggleChecked = useCallback((id: string, checked: boolean) => {
    updateSessionChecked(id, checked)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, checked } : s))
  }, [])

  const handleOpenCanvas = useCallback((sessionId: string) => {
    setCanvasSessionId(sessionId)
    saveCurrentSessionId(sessionId)
    setView('canvas')
  }, [])

  const handleTitleChange = useCallback((title: string) => {
    if (!title || !canvasSessionId) return
    updateSessionTitle(canvasSessionId, title)
    setSessions((prev) => prev.map((s) => s.id === canvasSessionId ? { ...s, title } : s))
  }, [canvasSessionId])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {view === 'kanban' ? (
        /* ── Project board (independent page) ── */
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          <ProjectRail
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
          />
          <KanbanBoard
            sessions={sessions}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onOpenCanvas={handleOpenCanvas}
            onCreateSession={handleCreateSession}
            onDeleteSession={handleDeleteSession}
            onMoveSession={handleMoveSession}
            onToggleChecked={handleToggleChecked}
          />
        </div>
      ) : (
        /* ── Canvas (main view, full screen) ── */
        <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
          <Sidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
            sessions={sessions}
            currentSessionId={canvasSessionId}
            onSelectSession={(id) => { setCanvasSessionId(id); saveCurrentSessionId(id) }}
            onNewSession={() => handleCreateSession('New session')}
            onDeleteSession={handleDeleteSession}
          />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {canvasSessionId && (
            <ThinkCanvas
              sessionId={canvasSessionId}
              onTitleChange={handleTitleChange}
            />
          )}
          </div>
          {/* Projects button — top right overlay */}
          <button
            onClick={() => setView('kanban')}
            style={{
              position: 'absolute', top: 14, right: 16, zIndex: 10,
              background: 'hsla(0,0%,100%,0.9)', border: '1px solid hsl(0,0%,85%)',
              borderRadius: 8, fontSize: 12, color: '#555',
              padding: '6px 12px', cursor: 'pointer',
              boxShadow: '0 1px 6px hsla(0,0%,0%,0.08)',
              backdropFilter: 'blur(4px)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0,0%,93%)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsla(0,0%,100%,0.9)' }}
          >
            ⊞ Projects
          </button>
        </div>
      )}
    </div>
  )
}
