'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import {
  loadSessionsIndex,
  loadCurrentSessionId,
  saveCurrentSessionId,
  createSession,
  deleteSession,
  updateSessionTitle,
} from '@/lib/sessions'
import type { SessionMeta } from '@/types'

const ThinkCanvas = dynamic(() => import('@/components/ThinkCanvas'), { ssr: false })

export default function Home() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Bootstrap on mount
  useEffect(() => {
    const index = loadSessionsIndex()
    const lastId = loadCurrentSessionId()
    if (index.length === 0) {
      const s = createSession('New session')
      setSessions([s])
      setCurrentSessionId(s.id)
    } else {
      setSessions(index)
      const validId = lastId && index.find((s) => s.id === lastId) ? lastId : index[0].id
      setCurrentSessionId(validId)
      saveCurrentSessionId(validId)
    }
  }, [])

  const handleNewSession = useCallback(() => {
    const s = createSession('New session')
    setSessions((prev) => [s, ...prev])
    setCurrentSessionId(s.id)
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    setCurrentSessionId(id)
    saveCurrentSessionId(id)
  }, [])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id)
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id)
      if (id === currentSessionId) {
        if (remaining.length === 0) {
          const s = createSession('New session')
          setCurrentSessionId(s.id)
          return [s]
        }
        setCurrentSessionId(remaining[0].id)
        saveCurrentSessionId(remaining[0].id)
      }
      return remaining
    })
  }, [currentSessionId])

  const handleTitleChange = useCallback((title: string) => {
    if (!title || !currentSessionId) return
    updateSessionTitle(currentSessionId, title)
    setSessions((prev) =>
      prev.map((s) => s.id === currentSessionId ? { ...s, title } : s)
    )
  }, [currentSessionId])

  if (!currentSessionId) return null

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ThinkCanvas
          sessionId={currentSessionId}
          onTitleChange={handleTitleChange}
        />
      </div>
    </div>
  )
}
