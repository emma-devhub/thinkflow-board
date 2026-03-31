# Task Panel Implementation Plan

**Goal:** Add a two-mode sidebar panel — "Tasks" (hierarchical task → session groups) and "Recent" (flat list sorted by date) — so users can organize their research into named projects.

**Architecture:** Introduce a `Task` entity stored in localStorage alongside sessions. Each session gains an optional `taskId` and an `updatedAt` timestamp. The Sidebar gets a view toggle and two rendering modes; `app/page.tsx` wires up new task CRUD callbacks; `ThinkCanvas` pings `updatedAt` whenever the canvas changes.

**Tech Stack:** TypeScript, React, localStorage (no new dependencies)

---

## File Map

| File | Change |
|---|---|
| `types/index.ts` | Add `Task` type; add `taskId?` + `updatedAt` to `SessionMeta` |
| `lib/sessions.ts` | Add `updatedAt` stamping; add task CRUD helpers |
| `lib/tasks.ts` | New — isolated task persistence helpers |
| `components/Sidebar.tsx` | Full rewrite — two view modes, collapsible task groups |
| `app/page.tsx` | Pass task state + callbacks to Sidebar; call `onTitleChange` on session update |

---

## Task 1: Extend types

**Files:**
- Modify: `types/index.ts`

- [ ] Add `Task` interface and extend `SessionMeta`

```typescript
// types/index.ts — add these:

export interface Task {
  id: string
  title: string
  createdAt: number
  collapsed: boolean
}

// update SessionMeta:
export interface SessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number       // ← new (timestamp of last canvas change)
  taskId?: string         // ← new (undefined = unorganized)
}
```

- [ ] Run `npx tsc --noEmit` — expect errors in sessions.ts (missing `updatedAt`), fix next task

---

## Task 2: Update `lib/sessions.ts`

**Files:**
- Modify: `lib/sessions.ts`

- [ ] Update `createSession` to include `updatedAt`:

```typescript
export function createSession(title = 'New session'): SessionMeta {
  const session: SessionMeta = {
    id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 60) || 'New session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const existing = loadSessionsIndex()
  saveSessionsIndex([session, ...existing])
  saveCurrentSessionId(session.id)
  return session
}
```

- [ ] Add `touchSession` (bumps `updatedAt`):

```typescript
export function touchSession(id: string): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(
    existing.map((s) => s.id === id ? { ...s, updatedAt: Date.now() } : s)
  )
}
```

- [ ] Add `moveSessionToTask`:

```typescript
export function moveSessionToTask(sessionId: string, taskId: string | undefined): void {
  const existing = loadSessionsIndex()
  saveSessionsIndex(
    existing.map((s) => s.id === sessionId ? { ...s, taskId } : s)
  )
}
```

- [ ] Update `loadSessionsIndex` sort to use `updatedAt` (fallback to `createdAt` for old data):

```typescript
return arr.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
```

- [ ] Run `npx tsc --noEmit` — should be clean

---

## Task 3: Create `lib/tasks.ts`

**Files:**
- Create: `lib/tasks.ts`

- [ ] Write task CRUD helpers:

```typescript
import type { Task } from '@/types'

const TASKS_KEY = 'thinkflow-tasks'

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Task[]
  } catch { return [] }
}

function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  } catch { /* ignore */ }
}

export function createTask(title: string): Task {
  const task: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim().slice(0, 60) || 'New task',
    createdAt: Date.now(),
    collapsed: false,
  }
  saveTasks([...loadTasks(), task])
  return task
}

export function deleteTask(id: string): void {
  saveTasks(loadTasks().filter((t) => t.id !== id))
}

export function updateTaskTitle(id: string, title: string): void {
  saveTasks(loadTasks().map((t) => t.id === id ? { ...t, title: title.slice(0, 60) } : t))
}

export function toggleTaskCollapsed(id: string): void {
  saveTasks(loadTasks().map((t) => t.id === id ? { ...t, collapsed: !t.collapsed } : t))
}
```

- [ ] Run `npx tsc --noEmit` — clean

---

## Task 4: Update `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] Import new helpers and types:

```typescript
import { loadTasks, createTask, deleteTask, updateTaskTitle, toggleTaskCollapsed } from '@/lib/tasks'
import { moveSessionToTask, touchSession } from '@/lib/sessions'
import type { Task } from '@/types'
```

- [ ] Add task state:

```typescript
const [tasks, setTasks] = useState<Task[]>([])

// in the bootstrap useEffect, also load tasks:
setTasks(loadTasks())
```

- [ ] Add task callbacks:

```typescript
const handleNewTask = useCallback((title: string) => {
  const t = createTask(title)
  setTasks((prev) => [...prev, t])
}, [])

const handleDeleteTask = useCallback((id: string) => {
  deleteTask(id)
  setTasks((prev) => prev.filter((t) => t.id !== id))
  // unassign all sessions that were in this task
  setSessions((prev) => prev.map((s) => s.taskId === id ? { ...s, taskId: undefined } : s))
}, [setSessions])

const handleRenameTask = useCallback((id: string, title: string) => {
  updateTaskTitle(id, title)
  setTasks((prev) => prev.map((t) => t.id === id ? { ...t, title } : t))
}, [])

const handleToggleTask = useCallback((id: string) => {
  toggleTaskCollapsed(id)
  setTasks((prev) => prev.map((t) => t.id === id ? { ...t, collapsed: !t.collapsed } : t))
}, [])

const handleMoveSession = useCallback((sessionId: string, taskId: string | undefined) => {
  moveSessionToTask(sessionId, taskId)
  setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, taskId } : s))
}, [setSessions])
```

