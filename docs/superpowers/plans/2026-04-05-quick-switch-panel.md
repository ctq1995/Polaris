# QuickSwitchPanel 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建右侧悬停触发的快速切换面板组件，用于快速切换会话和工作区

**Architecture:** 创建独立的 QuickSwitchPanel 组件，采用玻璃风格设计，通过悬停交互展开面板，复用 FloatingIsland 的会话/工作区切换逻辑，同步修改 ChatNavigator 为玻璃风格

**Tech Stack:** React, TypeScript, Tailwind CSS, Zustand, Lucide Icons

---

## 文件结构

```
src/components/QuickSwitchPanel/
├── QuickSwitchPanel.tsx      # 主组件（悬停逻辑+触发器+面板组合）
├── QuickSwitchTrigger.tsx    # 触发器子组件
├── QuickSwitchContent.tsx    # 面板内容子组件
├── types.ts                  # 类型定义
├── index.ts                  # 导出入口

修改文件:
├── src/components/Chat/ChatNavigator.tsx   # 改为玻璃风格
├── src/components/Layout/RightPanel.tsx    # 集成 QuickSwitchPanel
```

---

## Phase 1: 基础组件结构

### Task 1: 创建目录和类型定义

**Files:**
- Create: `src/components/QuickSwitchPanel/types.ts`
- Create: `src/components/QuickSwitchPanel/index.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
/**
 * QuickSwitchPanel 组件类型定义
 */

import type { SessionStatus } from '@/types/session'

/** 面板可见状态 */
export type PanelVisibility = 'hidden' | 'visible'

/** 会话项信息 */
export interface QuickSessionInfo {
  id: string
  title: string
  status: SessionStatus
  isActive: boolean
}

/** 工作区项信息 */
export interface QuickWorkspaceInfo {
  id: string
  name: string
  path: string
  isMain: boolean
  contextCount: number
}

/** QuickSwitchPanel Props */
export interface QuickSwitchPanelProps {
  /** 自定义类名 */
  className?: string
}
```

- [ ] **Step 2: 创建导出入口文件**

```typescript
/**
 * QuickSwitchPanel 导出入口
 */

export { QuickSwitchPanel } from './QuickSwitchPanel'
export type { QuickSwitchPanelProps, QuickSessionInfo, QuickWorkspaceInfo } from './types'
```

- [ ] **Step 3: 提交 Phase 1 基础文件**

```bash
git add src/components/QuickSwitchPanel/types.ts src/components/QuickSwitchPanel/index.ts
git commit -m "feat(QuickSwitchPanel): add type definitions and export entry"

# 预期: 新增 2 个文件
```

---

### Task 2: 创建触发器组件

**Files:**
- Create: `src/components/QuickSwitchPanel/QuickSwitchTrigger.tsx`

- [ ] **Step 1: 创建触发器组件骨架**

```typescript
/**
 * QuickSwitchTrigger - 快速切换触发器组件
 *
 * 右侧贴边的玻璃风格触发器，悬停时展开面板
 */

import { memo } from 'react'
import { cn } from '@/utils/cn'
import { Zap } from 'lucide-react'
import { StatusDot } from '@/components/Session/StatusDot'
import type { SessionStatus } from '@/types/session'

interface QuickSwitchTriggerProps {
  /** 当前会话状态 */
  status: SessionStatus
  /** 是否悬停中 */
  isHovering: boolean
  /** 悬停进入回调 */
  onMouseEnter: () => void
  /** 悬停离开回调 */
  onMouseLeave: () => void
}

export const QuickSwitchTrigger = memo(function QuickSwitchTrigger({
  status,
  isHovering,
  onMouseEnter,
  onMouseLeave,
}: QuickSwitchTriggerProps) {
  return (
    <div
      className={cn(
        // 位置：右侧贴边
        'absolute right-0 top-[100px]',
        // 尺寸：32x44px
        'w-8 h-11',
        // 玻璃风格
        'bg-background-elevated/85 backdrop-blur-xl',
        // 边框：左圆角贴边设计
        'border border-border/50 border-r-0 rounded-l-xl',
        // 阴影
        'shadow-lg shadow-black/5',
        // 内容布局
        'flex flex-col items-center justify-center gap-1',
        // 交互
        'cursor-pointer transition-all duration-150',
        // 悬停状态
        isHovering && 'bg-background-elevated/95 shadow-xl shadow-black/10'
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 状态指示点 */}
      <StatusDot status={status} size="sm" />

      {/* 快捷图标 */}
      <Zap className="w-3.5 h-3.5 text-text-muted" />
    </div>
  )
})
```

