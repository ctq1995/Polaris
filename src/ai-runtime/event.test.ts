/**
 * AI Event 测试
 *
 * 测试事件创建函数和类型守卫
 */

import { describe, it, expect } from 'vitest'
import {
  // 事件创建函数
  createTokenEvent,
  createThinkingEvent,
  createToolCallStartEvent,
  createToolCallEndEvent,
  createProgressEvent,
  createErrorEvent,
  createSessionStartEvent,
  createSessionEndEvent,
  createUserMessageEvent,
  createAssistantMessageEvent,
  createTaskMetadataEvent,
  createTaskProgressEvent,
  createTaskCompletedEvent,
  createTaskCanceledEvent,
  createTodoCreatedEvent,
  createTodoUpdatedEvent,
  createTodoDeletedEvent,
  createTodoExecutionStartedEvent,
  createTodoExecutionProgressEvent,
  createTodoExecutionCompletedEvent,
  // 类型守卫
  isTokenEvent,
  isThinkingEvent,
  isToolCallStartEvent,
  isToolCallEndEvent,
  isProgressEvent,
  isErrorEvent,
  isResultEvent,
  isSessionStartEvent,
  isSessionEndEvent,
  isUserMessageEvent,
  isAssistantMessageEvent,
  isTaskMetadataEvent,
  isTaskProgressEvent,
  isTaskCompletedEvent,
  isTaskCanceledEvent,
  isTodoCreatedEvent,
  isTodoUpdatedEvent,
  isTodoDeletedEvent,
  isTodoExecutionStartedEvent,
  isTodoExecutionProgressEvent,
  isTodoExecutionCompletedEvent,
  isAIEvent,
  // 类型
  type AIEvent,
} from './event'

