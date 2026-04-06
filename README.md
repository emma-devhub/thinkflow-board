# ThinkFlow

**A visual AI research tool and personal task board — think in maps, plan in time.**

ThinkFlow combines an infinite AI canvas with a practical Kanban/week planner, all powered by Google Gemini.

---

## Features

### Visual Research Canvas
Start any topic and watch your research grow into a branching graph. Each AI response becomes a draggable card on an infinite canvas. Branch from any card to explore sub-topics, building a visual conversation tree with full context preserved along each path.

### Adaptive Format — Tree or Chain
The AI decides response format based on content. Multi-dimensional topics auto-expand into a **branching mind map**. Focused follow-ups form a **linear chain**. Both coexist naturally on the same canvas.

### My Note Cards
Drop freeform sticky notes anywhere on the canvas. Notes support Markdown and can be used as branch points for further AI queries.

### Flexible Layout
Toggle between **Left→Right** and **Top→Bottom** tree layouts. Deletable edges let you restructure graphs freely. Cascade delete removes a node and all descendants in one action.

---

### By Focus (Kanban Board)
Organize tasks by focus area (custom columns). Drag cards between columns. Horizontally scrollable — auto-scrolls past empty columns on load.

- **未分类 column**: Always visible, catches tasks with no assigned focus. Inline add supported.
- **Project Rail**: Filter tasks by project using the collapsible left sidebar (desktop).

### By Time (Week View)
A Mon–Sun week board showing tasks by due date, with an unscheduled column on the left.

- Auto-scrolls to today's column on load.
- Add tasks inline with `@ProjectName @FocusName` mention syntax for instant classification.
- Tasks without mentions are **auto-classified** in the background by AI (project + focus guessed silently).

### Recurring / Count-Based Tasks
Weekly habit tracking built in. Tell the Board Assistant *"去gym，每周3次，暂定135"* and it creates three cards placed on Mon/Wed/Fri. All cards in the group share a **X/Y次** progress badge. Overdue unchecked cards show an orange left border and **· 逾期** label.

### Board Assistant (AI Chat Panel)
A sliding chat panel shared between By Focus and By Time, powered by Gemini 2.5 Flash.

- **Paste a todo list** → AI parses tasks, infers project/column/due date → preview → one-click add.
- **Persistent history**: Conversation saved to Supabase across page reloads.
- **Memory**: Every 10 messages, the AI distills key facts about your work style and projects into a persistent memory. Future conversations start with this context — no need to re-explain.
- Toggle with the **✦ AI** button. Panel pushes the board left; all columns remain visible.

### Canvas On-Demand
Task cards don't auto-create canvas sessions. The **↗** arrow on each card is gray until first click (creates canvas), then blue (opens it). The canvas sidebar only shows sessions you've explicitly opened — no clutter.

### Smart Done-Task Filtering
Tasks completed before the current week are automatically hidden from both board views. Tasks completed this week remain visible. Uses a dedicated `checked_at` timestamp for accuracy.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Canvas | React Flow (`@xyflow/react`) |
| AI | Gemini 2.5 Flash (streaming + JSON) |
| Styling | Tailwind CSS 4 |
| Persistence | Supabase (PostgreSQL) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- [Google AI Studio](https://aistudio.google.com) API key
- [Supabase](https://supabase.com) project

### Installation

```bash
git clone https://github.com/emma-devhub/thinkflow-board.git
cd thinkflow-board
npm install
```

### Environment

```env
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

Run in Supabase SQL Editor:

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
  checked_at bigint,
  due_date text,
  estimated_mins integer,
  week_order integer,
  recurring_group_id text,
  weekly_target integer,
  has_canvas boolean default false
);

create table canvas_states (
  session_id text primary key,
  nodes jsonb,
  edges jsonb,
  layout_dir text,
  updated_at bigint
);

create table projects (
  id text primary key,
  title text,
  color text,
  created_at bigint
);

create table directions (
  id text primary key,
  label text,
  color text,
  sort_order integer
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tasks jsonb,
  created_at timestamptz default now()
);

create table user_memory (
  id integer primary key default 1,
  content text not null default '',
  updated_at timestamptz default now()
);
insert into user_memory (id, content) values (1, '') on conflict (id) do nothing;
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## License

MIT