- [ ] **Step 2: 提交触发器组件**

```bash
git add src/components/QuickSwitchPanel/QuickSwitchTrigger.tsx
git commit -m "feat(QuickSwitchPanel): add QuickSwitchTrigger component with glass style"

# 预期: 新增触发器组件文件
```

---

### Task 3: 创建面板内容组件

**Files:**
- Create: `src/components/QuickSwitchPanel/QuickSwitchContent.tsx`

- [ ] **Step 1: 创建面板内容组件骨架**

```typescript
/**
 * QuickSwitchContent - 快速切换面板内容组件
 *
 * 展示会话列表、工作区信息和新建会话按钮
 */

import { memo, useCallback } from 'react'
import { cn } from '@/utils/cn'
import { Plus, FolderOpen, Loader2 } from 'lucide-react'
import { StatusDot } from '@/components/Session/StatusDot'
import type { QuickSessionInfo, QuickWorkspaceInfo } from './types'

interface QuickSwitchContentProps {
  /** 会话列表 */
  sessions: QuickSessionInfo[]
  /** 当前工作区信息 */
  workspace: QuickWorkspaceInfo | null
  /** 切换会话回调 */
  onSwitchSession: (sessionId: string) => void
  /** 新建会话回调 */
  onCreateSession: () => void
  /** 悬停进入回调 */
  onMouseEnter: () => void
  /** 悬停离开回调 */
  onMouseLeave: () => void
}

export const QuickSwitchContent = memo(function QuickSwitchContent({
  sessions,
  workspace,
  onSwitchSession,
  onCreateSession,
  onMouseEnter,
  onMouseLeave,
}: QuickSwitchContentProps) {
  // 获取当前活跃会话
  const activeSession = sessions.find(s => s.isActive)

  return (
    <div
      className={cn(
        // 位置：触发器左侧
        'absolute right-8 -top-2',
        // 尺寸：240px宽
        'w-60',
        // 玻璃风格
        'bg-background-elevated/95 backdrop-blur-2xl',
        // 边框和圆角
        'border border-border/50 rounded-2xl',
        // 阴影
        'shadow-xl shadow-black/10',
        // 入场动画
        'animate-in fade-in-0 zoom-in-95 duration-150',
        // 内容布局
        'overflow-hidden'
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header: 当前状态 */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          {activeSession && (
            <>
              <StatusDot status={activeSession.status} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {activeSession.title}
                </div>
                <div className="text-xs text-text-tertiary">
                  {getStatusLabel(activeSession.status)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sessions: 会话列表 */}
      <div className="px-4 py-2">
        <div className="text-xs text-text-tertiary uppercase tracking-wide mb-2">
          会话
        </div>

        <div className="space-y-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSwitchSession(session.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
                'text-sm transition-colors',
                session.isActive
                  ? 'bg-primary/10 border-l-2 border-l-primary text-primary'
                  : 'hover:bg-background-hover text-text-secondary'
              )}
            >
              <StatusDot status={session.status} size="sm" />
              <span className="truncate">{session.title}</span>
              {session.status === 'running' && (
                <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />
              )}
              {session.isActive && (
                <span className="text-xs text-primary ml-auto">当前</span>
              )}
            </button>
          ))}
        </div>

        {/* 新建会话按钮 */}
        <button
          onClick={onCreateSession}
          className={cn(
            'w-full mt-2 px-3 py-2 rounded-lg',
            'border border-dashed border-border-subtle',
            'text-xs text-text-tertiary',
            'hover:bg-background-hover hover:text-text-secondary',
            'transition-colors'
          )}
        >
          <Plus className="w-3 h-3 inline mr-1" />
          新建会话
        </button>
      </div>

      {/* Workspace: 工作区信息 */}
      {workspace && (
        <div className="px-4 py-2 border-t border-border-subtle">
          <div className="text-xs text-text-tertiary uppercase tracking-wide mb-2">
            工作区
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5">
            <FolderOpen className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-sm truncate">{workspace.name}</span>
            {workspace.contextCount > 0 && (
              <span className="text-xs bg-primary text-white px-1.5 rounded">
                +{workspace.contextCount}
              </span>
            )}
            <span className="text-xs text-text-tertiary ml-auto">主工作区</span>
          </div>
        </div>
      )}
    </div>
  )
})

// 状态标签映射
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: '空闲',
    running: '运行中',
    waiting: '等待输入',
    error: '错误',
    'background-running': '后台运行',
  }
  return labels[status] || '未知'
}
```

