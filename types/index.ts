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
  startTime?: string    // 'HH:MM' — scheduled start time for time-range slots
  estimatedMins?: number
  weekOrder?: number    // sort key within a day column (lower = higher up)
  recurringGroupId?: string  // shared ID across all instances of a recurring task
  weeklyTarget?: number      // total times per week (e.g. 3 for "gym 3x/week")
  hasCanvas?: boolean   // true once user has opened/created canvas for this card
  deletedAt?: number    // ms timestamp of soft-delete; undefined = not deleted
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

// AI-driven task update — only fields present should be applied
export interface ParsedTaskUpdate {
  id: string
  title?: string
  projectId?: string | null
  columnId?: string | null
  dueDate?: string | null       // 'YYYY-MM-DD'
  startTime?: string | null     // 'HH:MM'
  estimatedMins?: number | null
}

// AI-driven project creation
export interface ParsedProjectCreate {
  title: string
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
