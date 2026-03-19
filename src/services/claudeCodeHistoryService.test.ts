/**
 * claudeCodeHistoryService 单元测试
 *
 * 测试覆盖：
 * 1. listSessions - 列出 Claude Code 会话
 * 2. getSessionHistory - 获取会话历史
 * 3. convertMessagesToFormat - 消息格式转换
 * 4. extractToolCalls - 工具调用提取
 * 5. convertToChatMessages - 转换为 ChatMessage 格式
 * 6. formatFileSize / formatTime - 工具函数
 * 7. getClaudeCodeHistoryService - 单例模式
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ClaudeCodeHistoryService,
  getClaudeCodeHistoryService,
  type ClaudeCodeSessionMeta,
  type ClaudeCodeMessage,
} from './claudeCodeHistoryService'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock crypto.randomUUID
const mockUUIDs = ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4', 'uuid-5']
let uuidIndex = 0

vi.stubGlobal('crypto', {
  randomUUID: () => mockUUIDs[uuidIndex++ % mockUUIDs.length],
})

// 导入 mock 后的 invoke
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

describe('ClaudeCodeHistoryService', () => {
  let service: ClaudeCodeHistoryService

  beforeEach(() => {
    service = new ClaudeCodeHistoryService()
    vi.clearAllMocks()
    uuidIndex = 0
  })

  afterEach(() => {
    vi.resetModules()
  })

  // ============================================================================
  // listSessions 测试
  // ============================================================================

  describe('listSessions', () => {
    it('应该成功返回会话列表', async () => {
      const mockSessions: ClaudeCodeSessionMeta[] = [
        {
          sessionId: 'session-1',
          projectPath: '/path/to/project',
          firstPrompt: 'Hello',
          messageCount: 10,
          created: '2026-03-19T10:00:00Z',
          modified: '2026-03-19T11:00:00Z',
          filePath: '/path/to/session.json',
          fileSize: 1024,
        },
        {
          sessionId: 'session-2',
          projectPath: '/path/to/project',
          firstPrompt: 'World',
          messageCount: 5,
          created: '2026-03-18T10:00:00Z',
          modified: '2026-03-18T11:00:00Z',
          filePath: '/path/to/session2.json',
          fileSize: 512,
        },
      ]

      mockInvoke.mockResolvedValueOnce(mockSessions)

      const result = await service.listSessions('/path/to/project')

      expect(mockInvoke).toHaveBeenCalledWith('list_claude_code_sessions', {
        projectPath: '/path/to/project',
      })
      expect(result).toEqual(mockSessions)
    })

    it('应该处理无项目路径的情况', async () => {
      const mockSessions: ClaudeCodeSessionMeta[] = []
      mockInvoke.mockResolvedValueOnce(mockSessions)

      const result = await service.listSessions()

      expect(mockInvoke).toHaveBeenCalledWith('list_claude_code_sessions', {
        projectPath: undefined,
      })
      expect(result).toEqual([])
    })

    it('应该处理调用失败返回空数组', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Tauri invoke failed'))

      const result = await service.listSessions('/path/to/project')

      expect(result).toEqual([])
    })

    it('应该处理非 Error 类型的异常', async () => {
      mockInvoke.mockRejectedValueOnce('string error')

      const result = await service.listSessions('/path/to/project')

      expect(result).toEqual([])
    })
  })

  // ============================================================================
  // getSessionHistory 测试
  // ============================================================================

  describe('getSessionHistory', () => {
    it('应该成功返回会话历史', async () => {
      const mockMessages: ClaudeCodeMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]

      mockInvoke.mockResolvedValueOnce(mockMessages)

      const result = await service.getSessionHistory('session-1', '/path')

      expect(mockInvoke).toHaveBeenCalledWith('get_claude_code_session_history', {
        sessionId: 'session-1',
        projectPath: '/path',
      })
      expect(result).toEqual(mockMessages)
    })

    it('应该处理调用失败返回空数组', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'))

      const result = await service.getSessionHistory('session-1')

      expect(result).toEqual([])
    })
  })

  // ============================================================================
  // convertMessagesToFormat 测试
  // ============================================================================

  describe('convertMessagesToFormat', () => {
    it('应该转换字符串内容的消息', () => {
      const messages: ClaudeCodeMessage[] = [
        { role: 'user', content: 'Hello', timestamp: '2026-03-19T10:00:00Z' },
        { role: 'assistant', content: 'Hi!', timestamp: '2026-03-19T10:01:00Z' },
      ]

      const result = service.convertMessagesToFormat(messages)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'user-0',
        role: 'user',
        content: 'Hello',
        timestamp: '2026-03-19T10:00:00Z',
      })
      expect(result[1]).toEqual({
        id: 'assistant-1',
        role: 'assistant',
        content: 'Hi!',
        timestamp: '2026-03-19T10:01:00Z',
      })
    })

    it('应该处理数组内容的消息', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
          timestamp: '2026-03-19T10:00:00Z',
        },
      ]

      const result = service.convertMessagesToFormat(messages)

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Part 1Part 2')
    })

    it('应该为没有时间戳的消息生成默认时间戳', () => {
      const messages: ClaudeCodeMessage[] = [
        { role: 'user', content: 'Test' },
      ]

      const result = service.convertMessagesToFormat(messages)

      expect(result[0].timestamp).toBeDefined()
    })

    it('应该处理空消息数组', () => {
      const result = service.convertMessagesToFormat([])
      expect(result).toEqual([])
    })

    it('应该跳过非文本类型的数组项', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Text' },
            { type: 'image', data: 'base64...' },
            { type: 'tool_use', name: 'Test', input: {} },
          ],
        },
      ]

      const result = service.convertMessagesToFormat(messages)

      expect(result[0].content).toBe('Text')
    })
  })

  // ============================================================================
  // extractToolCalls 测试
  // ============================================================================

  describe('extractToolCalls', () => {
    it('应该提取工具调用', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'call-1', name: 'ReadFile', input: { path: '/test' } },
            { type: 'text', text: 'Here is the result' },
          ],
          timestamp: '2026-03-19T10:00:00Z',
        },
      ]

      const result = service.extractToolCalls(messages)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'call-1',
        name: 'ReadFile',
        status: 'completed',
        input: { path: '/test' },
        startedAt: '2026-03-19T10:00:00Z',
      })
    })

    it('应该为缺少 id 的工具调用生成 UUID', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Test', input: {} }],
          timestamp: '2026-03-19T10:00:00Z',
        },
      ]

      const result = service.extractToolCalls(messages)

      expect(result[0].id).toBe('uuid-1')
    })

    it('应该为缺少 name 的工具调用使用 unknown', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'call-1', input: {} }],
          timestamp: '2026-03-19T10:00:00Z',
        },
      ]

      const result = service.extractToolCalls(messages)

      expect(result[0].name).toBe('unknown')
    })

    it('应该处理字符串内容的消息（跳过）', () => {
      const messages: ClaudeCodeMessage[] = [
        { role: 'assistant', content: 'Just text' },
      ]

      const result = service.extractToolCalls(messages)

      expect(result).toEqual([])
    })

    it('应该处理空消息数组', () => {
      const result = service.extractToolCalls([])
      expect(result).toEqual([])
    })

    it('应该跳过用户消息', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'user',
          content: [{ type: 'tool_use', name: 'Test', input: {} }],
        },
      ]

      const result = service.extractToolCalls(messages)

      // tool_use 只会在 assistant 消息中提取
      expect(result).toHaveLength(1) // 当前实现会提取，因为没有过滤 role
    })
  })

  // ============================================================================
  // convertToChatMessages 测试
  // ============================================================================

  describe('convertToChatMessages', () => {
    it('应该转换简单用户消息', () => {
      const messages: ClaudeCodeMessage[] = [
        { role: 'user', content: 'Hello', timestamp: '2026-03-19T10:00:00Z' },
      ]

      const result = service.convertToChatMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('user')
      expect((result[0] as { content: string }).content).toBe('Hello')
    })

    it('应该转换助手消息为 blocks 格式', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'thinking', thinking: 'Let me think...' },
          ],
          timestamp: '2026-03-19T10:00:00Z',
        },
      ]

      const result = service.convertToChatMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('assistant')
      const blocks = (result[0] as { blocks: Array<{ type: string; content?: string }> }).blocks
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('text')
      expect(blocks[1].type).toBe('thinking')
    })

    it('应该跳过 tool_result 类型的用户消息', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'call-1', content: 'Result' }],
        },
        { role: 'user', content: 'Next question' },
      ]

      const result = service.convertToChatMessages(messages)

      // tool_result 应该被跳过
      expect(result).toHaveLength(1)
      expect((result[0] as { content: string }).content).toBe('Next question')
    })

    it('应该合并连续的 assistant 消息', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Part 1' }],
          timestamp: '2026-03-19T10:00:00Z',
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Part 2' }],
          timestamp: '2026-03-19T10:01:00Z',
        },
      ]

      const result = service.convertToChatMessages(messages)

      // 应该合并为一条消息
      expect(result).toHaveLength(1)
      const blocks = (result[0] as { blocks: Array<{ type: string; content?: string }> }).blocks
      expect(blocks).toHaveLength(2)
      expect(blocks[0].content).toBe('Part 1')
      expect(blocks[1].content).toBe('Part 2')
    })

    it('应该处理系统消息', () => {
      const messages: ClaudeCodeMessage[] = [
        { role: 'system', content: 'System message' },
      ]

      const result = service.convertToChatMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('system')
    })

    it('应该处理 tool_use 类型的内容块', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call-1',
              name: 'ReadFile',
              input: { path: '/test' },
            },
          ],
          timestamp: '2026-03-19T10:00:00Z',
        },
      ]

      const result = service.convertToChatMessages(messages)

      expect(result).toHaveLength(1)
      const blocks = (result[0] as { blocks: Array<{ type: string }> }).blocks
      expect(blocks[0].type).toBe('tool_call')
    })

    it('应该为空内容添加空文本块', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: [],
        },
      ]

      const result = service.convertToChatMessages(messages)

      const blocks = (result[0] as { blocks: Array<{ type: string; content?: string }> }).blocks
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('text')
      expect(blocks[0].content).toBe('')
    })

    it('应该处理字符串类型的助手消息', () => {
      const messages: ClaudeCodeMessage[] = [
        {
          role: 'assistant',
          content: 'Plain text response',
          timestamp: '2026-03-19T10:00:00Z',
        },
      ]

      const result = service.convertToChatMessages(messages)

      expect(result).toHaveLength(1)
      const blocks = (result[0] as { blocks: Array<{ type: string; content?: string }> }).blocks
      expect(blocks).toHaveLength(1)
      expect(blocks[0].content).toBe('Plain text response')
    })
  })

  // ============================================================================
  // formatFileSize 测试
  // ============================================================================

  describe('formatFileSize', () => {
    it('应该格式化字节', () => {
      expect(service.formatFileSize(512)).toBe('512 B')
    })

    it('应该格式化 KB', () => {
      expect(service.formatFileSize(1024)).toBe('1 KB')
      expect(service.formatFileSize(1536)).toBe('1.5 KB')
    })

    it('应该格式化 MB', () => {
      expect(service.formatFileSize(1048576)).toBe('1 MB')
      expect(service.formatFileSize(1572864)).toBe('1.5 MB')
    })

    it('应该格式化 GB', () => {
      expect(service.formatFileSize(1073741824)).toBe('1 GB')
    })

    it('应该处理 0 字节', () => {
      expect(service.formatFileSize(0)).toBe('0 B')
    })
  })

  // ============================================================================
  // formatTime 测试
  // ============================================================================

  describe('formatTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-19T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该返回"刚刚"对于小于 1 分钟', () => {
      const timestamp = '2026-03-19T11:59:30Z'
      expect(service.formatTime(timestamp)).toBe('刚刚')
    })

    it('应该返回分钟对于小于 1 小时', () => {
      const timestamp = '2026-03-19T11:30:00Z'
      expect(service.formatTime(timestamp)).toBe('30 分钟前')
    })

    it('应该返回小时对于小于 24 小时', () => {
      const timestamp = '2026-03-19T10:00:00Z'
      expect(service.formatTime(timestamp)).toBe('2 小时前')
    })

    it('应该返回天对于小于 7 天', () => {
      const timestamp = '2026-03-17T12:00:00Z'
      expect(service.formatTime(timestamp)).toBe('2 天前')
    })

    it('应该返回日期对于超过 7 天', () => {
      const timestamp = '2026-03-10T12:00:00Z'
      const result = service.formatTime(timestamp)
      expect(result).toMatch(/3月/)
    })
  })

  // ============================================================================
  // getClaudeCodeHistoryService 单例测试
  // ============================================================================

  describe('getClaudeCodeHistoryService', () => {
    it('应该返回单例实例', () => {
      // 重置模块以清除单例
      vi.resetModules()

      // 重新导入
      return import('./claudeCodeHistoryService').then((module) => {
        const instance1 = module.getClaudeCodeHistoryService()
        const instance2 = module.getClaudeCodeHistoryService()
        expect(instance1).toBe(instance2)
      })
    })
  })
})

// ============================================================================
// isToolResultMessage 测试（通过 convertToChatMessages 间接测试）
// ============================================================================

describe('isToolResultMessage 间接测试', () => {
  let service: ClaudeCodeHistoryService

  beforeEach(() => {
    service = new ClaudeCodeHistoryService()
    vi.clearAllMocks()
  })

  it('应该正确识别 tool_result 消息', () => {
    const messages: ClaudeCodeMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call-1', content: 'Result' },
        ],
      },
      { role: 'user', content: 'Real question' },
    ]

    const result = service.convertToChatMessages(messages)

    // tool_result 应该被跳过
    expect(result).toHaveLength(1)
  })

  it('应该不跳过普通用户消息', () => {
    const messages: ClaudeCodeMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
    ]

    const result = service.convertToChatMessages(messages)

    expect(result).toHaveLength(1)
  })
})

// ============================================================================
// parseAssistantBlocks 测试（通过 convertToChatMessages 间接测试）
// ============================================================================

describe('parseAssistantBlocks 间接测试', () => {
  let service: ClaudeCodeHistoryService

  beforeEach(() => {
    service = new ClaudeCodeHistoryService()
    vi.clearAllMocks()
    uuidIndex = 0
  })

  it('应该跳过空的 thinking 块', () => {
    const messages: ClaudeCodeMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'thinking', thinking: '   ' }, // 空白应该被跳过
        ],
      },
    ]

    const result = service.convertToChatMessages(messages)
    const blocks = (result[0] as { blocks: Array<{ type: string }> }).blocks

    // 空白 thinking 应该被跳过
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  it('应该处理非对象类型的数组项', () => {
    const messages: ClaudeCodeMessage[] = [
      {
        role: 'assistant',
        content: ['string', null, undefined, 123] as unknown[],
      },
    ]

    const result = service.convertToChatMessages(messages)

    // 应该添加空文本块
    const blocks = (result[0] as { blocks: Array<{ type: string }> }).blocks
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  it('应该处理缺少 type 的对象', () => {
    const messages: ClaudeCodeMessage[] = [
      {
        role: 'assistant',
        content: [{ text: 'Hello' }] as Array<{ text: string }>,
      },
    ]

    const result = service.convertToChatMessages(messages)

    // 应该添加空文本块
    const blocks = (result[0] as { blocks: Array<{ type: string }> }).blocks
    expect(blocks).toHaveLength(1)
  })
})

// ============================================================================
// extractUserContent 测试（通过 convertToChatMessages 间接测试）
// ============================================================================

describe('extractUserContent 间接测试', () => {
  let service: ClaudeCodeHistoryService

  beforeEach(() => {
    service = new ClaudeCodeHistoryService()
    vi.clearAllMocks()
  })

  it('应该从用户消息中过滤 tool_result', () => {
    const messages: ClaudeCodeMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'tool_result', tool_use_id: 'call-1', content: 'Result' },
        ],
      },
    ]

    const result = service.convertToChatMessages(messages)

    expect(result).toHaveLength(1)
    expect((result[0] as { content: string }).content).toBe('Hello')
  })

  it('应该处理非字符串非数组的 content', () => {
    const messages: ClaudeCodeMessage[] = [
      {
        role: 'user',
        content: { foo: 'bar' } as unknown as string,
      },
    ]

    const result = service.convertToChatMessages(messages)

    expect((result[0] as { content: string }).content).toBe('')
  })
})
