import type {
  TodoCreateParams,
  TodoItem,
  TodoPriority,
  TodoStatus,
  TodoSubtask,
  TodoUpdateParams,
} from '../types/todo.js'

export interface TodoFileData {
  version: '1.0.0'
  updatedAt: string
  todos: TodoItem[]
}

const TODO_FILE = '.polaris/todos.json'
const TODO_FILE_VERSION = '1.0.0' as const
const TODO_PRIORITIES: TodoPriority[] = ['low', 'normal', 'high', 'urgent']
const TODO_STATUSES: TodoStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value] : undefined
}

function asPriority(value: unknown, fallback: TodoPriority = 'normal'): TodoPriority {
  return typeof value === 'string' && TODO_PRIORITIES.includes(value as TodoPriority)
    ? (value as TodoPriority)
    : fallback
}

function asStatus(value: unknown, fallback: TodoStatus = 'pending'): TodoStatus {
  return typeof value === 'string' && TODO_STATUSES.includes(value as TodoStatus)
    ? (value as TodoStatus)
    : fallback
}

function normalizeSubtasks(value: unknown): TodoSubtask[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const subtasks: TodoSubtask[] = []

  for (const item of value) {
    if (!isObject(item)) {
      continue
    }

    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!title) {
      continue
    }

    subtasks.push({
      id: typeof item.id === 'string' && item.id.trim() !== '' ? item.id : crypto.randomUUID(),
      title,
      completed: Boolean(item.completed),
      createdAt: asOptionalString(item.createdAt),
    })
  }

  return subtasks.length > 0 ? subtasks : undefined
}

function normalizeTodo(raw: unknown): TodoItem | null {
  if (!isObject(raw)) {
    return null
  }

  const id = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id : crypto.randomUUID()
  const content = typeof raw.content === 'string' ? raw.content.trim() : ''
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt

  if (!content) {
    return null
  }

  return {
    id,
    content,
    description: asOptionalString(raw.description),
    status: asStatus(raw.status),
    priority: asPriority(raw.priority),
    tags: asOptionalStringArray(raw.tags),
    relatedFiles: asOptionalStringArray(raw.relatedFiles),
    sessionId: asOptionalString(raw.sessionId),
    workspaceId:
      raw.workspaceId === null || typeof raw.workspaceId === 'string'
        ? (raw.workspaceId as string | null)
        : undefined,
    subtasks: normalizeSubtasks(raw.subtasks),
    dueDate: asOptionalString(raw.dueDate),
    reminderTime: asOptionalString(raw.reminderTime),
    estimatedHours: asOptionalNumber(raw.estimatedHours),
    spentHours: asOptionalNumber(raw.spentHours),
    dependsOn: asOptionalStringArray(raw.dependsOn),
    blockers: asOptionalStringArray(raw.blockers),
    milestoneId: asOptionalString(raw.milestoneId),
    complexity:
      raw.complexity === 'simple' || raw.complexity === 'medium' || raw.complexity === 'complex'
        ? raw.complexity
        : undefined,
    attachments: asOptionalStringArray(raw.attachments),
    completedAt: asOptionalString(raw.completedAt),
    lastProgress: asOptionalString(raw.lastProgress),
    lastError: asOptionalString(raw.lastError),
    createdAt,
    updatedAt,
  }
}

function createEmptyTodoFileData(): TodoFileData {
  return {
    version: TODO_FILE_VERSION,
    updatedAt: new Date().toISOString(),
    todos: [],
  }
}

function stringifyTodoFileData(data: TodoFileData): string {
  return `${JSON.stringify(data, null, 2)}\n`
}

export interface TodoRepositoryFileAccess {
  pathExists(path: string): Promise<boolean>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
}

export class WorkspaceTodoRepository {
  private readonly workspacePath: string
  private readonly filePath: string
  private readonly fileAccess: TodoRepositoryFileAccess

  constructor(workspacePath: string, fileAccess: TodoRepositoryFileAccess) {
    const normalizedWorkspacePath = workspacePath.trim()
    if (!normalizedWorkspacePath) {
      throw new Error('workspacePath 不能为空')
    }

    this.workspacePath = normalizedWorkspacePath
    this.filePath = `${normalizedWorkspacePath}/${TODO_FILE}`
    this.fileAccess = fileAccess
  }

  getWorkspacePath(): string {
    return this.workspacePath
  }

  getFilePath(): string {
    return this.filePath
  }

