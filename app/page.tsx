'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
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
  const [view, setView] = useState<View>('kanban')
  const [canvasSessionId, setCanvasSessionId] = useState<string>('')

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
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Left rail — always visible */}
      <ProjectRail
        projects={projects}
        selectedProjectId={view === 'kanban' ? selectedProjectId : null}
        onSelectProject={(id) => { setSelectedProjectId(id); setView('kanban') }}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
      />

      {/* Main area */}
      {view === 'kanban' ? (
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
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Back bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', borderBottom: '1px solid #e0ddd9',
            background: '#fafafa', flexShrink: 0,
          }}>
            <button
              onClick={() => setView('kanban')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#666', padding: '4px 8px',
                borderRadius: 6,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eee' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              ← Back to board
            </button>
            {canvasSessionId && (
              <span style={{ fontSize: 13, color: '#aaa' }}>
                {sessions.find((s) => s.id === canvasSessionId)?.title ?? ''}
              </span>
            )}
          </div>

          {/* Canvas */}
          {canvasSessionId && (
            <ThinkCanvas
              sessionId={canvasSessionId}
              onTitleChange={handleTitleChange}
            />
          )}
        </div>
      )}
    </div>
  )
}
