/**
 * PromptBuilder 测试
 *
 * 测试提示词构建器的各种场景：
 * - 基础提示词构建
 * - 完整提示词构建（带 CLAUDE.md）
 * - 配置选项
 * - 错误处理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PromptBuilder, type PromptBuilderConfig } from './prompt-builder'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

describe('PromptBuilder', () => {
  let builder: PromptBuilder
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('buildBasePrompt', () => {
    it('返回基础提示词', () => {
      builder = new PromptBuilder()
      const prompt = builder.buildBasePrompt()

      expect(prompt).toContain('Polaris 编程助手')
      expect(prompt).toContain('简单问题直接回答')
      expect(prompt).toContain('只在必要时使用工具')
      expect(prompt).toContain('保持简洁明了')
      expect(prompt).toContain('优先考虑代码质量')
    })

    it('基础提示词不包含工作区规则', () => {
      builder = new PromptBuilder()
      const prompt = builder.buildBasePrompt()

      expect(prompt).not.toContain('项目规则')
    })

    it('每次调用返回相同的提示词', () => {
      builder = new PromptBuilder()
      const prompt1 = builder.buildBasePrompt()
      const prompt2 = builder.buildBasePrompt()

      expect(prompt1).toBe(prompt2)
    })

    it('不依赖配置', () => {
      builder = new PromptBuilder({ workspaceDir: '/some/path' })
      const prompt = builder.buildBasePrompt()

      // buildBasePrompt 不读取 CLAUDE.md
      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe('buildFullPrompt', () => {
    it('无工作区配置时返回基础提示词', async () => {
      builder = new PromptBuilder()
      const prompt = await builder.buildFullPrompt('用户消息')

      expect(prompt).toContain('Polaris 编程助手')
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('有工作区但 CLAUDE.md 不存在时返回基础提示词', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('File not found'))

      builder = new PromptBuilder({ workspaceDir: '/workspace' })
      const prompt = await builder.buildFullPrompt('用户消息')

      expect(prompt).toContain('Polaris 编程助手')
      expect(mockInvoke).toHaveBeenCalledWith('read_file', { path: '/workspace/CLAUDE.md' })
    })

    it('有工作区且 CLAUDE.md 存在时返回完整提示词', async () => {
      const claudeMdContent = '# 项目规则\n\n这是项目的自定义规则。'
      mockInvoke.mockResolvedValueOnce(claudeMdContent)

      builder = new PromptBuilder({ workspaceDir: '/workspace' })
      const prompt = await builder.buildFullPrompt('用户消息')

      expect(prompt).toContain('Polaris 编程助手')
      expect(prompt).toContain('项目规则')
      expect(prompt).toContain('这是项目的自定义规则')
    })

    it('CLAUDE.md 内容正确拼接到提示词', async () => {
      const claudeMdContent = '## 代码规范\n\n- 使用 TypeScript\n- 遵循 ESLint 规则'
      mockInvoke.mockResolvedValueOnce(claudeMdContent)

      builder = new PromptBuilder({ workspaceDir: '/project' })
      const prompt = await builder.buildFullPrompt('帮我写代码')

      expect(prompt).toContain('项目规则：')
      expect(prompt).toContain('## 代码规范')
      expect(prompt).toContain('使用 TypeScript')
    })

    it('正确调用 invoke 读取 CLAUDE.md', async () => {
      mockInvoke.mockResolvedValueOnce('content')

      builder = new PromptBuilder({ workspaceDir: '/my/workspace' })
      await builder.buildFullPrompt('message')

      expect(mockInvoke).toHaveBeenCalledWith('read_file', {
        path: '/my/workspace/CLAUDE.md'
      })
    })

    it('多次调用时每次都尝试读取 CLAUDE.md', async () => {
      mockInvoke.mockResolvedValueOnce('content1')
      mockInvoke.mockResolvedValueOnce('content2')

      builder = new PromptBuilder({ workspaceDir: '/workspace' })
      await builder.buildFullPrompt('msg1')
      await builder.buildFullPrompt('msg2')

      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('配置选项', () => {
    it('接受空配置', () => {
      builder = new PromptBuilder()
      expect(builder).toBeDefined()
    })

    it('接受 workspaceDir 配置', () => {
      const config: PromptBuilderConfig = {
        workspaceDir: '/path/to/workspace'
      }
      builder = new PromptBuilder(config)
      expect(builder).toBeDefined()
    })

    it('接受 verbose 配置', () => {
      const config: PromptBuilderConfig = {
        verbose: true
      }
      builder = new PromptBuilder(config)
      expect(builder).toBeDefined()
    })

    it('接受完整配置', () => {
      const config: PromptBuilderConfig = {
        workspaceDir: '/workspace',
        verbose: true
      }
      builder = new PromptBuilder(config)
      expect(builder).toBeDefined()
    })

    it('配置为 undefined 时使用默认值', () => {
      builder = new PromptBuilder(undefined)
      expect(builder).toBeDefined()
    })
  })

  describe('错误处理', () => {
    it('invoke 抛出错误时返回基础提示词', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'))

      builder = new PromptBuilder({ workspaceDir: '/workspace' })
      const prompt = await builder.buildFullPrompt('message')

      expect(prompt).toContain('Polaris 编程助手')
      expect(prompt).not.toContain('项目规则')
    })

    it('invoke 返回 null 时返回基础提示词', async () => {
      mockInvoke.mockResolvedValueOnce(null)

      builder = new PromptBuilder({ workspaceDir: '/workspace' })
      const prompt = await builder.buildFullPrompt('message')

      expect(prompt).toContain('Polaris 编程助手')
    })

    it('invoke 返回空字符串时返回基础提示词', async () => {
      mockInvoke.mockResolvedValueOnce('')

      builder = new PromptBuilder({ workspaceDir: '/workspace' })
      const prompt = await builder.buildFullPrompt('message')

      // 空字符串会拼接，但不影响基础提示词
      expect(prompt).toContain('Polaris 编程助手')
    })

    it('工作区路径不存在时正常处理', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Path not found'))

      builder = new PromptBuilder({ workspaceDir: '/nonexistent' })
      const prompt = await builder.buildFullPrompt('message')

      expect(prompt).toContain('Polaris 编程助手')
    })
  })

  describe('Intent 参数', () => {
    it('无 intent 参数时正常工作', async () => {
      builder = new PromptBuilder()
      const prompt = await builder.buildFullPrompt('message')

      expect(prompt).toContain('Polaris 编程助手')
    })

    it('有 intent 参数时正常工作', async () => {
      const intent = {
        type: 'code' as const,
        requiresTools: true,
        requiredTools: ['read_file'],
        requiresSkills: false,
        skillTriggers: [],
        complexity: 'medium' as const
      }

      builder = new PromptBuilder()
      const prompt = await builder.buildFullPrompt('message', intent)

      expect(prompt).toContain('Polaris 编程助手')
    })
  })

  describe('提示词内容验证', () => {
    it('包含核心原则', async () => {
      builder = new PromptBuilder()
      const prompt = await builder.buildFullPrompt('message')

      expect(prompt).toContain('简单问题直接回答')
      expect(prompt).toContain('不要过度分析')
      expect(prompt).toContain('只在必要时使用工具')
      expect(prompt).toContain('保持简洁明了')
    })

    it('包含 shell 命令规则', async () => {
      builder = new PromptBuilder()
      const prompt = await builder.buildFullPrompt('message')

      expect(prompt).toContain('shell 命令')
      expect(prompt).toContain('工作目录')
    })

    it('提示词不以换行开头或结尾', () => {
      builder = new PromptBuilder()
      const prompt = builder.buildBasePrompt()

      expect(prompt.startsWith('\n')).toBe(false)
      expect(prompt.endsWith('\n')).toBe(false)
    })
  })

  describe('并发调用', () => {
    it('支持并发调用 buildFullPrompt', async () => {
      mockInvoke.mockResolvedValue('content')

      builder = new PromptBuilder({ workspaceDir: '/workspace' })

      const promises = [
        builder.buildFullPrompt('msg1'),
        builder.buildFullPrompt('msg2'),
        builder.buildFullPrompt('msg3')
      ]

      const results = await Promise.all(promises)

      results.forEach(prompt => {
        expect(prompt).toContain('Polaris 编程助手')
      })
    })
  })
})
