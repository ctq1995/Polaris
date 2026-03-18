/**
 * CompactMessageList - 小屏模式专用消息列表
 *
 * 特点：
 * - 简单滚动列表（小屏消息量有限，无需虚拟列表）
 * - 紧凑的消息间距
 * - 自动滚动到底部
 * - 支持滚动到指定消息
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useEventChatStore } from '../../stores'
import { CompactUserMessage } from './CompactUserMessage'
import { CompactAssistantMessage } from './CompactAssistantMessage'
import type { ChatMessage } from '../../types/chat'
import { isUserMessage, isAssistantMessage } from '../../types/chat'

export interface CompactMessageListRef {
  /** 滚动到指定消息索引 */
  scrollToMessage: (index: number) => void
  /** 滚动到底部 */
  scrollToBottom: () => void
}

interface CompactMessageListProps {
  /** 消息元素的类名，用于定位 */
  messageClassName?: string
}

export const CompactMessageList = forwardRef<CompactMessageListRef, CompactMessageListProps>(
  function CompactMessageList(_props, ref) {
    const messages = useEventChatStore(state => state.messages)
    const isStreaming = useEventChatStore(state => state.isStreaming)
    const listRef = useRef<HTMLDivElement>(null)
    const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      scrollToMessage: (index: number) => {
        if (index < 0 || index >= messages.length) return
        const message = messages[index]
        const element = messageRefs.current.get(message.id)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      },
      scrollToBottom: () => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      }
    }), [messages])

    // 自动滚动到底部
    useEffect(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    }, [messages, isStreaming])

    if (messages.length === 0) {
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center text-text-tertiary text-sm">
          <p>开始新对话...</p>
        </div>
      )
    }

    return (
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-2"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            ref={(el) => {
              if (el) {
                messageRefs.current.set(message.id, el)
              } else {
                messageRefs.current.delete(message.id)
              }
            }}
          >
            <CompactMessageItem message={message} />
          </div>
        ))}

        {/* 流式输出指示器 */}
        {isStreaming && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-text-tertiary text-xs">
            <span className="animate-pulse">●</span>
            <span>AI 正在回复...</span>
          </div>
        )}
      </div>
    )
  }
)

function CompactMessageItem({ message }: { message: ChatMessage }) {
  if (isUserMessage(message)) {
    return <CompactUserMessage message={message} />
  }

  if (isAssistantMessage(message)) {
    return <CompactAssistantMessage message={message} />
  }

  // 其他类型消息暂不显示
  return null
}
