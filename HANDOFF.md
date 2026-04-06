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
| AI (classify) | Gemini 2.5 Flash via `/api/classify-task` |
| AI (memory distill) | Gemini 2.5 Flash via `/api/distill-memory` |
| Storage | Supabase (PostgreSQL) — migrated from localStorage 2026-04-04 |
| Deploy target | Vercel (Next.js 16 App Router, Node.js streaming) |

---

## File Map

```
app/
  page.tsx                      — Root: owns all state, routes between canvas and board views
  api/chat/route.ts             — POST /api/chat: Gemini SSE → plain text stream (canvas AI)
  api/board-chat/route.ts       — POST /api/board-chat: Gemini streaming (Board Assistant)
  api/classify-task/route.ts    — POST /api/classify-task: auto-classify task → {projectId, columnId}
  api/distill-memory/route.ts   — POST /api/distill-memory: summarise chat history into memory.md
  globals.css                   — Global styles + keyframe animations

components/
  ThinkCanvas.tsx       — React Flow canvas: nodes, edges, branching, mindmap layout
  ResearchNode.tsx      — Card UI for seed / response / note node types
  DeletableEdge.tsx     — SVG edge with hover-to-delete button at midpoint
  ExpandModal.tsx       — Full-screen content overlay (Escape to close)
  Sidebar.tsx           — Collapsible session list (canvas view, only hasCanvas sessions)
  KanbanBoard.tsx       — "By Focus" kanban with horizontal scroll + Board Assistant toggle
  WeekBoard.tsx         — "By Time" week view with day columns and unscheduled column
  ProjectRail.tsx       — Collapsible project sidebar (desktop only)
  BoardChatPanel.tsx    — Board Assistant chat UI (shared between both views, persists history)

lib/
  sessions.ts   — Supabase CRUD for sessions
  projects.ts   — Supabase CRUD for projects
  directions.ts — Supabase CRUD for focus columns (directions)
  canvas.ts     — Supabase CRUD for canvas_states
  memory.ts     — Supabase CRUD for chat_messages + user_memory
  supabase.ts   — Supabase client singleton

types/
  index.ts      — All TypeScript interfaces
```

---

## Supabase Schema

### `sessions`

```sql
create table sessions (
  id text primary key,
  title text,
  created_at bigint,
  updated_at bigint,
  status text default 'todo',
  project_id text,
  column_id text,
  checked boolean default false,
  checked_at bigint,               -- ms timestamp when checked=true was last set
  due_date text,
  estimated_mins integer,
  week_order integer,
  recurring_group_id text,
  weekly_target integer,
  has_canvas boolean default false  -- true once user has explicitly opened canvas for this card
);
```

### `canvas_states`

```sql
create table canvas_states (
  session_id text primary key,
  nodes jsonb,
  edges jsonb,
  layout_dir text,
  updated_at bigint
);
```

### `projects` / `directions`

```sql
create table projects (id text primary key, title text, color text, created_at bigint);
create table directions (id text primary key, label text, color text, sort_order integer);
```

### `chat_messages`

```sql
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tasks jsonb,
  created_at timestamptz default now()
);
```

### `user_memory`

```sql
create table user_memory (
  id integer primary key default 1,
  content text not null default '',
  updated_at timestamptz default now()
);
insert into user_memory (id, content) values (1, '') on conflict (id) do nothing;
```

---

## Data Model

### SessionMeta

```ts
interface SessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  status: TaskStatus         // 'todo' | 'inprogress' | 'done'
  projectId?: string
  columnId?: string          // maps to Direction.id
  checked?: boolean
  checkedAt?: number         // ms timestamp of last check — used for pre-week filter
  dueDate?: string           // 'YYYY-MM-DD'
  weekOrder?: number         // sort order within a day column
  estimatedMins?: number
  recurringGroupId?: string
  weeklyTarget?: number
  hasCanvas?: boolean        // true once canvas was opened for this card
}
```

### ParsedTask (Board Assistant output)

```ts
interface ParsedTask {
  title: string
  projectId: string | null
  columnId: string | null
  dueDate: string | null
  weeklyTarget?: number
  plannedDays?: string[]     // length = weeklyTarget
}
```

---

## Key Flows

### 1. Board Assistant — Task Creation

```
user pastes todo list → BoardChatPanel sends to /api/board-chat (with memory in system prompt)
  → Gemini parses tasks, infers project/column/dueDate
  → response streams with <tasks>[JSON]</tasks> block at end
  → while streaming: hide <tasks> block from display
  → on stream end: parseTasksBlock() extracts ParsedTask[]
  → shows preview cards with project/column/date tags
  → user clicks "Add N tasks" → onCreateTasks(tasks) callback
  → messages saved to chat_messages table (fire-and-forget)
  → every 10 user messages: /api/distill-memory updates user_memory (background)
```

### 2. Board Assistant Memory

```
On panel mount:
  loadChatHistory(80)  → restore up to 80 messages from chat_messages table
  loadMemory()         → load user_memory.content into memoryRef

Each conversation turn:
  memory sent in every /api/board-chat request (system prompt injection)
  messages saved to DB after stream ends

Every 10th user message:
  POST /api/distill-memory { messages: last-20, currentMemory }
  → Gemini produces updated bullet-point memory (<400 words)
  → saved to user_memory table + memoryRef updated
```

### 3. Canvas — On-Demand Creation