- [ ] **Step 2: 提交面板内容组件**

```bash
git add src/components/QuickSwitchPanel/QuickSwitchContent.tsx
git commit -m "feat(QuickSwitchPanel): add QuickSwitchContent component with session/workspace display"

# 预期: 新增面板内容组件文件
```

---

### Task 4: 创建主组件并实现悬停逻辑

**Files:**
- Create: `src/components/QuickSwitchPanel/QuickSwitchPanel.tsx`

- [ ] **Step 1: 创建主组件骨架**

```typescript
/**
 * QuickSwitchPanel - 快速切换面板主组件
 *
 * 右侧悬停触发的会话/工作区快速切换面板
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { QuickSwitchTrigger } from './QuickSwitchTrigger'
import { QuickSwitchContent } from './QuickSwitchContent'
import type { QuickSwitchPanelProps, QuickSessionInfo, QuickWorkspaceInfo } from './types'
import type { SessionStatus } from '@/types/session'
import {
  useSessionMetadataList,
  useActiveSessionId,
  useSessionManagerActions,
} from '@/stores/conversationStore/sessionStoreManager'
import { useWorkspaceStore } from '@/stores/workspaceStore'

/** 展开延迟（毫秒） */
const SHOW_DELAY = 0

/** 关闭延迟（毫秒） */
const HIDE_DELAY = 150

export const QuickSwitchPanel = memo(function QuickSwitchPanel({
  className,
}: QuickSwitchPanelProps) {
  // 面板可见状态
  const [isPanelVisible, setIsPanelVisible] = useState(false)

  // 使用 ref 管理悬停状态，避免闭包陷阱
  const isHoveringTriggerRef = useRef(false)
  const isHoveringPanelRef = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 会话数据
  const sessions = useSessionMetadataList()
  const activeSessionId = useActiveSessionId()
  const { createSession, switchSession } = useSessionManagerActions()

  // 工作区数据
  const workspaces = useWorkspaceStore((state) => state.workspaces)
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId)

  // 清除所有定时器
  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
  }, [])

  // 显示面板（带延迟）
  const scheduleShow = useCallback(() => {
    clearTimers()
    showTimerRef.current = setTimeout(() => {
      setIsPanelVisible(true)
    }, SHOW_DELAY)
  }, [clearTimers])

  // 隐藏面板（带延迟）
  const scheduleHide = useCallback(() => {
    clearTimers()
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveringTriggerRef.current && !isHoveringPanelRef.current) {
        setIsPanelVisible(false)
      }
    }, HIDE_DELAY)
  }, [clearTimers])

  // 组件卸载时清理
  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  // 触发器悬停处理
  const handleTriggerMouseEnter = useCallback(() => {
    isHoveringTriggerRef.current = true
    scheduleShow()
  }, [scheduleShow])

  const handleTriggerMouseLeave = useCallback(() => {
    isHoveringTriggerRef.current = false
    scheduleHide()
  }, [scheduleHide])

  // 面板悬停处理
  const handlePanelMouseEnter = useCallback(() => {
    isHoveringPanelRef.current = true
    clearTimers()
  }, [clearTimers])

  const handlePanelMouseLeave = useCallback(() => {
    isHoveringPanelRef.current = false
    scheduleHide()
  }, [scheduleHide])

  // 会话切换
  const handleSwitchSession = useCallback((sessionId: string) => {
    switchSession(sessionId)
    // 切换后保持面板展开，用户可能需要连续切换
  }, [switchSession])

  // 新建会话
  const handleCreateSession = useCallback(() => {
    createSession({
      type: 'free',
      workspaceId: currentWorkspaceId || undefined,
    })
  }, [createSession, currentWorkspaceId])

  // 计算会话列表数据
  const sessionList = useMemo<QuickSessionInfo[]>(() => {
    // 过滤静默会话
    const visibleSessions = sessions.filter(s => !s.silentMode)
    return visibleSessions.map(session => ({
      id: session.id,
      title: session.title,
      status: mapSessionStatus(session.status),
      isActive: session.id === activeSessionId,
    }))
  }, [sessions, activeSessionId])

  // 计算工作区数据
  const workspaceInfo = useMemo<QuickWorkspaceInfo | null>(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId)
    if (!activeSession?.workspaceId) return null
    const workspace = workspaces.find(w => w.id === activeSession.workspaceId)
    if (!workspace) return null
    return {
      id: workspace.id,
      name: workspace.name,
      path: workspace.path,
      isMain: true,
      contextCount: activeSession.contextWorkspaceIds?.length || 0,
    }
  }, [sessions, activeSessionId, workspaces])

  // 获取当前会话状态
  const currentStatus = useMemo<SessionStatus>(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId)
    return activeSession ? mapSessionStatus(activeSession.status) : 'idle'
  }, [sessions, activeSessionId])

  // 无会话时不显示
  if (sessions.length === 0) {
    return null
  }

  return (
    <div className={cn('absolute right-0 top-0 bottom-0 pointer-events-none', className)}>
      {/* 触发器 */}
      <div className="pointer-events-auto">
        <QuickSwitchTrigger
          status={currentStatus}
          isHovering={isPanelVisible}
          onMouseEnter={handleTriggerMouseEnter}
          onMouseLeave={handleTriggerMouseLeave}
        />
      </div>

      {/* 面板 */}
      {isPanelVisible && (
        <div className="pointer-events-auto">
          <QuickSwitchContent
            sessions={sessionList}
            workspace={workspaceInfo}
            onSwitchSession={handleSwitchSession}
            onCreateSession={handleCreateSession}
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
          />
        </div>
      )}
    </div>
  )
})

// 会话状态映射
function mapSessionStatus(status: string): SessionStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'waiting':
      return 'waiting'
    case 'error':
      return 'error'
    case 'background-running':
      return 'background-running'
    default:
      return 'idle'
  }
}
```

