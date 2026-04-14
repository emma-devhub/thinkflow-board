'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import ProjectRail from '@/components/ProjectRail'
import KanbanBoard from '@/components/KanbanBoard'
import WeekBoard from '@/components/WeekBoard'
import BoardChatPanel from '@/components/BoardChatPanel'
import {
  loadSessionsIndex,
  loadCurrentSessionId,
  saveCurrentSessionId,
  createSession,
  createRecurringSessions,
  softDeleteSession,
  deleteSession,
  restoreSession,
  loadTrashedSessions,
  updateSessionTitle,
  updateSessionColumn,
  updateSessionProject,
  updateSessionChecked,
  updateSessionSchedule,
  updateSessionsWeekOrder,
  updateSessionHasCanvas,
  updateSessionFull,
  cleanupOldTrashedSessions,
} from '@/lib/sessions'
import {
  loadProjects,
  createProject,
  deleteProject,
  updateProjectTitle,
} from '@/lib/projects'
import { loadDirections, type Direction } from '@/lib/directions'
import type { SessionMeta, Project, ParsedTask, ParsedTaskUpdate } from '@/types'
import { useIsMobile } from '@/lib/useIsMobile'

// Synchronous mobile check for initial state (runs only on client)
const initMobile = () => typeof window !== 'undefined' && window.innerWidth < 768

const ThinkCanvas = dynamic(() => import('@/components/ThinkCanvas'), { ssr: false })

type View = 'kanban' | 'canvas'

