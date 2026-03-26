/**
 * 工具启动注册
 *
 * 在应用启动时注册所有可用的 AI 工具
 */

import { globalToolRegistry } from '@/ai-runtime'
import { todoTools } from '@/ai-runtime/tools/todoTools'

/**
 * 注册所有 AI 工具
 *
 * 注意：需求库工具已改为通过系统提示词引导 Claude Code 直接操作
 * requirements.json 文件，不再使用 globalToolRegistry 注册。
 * 参见 src/locales/zh-CN/systemPrompt.json 中的 reqManagement 指令。
 */
export function bootstrapTools(): void {
  console.log('[ToolBootstrap] 开始注册 AI 工具...')

  // 注册待办工具
  for (const tool of todoTools) {
    globalToolRegistry.register(tool)
  }

  console.log(`[ToolBootstrap] 已注册 ${todoTools.length} 个待办工具`)
  console.log('[ToolBootstrap] 所有可用工具:', globalToolRegistry.listNames())
}
