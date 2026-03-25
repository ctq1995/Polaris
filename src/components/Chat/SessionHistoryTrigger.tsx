/**
 * SessionHistoryTrigger - 会话历史悬浮触发器
 *
 * 特点：
 * - 右边缘完全贴屏幕，形成半圆效果
 * - 位置：屏幕右边垂直居中
 * - 鼠标悬停时展开会话历史面板
 * - 鼠标移出时延迟隐藏
 */

import { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Loader2 } from 'lucide-react'
import { useViewStore } from '@/stores/viewStore'

// 懒加载会话历史面板
const SessionHistoryPanel = lazy(() => import('./SessionHistoryPanel').then(m => ({ default: m.SessionHistoryPanel })))

export function SessionHistoryTrigger() {
  const { t } = useTranslation('chat')
  const showSessionHistory = useViewStore((state) => state.showSessionHistory)
  const toggleSessionHistory = useViewStore((state) => state.toggleSessionHistory)

  // 悬停状态控制
  const [isHovering, setIsHovering] = useState(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  // 悬停处理
  const handleTriggerHover = useCallback((hovering: boolean) => {
    if (hovering) {
      // 鼠标进入，取消隐藏定时器并显示
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      setIsHovering(true)
      if (!showSessionHistory) {
        toggleSessionHistory()
      }
    }
  }, [showSessionHistory, toggleSessionHistory])

  // 面板区域悬停处理
  const handlePanelHover = useCallback((hovering: boolean) => {
    if (hovering) {
      // 鼠标进入面板，取消隐藏定时器
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    } else {
      // 鼠标离开面板，延迟隐藏
      hideTimerRef.current = setTimeout(() => {
        setIsHovering(false)
        if (showSessionHistory) {
          toggleSessionHistory()
        }
      }, 200)
    }
  }, [showSessionHistory, toggleSessionHistory])

  return (
    <>
      {/* 贴边半圆悬浮触发器 */}
      <button
        onMouseEnter={() => handleTriggerHover(true)}
        onMouseLeave={() => handleTriggerHover(false)}
        className={`
          fixed z-40
          /* 贴边半圆：右半圆在屏幕外，左半圆在屏幕内 */
          w-8 h-14 -mr-4
          rounded-l-full
          flex items-center justify-start pl-1
          shadow-lg
          transition-all duration-200 ease-out
          group
          ${isHovering
            ? 'bg-primary-hover shadow-xl'
            : 'bg-primary hover:bg-primary-hover hover:shadow-xl'
          }
        `}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          right: '0'
        }}
        title={t('history.title')}
      >
        <History
          size={16}
          className={`
            text-white transition-transform duration-200
            ${isHovering ? 'rotate-12' : 'group-hover:rotate-12'}
          `}
        />
      </button>

      {/* 会话历史面板 - 悬浮展开 */}
      {showSessionHistory && (
        <div
          onMouseEnter={() => handlePanelHover(true)}
          onMouseLeave={() => handlePanelHover(false)}
          className={`
            fixed z-50
            bg-background-elevated border border-border
            rounded-l-xl shadow-xl
            animate-in slide-in-from-right duration-200
          `}
          style={{
            top: '10%',
            right: '0',
            height: '80%',
            width: '400px'
          }}
        >
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span>{t('history.loading')}</span>
              </div>
            }
          >
            <SessionHistoryPanel
              onClose={() => {
                setIsHovering(false)
                if (showSessionHistory) {
                  toggleSessionHistory()
                }
              }}
            />
          </Suspense>
        </div>
      )}
    </>
  )
}