- [ ] **Step 2: 提交主组件**

```bash
git add src/components/QuickSwitchPanel/QuickSwitchPanel.tsx
git commit -m "feat(QuickSwitchPanel): add main component with hover interaction logic"

# 预期: 新增主组件文件，包含完整的悬停交互逻辑
```

---

## Phase 2: 集成到 RightPanel

### Task 5: 在 RightPanel 中集成 QuickSwitchPanel

**Files:**
- Modify: `src/components/Layout/RightPanel.tsx`

- [ ] **Step 1: 导入并添加 QuickSwitchPanel**

修改 `src/components/Layout/RightPanel.tsx`：

```typescript
// 在文件顶部添加导入
import { QuickSwitchPanel } from '../QuickSwitchPanel'

// 在 fillRemaining 模式的 aside 中添加（第 44 行后）：
<aside className="flex flex-col flex-1 bg-background-elevated border-l border-border min-w-[200px] relative">
  {/* 悬浮岛 */}
  <FloatingIsland />
  {/* 快速切换面板 */}
  <QuickSwitchPanel />
  {/* 内容区域 */}
  <div className="flex-1 flex flex-col">
    {children}
  </div>
</aside>

// 在固定宽度模式的 aside 中添加（第 62 行后）：
<aside
  className="flex flex-col bg-background-elevated border-l border-border shrink-0 relative"
  style={{ width: `${width}px` }}
>
  {/* 悬浮岛 */}
  <FloatingIsland />
  {/* 快速切换面板 */}
  <QuickSwitchPanel />
  {/* 内容区域 */}
  <div className="flex-1 flex flex-col">
    {children}
  </div>
</aside>
```

