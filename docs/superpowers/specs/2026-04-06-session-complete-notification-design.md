# 会话完成通知设计文档

## 概述

将现有 Toast 通知系统从右下角移至输入框上方（ChatStatusBar 右上方），并扩展支持会话完成通知，支持快速切换会话。

## 需求总结

1. **位置调整**：Toast 通知从全局右下角移至 ChatStatusBar 右上方
2. **会话完成通知**：后台会话完成时弹出通知，显示会话标题
3. **交互支持**：通知支持「切换」按钮，点击可直接跳转到该会话
4. **超时时间**：会话完成通知 2 分钟后自动消失
5. **堆叠顺序**：新通知在下方，最多显示 5 条，超出时旧的自动消失
6. **动画效果**：滑入滑出动画

## 技术设计

### 1. 数据结构扩展

**文件：`src/stores/toastStore.ts`**

```typescript
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'session_complete'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number // 毫秒，0 表示不自动关闭
  // 新增：可交互操作
  action?: {
    label: string
    onClick: () => void
  }
  // 新增：会话 ID（用于 session_complete 类型）
  sessionId?: string
}
```

**新增快捷方法：**

```typescript
sessionComplete: (title: string, sessionId: string, onSwitch: () => void) => string
```

**最大数量限制：**

```typescript
const MAX_TOASTS = 5

// 在 addToast 中添加限制逻辑
addToast: (toast) => {
  const id = `toast-${++toastId}`
  const newToast: Toast = {
    id,
    duration: 4000,
    ...toast,
  }

  set((state) => {
    const toasts = [...state.toasts, newToast]
    // 超出限制时移除最旧的
    if (toasts.length > MAX_TOASTS) {
      toasts.shift()
    }
    return { toasts }
  })

  // 自动移除逻辑...
}
```

### 2. 默认时长配置

| 通知类型 | 默认时长 |
|---------|---------|
| success | 4 秒 |
| error | 6 秒 |
| warning | 4 秒 |
| info | 4 秒 |
| session_complete | 2 分钟 (120000ms) |

### 3. 组件改动

**文件：`src/components/Common/Toast.tsx`**

#### 3.1 ToastContainer 改为相对定位容器

```tsx
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="absolute right-0 top-0 transform -translate-y-full translate-y-[-8px] z-50 flex flex-col gap-2 max-w-sm w-max">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}
```

#### 3.2 ToastItem 支持交互按钮

```tsx
const colorMap: Record<ToastType, { bg: string; border: string; icon: string }> = {
  // ... 现有配置
  session_complete: {
    bg: 'bg-success/10',
    border: 'border-success/30',
    icon: 'text-success',
  },
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const Icon = iconMap[toast.type]
  const colors = colorMap[toast.type]

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border shadow-lg',
      colors.bg, colors.border,
      'animate-slide-in-right',
      toast.type === 'session_complete' && 'min-w-[280px]'
    )}>
      <Icon size={18} className={cn('shrink-0 mt-0.5', colors.icon)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary">{toast.title}</div>
        {toast.message && (
          <div className="text-xs text-text-secondary mt-0.5">{toast.message}</div>
        )}
      </div>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            onClose()
          }}
          className="shrink-0 px-2 py-1 text-xs font-medium rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={onClose} className="shrink-0 p-1 text-text-tertiary hover:text-text-primary hover:bg-background-surface rounded transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
```

### 4. 通知触发逻辑

**文件：`src/stores/conversationStore/sessionStoreManager.ts`**

在 `dispatchEvent` 函数中，当后台会话完成时触发通知：

```typescript
if (event.type === 'session_end') {
  newStatus = 'idle'

  if (get().backgroundSessionIds.includes(routeSessionId)) {
    get().addToNotifications(routeSessionId)
    get().removeFromBackground(routeSessionId)

    // 触发 Toast 通知
    const sessionMetadata = get().sessionMetadata.get(routeSessionId)
    if (sessionMetadata) {
      useToastStore.getState().sessionComplete(
        sessionMetadata.title,
        routeSessionId,
        () => get().switchSession(routeSessionId)
      )
    }
  }
}
```

### 5. 布局改动

**文件：`src/App.tsx`**

将 ToastContainer 从全局位置移到 ChatStatusBar 上方：

```tsx
{/* 右侧 AI 对话面板 */}
<RightPanel fillRemaining={isCompact || rightPanelFillRemaining}>
  {/* 错误提示 */}
  {error && (...)}

  {/* 消息区域 */}
  <EnhancedChatMessages />

  {/* 状态栏容器（带通知） */}
  <div className="relative">
    {/* Toast 通知区域 */}
    <ToastContainer />

    {/* 对话状态栏 */}
    <ChatStatusBar />
  </div>

  {/* 输入区域 */}
  <ChatInput ... />
</RightPanel>
```

**移除底部的全局 ToastContainer：**

```tsx
{/* 删除这一行 */}
{/* <ToastContainer /> */}
```

### 6. 动画样式

**文件：`src/index.css`**（已有 `animate-slide-in-right`，确认存在即可）

```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out;
}
```

**新增滑出动画（可选，用于关闭时）：**

```css
@keyframes slide-out-right {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.animate-slide-out-right {
  animation: slide-out-right 0.15s ease-in forwards;
}
```

## 文件改动清单

| 文件 | 改动内容 |
|-----|---------|
| `src/stores/toastStore.ts` | 扩展 Toast 类型、新增 action/sessionId 字段、新增 sessionComplete 方法、添加最大数量限制 |
| `src/components/Common/Toast.tsx` | 位置改为 relative 容器内绝对定位、ToastItem 支持交互按钮、新增 session_complete 样式 |
| `src/stores/conversationStore/sessionStoreManager.ts` | 会话完成时触发 Toast 通知 |
| `src/App.tsx` | 移动 ToastContainer 到 ChatStatusBar 上方，移除底部全局 ToastContainer |
| `src/index.css` | 确认/新增滑入滑出动画 |

## 视觉效果

**普通通知：**
```
┌────────────────────────────┐
│ ✓ 操作成功           [X]  │
└────────────────────────────┘
```

**会话完成通知：**
```
┌──────────────────────────────────┐
│ ✓ 会话「分析代码」已完成 [切换] [X] │
└──────────────────────────────────┘
```

**多个通知堆叠（新的在下方）：**
```
┌──────────────────────────────────┐
│ ✓ 操作成功                [X]  │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ ✓ 会话「修复 Bug」已完成 [切换] [X] │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ ✓ 会话「分析代码」已完成 [切换] [X] │
└──────────────────────────────────┘
```

## 测试要点

1. **基本功能**：普通 Toast 通知正常显示和消失
2. **会话通知**：后台会话完成时弹出通知，显示正确标题
3. **切换功能**：点击「切换」按钮能正确跳转到对应会话
4. **超时时间**：普通通知 4 秒消失，会话通知 2 分钟消失
5. **数量限制**：超过 5 条时，最旧的自动消失
6. **堆叠顺序**：新通知在下方
7. **动画效果**：滑入滑出动画流畅
8. **关闭功能**：点击 X 按钮能关闭通知