```
Task cards created from board views have hasCanvas=false by default.
↗ arrow shown on every card hover — gray when hasCanvas=false, blue when true.
On first click:
  updateSessionHasCanvas(id)  → sets has_canvas=true in DB
  setView('canvas')
Canvas Sidebar only shows sessions where hasCanvas=true.
Sessions created via "New chat" in sidebar always get hasCanvas=true.
```

### 4. Auto-Classification (By Time unscheduled add)

```
User adds task without @mentions → handleCreateWeekSession fires
→ background fetch to /api/classify-task { title, projects, dirs }
→ Gemini returns { projectId, columnId } (temperature=0)
→ updateSessionProject / updateSessionColumn called silently
→ card updates in place without user action
```

### 5. @mention Parsing (By Time add input)

```
"fix bug @Thinkflow @Vibe Coding" → parseMentions():
  split on '@', match each segment against projects (title) + dirs (label)
  → { title: "fix bug", projectId: <id>, columnId: <id> }
Unmatched @tokens stay in the title.
```

### 6. Pre-Week Done Task Filter

```
Both KanbanBoard and WeekBoard filter:
  sessions.filter(s => !(s.checked && (s.checkedAt ?? s.updatedAt) < thisMonday))
Always on — no toggle. Uses checkedAt for accuracy; falls back to updatedAt for
tasks checked before the column was added.
```

### 7. By Focus — Horizontal Scroll

```
Columns container: overflowX: 'auto', each column width: 220px, flexShrink: 0
On mount (after dirs load): if 未分类 is empty → scrollTo({ left: 236, behavior: 'smooth' })
  (236 = 220px column + 16px gap)
```

---

## API Endpoints

### `POST /api/chat` — canvas AI

```
Request:  { message, context: [{role, content}] }
Response: 200 text/stream | 429 | 500
Rate limit: 10 req/min/IP
```

### `POST /api/board-chat` — Board Assistant

```
Request:  { message, context, projects, columns, today, memory? }
Response: 200 text/stream (may contain <tasks>[JSON]</tasks>)
Rate limit: 20 req/min/IP
```

### `POST /api/classify-task` — background auto-classify

```
Request:  { title, projects: [{id,title}], dirs: [{id,label}] }
Response: { projectId: string|null, columnId: string|null }
Fire-and-forget from client. Returns nulls on any error.
```

### `POST /api/distill-memory` — memory distillation

```
Request:  { messages: [{role,content}], currentMemory: string }
Response: { memory: string }   (updated bullet-point memory, <400 words)
Triggered every 10 user messages from BoardChatPanel. Fire-and-forget.
```

---

## Environment

```env
GEMINI_API_KEY=...                  # from Google AI Studio
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Changelog

### 2026-04-06

- **Board Assistant memory**: Chat history persisted in `chat_messages` table; `user_memory` table stores distilled bullet-point memory; every 10 user messages, `/api/distill-memory` updates the memory; memory injected into every board-chat system prompt.
- **Canvas on-demand**: Cards no longer auto-populate canvas sidebar. `has_canvas` column added. `↗` arrow gray (create) → blue (open) on first click. Canvas sidebar filters to `hasCanvas=true` sessions only.
- **`checked_at` accuracy**: New `checked_at` column set when task is checked. Pre-week filter uses `checkedAt` instead of `updatedAt` to avoid false positives from renames/moves.
- **Hide pre-week done tasks**: Always-on filter removes tasks completed before this week's Monday. No toggle button.
- **By Focus horizontal scroll**: Columns now scroll horizontally (220px fixed width). Auto-scrolls past empty 未分类 on load.
- **Recurring progress denominator**: `getRecurringProgress` now uses `group.length` (actual card count) instead of `weeklyTarget` as denominator.
- **Board Assistant header**: Matched height to main panel header (two-line: title 18px + subtitle 12px).
- **Board Assistant input**: Textarea defaults to 3 rows / minHeight 60px.
- **Concave sidebar corners**: Main board area has `borderTopRightRadius/borderBottomRightRadius: 12` when AI panel is open.

### 2026-04-05

- **Shared AI panel**: `BoardChatPanel` lifted to `page.tsx` — single instance shared between By Focus and By Time. State (history, open/closed) persists across view switches.
- **`@mention` parsing**: By Time unscheduled add supports `@ProjectName @FocusName` inline. Unmatched tokens stay in title.
- **Auto-classify**: Tasks added without `@mentions` are silently classified by `/api/classify-task` in the background.
- **未分类 column**: By Focus always shows an 未分类 column for sessions with no matching focus. Supports inline add.
- **Mobile-responsive layout**: ProjectRail hidden on mobile; By Time is default mobile view.

### 2026-04-05 (earlier)

- **Recurring / count-based tasks**: `recurringGroupId` + `weeklyTarget`. Board Assistant parses "3次, 暂定135" → N cards on planned days. Cards show `(X/Y次)` progress badge; overdue = orange border + `· 逾期`.
- **By Time AI panel**: Panel pushed columns left (flex sibling, not overlay).

### 2026-04-04

- **Board Assistant**: `BoardChatPanel.tsx` + `/api/board-chat`. Paste todos → AI parses → preview → create cards.
- **By Time layout**: Unscheduled column fixed left; day columns auto-scroll to today.
- **Supabase migration**: All data moved from `localStorage` to Supabase PostgreSQL.
