/**
 * AIActions - 需求面板的 AI 操作按钮栏
 *
 * 通过自然语言 prompt 指导 AI 操作需求文件（而非注册工具调用）
 * AI 通过系统提示词已知道需求库文件路径和格式
 */

import { Bot, Code, TestTube, Lightbulb } from 'lucide-react'
import type { Requirement } from '@/types/requirement'
import { useEventChatStore } from '@/stores'
import clsx from 'clsx'

interface AIActionsProps {
  requirement: Requirement
  className?: string
}

/** 根据需求状态生成对应的 AI 自然语言提示词 */
function buildPrompt(req: Requirement, action: string): string {
  const info = `需求ID: ${req.id}\n标题: ${req.title}\n类型: ${req.type}\n优先级: ${req.priority}`
  const desc = req.description ? `\n描述: ${req.description}` : ''

  switch (action) {
    case 'analyze':
      return `[需求分析任务] 请分析以下需求，探索代码库了解上下文。
分析完成后请：
1. 读取 .polaris/requirements.json，更新该需求的 analysis 字段（摘要、建议子任务、相关文件、复杂度评估等）
2. 生成 HTML 原型写入 .polaris/prototypes/${req.id}.html
3. 更新 design.prototypes 数组，添加原型记录
4. 更新需求状态为 designed

${info}${desc}`

    case 'explore':
      return `[需求探索任务] 请探索当前代码库，识别缺失的功能、潜在的改进点和未覆盖的边界情况。
先读取 .polaris/requirements.json 查看已有需求避免重复。
发现新需求后，更新 requirements.json 添加新条目（设置 approved=false, source="agent_analysis"）。`

    case 'develop':
      return `[需求开发任务] 请开发实现以下需求。
先读取 .polaris/requirements.json 获取需求详情和分析结果（analysis 字段）。
开发完成后更新 requirements.json 中该需求的状态为 testing。

${info}${desc}`

    case 'test':
      return `[需求测试任务] 请测试验证以下需求的实现是否正确。
先读取 .polaris/requirements.json 获取需求详情和验收标准（design.acceptanceCriteria）。
运行相关测试、检查边界情况。
测试通过则更新需求状态为 tested，不通过则更新为 fixing 并说明原因。

${info}${desc}`

    case 'prototype':
      return `[原型生成任务] 请根据以下需求描述生成一个完整的 HTML 原型页面。
生成完整的 HTML 文档（含 CSS），写入 .polaris/prototypes/${req.id}.html。
然后读取 .polaris/requirements.json，更新该需求的 design.prototypes 数组添加原型记录。

${info}${desc}`

    default:
      return ''
  }
}

export function AIActions({ requirement: req, className }: AIActionsProps) {
  const handleAIAction = (action: string) => {
    const prompt = buildPrompt(req, action)
    if (!prompt) return

    try {
      useEventChatStore.getState().sendMessage(prompt)
    } catch (e) {
      console.error('[AIActions] 发送 AI 消息失败:', e)
    }
  }

  /** 根据当前状态显示不同的操作按钮 */
  const getActions = (): { key: string; icon: typeof Bot; label: string; action: string }[] => {
    const actions: { key: string; icon: typeof Bot; label: string; action: string; show?: boolean }[] = [
      // 分析阶段（未确认时也可触发分析）
      {
        key: 'analyze',
        icon: Bot,
        label: 'AI 分析',
        action: 'analyze',
        show: ['draft', 'analyzing'].includes(req.status),
      },
      // 原型生成
      {
        key: 'prototype',
        icon: Lightbulb,
        label: 'AI 生成原型',
        action: 'prototype',
      },
      // 开发阶段
      {
        key: 'develop',
        icon: Code,
        label: 'AI 开发',
        action: 'develop',
        show: ['designed', 'developing'].includes(req.status),
      },
      // 测试阶段
      {
        key: 'test',
        icon: TestTube,
        label: 'AI 测试',
        action: 'test',
        show: ['developing', 'testing', 'fixing', 'tested'].includes(req.status),
      },
    ]

    return actions.filter((a) => a.show !== false)
  }

  const actions = getActions()

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      <Bot size={12} className="text-primary" />
      {actions.map(({ key, icon: Icon, label, action }) => (
        <button
          key={key}
          onClick={() => handleAIAction(action)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-primary/10 text-primary rounded hover:bg-primary/20 transition-all"
          title={`发送指令给 AI: ${label}`}
        >
          <Icon size={11} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
