# ThinkFlow

**A visual AI research tool that turns conversations into explorable mind maps.**

ThinkFlow lets you start with any research topic, receive an AI-generated response as a draggable card, then branch from any card to explore sub-topics — building an infinite, visual conversation tree powered by Google Gemini.

---

## Features

### Visual Research Tree
Start a topic and watch your research grow into a branching graph. Each card lives on an infinite canvas — drag, zoom, and rearrange freely.

### Multi-Session Sidebar
Manage multiple independent research sessions. Each session persists in your browser with its own canvas state, so you can pick up exactly where you left off.

### AI Response Cards
Every question spawns a new card, streamed token-by-token from Gemini 2.5 Flash. Branch from any card to explore sub-topics with full conversation context preserved along each branch path.

### Adaptive Format — Tree or Chain
The AI decides the response format based on content. Multi-dimensional topics automatically expand into a **branching mind map**. Focused or follow-up questions stay as a **single connected card**, forming a linear chain. Both patterns coexist naturally on the same canvas.

### Board Assistant (AI Chat Panel)
A sliding chat panel on the Kanban board powered by Gemini 2.5 Flash. Paste a todo list and the AI parses tasks, infers project/column/dueDate, shows a preview, and creates cards in one click. Also supports general Q&A about your tasks. Toggle with the **✦ AI** button — the panel pushes the board left, all columns remain visible.

### My Note Cards
Drop freeform sticky notes anywhere on the canvas. Notes support Markdown rendering and can also be used as branch points to query the AI in context.

### Flexible Layout
Toggle between **Left→Right** and **Top→Bottom** tree layouts to match your thinking style.

### Deletable Edges
Hover any connection line to reveal a delete button — restructure your graph without losing nodes.

### Cascade Delete
Remove a node and all its descendants in one action, or delete a single card while keeping the rest of the tree.

### Expand to Full Screen
Click "⤢ expand" on any card to read the full response in a distraction-free overlay.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Canvas | React Flow (`@xyflow/react`) |
| AI (canvas) | Gemini 2.5 Flash (streaming) |
| AI (board) | Gemini 2.5 Flash (streaming, Board Assistant) |
| Styling | Tailwind CSS |
| Fonts | Lora (serif) + JetBrains Mono |
| Persistence | Browser localStorage |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Groq](https://console.groq.com) API key (free, no credit card required)

### Installation

```bash
git clone https://github.com/emma-devhub/thinkflow.git
cd thinkflow
npm install
```

### Environment Setup

Create a `.env.local` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

1. **Start a session** — Type your research topic into the center prompt and press Enter
2. **Branch out** — Type a follow-up in any card's "Continue researching…" box to create a child node
3. **Build a mind map** — Ask for a structured breakdown using headers; click the mindmap button on the response card to auto-layout
4. **Take notes** — Click **+ My Note** to drop a sticky note anywhere on the canvas
5. **Manage sessions** — Use the left sidebar to switch between research sessions or start a new one

---

## Architecture

```
thinkflow/
├── app/
│   ├── page.tsx              # Root layout — sidebar + canvas
│   └── api/chat/route.ts     # Streaming Gemini API endpoint
├── components/
│   ├── ThinkCanvas.tsx       # React Flow canvas, node/edge state, branch logic
│   ├── ResearchNode.tsx      # Card UI — AI content, note editing, branch input
│   ├── DeletableEdge.tsx     # Custom edge with hover-to-delete
│   ├── ExpandModal.tsx       # Full-screen content overlay
│   └── Sidebar.tsx           # Session management panel
├── lib/
│   ├── gemini.ts             # Gemini streaming client
│   └── sessions.ts           # localStorage session helpers
└── types/index.ts            # Shared TypeScript interfaces
```

---

## Design Decisions

**Conversation context per branch** — When you branch from a node, the full path from root to that node is sent as conversation history. This means each branch maintains its own coherent context, so Gemini always understands how the current question relates to the broader research.

**Streaming into nodes** — Responses stream token-by-token directly into the node's content field via React state, so you see the answer appear in real time without blocking the canvas.

**Ref-based submit guard** — The "Continue researching" submit uses a `useRef` guard (not `useState`) to prevent duplicate API calls from rapid Enter+click, since React's state batching can't provide synchronous guarantees.

**Two-level mindmap layout** — The auto-layout algorithm counts leaf slots across all sections to evenly distribute vertical/horizontal space, positioning parent L1 nodes at the centroid of their children.

---

## License

MIT
