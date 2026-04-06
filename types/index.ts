export interface Project {
  id: string
  title: string
  color: string
  createdAt: number
}

export type TaskStatus = 'todo' | 'inprogress' | 'done'

export interface SessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  projectId?: string
  status: TaskStatus
  columnId?: string
  checked?: boolean
  checkedAt?: number    // ms timestamp when last checked (for filtering old done tasks)
  dueDate?: string      // 'YYYY-MM-DD'
  estimatedMins?: number
  weekOrder?: number    // sort key within a day column (lower = higher up)
  recurringGroupId?: string  // shared ID across all instances of a recurring task
  weeklyTarget?: number      // total times per week (e.g. 3 for "gym 3x/week")
  hasCanvas?: boolean   // true once user has opened/created canvas for this card
}

export interface ConversationMessage {
  role: 'user' | 'model'
  content: string
}

export interface ParsedTask {
  title: string
  projectId: string | null
  columnId: string | null
  dueDate: string | null      // 'YYYY-MM-DD' (used only when weeklyTarget is absent)
  weeklyTarget?: number       // if set, this is a recurring task
  plannedDays?: string[]      // 'YYYY-MM-DD' list, one per instance (length = weeklyTarget)
}

export interface Direction {
  id: string
  label: string
  color: string
}

export interface NodeData extends Record<string, unknown> {
  nodeType: 'seed' | 'response' | 'note'
  content: string
  prompt: string
  isLoading: boolean
  context: ConversationMessage[]
  onContinue: (text: string, context: ConversationMessage[]) => void
  onExpand: (content: string, prompt: string) => void
  onDelete: () => void
  onDeleteCascade: () => void
  onUpdateNote: (content: string) => void
}
