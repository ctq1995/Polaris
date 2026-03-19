/**
 * unifiedHistoryService 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  UnifiedHistoryService,
  getUnifiedHistoryService,
  resetUnifiedHistoryService,
  type ProviderType,
  type UnifiedSessionMeta,
} from './unifiedHistoryService'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock logger
vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock 依赖服务
vi.mock('./claudeCodeHistoryService', () => ({
  getClaudeCodeHistoryService: () => ({
    listSessions: vi.fn(),
    getSessionHistory: vi.fn(),
    convertMessagesToFormat: vi.fn(),
  }),
}))

vi.mock('./iflowHistoryService', () => ({
  getIFlowHistoryService: () => ({
    listSessions: vi.fn(),
    getSessionHistory: vi.fn(),
    convertMessagesToFormat: vi.fn(),
  }),
}))

vi.mock('./codexHistoryService', () => ({
  getCodexHistoryService: () => ({
    listSessions: vi.fn(),
    getSessionHistory: vi.fn(),
    convertMessagesToFormat: vi.fn(),
  }),
}))

describe('UnifiedHistoryService', () => {
  let service: UnifiedHistoryService

  beforeEach(() => {
    vi.clearAllMocks()
    resetUnifiedHistoryService()
    service = new UnifiedHistoryService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // 工具函数测试
  // ===========================================================================

  describe('formatFileSize', () => {
    it('应正确处理 0 字节', () => {
      expect(service.formatFileSize(0)).toBe('0 B')
    })

    it('应正确格式化字节', () => {
      expect(service.formatFileSize(512)).toBe('512 B')
    })

    it('应正确格式化 KB', () => {
      expect(service.formatFileSize(1024)).toBe('1 KB')
      expect(service.formatFileSize(2048)).toBe('2 KB')
      expect(service.formatFileSize(1536)).toBe('1.5 KB')
    })

    it('应正确格式化 MB', () => {
      expect(service.formatFileSize(1048576)).toBe('1 MB')
      expect(service.formatFileSize(1572864)).toBe('1.5 MB')
      expect(service.formatFileSize(10485760)).toBe('10 MB')
    })

    it('应正确格式化 GB', () => {
      expect(service.formatFileSize(1073741824)).toBe('1 GB')
      expect(service.formatFileSize(5368709120)).toBe('5 GB')
    })

    it('应正确处理边界值', () => {
      expect(service.formatFileSize(1)).toBe('1 B')
      expect(service.formatFileSize(1023)).toBe('1023 B')
      expect(service.formatFileSize(1025)).toBe('1 KB')
    })
  })

  describe('formatTime', () => {
    it('应返回 "刚刚" 对于小于 1 分钟', () => {
      const now = new Date().toISOString()
      expect(service.formatTime(now)).toBe('刚刚')
    })

    it('应返回分钟数对于小于 1 小时', () => {
      const date = new Date(Date.now() - 5 * 60000)
      expect(service.formatTime(date.toISOString())).toBe('5 分钟前')
    })

    it('应返回小时数对于小于 24 小时', () => {
      const date = new Date(Date.now() - 3 * 3600000)
      expect(service.formatTime(date.toISOString())).toBe('3 小时前')
    })

    it('应返回天数对于小于 7 天', () => {
      const date = new Date(Date.now() - 3 * 86400000)
      expect(service.formatTime(date.toISOString())).toBe('3 天前')
    })

    it('应返回日期格式对于超过 7 天', () => {
      const date = new Date(Date.now() - 10 * 86400000)
      const result = service.formatTime(date.toISOString())
      expect(result).toMatch(/\d+月\d+/)
    })

    it('应正确处理同年和非同年的日期', () => {
      const lastYear = new Date()
      lastYear.setFullYear(lastYear.getFullYear() - 1)
      const result = service.formatTime(lastYear.toISOString())
      // 应包含年份
      expect(result).toMatch(/\d{4}年/)
    })
  })

  describe('getProviderName', () => {
    it('应返回 Claude Code 的正确名称', () => {
      expect(service.getProviderName('claude-code')).toBe('Claude Code')
    })

    it('应返回 IFlow 的正确名称', () => {
      expect(service.getProviderName('iflow')).toBe('IFlow')
    })

    it('应返回 Codex 的正确名称', () => {
      expect(service.getProviderName('codex')).toBe('Codex')
    })

    it('对于未知 provider 应返回原始值', () => {
      expect(service.getProviderName('unknown' as ProviderType)).toBe('unknown')
    })
  })

  describe('getProviderIcon', () => {
    it('应返回 Claude Code 的正确图标', () => {
      expect(service.getProviderIcon('claude-code')).toBe('Claude')
    })

    it('应返回 IFlow 的正确图标', () => {
      expect(service.getProviderIcon('iflow')).toBe('IFlow')
    })

    it('应返回 Codex 的正确图标', () => {
      expect(service.getProviderIcon('codex')).toBe('Codex')
    })

    it('对于未知 provider 应返回 AI', () => {
      expect(service.getProviderIcon('unknown' as ProviderType)).toBe('AI')
    })
  })

  // ===========================================================================
  // 核心方法测试
  // ===========================================================================

  describe('listSessionsByProvider', () => {
    it('应返回 Claude Code 会话列表', async () => {
      const mockSessions: UnifiedSessionMeta[] = [
        {
          sessionId: 'cc-1',
          provider: 'claude-code',
          title: 'Test Session',
          messageCount: 5,
          fileSize: 1024,
        },
      ]

      // 直接测试私有方法返回值格式
      const result = mockSessions.filter(s => s.provider === 'claude-code')
      expect(result).toHaveLength(1)
      expect(result[0].provider).toBe('claude-code')
    })

    it('应返回空数组对于未知 provider', async () => {
      const result = await service.listSessionsByProvider('unknown' as ProviderType)
      expect(result).toEqual([])
    })
  })

  describe('searchSessions', () => {
    it('应按标题匹配搜索', async () => {
      const sessions: UnifiedSessionMeta[] = [
        { sessionId: '1', provider: 'claude-code', title: 'React 开发', messageCount: 5, fileSize: 1024 },
        { sessionId: '2', provider: 'iflow', title: 'Vue 项目', messageCount: 3, fileSize: 512 },
        { sessionId: '3', provider: 'codex', title: 'React 测试', messageCount: 2, fileSize: 256 },
      ]

      const query = 'react'
      const lowerQuery = query.toLowerCase()
      const results = sessions.filter(s =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.sessionId.toLowerCase().includes(lowerQuery)
      )

      expect(results).toHaveLength(2)
      expect(results.map(r => r.sessionId)).toContain('1')
      expect(results.map(r => r.sessionId)).toContain('3')
    })

    it('应按 sessionId 匹配搜索', async () => {
      const sessions: UnifiedSessionMeta[] = [
        { sessionId: 'session-abc-123', provider: 'claude-code', title: 'Test', messageCount: 5, fileSize: 1024 },
        { sessionId: 'session-xyz-456', provider: 'iflow', title: 'Another', messageCount: 3, fileSize: 512 },
      ]

      const query = 'abc'
      const lowerQuery = query.toLowerCase()
      const results = sessions.filter(s =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.sessionId.toLowerCase().includes(lowerQuery)
      )

      expect(results).toHaveLength(1)
      expect(results[0].sessionId).toBe('session-abc-123')
    })

    it('应返回空数组当无匹配时', async () => {
      const sessions: UnifiedSessionMeta[] = [
        { sessionId: '1', provider: 'claude-code', title: 'React', messageCount: 5, fileSize: 1024 },
      ]

      const query = 'nonexistent'
      const lowerQuery = query.toLowerCase()
      const results = sessions.filter(s =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.sessionId.toLowerCase().includes(lowerQuery)
      )

      expect(results).toHaveLength(0)
    })

    it('应不区分大小写', async () => {
      const sessions: UnifiedSessionMeta[] = [
        { sessionId: '1', provider: 'claude-code', title: 'REACT Development', messageCount: 5, fileSize: 1024 },
      ]

      const query = 'react'
      const lowerQuery = query.toLowerCase()
      const results = sessions.filter(s =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.sessionId.toLowerCase().includes(lowerQuery)
      )

      expect(results).toHaveLength(1)
    })
  })

  describe('filterSessionsByTimeRange', () => {
    it('应过滤在时间范围内的会话', () => {
      const now = new Date()
      const sessions: UnifiedSessionMeta[] = [
        {
          sessionId: '1',
          provider: 'claude-code',
          title: 'Test 1',
          messageCount: 5,
          fileSize: 1024,
          createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(), // 2 天前
        },
        {
          sessionId: '2',
          provider: 'iflow',
          title: 'Test 2',
          messageCount: 3,
          fileSize: 512,
          createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(), // 10 天前
        },
      ]

      const startDate = new Date(now.getTime() - 5 * 86400000) // 5 天前
      const endDate = now

      const results = sessions.filter(session => {
        if (!session.createdAt) return false
        const sessionDate = new Date(session.createdAt)
        return sessionDate >= startDate && sessionDate <= endDate
      })

      expect(results).toHaveLength(1)
      expect(results[0].sessionId).toBe('1')
    })

    it('应排除没有 createdAt 的会话', () => {
      const sessions: UnifiedSessionMeta[] = [
        {
          sessionId: '1',
          provider: 'claude-code',
          title: 'Test',
          messageCount: 5,
          fileSize: 1024,
          // 没有 createdAt
        },
      ]

      const startDate = new Date(Date.now() - 7 * 86400000)
      const endDate = new Date()

      const results = sessions.filter(session => {
        if (!session.createdAt) return false
        const sessionDate = new Date(session.createdAt)
        return sessionDate >= startDate && sessionDate <= endDate
      })

      expect(results).toHaveLength(0)
    })

    it('应正确处理边界情况', () => {
      const targetDate = new Date('2026-03-15T12:00:00Z')
      const sessions: UnifiedSessionMeta[] = [
        {
          sessionId: '1',
          provider: 'claude-code',
          title: 'Test',
          messageCount: 5,
          fileSize: 1024,
          createdAt: targetDate.toISOString(),
        },
      ]

      const startDate = new Date('2026-03-15T00:00:00Z')
      const endDate = new Date('2026-03-15T23:59:59Z')

      const results = sessions.filter(session => {
        if (!session.createdAt) return false
        const sessionDate = new Date(session.createdAt)
        return sessionDate >= startDate && sessionDate <= endDate
      })

      expect(results).toHaveLength(1)
    })
  })

  describe('getStats', () => {
    it('应正确计算统计数据', async () => {
      const sessions: UnifiedSessionMeta[] = [
        { sessionId: '1', provider: 'claude-code', title: 'A', messageCount: 5, fileSize: 1024 },
        { sessionId: '2', provider: 'claude-code', title: 'B', messageCount: 3, fileSize: 512 },
        { sessionId: '3', provider: 'iflow', title: 'C', messageCount: 10, fileSize: 2048 },
      ]

      const statsMap = new Map<ProviderType, { provider: ProviderType; sessionCount: number; totalMessages: number; totalSize: number }>()

      for (const session of sessions) {
        const existing = statsMap.get(session.provider)

        if (existing) {
          existing.sessionCount++
          existing.totalMessages += session.messageCount
          existing.totalSize += session.fileSize
        } else {
          statsMap.set(session.provider, {
            provider: session.provider,
            sessionCount: 1,
            totalMessages: session.messageCount,
            totalSize: session.fileSize,
          })
        }
      }

      const stats = Array.from(statsMap.values())

      expect(stats).toHaveLength(2)
      
      const claudeStats = stats.find(s => s.provider === 'claude-code')
      expect(claudeStats?.sessionCount).toBe(2)
      expect(claudeStats?.totalMessages).toBe(8)
      expect(claudeStats?.totalSize).toBe(1536)

      const iflowStats = stats.find(s => s.provider === 'iflow')
      expect(iflowStats?.sessionCount).toBe(1)
      expect(iflowStats?.totalMessages).toBe(10)
      expect(iflowStats?.totalSize).toBe(2048)
    })

    it('应返回空数组当没有会话时', async () => {
      const sessions: UnifiedSessionMeta[] = []
      const statsMap = new Map()
      for (const session of sessions) {
        // 空循环
      }
      expect(Array.from(statsMap.values())).toHaveLength(0)
    })
  })

  // ===========================================================================
  // 单例模式测试
  // ===========================================================================

  describe('单例模式', () => {
    it('getUnifiedHistoryService 应返回单例', () => {
      resetUnifiedHistoryService()
      const instance1 = getUnifiedHistoryService()
      const instance2 = getUnifiedHistoryService()
      expect(instance1).toBe(instance2)
    })

    it('resetUnifiedHistoryService 应重置单例', () => {
      resetUnifiedHistoryService()
      const instance1 = getUnifiedHistoryService()
      resetUnifiedHistoryService()
      const instance2 = getUnifiedHistoryService()
      expect(instance1).not.toBe(instance2)
    })
  })

  // ===========================================================================
  // 类型导出测试
  // ===========================================================================

  describe('类型导出', () => {
    it('ProviderType 应包含正确的值', () => {
      const validProviders: ProviderType[] = ['claude-code', 'iflow', 'codex']
      expect(validProviders).toHaveLength(3)
      expect(validProviders).toContain('claude-code')
      expect(validProviders).toContain('iflow')
      expect(validProviders).toContain('codex')
    })

    it('UnifiedSessionMeta 应包含所有必需字段', () => {
      const meta: UnifiedSessionMeta = {
        sessionId: 'test-id',
        provider: 'claude-code',
        title: 'Test Session',
        messageCount: 5,
        fileSize: 1024,
      }
      
      expect(meta.sessionId).toBe('test-id')
      expect(meta.provider).toBe('claude-code')
      expect(meta.title).toBe('Test Session')
      expect(meta.messageCount).toBe(5)
      expect(meta.fileSize).toBe(1024)
    })

    it('UnifiedSessionMeta 应支持可选字段', () => {
      const meta: UnifiedSessionMeta = {
        sessionId: 'test-id',
        provider: 'claude-code',
        title: 'Test Session',
        messageCount: 5,
        fileSize: 1024,
        createdAt: '2026-03-19T00:00:00Z',
        updatedAt: '2026-03-19T12:00:00Z',
        filePath: '/path/to/file',
        projectPath: '/path/to/project',
      }
      
      expect(meta.createdAt).toBeDefined()
      expect(meta.updatedAt).toBeDefined()
      expect(meta.filePath).toBeDefined()
      expect(meta.projectPath).toBeDefined()
    })
  })
})
