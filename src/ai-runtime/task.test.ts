/**
 * AI Task 测试
 *
 * 测试任务创建函数和类型定义
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createTask,
  type AITask,
  type AITaskKind,
  type AITaskInput,
  type AITaskStatus,
  type AITaskMetadata,
  type WorkspaceInfo,
  type WorkspaceContextExtra,
} from './task'

describe('createTask', () => {
  describe('basic task creation', () => {
    it('should create a chat task with required fields', () => {
      const task = createTask('chat', { prompt: 'Hello AI' })

      expect(task.id).toBeDefined()
      expect(task.kind).toBe('chat')
      expect(task.input.prompt).toBe('Hello AI')
      expect(task.input.files).toBeUndefined()
      expect(task.input.extra).toBeUndefined()
      expect(task.engineId).toBeUndefined()
    })

    it('should create task with files', () => {
      const task = createTask('analyze', {
        prompt: 'Analyze this',
        files: ['/src/test.ts', '/src/utils.ts'],
      })

      expect(task.kind).toBe('analyze')
      expect(task.input.files).toEqual(['/src/test.ts', '/src/utils.ts'])
    })

    it('should create task with extra params', () => {
      const extra: WorkspaceContextExtra = {
        currentWorkspace: {
          name: 'my-project',
          path: '/workspace/my-project',
          referenceSyntax: '@/workspace/my-project',
        },
        contextWorkspaces: [],
      }

      const task = createTask('refactor', {
        prompt: 'Refactor this',
        extra,
      })

      expect(task.input.extra).toEqual(extra)
    })

    it('should use provided id', () => {
      const task = createTask('chat', { prompt: 'test' }, { id: 'custom-id-123' })

      expect(task.id).toBe('custom-id-123')
    })

    it('should use provided engineId', () => {
      const task = createTask('chat', { prompt: 'test' }, { engineId: 'claude-code' })

      expect(task.engineId).toBe('claude-code')
    })

    it('should generate unique ids', () => {
      const task1 = createTask('chat', { prompt: 'test1' })
      const task2 = createTask('chat', { prompt: 'test2' })

      expect(task1.id).not.toBe(task2.id)
    })

    it('should generate valid UUID format', () => {
      const task = createTask('chat', { prompt: 'test' })
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

      expect(task.id).toMatch(uuidRegex)
    })
  })

  describe('task kinds', () => {
    it('should support chat kind', () => {
      const task = createTask('chat', { prompt: 'Hello' })
      expect(task.kind).toBe('chat')
    })

    it('should support refactor kind', () => {
      const task = createTask('refactor', { prompt: 'Refactor this' })
      expect(task.kind).toBe('refactor')
    })

    it('should support analyze kind', () => {
      const task = createTask('analyze', { prompt: 'Analyze this' })
      expect(task.kind).toBe('analyze')
    })

    it('should support generate kind', () => {
      const task = createTask('generate', { prompt: 'Generate code' })
      expect(task.kind).toBe('generate')
    })
  })

  describe('createTaskOptions', () => {
    it('should use default options when not provided', () => {
      const task = createTask('chat', { prompt: 'test' })

      expect(task.id).toBeDefined()
      expect(task.engineId).toBeUndefined()
    })

    it('should allow empty options object', () => {
      const task = createTask('chat', { prompt: 'test' }, {})

      expect(task.id).toBeDefined()
      expect(task.engineId).toBeUndefined()
    })

    it('should use both id and engineId', () => {
      const task = createTask(
        'chat',
        { prompt: 'test' },
        { id: 'task-1', engineId: 'openai' }
      )

      expect(task.id).toBe('task-1')
      expect(task.engineId).toBe('openai')
    })
  })
})

describe('Type definitions', () => {
  it('AITask should have correct structure', () => {
    const task: AITask = {
      id: 'task-123',
      kind: 'chat',
      input: {
        prompt: 'Hello',
        files: ['/test.ts'],
        extra: { custom: 'value' },
      },
      engineId: 'claude-code',
    }

    expect(task.id).toBe('task-123')
    expect(task.kind).toBe('chat')
    expect(task.input.prompt).toBe('Hello')
    expect(task.input.files).toEqual(['/test.ts'])
    expect(task.input.extra).toEqual({ custom: 'value' })
    expect(task.engineId).toBe('claude-code')
  })

  it('AITaskInput should allow optional fields', () => {
    const input1: AITaskInput = { prompt: 'test' }
    const input2: AITaskInput = { prompt: 'test', files: [] }
    const input3: AITaskInput = { prompt: 'test', extra: {} }
    const input4: AITaskInput = { prompt: 'test', files: [], extra: {} }

    expect(input1.prompt).toBe('test')
    expect(input2.files).toEqual([])
    expect(input3.extra).toEqual({})
    expect(input4.files).toEqual([])
  })

  it('AITaskKind should support all kinds', () => {
    const kinds: AITaskKind[] = ['chat', 'refactor', 'analyze', 'generate']

    kinds.forEach((kind) => {
      const task = createTask(kind, { prompt: 'test' })
      expect(task.kind).toBe(kind)
    })
  })

  it('AITaskStatus should have correct values', () => {
    const statuses: AITaskStatus[] = ['pending', 'running', 'completed', 'failed', 'aborted']

    expect(statuses).toContain('pending')
    expect(statuses).toContain('running')
    expect(statuses).toContain('completed')
    expect(statuses).toContain('failed')
    expect(statuses).toContain('aborted')
  })

  it('AITaskMetadata should have correct structure', () => {
    const metadata: AITaskMetadata = {
      taskId: 'task-123',
      sessionId: 'session-456',
      status: 'completed',
      startTime: 1000,
      endTime: 2000,
      error: undefined,
    }

    expect(metadata.taskId).toBe('task-123')
    expect(metadata.sessionId).toBe('session-456')
    expect(metadata.status).toBe('completed')
    expect(metadata.startTime).toBe(1000)
    expect(metadata.endTime).toBe(2000)
  })

  it('AITaskMetadata with error should be valid', () => {
    const metadata: AITaskMetadata = {
      taskId: 'task-123',
      sessionId: 'session-456',
      status: 'failed',
      error: 'Something went wrong',
    }

    expect(metadata.status).toBe('failed')
    expect(metadata.error).toBe('Something went wrong')
  })
})

describe('WorkspaceInfo and WorkspaceContextExtra', () => {
  it('WorkspaceInfo should have correct structure', () => {
    const workspace: WorkspaceInfo = {
      name: 'my-project',
      path: '/workspace/my-project',
      referenceSyntax: '@/workspace/my-project',
    }

    expect(workspace.name).toBe('my-project')
    expect(workspace.path).toBe('/workspace/my-project')
    expect(workspace.referenceSyntax).toBe('@/workspace/my-project')
  })

  it('WorkspaceContextExtra should have correct structure', () => {
    const context: WorkspaceContextExtra = {
      currentWorkspace: {
        name: 'main',
        path: '/workspace/main',
        referenceSyntax: '@/workspace/main',
      },
      contextWorkspaces: [
        {
          name: 'lib',
          path: '/workspace/lib',
          referenceSyntax: '@/workspace/lib',
        },
      ],
    }

    expect(context.currentWorkspace.name).toBe('main')
    expect(context.contextWorkspaces.length).toBe(1)
    expect(context.contextWorkspaces[0].name).toBe('lib')
  })

  it('should allow empty contextWorkspaces', () => {
    const context: WorkspaceContextExtra = {
      currentWorkspace: {
        name: 'main',
        path: '/workspace/main',
        referenceSyntax: '@/workspace/main',
      },
      contextWorkspaces: [],
    }

    expect(context.contextWorkspaces).toEqual([])
  })

  it('task input can include WorkspaceContextExtra', () => {
    const context: WorkspaceContextExtra = {
      currentWorkspace: {
        name: 'main',
        path: '/workspace/main',
        referenceSyntax: '@/workspace/main',
      },
      contextWorkspaces: [],
    }

    const task = createTask('chat', {
      prompt: 'Hello',
      extra: context,
    })

    expect(task.input.extra).toEqual(context)
  })
})