describe('Event Creation Functions', () => {
  describe('TokenEvent', () => {
    it('should create a token event', () => {
      const event = createTokenEvent('Hello')
      expect(event).toEqual({ type: 'token', value: 'Hello' })
    })

    it('should create empty token event', () => {
      const event = createTokenEvent('')
      expect(event).toEqual({ type: 'token', value: '' })
    })
  })

  describe('ThinkingEvent', () => {
    it('should create a thinking event', () => {
      const event = createThinkingEvent('Thinking about...')
      expect(event).toEqual({ type: 'thinking', content: 'Thinking about...' })
    })
  })

  describe('ToolCallStartEvent', () => {
    it('should create tool call start event with args', () => {
      const event = createToolCallStartEvent('read_file', { path: '/test.ts' })
      expect(event).toEqual({
        type: 'tool_call_start',
        tool: 'read_file',
        args: { path: '/test.ts' },
      })
    })

    it('should create tool call start event with callId', () => {
      const event = createToolCallStartEvent('write_file', { path: '/test.ts' })
      expect(event.type).toBe('tool_call_start')
      expect(event.tool).toBe('write_file')
      expect(event.args).toEqual({ path: '/test.ts' })
    })

    it('should create tool call start event with empty args', () => {
      const event = createToolCallStartEvent('list_files', {})
      expect(event).toEqual({
        type: 'tool_call_start',
        tool: 'list_files',
        args: {},
      })
    })
  })

  describe('ToolCallEndEvent', () => {
    it('should create tool call end event with result', () => {
      const event = createToolCallEndEvent('read_file', { content: 'test' })
      expect(event).toEqual({
        type: 'tool_call_end',
        tool: 'read_file',
        result: { content: 'test' },
        success: true,
      })
    })

    it('should create tool call end event with failure', () => {
      const event = createToolCallEndEvent('read_file', undefined, false)
      expect(event).toEqual({
        type: 'tool_call_end',
        tool: 'read_file',
        result: undefined,
        success: false,
      })
    })

    it('should default success to true', () => {
      const event = createToolCallEndEvent('test_tool')
      expect(event.success).toBe(true)
    })
  })

  describe('ProgressEvent', () => {
    it('should create progress event with all fields', () => {
      const event = createProgressEvent('Processing...', 50)
      expect(event).toEqual({
        type: 'progress',
        message: 'Processing...',
        percent: 50,
      })
    })

    it('should create progress event with only message', () => {
      const event = createProgressEvent('Starting...')
      expect(event).toEqual({
        type: 'progress',
        message: 'Starting...',
        percent: undefined,
      })
    })

    it('should create progress event with only percent', () => {
      const event = createProgressEvent(undefined, 75)
      expect(event).toEqual({
        type: 'progress',
        message: undefined,
        percent: 75,
      })
    })

    it('should create progress event with no fields', () => {
      const event = createProgressEvent()
      expect(event).toEqual({
        type: 'progress',
        message: undefined,
        percent: undefined,
      })
    })
  })

  describe('ErrorEvent', () => {
    it('should create error event with message only', () => {
      const event = createErrorEvent('Something went wrong')
      expect(event).toEqual({
        type: 'error',
        error: 'Something went wrong',
        code: undefined,
      })
    })

    it('should create error event with code', () => {
      const event = createErrorEvent('Not found', 'ENOENT')
      expect(event).toEqual({
        type: 'error',
        error: 'Not found',
        code: 'ENOENT',
      })
    })
  })

  describe('SessionStartEvent', () => {
    it('should create session start event', () => {
      const event = createSessionStartEvent('session-123')
      expect(event).toEqual({
        type: 'session_start',
        sessionId: 'session-123',
      })
    })
  })

  describe('SessionEndEvent', () => {
    it('should create session end event without reason', () => {
      const event = createSessionEndEvent('session-123')
      expect(event).toEqual({
        type: 'session_end',
        sessionId: 'session-123',
        reason: undefined,
      })
    })

    it('should create session end event with reason', () => {
      const event = createSessionEndEvent('session-123', 'completed')
      expect(event).toEqual({
        type: 'session_end',
        sessionId: 'session-123',
        reason: 'completed',
      })
    })

    it('should create session end event with aborted reason', () => {
      const event = createSessionEndEvent('session-123', 'aborted')
      expect(event.reason).toBe('aborted')
    })

    it('should create session end event with error reason', () => {
      const event = createSessionEndEvent('session-123', 'error')
      expect(event.reason).toBe('error')
    })
  })

  describe('UserMessageEvent', () => {
    it('should create user message event without files', () => {
      const event = createUserMessageEvent('Hello AI')
      expect(event).toEqual({
        type: 'user_message',
        content: 'Hello AI',
        files: undefined,
      })
    })

    it('should create user message event with files', () => {
      const event = createUserMessageEvent('Check this file', ['/src/test.ts'])
      expect(event).toEqual({
        type: 'user_message',
        content: 'Check this file',
        files: ['/src/test.ts'],
      })
    })

    it('should create user message event with multiple files', () => {
      const event = createUserMessageEvent('Check these', ['/src/a.ts', '/src/b.ts'])
      expect(event.files).toEqual(['/src/a.ts', '/src/b.ts'])
    })
  })

  describe('AssistantMessageEvent', () => {
    it('should create assistant message event with default values', () => {
      const event = createAssistantMessageEvent('Hello user')
      expect(event).toEqual({
        type: 'assistant_message',
        content: 'Hello user',
        isDelta: false,
        toolCalls: undefined,
      })
    })

    it('should create assistant message event with isDelta true', () => {
      const event = createAssistantMessageEvent('Hello', true)
      expect(event.isDelta).toBe(true)
    })

    it('should create assistant message event with toolCalls', () => {
      const toolCalls = [
        { id: 'call-1', name: 'read_file', args: {}, status: 'pending' as const },
      ]
      const event = createAssistantMessageEvent('Processing', false, toolCalls)
      expect(event.toolCalls).toEqual(toolCalls)
    })
  })
})