  async listTodos(): Promise<TodoItem[]> {
    const data = await this.readData()
    return data.todos
  }

  async getTodo(id: string): Promise<TodoItem | null> {
    const todoId = id.trim()
    if (!todoId) {
      throw new Error('id 不能为空')
    }

    const todos = await this.listTodos()
    return todos.find(todo => todo.id === todoId) ?? null
  }

  async createTodo(params: TodoCreateParams): Promise<TodoItem> {
    const content = params.content.trim()
    if (!content) {
      throw new Error('content 不能为空')
    }

    const now = new Date().toISOString()
    const todo: TodoItem = {
      id: crypto.randomUUID(),
      content,
      description: params.description?.trim() || undefined,
      status: 'pending',
      priority: params.priority ?? 'normal',
      tags: params.tags?.filter(Boolean),
      relatedFiles: params.relatedFiles?.filter(Boolean),
      dueDate: params.dueDate,
      estimatedHours: params.estimatedHours,
      workspaceId: params.workspaceId,
      sessionId: params.sessionId,
      gitContext: params.gitContext ? { ...params.gitContext } : undefined,
      subtasks: params.subtasks
        ?.map(subtask => ({
          id: crypto.randomUUID(),
          title: subtask.title.trim(),
          completed: false,
          createdAt: now,
        }))
        .filter(subtask => subtask.title !== ''),
      createdAt: now,
      updatedAt: now,
    }

    const data = await this.readData()
    data.todos.push(todo)
    await this.writeData(data)

    return todo
  }

  async updateTodo(id: string, updates: TodoUpdateParams): Promise<TodoItem> {
    const todoId = id.trim()
    if (!todoId) {
      throw new Error('id 不能为空')
    }

    const data = await this.readData()
    const index = data.todos.findIndex(todo => todo.id === todoId)

    if (index === -1) {
      throw new Error(`待办不存在: ${todoId}`)
    }

    const current = data.todos[index]
    const nextStatus = updates.status ?? current.status
    const nextContent = updates.content !== undefined
      ? (updates.content.trim() || current.content)
      : current.content

    const updatedTodo: TodoItem = {
      ...current,
      ...updates,
      content: nextContent,
      description: updates.description !== undefined ? (updates.description.trim() || undefined) : current.description,
      tags: updates.tags ?? current.tags,
      relatedFiles: updates.relatedFiles ?? current.relatedFiles,
      dependsOn: updates.dependsOn ?? current.dependsOn,
      subtasks: updates.subtasks ?? current.subtasks,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    }

    if (nextStatus === 'completed' && current.status !== 'completed') {
      updatedTodo.completedAt = new Date().toISOString()
    }

    if (nextStatus !== 'completed') {
      delete updatedTodo.completedAt
    }

    data.todos[index] = updatedTodo
    await this.writeData(data)

    return updatedTodo
  }

  async deleteTodo(id: string): Promise<TodoItem> {
    const todoId = id.trim()
    if (!todoId) {
      throw new Error('id 不能为空')
    }

    const data = await this.readData()
    const index = data.todos.findIndex(todo => todo.id === todoId)

    if (index === -1) {
      throw new Error(`待办不存在: ${todoId}`)
    }

    const [deletedTodo] = data.todos.splice(index, 1)
    await this.writeData(data)

    return deletedTodo
  }

  async readData(): Promise<TodoFileData> {
    const exists = await this.fileAccess.pathExists(this.filePath)

    if (!exists) {
      const emptyData = createEmptyTodoFileData()
      await this.fileAccess.writeFile(this.filePath, stringifyTodoFileData(emptyData))
      return emptyData
    }

    const content = await this.fileAccess.readFile(this.filePath)
    const parsed = JSON.parse(content) as unknown

    if (!isObject(parsed)) {
      return createEmptyTodoFileData()
    }

    const todos = Array.isArray(parsed.todos)
      ? parsed.todos.map(normalizeTodo).filter((todo): todo is TodoItem => todo !== null)
      : []

    return {
      version: TODO_FILE_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      todos,
    }
  }

  async writeData(data: TodoFileData): Promise<void> {
    const normalized: TodoFileData = {
      version: TODO_FILE_VERSION,
      updatedAt: new Date().toISOString(),
      todos: data.todos,
    }

    await this.fileAccess.writeFile(this.filePath, stringifyTodoFileData(normalized))
  }
}
