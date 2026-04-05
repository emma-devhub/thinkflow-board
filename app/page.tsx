'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import ProjectRail from '@/components/ProjectRail'
import KanbanBoard from '@/components/KanbanBoard'
import WeekBoard from '@/components/WeekBoard'
import {
  loadSessionsIndex,
  loadCurrentSessionId,
  saveCurrentSessionId,
  createSession,
  deleteSession,
  updateSessionTitle,
  updateSessionColumn,
  updateSessionChecked,
  updateSessionSchedule,
  updateSessionsWeekOrder,
} from '@/lib/sessions'
import {
  loadProjects,
  createProject,
  deleteProject,
  updateProjectTitle,
} from '@/lib/projects'
import type { SessionMeta, Project, ParsedTask } from '@/types'

const ThinkCanvas = dynamic(() => import('@/components/ThinkCanvas'), { ssr: false })

type View = 'kanban' | 'canvas'

export default function Home() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [view, setView] = useState<View>('canvas')
  const [boardView, setBoardView] = useState<'domain' | 'week'>('domain')
  const [canvasSessionId, setCanvasSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Bootstrap on mount
  useEffect(() => {
    ;(async () => {
      const [loadedSessions, loadedProjects] = await Promise.all([
        loadSessionsIndex(),
        loadProjects(),
      ])
      setSessions(loadedSessions)
      setProjects(loadedProjects)
      const lastId = loadCurrentSessionId()
      if (lastId) setCanvasSessionId(lastId)
    })()
  }, [])

  // ── Project callbacks ──
  const handleCreateProject = useCallback(async (title: string) => {
    const p = await createProject(title)
    setProjects((prev) => [...prev, p])
  }, [])

  const handleDeleteProject = useCallback(async (id: string) => {
    await deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    // unassign sessions from deleted project
    setSessions((prev) => prev.map((s) => s.projectId === id ? { ...s, projectId: undefined } : s))
    if (selectedProjectId === id) setSelectedProjectId(null)
  }, [selectedProjectId])

  const handleRenameProject = useCallback(async (id: string, title: string) => {
    await updateProjectTitle(id, title)
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, title } : p))
  }, [])

  // ── Session/subtask callbacks ──
  const handleCreateSession = useCallback(async (title: string, projectId?: string, columnId?: string) => {
    const s = await createSession(title, { projectId, columnId })
    setSessions((prev) => [s, ...prev])
    setCanvasSessionId(s.id)
  }, [])

  const handleDeleteSession = useCallback(async (id: string) => {
    await deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (canvasSessionId === id) setCanvasSessionId('')
  }, [canvasSessionId])

  const handleMoveSession = useCallback(async (id: string, columnId: string) => {
    updateSessionColumn(id, columnId)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, columnId } : s))
  }, [])

  const handleToggleChecked = useCallback(async (id: string, checked: boolean) => {
    updateSessionChecked(id, checked)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, checked } : s))
  }, [])

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    updateSessionTitle(id, title)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s))
  }, [])

  const handleCreateTasks = useCallback(async (tasks: ParsedTask[]) => {
    for (const task of tasks) {
      const s = await createSession(task.title, {
        projectId: task.projectId ?? undefined,
        columnId: task.columnId ?? undefined,
      })
      if (task.dueDate) updateSessionSchedule(s.id, task.dueDate, undefined)
      setSessions((prev) => [{ ...s, dueDate: task.dueDate ?? undefined }, ...prev])
    }
  }, [])

  const handleScheduleSession = useCallback(async (id: string, dueDate: string | undefined, estimatedMins: number | undefined) => {
    updateSessionSchedule(id, dueDate, estimatedMins)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, dueDate, estimatedMins } : s))
  }, [])

  const handleReorderWeek = useCallback(async (updates: { id: string; weekOrder: number }[]) => {
    updateSessionsWeekOrder(updates)
    setSessions((prev) => prev.map((s) => {
      const u = updates.find((x) => x.id === s.id)
      return u ? { ...s, weekOrder: u.weekOrder } : s
    }))
  }, [])

  const handleCreateWeekSession = useCallback(async (title: string, projectId?: string, dueDate?: string) => {
    const s = await createSession(title, { projectId })
    if (dueDate) updateSessionSchedule(s.id, dueDate, undefined)
    setSessions((prev) => [{ ...s, dueDate }, ...prev])
    setCanvasSessionId(s.id)
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
          {boardView === 'domain' ? (
            <KanbanBoard
              sessions={sessions}
              projects={projects}
              selectedProjectId={selectedProjectId}
              onOpenCanvas={handleOpenCanvas}
              onCreateSession={handleCreateSession}
              onDeleteSession={handleDeleteSession}
              onMoveSession={handleMoveSession}
              onToggleChecked={handleToggleChecked}
              onRenameSession={handleRenameSession}
              onCreateTasks={handleCreateTasks}
              boardView={boardView}
              onBoardViewChange={setBoardView}
            />
          ) : (
            <WeekBoard
              sessions={sessions}
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSchedule={handleScheduleSession}
              onReorderWeek={handleReorderWeek}
              onCreateSession={handleCreateWeekSession}
              onDelete={handleDeleteSession}
              onToggleChecked={handleToggleChecked}
              onRename={handleRenameSession}
              onOpenCanvas={handleOpenCanvas}
              boardView={boardView}
              onBoardViewChange={setBoardView}
            />
          )}
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