describe('Task Event Creation Functions', () => {
  describe('createTaskMetadataEvent', () => {
    it('should create task metadata event with required fields', () => {
      const event = createTaskMetadataEvent('task-123', 'running')
      expect(event).toEqual({
        type: 'task_metadata',
        taskId: 'task-123',
        status: 'running',
      })
    })

    it('should create task metadata event with all fields', () => {
      const event = createTaskMetadataEvent('task-123', 'success', {
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
      })
      expect(event).toEqual({
        type: 'task_metadata',
        taskId: 'task-123',
        status: 'success',
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
      })
    })

    it('should create task metadata event with error', () => {
      const event = createTaskMetadataEvent('task-123', 'error', {
        error: 'Task failed',
      })
      expect(event.status).toBe('error')
      expect(event.error).toBe('Task failed')
    })

    it('should support all task statuses', () => {
      const statuses: Array<'pending' | 'running' | 'success' | 'error' | 'canceled'> = [
        'pending',
        'running',
        'success',
        'error',
        'canceled',
      ]
      statuses.forEach((status) => {
        const event = createTaskMetadataEvent('task-123', status)
        expect(event.status).toBe(status)
      })
    })
  })

  describe('createTaskProgressEvent', () => {
    it('should create task progress event with all fields', () => {
      const event = createTaskProgressEvent('task-123', 'Processing...', 50)
      expect(event).toEqual({
        type: 'task_progress',
        taskId: 'task-123',
        message: 'Processing...',
        percent: 50,
      })
    })

    it('should create task progress event without optional fields', () => {
      const event = createTaskProgressEvent('task-123')
      expect(event).toEqual({
        type: 'task_progress',
        taskId: 'task-123',
        message: undefined,
        percent: undefined,
      })
    })
  })

  describe('createTaskCompletedEvent', () => {
    it('should create task completed event with success', () => {
      const event = createTaskCompletedEvent('task-123', 'success', 1000)
      expect(event).toEqual({
        type: 'task_completed',
        taskId: 'task-123',
        status: 'success',
        duration: 1000,
        error: undefined,
      })
    })

    it('should create task completed event with failure', () => {
      const event = createTaskCompletedEvent('task-123', 'error', 500, 'Failed')
      expect(event).toEqual({
        type: 'task_completed',
        taskId: 'task-123',
        status: 'error',
        duration: 500,
        error: 'Failed',
      })
    })

    it('should create task completed event with canceled status', () => {
      const event = createTaskCompletedEvent('task-123', 'canceled')
      expect(event.status).toBe('canceled')
    })
  })

  describe('createTaskCanceledEvent', () => {
    it('should create task canceled event without reason', () => {
      const event = createTaskCanceledEvent('task-123')
      expect(event).toEqual({
        type: 'task_canceled',
        taskId: 'task-123',
        reason: undefined,
      })
    })

    it('should create task canceled event with reason', () => {
      const event = createTaskCanceledEvent('task-123', 'User cancelled')
      expect(event).toEqual({
        type: 'task_canceled',
        taskId: 'task-123',
        reason: 'User cancelled',
      })
    })
  })
})

describe('Todo Event Creation Functions', () => {
  describe('createTodoCreatedEvent', () => {
    it('should create todo created event with user source', () => {
      const event = createTodoCreatedEvent('todo-123', 'Write tests', 'high')
      expect(event).toEqual({
        type: 'todo_created',
        todoId: 'todo-123',
        content: 'Write tests',
        priority: 'high',
        source: 'user',
      })
    })

    it('should create todo created event with ai source', () => {
      const event = createTodoCreatedEvent('todo-123', 'Fix bug', 'medium', 'ai')
      expect(event.source).toBe('ai')
    })
  })

  describe('createTodoUpdatedEvent', () => {
    it('should create todo updated event with status change', () => {
      const event = createTodoUpdatedEvent('todo-123', { status: 'completed' })
      expect(event).toEqual({
        type: 'todo_updated',
        todoId: 'todo-123',
        changes: { status: 'completed' },
      })
    })

    it('should create todo updated event with multiple changes', () => {
      const event = createTodoUpdatedEvent('todo-123', {
        status: 'in_progress',
        content: 'Updated content',
        priority: 'high',
      })
      expect(event.changes).toEqual({
        status: 'in_progress',
        content: 'Updated content',
        priority: 'high',
      })
    })
  })

  describe('createTodoDeletedEvent', () => {
    it('should create todo deleted event', () => {
      const event = createTodoDeletedEvent('todo-123')
      expect(event).toEqual({
        type: 'todo_deleted',
        todoId: 'todo-123',
      })
    })
  })

  describe('createTodoExecutionStartedEvent', () => {
    it('should create todo execution started event', () => {
      const event = createTodoExecutionStartedEvent('todo-123', 'session-456')
      expect(event).toEqual({
        type: 'todo_execution_started',
        todoId: 'todo-123',
        sessionId: 'session-456',
      })
    })
  })

  describe('createTodoExecutionProgressEvent', () => {
    it('should create todo execution progress event with percent', () => {
      const event = createTodoExecutionProgressEvent('todo-123', 'Working...', 50)
      expect(event).toEqual({
        type: 'todo_execution_progress',
        todoId: 'todo-123',
        message: 'Working...',
        percent: 50,
      })
    })

    it('should create todo execution progress event without percent', () => {
      const event = createTodoExecutionProgressEvent('todo-123', 'Starting...')
      expect(event.percent).toBeUndefined()
    })
  })

  describe('createTodoExecutionCompletedEvent', () => {
    it('should create todo execution completed event with success', () => {
      const event = createTodoExecutionCompletedEvent('todo-123', 'success')
      expect(event).toEqual({
        type: 'todo_execution_completed',
        todoId: 'todo-123',
        status: 'success',
        error: undefined,
      })
    })

    it('should create todo execution completed event with failure', () => {
      const event = createTodoExecutionCompletedEvent('todo-123', 'failed', 'Task failed')
      expect(event).toEqual({
        type: 'todo_execution_completed',
        todoId: 'todo-123',
        status: 'failed',
        error: 'Task failed',
      })
    })

    it('should create todo execution completed event with aborted status', () => {
      const event = createTodoExecutionCompletedEvent('todo-123', 'aborted')
      expect(event.status).toBe('aborted')
    })
  })
})

