# ThinkFlow Board — Developer Handoff

Internal reference for developers picking up this codebase.

---

## Repo Context

| Item | Detail |
|---|---|
| Repo | `emma-devhub/thinkflow-board` |
| Sister repo | `emma-devhub/thinkflow` — canvas-only version (no Kanban) |
| AI (canvas) | Gemini 2.5 Flash via `/api/chat` |
| AI (board assistant) | Gemini 2.5 Flash via `/api/board-chat` |
| Storage | Supabase (PostgreSQL) — migrated from localStorage 2026-04-04 |
| Deploy target | Vercel (Next.js 16 App Router, Node.js streaming) |

---

## File Map

```
app/
  page.tsx                  — Root: owns all state, routes between canvas and board views
  api/chat/route.ts         — POST /api/chat: Gemini SSE → plain text stream (canvas AI)
  api/board-chat/route.ts   — POST /api/board-chat: Gemini streaming (Board Assistant)
  globals.css               — Global styles + keyframe animations

components/
  ThinkCanvas.tsx           — React Flow canvas: nodes, edges, branching, mindmap layout
  ResearchNode.tsx          — Card UI for seed / response / note node types
  DeletableEdge.tsx         — SVG edge with hover-to-delete button at midpoint
  ExpandModal.tsx           — Full-screen content overlay (Escape to close)
  Sidebar.tsx               — Collapsible session list (canvas view)
  KanbanBoard.tsx           — Kanban board with drag-and-drop columns + Board Assistant panel
  WeekBoard.tsx             — "By Time" week view with day columns and unscheduled column
  ProjectRail.tsx           — Collapsible project sidebar
  BoardChatPanel.tsx        — Board Assistant chat UI (Gemini-powered, streaming)

lib/
  sessions.ts               — CRUD helpers for localStorage session management
  projects.ts               — Project CRUD helpers

types/
  index.ts                  — All TypeScript interfaces
```

---

## Data Model

### localStorage Keys

| Key | Content |
|---|---|
| `thinkflow-sessions` | `SessionMeta[]` sorted by `updatedAt` desc |
| `thinkflow-current` | current session ID string |
| `thinkflow-canvas-{id}` | `{ nodes: Node[], edges: Edge[] }` |
| `thinkflow-canvas-{id}:dir` | `'LR'` or `'TB'` |
| `thinkflow-projects` | `Project[]` |
| `thinkflow-directions` | `Direction[]` — Kanban column definitions |

### SessionMeta

```ts
interface SessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  status: TaskStatus         // 'todo' | 'inprogress' | 'done'
  projectId?: string
  columnId?: string          // maps to Direction.id in Kanban
  checked?: boolean          // task completion state
  dueDate?: string           // 'YYYY-MM-DD' for By Time view
  weekOrder?: number         // sort order within a day column
  estimatedMins?: number     // time estimate (UI hidden, kept for future)
  recurringGroupId?: string  // shared ID across all instances of a recurring task
  weeklyTarget?: number      // total times per week (e.g. 3 for "gym 3×/week")
}
```

### ParsedTask (Board Assistant output)

```ts
interface ParsedTask {
  title: string
  projectId: string | null
  columnId: string | null
  dueDate: string | null      // 'YYYY-MM-DD' — used for one-off tasks
  weeklyTarget?: number       // if set, this is a recurring task
  plannedDays?: string[]      // YYYY-MM-DD list, length = weeklyTarget
}
```

### Recurring Task Group

When `weeklyTarget` is set on a `ParsedTask`, `handleCreateTasks` calls `createRecurringSessions()` which:
- Generates a shared `recurringGroupId` (`rg-{timestamp}-{random}`)
- Creates `weeklyTarget` session rows, one per date in `plannedDays`
- All rows get the same `recurringGroupId` and `weeklyTarget`

Progress badge: `WeekBoard` computes `done/total` by counting checked sessions with the same `recurringGroupId` across **all** sessions (not just visible ones). Overdue = `!checked && dueDate < today` → orange left border + `· 逾期` label.

---

## Key Flows

### 1. Board Assistant — Task Creation

```
user pastes todo list → BoardChatPanel sends to /api/board-chat
  → Gemini parses tasks, infers project/column/dueDate
  → response streams with <tasks>[JSON]</tasks> block at end
  → while streaming: hide <tasks> block from display
  → on stream end: parseTasksBlock() extracts ParsedTask[]
  → shows preview cards with project/column/date tags
  → user clicks "Add N tasks" → onCreateTasks(tasks) callback
      → createSession(title, {projectId, columnId})
      → updateSessionSchedule(id, dueDate) if date present
```