完整修改后的文件：

```typescript
/**
 * RightPanel - 右侧 AI 对话面板组件
 */

import { ReactNode } from 'react'
import { useViewStore } from '@/stores/viewStore'
import { ResizeHandle } from '../Common'
import { FloatingIsland } from '../FloatingIsland'
import { QuickSwitchPanel } from '../QuickSwitchPanel'

interface RightPanelProps {
  children: ReactNode
  /** 是否填充剩余空间（当中间区域为空时） */
  fillRemaining?: boolean
}

/**
 * 右侧面板组件
 * 支持折叠（完全隐藏）和任意宽度调整
 * 当 fillRemaining 为 true 时，自动扩展填充剩余空间
 */
export function RightPanel({ children, fillRemaining = false }: RightPanelProps) {
  const width = useViewStore((state) => state.rightPanelWidth)
  const setWidth = useViewStore((state) => state.setRightPanelWidth)
  const collapsed = useViewStore((state) => state.rightPanelCollapsed)

  // 折叠状态：不渲染面板
  if (collapsed) {
    return null
  }

  // 拖拽处理 - 调整宽度，支持更灵活的范围
  const handleResize = (delta: number) => {
    const newWidth = Math.max(200, Math.min(1200, width + delta))
    setWidth(newWidth)
  }

  // 填充模式：使用 flex-1 自动扩展，不显示拖拽手柄
  if (fillRemaining) {
    return (
      <aside className="flex flex-col flex-1 bg-background-elevated border-l border-border min-w-[200px] relative">
        {/* 悬浮岛 */}
        <FloatingIsland />
        {/* 快速切换面板 */}
        <QuickSwitchPanel />
        {/* 内容区域 */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </aside>
    )
  }

  return (
    <>
      {/* 拖拽手柄 */}
      <ResizeHandle direction="horizontal" position="left" onDrag={handleResize} />

      {/* 面板容器 - 使用固定宽度 */}
      <aside
        className="flex flex-col bg-background-elevated border-l border-border shrink-0 relative"
        style={{ width: `${width}px` }}
      >
        {/* 悬浮岛 */}
        <FloatingIsland />
        {/* 快速切换面板 */}
        <QuickSwitchPanel />
        {/* 内容区域 */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </aside>
    </>
  )
}
```

- [ ] **Step 2: 提交集成修改**

```bash
git add src/components/Layout/RightPanel.tsx
git commit -m "feat(RightPanel): integrate QuickSwitchPanel component"

# 预期: RightPanel.tsx 新增 QuickSwitchPanel 导入和渲染
```

---

## Phase 3: 修改 ChatNavigator 为玻璃风格

### Task 6: 修改 ChatNavigator 悬浮球样式

**Files:**
- Modify: `src/components/Chat/ChatNavigator.tsx:147-185`

- [ ] **Step 1: 修改悬浮球的 className**

将 `src/components/Chat/ChatNavigator.tsx` 第 147-185 行的悬浮球部分改为玻璃风格：