describe('Type Guards', () => {
  describe('Basic event type guards', () => {
    it('isTokenEvent should return true for token events', () => {
      const event = createTokenEvent('test')
      expect(isTokenEvent(event)).toBe(true)
      expect(isTokenEvent(createErrorEvent('test'))).toBe(false)
    })

    it('isThinkingEvent should return true for thinking events', () => {
      const event = createThinkingEvent('thinking...')
      expect(isThinkingEvent(event)).toBe(true)
      expect(isThinkingEvent(createTokenEvent('test'))).toBe(false)
    })

    it('isToolCallStartEvent should return true for tool call start events', () => {
      const event = createToolCallStartEvent('test', {})
      expect(isToolCallStartEvent(event)).toBe(true)
      expect(isToolCallStartEvent(createToolCallEndEvent('test'))).toBe(false)
    })

    it('isToolCallEndEvent should return true for tool call end events', () => {
      const event = createToolCallEndEvent('test')
      expect(isToolCallEndEvent(event)).toBe(true)
      expect(isToolCallEndEvent(createToolCallStartEvent('test', {}))).toBe(false)
    })

    it('isProgressEvent should return true for progress events', () => {
      const event = createProgressEvent('test')
      expect(isProgressEvent(event)).toBe(true)
      expect(isProgressEvent(createTokenEvent('test'))).toBe(false)
    })

    it('isErrorEvent should return true for error events', () => {
      const event = createErrorEvent('test')
      expect(isErrorEvent(event)).toBe(true)
      expect(isErrorEvent(createProgressEvent('test'))).toBe(false)
    })

    it('isResultEvent should return true for result events', () => {
      const event: AIEvent = { type: 'result', output: 'test' }
      expect(isResultEvent(event)).toBe(true)
      expect(isResultEvent(createErrorEvent('test'))).toBe(false)
    })

    it('isSessionStartEvent should return true for session start events', () => {
      const event = createSessionStartEvent('session-123')
      expect(isSessionStartEvent(event)).toBe(true)
      expect(isSessionStartEvent(createSessionEndEvent('session-123'))).toBe(false)
    })

    it('isSessionEndEvent should return true for session end events', () => {
      const event = createSessionEndEvent('session-123')
      expect(isSessionEndEvent(event)).toBe(true)
      expect(isSessionEndEvent(createSessionStartEvent('session-123'))).toBe(false)
    })

    it('isUserMessageEvent should return true for user message events', () => {
      const event = createUserMessageEvent('Hello')
      expect(isUserMessageEvent(event)).toBe(true)
      expect(isUserMessageEvent(createAssistantMessageEvent('Hello'))).toBe(false)
    })

    it('isAssistantMessageEvent should return true for assistant message events', () => {
      const event = createAssistantMessageEvent('Hello')
      expect(isAssistantMessageEvent(event)).toBe(true)
      expect(isAssistantMessageEvent(createUserMessageEvent('Hello'))).toBe(false)
    })
  })

  describe('Task event type guards', () => {
    it('isTaskMetadataEvent should return true for task metadata events', () => {
      const event = createTaskMetadataEvent('task-123', 'running')
      expect(isTaskMetadataEvent(event)).toBe(true)
      expect(isTaskMetadataEvent(createTaskProgressEvent('task-123'))).toBe(false)
    })

    it('isTaskProgressEvent should return true for task progress events', () => {
      const event = createTaskProgressEvent('task-123')
      expect(isTaskProgressEvent(event)).toBe(true)
      expect(isTaskProgressEvent(createTaskMetadataEvent('task-123', 'running'))).toBe(false)
    })

    it('isTaskCompletedEvent should return true for task completed events', () => {
      const event = createTaskCompletedEvent('task-123', 'success')
      expect(isTaskCompletedEvent(event)).toBe(true)
      expect(isTaskCompletedEvent(createTaskCanceledEvent('task-123'))).toBe(false)
    })

    it('isTaskCanceledEvent should return true for task canceled events', () => {
      const event = createTaskCanceledEvent('task-123')
      expect(isTaskCanceledEvent(event)).toBe(true)
      expect(isTaskCanceledEvent(createTaskCompletedEvent('task-123', 'success'))).toBe(false)
    })
  })

  describe('Todo event type guards', () => {
    it('isTodoCreatedEvent should return true for todo created events', () => {
      const event = createTodoCreatedEvent('todo-123', 'Test', 'high')
      expect(isTodoCreatedEvent(event)).toBe(true)
      expect(isTodoCreatedEvent(createTodoUpdatedEvent('todo-123', {}))).toBe(false)
    })

    it('isTodoUpdatedEvent should return true for todo updated events', () => {
      const event = createTodoUpdatedEvent('todo-123', { status: 'done' })
      expect(isTodoUpdatedEvent(event)).toBe(true)
      expect(isTodoUpdatedEvent(createTodoCreatedEvent('todo-123', 'Test', 'high'))).toBe(false)
    })

    it('isTodoDeletedEvent should return true for todo deleted events', () => {
      const event = createTodoDeletedEvent('todo-123')
      expect(isTodoDeletedEvent(event)).toBe(true)
      expect(isTodoDeletedEvent(createTodoCreatedEvent('todo-123', 'Test', 'high'))).toBe(false)
    })

    it('isTodoExecutionStartedEvent should return true for todo execution started events', () => {
      const event = createTodoExecutionStartedEvent('todo-123', 'session-456')
      expect(isTodoExecutionStartedEvent(event)).toBe(true)
      expect(isTodoExecutionStartedEvent(createTodoCreatedEvent('todo-123', 'Test', 'high'))).toBe(
        false
      )
    })

    it('isTodoExecutionProgressEvent should return true for todo execution progress events', () => {
      const event = createTodoExecutionProgressEvent('todo-123', 'Working...')
      expect(isTodoExecutionProgressEvent(event)).toBe(true)
      expect(
        isTodoExecutionProgressEvent(createTodoExecutionStartedEvent('todo-123', 'session-456'))
      ).toBe(false)
    })

    it('isTodoExecutionCompletedEvent should return true for todo execution completed events', () => {
      const event = createTodoExecutionCompletedEvent('todo-123', 'success')
      expect(isTodoExecutionCompletedEvent(event)).toBe(true)
      expect(
        isTodoExecutionCompletedEvent(createTodoExecutionStartedEvent('todo-123', 'session-456'))
      ).toBe(false)
    })
  })
})