### 2. Canvas — Adaptive Format (tree or chain)

```
stream ends → parseMarkdownSections(content)
  → if ≥2 ## sections: expandToMindmap() → tree layout
  → else: single node stays as card → forms linear chain
```

AI prompt (in `route.ts`) instructs the model to choose format based on content — multi-dimensional topics get `##` headers, focused answers get flowing prose.

### 3. By Time View — Layout

```
WeekBoard renders two sibling areas:
  [fixed] unscheduled column (220px, never scrolls)
  [scrollable] day columns (Mon–Sun, 200px each, overflowX: auto)
    → on mount: scrollContainerRef scrolls to today's column
    → today column highlighted with blue border (#5578cc)
```

### 4. Kanban Board Assistant Panel

```
KanbanBoard renders as flex row:
  [flex: 1] main board area (columns shrink elastically)
  [width: 0→320, transition] BoardChatPanel wrapper
    → opening panel: wrapper width → 320px, columns auto-shrink
    → closing panel: wrapper width → 0px, columns auto-expand
```

---

## Mindmap Layout Algorithm

Same as `thinkflow` repo. `expandToMindmap()` in `ThinkCanvas.tsx`:

**LR mode** (left → right):
- Slot spacing: 360px vertical (cards 320px tall → 40px gap)
- L1 offset from parent: 560px right
- L2 offset from L1: 500px right

**TB mode** (top → bottom):
- Slot spacing: 460px horizontal
- L1 offset: 480px down; L2 offset: 440px down

---

## API Endpoints

### `POST /api/chat` (canvas AI)

```json
Request: { "message": "string", "context": [{ "role": "user"|"model", "content": "string" }] }
Response: 200 plain text stream | 429 rate limited | 500 key missing
```

Rate limit: 10 req/min/IP.

### `POST /api/board-chat` (Board Assistant)

```json
Request: {
  "message": "string",
  "context": [...],
  "projects": [{ "id", "title", "color" }],
  "columns": [{ "id", "label" }],
  "today": "YYYY-MM-DD"
}
Response: 200 plain text stream (may contain <tasks>[JSON]</tasks> at end)
```

Rate limit: 20 req/min/IP.
Task JSON schema: `[{ title, projectId, columnId, dueDate }]`

---

## Environment

```env
GEMINI_API_KEY=...   # from Google AI Studio
```

---

## What's Different vs `thinkflow` (sister repo)

| Feature | thinkflow | thinkflow-board |
|---|---|---|
| Canvas AI | Groq (llama-3.3-70b) | Gemini 2.5 Flash |
| Kanban board | ✗ | ✓ |
| Projects | ✗ | ✓ |
| Board Assistant | ✗ | ✓ |
| By Time view | ✗ | ✓ |
| `ThinkCanvas.tsx` | identical | identical |

---

## Changelog

### 2026-04-05

- **Recurring / count-based tasks**: New task type with `recurringGroupId` + `weeklyTarget`. Board Assistant parses "3次, 暂定135" → creates N cards on planned days. Cards show `(X/Y次)` progress badge; overdue unchecked cards get orange border + `· 逾期`. No auto-rollover by design.
- **By Time AI panel fixes**: AI button moved to far right (matching By Focus). Chat input now anchors to bottom (`display:flex` on wrapper). Panel now pushes columns left instead of overlapping (`minWidth:0` on columns div).
- **Supabase schema**: Added `recurring_group_id text` and `weekly_target integer` columns to `sessions` table.

### 2026-04-04

- **Board Assistant**: Added sliding AI chat panel to Kanban board (`BoardChatPanel.tsx` + `/api/board-chat`). Paste todos → AI parses → preview → create cards. Panel pushes board left with elastic column widths.
- **By Time layout**: Unscheduled column fixed left; day columns scroll independently and auto-scroll to today on mount.
- **Canvas mindmap**: Fixed LR slot spacing 310→360px to prevent card overlap.
- **Adaptive AI format**: Removed forced `##` structure from system prompt. AI now chooses tree vs. single-card format based on content.
- **Supabase migration**: All data moved from `localStorage` to Supabase PostgreSQL.