- [ ] Pass `onTouchSession` to `ThinkCanvas` (so canvas changes bump `updatedAt`):

```typescript
// in ThinkCanvas props: add onTouch?: () => void
// call it whenever canvas saves

// In page.tsx:
const handleTouch = useCallback(() => {
  touchSession(currentSessionId)
  setSessions((prev) =>
    prev.map((s) => s.id === currentSessionId ? { ...s, updatedAt: Date.now() } : s)
  )
}, [currentSessionId])
```

- [ ] Pass all new props to `<Sidebar>` and `<ThinkCanvas>`

- [ ] Run `npx tsc --noEmit` — fix any type errors

---

## Task 5: Rewrite `components/Sidebar.tsx`

**Files:**
- Modify: `components/Sidebar.tsx`

This is the main UI work. Two view modes: `tasks` and `recent`.

- [ ] Update `SidebarProps` interface:

```typescript
interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  sessions: SessionMeta[]
  tasks: Task[]
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
  onNewTask: (title: string) => void
  onDeleteTask: (id: string) => void
  onRenameTask: (id: string, title: string) => void
  onToggleTask: (id: string) => void
  onMoveSession: (sessionId: string, taskId: string | undefined) => void
}
```

- [ ] Add view toggle state `'tasks' | 'recent'` (default `'recent'`):

```typescript
const [view, setView] = useState<'tasks' | 'recent'>('recent')
```

- [ ] **Recent view** — render sessions flat, grouped by relative date:

```typescript
function groupByDate(sessions: SessionMeta[]) {
  const now = Date.now()
  const DAY = 86400000
  const groups: { label: string; items: SessionMeta[] }[] = []
  const buckets = [
    { label: 'Today', test: (s: SessionMeta) => now - (s.updatedAt ?? s.createdAt) < DAY },
    { label: 'Yesterday', test: (s: SessionMeta) => now - (s.updatedAt ?? s.createdAt) < DAY * 2 },
    { label: 'This week', test: (s: SessionMeta) => now - (s.updatedAt ?? s.createdAt) < DAY * 7 },
    { label: 'Older', test: () => true },
  ]
  const remaining = [...sessions].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  for (const bucket of buckets) {
    const items = remaining.filter(bucket.test)
    remaining.splice(0, remaining.length, ...remaining.filter((s) => !bucket.test(s)))
    if (items.length > 0) groups.push({ label: bucket.label, items })
  }
  return groups
}
```

- [ ] **Tasks view** — render task groups with collapsible session lists + "Unorganized" at bottom:

```typescript
// For each task: show task header (toggle collapse, rename on dblclick, delete on hover)
// Under each task: sessions with taskId === task.id
// At bottom: "Unorganized" group for sessions with no taskId
// "+ New task" button at top
```

- [ ] **Move session to task** — add a right-click context menu OR a small "move" icon on hover showing a task picker dropdown:

```typescript
// Keep it simple: on session hover, show a "⤵" icon
// Clicking it shows a small inline dropdown listing all tasks + "Unorganized"
// Selecting moves the session
```

- [ ] **Inline rename for tasks** — double-click task title enters edit mode (input field, blur to save)

- [ ] Build the complete Sidebar component with both views wired up

- [ ] Run `npx tsc --noEmit` — clean

---

## Task 6: Wire `ThinkCanvas` touch callback

**Files:**
- Modify: `components/ThinkCanvas.tsx`

- [ ] Add `onTouch?: () => void` to `ThinkCanvasProps`

- [ ] Call `onTouch?.()` inside the `useEffect` that saves to localStorage (so every canvas save bumps `updatedAt`):

```typescript
useEffect(() => {
  if (nodes.length === 0) return
  // ... existing save logic ...
  onTouch?.()
}, [nodes, edges, sessionId, layoutDir])
```

- [ ] Run `npx tsc --noEmit` — clean

---

## Task 7: Final integration test + commit

- [ ] Start dev server: `npm run dev`
- [ ] Verify:
  - [ ] Recent view shows date-grouped sessions
  - [ ] Can create a task (+ New task)
  - [ ] Can rename task (double-click)
  - [ ] Can delete task (hover → ✕)
  - [ ] Can move a session to a task (hover session → ⤵ icon → pick task)
  - [ ] Task collapses/expands on click
  - [ ] Canvas changes bump session to top of Recent view
  - [ ] Switching sessions works correctly
  - [ ] Page refresh preserves all data

- [ ] `npx tsc --noEmit` — clean
- [ ] Commit:

```bash
git add types/index.ts lib/sessions.ts lib/tasks.ts components/Sidebar.tsx app/page.tsx components/ThinkCanvas.tsx
git commit -m "feat: add task panel with task/date view modes

- Task entity: create, rename, delete, collapse/expand
- Sessions gain taskId (optional) and updatedAt timestamp
- Sidebar: toggle between Tasks view (grouped) and Recent view (date-grouped)
- Sessions can be moved between tasks via hover picker
- Canvas changes bump session updatedAt for accurate Recent sorting"
```