describe('isAIEvent', () => {
  it('should return true for valid AI events', () => {
    const validEvents: AIEvent[] = [
      createTokenEvent('test'),
      createThinkingEvent('thinking...'),
      createToolCallStartEvent('test', {}),
      createToolCallEndEvent('test'),
      createProgressEvent('test'),
      createErrorEvent('test'),
      { type: 'result', output: 'test' },
      createSessionStartEvent('session-123'),
      createSessionEndEvent('session-123'),
      createUserMessageEvent('Hello'),
      createAssistantMessageEvent('Hello'),
      createTaskMetadataEvent('task-123', 'running'),
      createTaskProgressEvent('task-123'),
      createTaskCompletedEvent('task-123', 'success'),
      createTaskCanceledEvent('task-123'),
      createTodoCreatedEvent('todo-123', 'Test', 'high'),
      createTodoUpdatedEvent('todo-123', {}),
      createTodoDeletedEvent('todo-123'),
      createTodoExecutionStartedEvent('todo-123', 'session-456'),
      createTodoExecutionProgressEvent('todo-123', 'Working...'),
      createTodoExecutionCompletedEvent('todo-123', 'success'),
    ]

    validEvents.forEach((event) => {
      expect(isAIEvent(event)).toBe(true)
    })
  })

  it('should return false for non-AI events', () => {
    const invalidInputs = [
      null,
      undefined,
      'string',
      123,
      [],
      {},
      { type: 'unknown_type' },
      { type: 123 },
      { foo: 'bar' },
    ]

    invalidInputs.forEach((input) => {
      expect(isAIEvent(input)).toBe(false)
    })
  })

  it('should return false for objects without type', () => {
    expect(isAIEvent({})).toBe(false)
    expect(isAIEvent({ value: 'test' })).toBe(false)
  })

  it('should return false for invalid type strings', () => {
    expect(isAIEvent({ type: 'invalid_type' })).toBe(false)
    expect(isAIEvent({ type: '' })).toBe(false)
  })
})