export default function Home() {
  const isMobile = useIsMobile()
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [dirs, setDirs] = useState<Direction[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  // On mobile: default to kanban+week; on desktop: default to canvas
  const [view, setView] = useState<View>(() => initMobile() ? 'kanban' : 'canvas')
  const [boardView, setBoardView] = useState<'domain' | 'week'>(() => initMobile() ? 'week' : 'domain')
  const [canvasSessionId, setCanvasSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [trash, setTrash] = useState<SessionMeta[]>([])
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [isTrashLoading, setIsTrashLoading] = useState(false)

  // Bootstrap on mount
  useEffect(() => {
    cleanupOldTrashedSessions() // fire-and-forget: purge soft-deleted items older than 7 days
    ;(async () => {
      const [loadedSessions, loadedProjects, loadedDirs] = await Promise.all([
        loadSessionsIndex(),
        loadProjects(),
        loadDirections(),
      ])
      setSessions(loadedSessions)
      setProjects(loadedProjects)
      setDirs(loadedDirs)
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
    // Sessions created directly from canvas sidebar are canvas sessions
    const s = await createSession(title, { projectId, columnId, hasCanvas: true })
    setSessions((prev) => [s, ...prev])
    setCanvasSessionId(s.id)
  }, [])

  const handleDeleteSession = useCallback(async (id: string) => {
    // Soft-delete: marks deleted_at in DB, moves to in-memory trash for recovery
    softDeleteSession(id)
    const deleted = sessions.find((s) => s.id === id)
    if (deleted) setTrash((prev) => [{ ...deleted, deletedAt: Date.now() }, ...prev])
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (canvasSessionId === id) setCanvasSessionId('')
  }, [canvasSessionId, sessions])

  const handleOpenTrash = useCallback(async () => {
    setIsTrashOpen(true)
    setIsTrashLoading(true)
    const trashed = await loadTrashedSessions()
    setTrash(trashed)
    setIsTrashLoading(false)
  }, [])

  const handleRestoreSession = useCallback(async (id: string) => {
    await restoreSession(id)
    const item = trash.find((s) => s.id === id)
    if (item) {
      const restored = { ...item, deletedAt: undefined }
      setSessions((prev) => [restored, ...prev])
    }
    setTrash((prev) => prev.filter((s) => s.id !== id))
  }, [trash])

  const handlePermanentDelete = useCallback(async (id: string) => {
    await deleteSession(id)
    setTrash((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleMoveSession = useCallback(async (id: string, columnId: string) => {
    updateSessionColumn(id, columnId)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, columnId } : s))
  }, [])

  const handleToggleChecked = useCallback(async (id: string, checked: boolean) => {
    updateSessionChecked(id, checked)
    const checkedAt = checked ? Date.now() : undefined
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, checked, checkedAt } : s))
  }, [])

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    updateSessionTitle(id, title)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s))
  }, [])

  const handleCreateTasks = useCallback(async (tasks: ParsedTask[]) => {
    for (const task of tasks) {
      if (task.weeklyTarget && task.plannedDays && task.plannedDays.length > 0) {
        const sessions = await createRecurringSessions(
          task.title,
          task.weeklyTarget,
          task.plannedDays,
          { projectId: task.projectId ?? undefined, columnId: task.columnId ?? undefined }
        )
        setSessions((prev) => [...sessions, ...prev])
      } else {
        const s = await createSession(task.title, {
          projectId: task.projectId ?? undefined,
          columnId: task.columnId ?? undefined,
        })
        if (task.dueDate) updateSessionSchedule(s.id, task.dueDate, undefined)
        setSessions((prev) => [{ ...s, dueDate: task.dueDate ?? undefined }, ...prev])
      }
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

  const handleCreateWeekSession = useCallback(async (title: string, projectId?: string, dueDate?: string, columnId?: string) => {
    const s = await createSession(title, { projectId, columnId })
    if (dueDate) updateSessionSchedule(s.id, dueDate, undefined)
    setSessions((prev) => [{ ...s, dueDate, columnId }, ...prev])
    setCanvasSessionId(s.id)

    // If no project/focus was specified, ask AI to classify in the background
    if (!projectId && !columnId) {
      fetch('/api/classify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, projects, dirs }),
      })
        .then((r) => r.json())
        .then(({ projectId: guessedProject, columnId: guessedColumn }: { projectId: string | null; columnId: string | null }) => {
          if (!guessedProject && !guessedColumn) return
          if (guessedProject) updateSessionProject(s.id, guessedProject)
          if (guessedColumn) updateSessionColumn(s.id, guessedColumn)
          setSessions((prev) =>
            prev.map((sess) =>
              sess.id === s.id
                ? { ...sess, projectId: guessedProject ?? sess.projectId, columnId: guessedColumn ?? sess.columnId }
                : sess
            )
          )
        })
        .catch(() => { /* silently ignore classify errors */ })
    }
  }, [projects, dirs])

  const handleOpenCanvas = useCallback((sessionId: string) => {
    // Mark hasCanvas on first open (fire-and-forget)
    setSessions((prev) => prev.map((s) => {
      if (s.id === sessionId && !s.hasCanvas) {
        updateSessionHasCanvas(sessionId)
        return { ...s, hasCanvas: true }
      }
      return s
    }))
    setCanvasSessionId(sessionId)
    saveCurrentSessionId(sessionId)
    setView('canvas')
  }, [])

  const handleUpdateTimeSlot = useCallback(async (id: string, startTime: string | null, estimatedMins: number | null) => {
    updateSessionFull(id, { startTime, estimatedMins })
    setSessions((prev) => prev.map((s) => s.id === id
      ? { ...s, startTime: startTime ?? undefined, estimatedMins: estimatedMins ?? undefined }
      : s
    ))
  }, [])

  const handleUpdateTasksFromAI = useCallback(async (updates: ParsedTaskUpdate[]) => {
    for (const upd of updates) {
      const { id, ...fields } = upd
      await updateSessionFull(id, fields)
      setSessions((prev) => prev.map((s) => {
        if (s.id !== id) return s
        const next = { ...s }
        if ('title' in fields && fields.title !== undefined) next.title = fields.title
        if ('projectId' in fields) next.projectId = fields.projectId ?? undefined
        if ('columnId' in fields) next.columnId = fields.columnId ?? undefined
        if ('dueDate' in fields) next.dueDate = fields.dueDate ?? undefined
        if ('startTime' in fields) next.startTime = fields.startTime ?? undefined
        if ('estimatedMins' in fields) next.estimatedMins = fields.estimatedMins ?? undefined
        return next
      }))
    }
  }, [])

  const handleCreateProjectFromAI = useCallback(async (title: string) => {
    const p = await createProject(title)
    setProjects((prev) => [...prev, p])
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
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#faf9f7' }}>
          {!isMobile && (
            <ProjectRail
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onRenameProject={handleRenameProject}
            />
          )}
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
              onUpdateTimeSlot={handleUpdateTimeSlot}
              boardView={boardView}
              onBoardViewChange={setBoardView}
              isChatOpen={isChatOpen}
              onToggleChatOpen={() => setIsChatOpen((v) => !v)}
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
              onCreateTasks={handleCreateTasks}
              onUpdateTimeSlot={handleUpdateTimeSlot}
              boardView={boardView}
              onBoardViewChange={setBoardView}
              isChatOpen={isChatOpen}
              onToggleChatOpen={() => setIsChatOpen((v) => !v)}
              dirs={dirs}
            />
          )}

          {/* AI chat panel — flex sibling on desktop, fixed bottom sheet on mobile */}
          {!isMobile ? (
            <div style={{
              width: isChatOpen ? 320 : 0,
              flexShrink: 0, overflow: 'hidden',
              transition: 'width 200ms ease',
              display: 'flex', flexDirection: 'column',
            }}>
              {isChatOpen && (
                <BoardChatPanel
                  projects={projects}
                  dirs={dirs}
                  sessions={sessions}
                  onCreateTasks={handleCreateTasks}
                  onUpdateTasks={handleUpdateTasksFromAI}
                  onCreateProject={handleCreateProjectFromAI}
                  onClose={() => setIsChatOpen(false)}
                />
              )}
            </div>
          ) : (
            isChatOpen && (
              <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                height: '72vh', zIndex: 100,
                display: 'flex', flexDirection: 'column',
                borderRadius: '16px 16px 0 0',
                overflow: 'hidden',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              }}>
                {/* Drag handle */}
                <div style={{ background: '#faf9f7', paddingTop: 10, paddingBottom: 4, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd' }} />
                </div>
                <BoardChatPanel
                  projects={projects}
                  dirs={dirs}
                  sessions={sessions}
                  onCreateTasks={handleCreateTasks}
                  onUpdateTasks={handleUpdateTasksFromAI}
                  onCreateProject={handleCreateProjectFromAI}
                  onClose={() => setIsChatOpen(false)}
                  isMobile
                />
              </div>
            )
          )}

          {/* Trash button — floating, bottom-left of board area */}
          {trash.length > 0 && !isTrashOpen && (
            <button
              onClick={handleOpenTrash}
              style={{
                position: 'fixed', bottom: 24, left: isMobile ? 16 : 80, zIndex: 50,
                background: 'white', border: '1px solid #e0ddd9',
                borderRadius: 10, padding: '7px 13px',
                fontSize: 12, color: '#888', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f3f0' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white' }}
            >
              🗑 垃圾箱 {trash.length > 0 && <span style={{ background: '#f0ede9', borderRadius: 8, padding: '1px 6px', fontSize: 11, fontWeight: 600, color: '#999' }}>{trash.length}</span>}
            </button>
          )}

          {/* Trash panel overlay */}
          {isTrashOpen && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.25)',
            }} onClick={() => setIsTrashOpen(false)}>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'white', borderRadius: 14, width: 380, maxWidth: '92vw',
                  maxHeight: '70vh', display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                }}
              >
                <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0ede9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>垃圾箱</div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>已删除的任务可从这里恢复</div>
                  </div>
                  <button onClick={() => setIsTrashOpen(false)} style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 14, cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#666' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#bbb' }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                  {isTrashLoading && <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: '20px 0' }}>加载中…</div>}
                  {!isTrashLoading && trash.length === 0 && <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: '20px 0' }}>垃圾箱为空</div>}
                  {!isTrashLoading && trash.map((s) => {
                    const proj = projects.find((p) => p.id === s.projectId)
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, marginBottom: 2 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#faf9f7' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                          {proj && <div style={{ fontSize: 11, color: proj.color, marginTop: 1 }}>{proj.title}</div>}
                        </div>
                        <button onClick={() => handleRestoreSession(s.id)}
                          style={{ flexShrink: 0, fontSize: 11, padding: '4px 9px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#555', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white' }}>
                          恢复
                        </button>
                        <button onClick={() => handlePermanentDelete(s.id)}
                          style={{ flexShrink: 0, fontSize: 11, padding: '4px 9px', borderRadius: 6, border: '1px solid #f5c6c6', background: 'white', color: '#c55', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff0f0' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white' }}>
                          删除
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Canvas (main view, full screen) ── */
        <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
          <Sidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
            sessions={sessions.filter((s) => s.hasCanvas)}
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
