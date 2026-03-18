/**
 * CompactChatNavigator - 小屏模式消息导航组件
 *
 * 特点：
 * - 紧凑的导航按钮
 * - 下拉菜单显示消息列表
 * - 支持快速跳转到指定消息
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { BookOpen, ChevronDown, User, Bot, ArrowDown } from 'lucide-react'
import { useEventChatStore } from '../../stores'
import { groupConversationRounds, type ConversationRound } from '../../utils/conversationRounds'
import { clsx } from 'clsx'

interface CompactChatNavigatorProps {
  /** 滚动到指定消息索引 */
  onScrollToMessage: (messageIndex: number) => void
  /** 滚动到底部 */
  onScrollToBottom: () => void
}

export function CompactChatNavigator({ onScrollToMessage, onScrollToBottom }: CompactChatNavigatorProps) {
  const messages = useEventChatStore(state => state.messages)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 生成对话轮次
  const rounds = groupConversationRounds(messages)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 跳转到指定轮次
  const handleRoundClick = useCallback((round: ConversationRound) => {
    // 跳转到该轮次的第一条消息
    const firstMessageIndex = round.messageIndices[0]
    onScrollToMessage(firstMessageIndex)
    setIsOpen(false)
  }, [onScrollToMessage])

  // 回到底部
  const handleScrollToBottom = useCallback(() => {
    onScrollToBottom()
    setIsOpen(false)
  }, [onScrollToBottom])

  if (rounds.length === 0) {
    return null
  }

  return (
    <div ref={containerRef} className="relative">
      {/* 导航按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-background-hover transition-colors text-xs"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>{rounds.length}</span>
        <ChevronDown className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 max-h-64 overflow-y-auto bg-background-elevated border border-border rounded-lg shadow-lg z-50">
          {/* 标题 */}
          <div className="sticky top-0 flex items-center justify-between px-2 py-1.5 border-b border-border bg-background-surface">
            <span className="text-xs font-medium text-text-secondary">对话导航</span>
            <span className="text-xs text-text-tertiary">{rounds.length} 轮</span>
          </div>

          {/* 轮次列表 */}
          <div className="py-1">
            {rounds.map((round) => (
              <button
                key={round.roundIndex}
                onClick={() => handleRoundClick(round)}
                className="w-full px-2 py-1.5 text-left hover:bg-background-hover transition-colors"
              >
                {/* 轮次标题 */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-text-tertiary">
                    #{round.roundIndex + 1}
                  </span>
                  <span className="text-xs text-text-tertiary ml-auto">
                    {round.timestamp}
                  </span>
                </div>

                {/* 用户消息 */}
                <div className="flex items-start gap-1">
                  <User className="w-3 h-3 text-text-tertiary shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary line-clamp-1">
                    {round.userSummary}
                  </p>
                </div>

                {/* 助手回复 */}
                {round.assistantMessage && (
                  <div className="flex items-start gap-1 mt-0.5">
                    <Bot className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-text-tertiary line-clamp-1">
                      {round.assistantSummary}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* 底部按钮 */}
          <div className="sticky bottom-0 border-t border-border bg-background-surface">
            <button
              onClick={handleScrollToBottom}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              回到底部
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