```tsx
// 替换原来的悬浮球 div（第 147-185 行）
{/* 贴边玻璃风格悬浮球 - 固定在右边缘 */}
<div
  className={clsx(
    'fixed right-0 top-1/2 -translate-y-1/2',
    // 尺寸：28x48px，贴边设计
    'w-7 h-12 -mr-3',
    // 玻璃风格（替换原来的蓝色）
    'rounded-l-xl',
    'bg-background-elevated/85 backdrop-blur-xl',
    'border border-border/50 border-r-0',
    'shadow-lg shadow-black/5',
    // 内容布局
    'flex items-center justify-center',
    // 交互
    'cursor-pointer transition-all duration-150',
    'group',
    // 悬停状态
    isPanelVisible
      ? 'bg-background-elevated/95 shadow-xl'
      : 'hover:bg-background-elevated/95 hover:shadow-xl'
  )}
  onMouseEnter={handleFloatingBallMouseEnter}
  onMouseLeave={handleFloatingBallMouseLeave}
  title={t('navigator.title')}
>
  {/* 三横线图标（改为灰色） */}
  <div className={clsx(
    'w-4 h-4 flex flex-col items-center justify-center gap-0.5',
    'transition-transform duration-200',
    isPanelVisible ? 'rotate-45' : 'group-hover:scale-110'
  )}>
    <div className={clsx(
      'w-3 h-0.5 bg-text-muted rounded-full transition-all duration-200',
      isPanelVisible ? 'rotate-90 absolute' : ''
    )} />
    <div className={clsx(
      'w-3 h-0.5 bg-text-muted rounded-full transition-all duration-200',
      isPanelVisible ? 'opacity-0' : ''
    )} />
    <div className={clsx(
      'w-3 h-0.5 bg-text-muted rounded-full transition-all duration-200',
      isPanelVisible ? '-rotate-90 absolute' : ''
    )} />
  </div>
</div>
```

- [ ] **Step 2: 提交样式修改**

```bash
git add src/components/Chat/ChatNavigator.tsx
git commit -m "style(ChatNavigator): change floating ball to glass style"

# 预期: ChatNavigator 悬浮球从蓝色改为玻璃风格
```

---

## Phase 4: 测试与验证

### Task 7: 运行构建验证

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
cd D:/space/base/Polaris && npx tsc --noEmit

# 预期: 无类型错误
```

- [ ] **Step 2: 运行开发服务器**

```bash
cd D:/space/base/Polaris && npm run dev

# 预期: 开发服务器启动成功
```

- [ ] **Step 3: 手动验证功能**

在浏览器中验证：
1. QuickSwitchPanel 触发器显示在右侧
2. 悬停触发器立即展开面板
3. 鼠标移动到面板内保持展开
4. 离开后 150ms 延迟关闭
5. 点击会话项可以切换会话
6. 点击新建按钮可以新建会话
7. ChatNavigator 悬浮球改为玻璃风格
8. 两个触发器位置不重叠（QuickSwitch 在上方，ChatNavigator 在下方）

- [ ] **Step 4: 提交最终验证**

```bash
git status
# 确认所有更改已提交
```

---

## 验收标准检查

- [ ] 1. 悬停触发器立即展开面板（SHOW_DELAY = 0）
- [ ] 2. 鼠标移动到面板内保持展开（isHoveringPanelRef 机制）
- [ ] 3. 离开后 150ms 延迟关闭（HIDE_DELAY = 150）
- [ ] 4. 会话切换功能正常工作（switchSession 调用）
- [ ] 5. 新建会话功能正常工作（createSession 调用）
- [ ] 6. 与对话导航位置不重叠（top: 100px vs bottom 居中）
- [ ] 7. 玻璃风格视觉效果统一（bg-background-elevated/85 + backdrop-blur）
- [ ] 8. 保留悬浮岛功能正常（FloatingIsland 仍在 RightPanel 中）

---

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/QuickSwitchPanel/types.ts` | 新建 | 类型定义 |
| `src/components/QuickSwitchPanel/index.ts` | 新建 | 导出入口 |
| `src/components/QuickSwitchPanel/QuickSwitchTrigger.tsx` | 新建 | 触发器组件 |
| `src/components/QuickSwitchPanel/QuickSwitchContent.tsx` | 新建 | 面板内容组件 |
| `src/components/QuickSwitchPanel/QuickSwitchPanel.tsx` | 新建 | 主组件 |
| `src/components/Layout/RightPanel.tsx` | 修改 | 集成 QuickSwitchPanel |
| `src/components/Chat/ChatNavigator.tsx` | 修改 | 玻璃风格悬浮球 |