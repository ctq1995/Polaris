# 阶段四：简化前端

> **执行次序**：第五步
> **依赖**：阶段一、二、三完成
> **产出**：简化的前端组件和状态管理

## 目标

简化前端代码，移除日志、订阅、协议模式相关逻辑。

## 文件变更

### 1. `src/types/scheduler.ts`

**删除类型**：
```typescript
// 删除
export type TaskMode = 'simple' | 'protocol';
export interface TaskLog { ... }
export interface PaginatedLogs { ... }
export interface LogRetentionConfig { ... }
export interface ProtocolTaskFiles { ... }
export interface RunTaskResult { ... }
export interface LockStatus { ... }
export interface LogStats { ... }

export const TaskModeLabels = { ... }
export const IntervalUnitLabels = { ... }
export function parseIntervalValue() { ... }
export function formatIntervalValue() { ... }
```

**保留类型**：
```typescript
export type TriggerType = 'once' | 'cron' | 'interval';
export type TaskStatus = 'running' | 'success' | 'failed';

export interface ScheduledTask {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: TriggerType;
  triggerValue: string;
  engineId: string;
  prompt: string;
  workDir?: string;
  description?: string;
  lastRunAt?: number;
  lastRunStatus?: TaskStatus;
  nextRunAt?: number;
  createdAt: number;
  updatedAt: number;
  workspacePath?: string;
  workspaceName?: string;
}

export interface CreateTaskParams {
  name: string;
  enabled?: boolean;
  triggerType: TriggerType;
  triggerValue: string;
  engineId: string;
  prompt: string;
  workDir?: string;
  description?: string;
}

export const TriggerTypeLabels: Record<TriggerType, string> = {
  once: '单次执行',
  cron: 'Cron 表达式',
  interval: '间隔执行',
};
```

### 2. `src/stores/schedulerStore.ts`

**删除状态**：
```typescript
// 删除
logs: TaskLog[];
logPagination: LogPagination;
logFilterTaskId: string | undefined;
subscribingTaskId: string | null;
subscribingTaskName: string | null;
subscriptionSessions: Record<string, SubscriptionSession>;
activeSubscriptionId: string | null;
isPanelCollapsed: boolean;
```

**删除方法**：
```typescript
// 删除
loadLogs()
loadLogsPaginated()
runTaskWithSubscription()
subscribeTask()
unsubscribeTask()
cleanupLogs()
clearSubscription()
initSchedulerEventListener()
startSubscriptionSession()
addSubscriptionLog()
updateSubscriptionStatus()
setActiveSubscription()
togglePanelCollapse()
stopSubscription()
clearSubscriptionSession()
```

**精简后**：
```typescript
import { create } from 'zustand';
import type { ScheduledTask, CreateTaskParams, TriggerType } from '../types/scheduler';

interface SchedulerState {
  tasks: ScheduledTask[];
  loading: boolean;
  error: string | null;

  loadTasks: () => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<ScheduledTask>;
  updateTask: (task: ScheduledTask) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string, enabled: boolean) => Promise<void>;
  runTask: (id: string) => Promise<void>;
  validateTrigger: (type: TriggerType, value: string) => Promise<number | null>;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  loadTasks: async () => {
    set({ loading: true, error: null });
    try {
      const tasks = await invoke<ScheduledTask[]>('scheduler_list_tasks', {
        params: { workspacePath: getCurrentWorkspacePath() }
      });
      set({ tasks, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  createTask: async (params) => {
    const task = await invoke<ScheduledTask>('scheduler_create_task', {
      params: { ...params, workspacePath: getCurrentWorkspacePath() }
    });
    set(state => ({ tasks: [...state.tasks, task] }));
    return task;
  },

  updateTask: async (task) => {
    await invoke('scheduler_update_task', {
      params: { ...task, workspacePath: getCurrentWorkspacePath() }
    });
    set(state => ({
      tasks: state.tasks.map(t => t.id === task.id ? task : t)
    }));
  },

  deleteTask: async (id) => {
    await invoke('scheduler_delete_task', {
      params: { id, workspacePath: getCurrentWorkspacePath() }
    });
    set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }));
  },

  toggleTask: async (id, enabled) => {
    await invoke('scheduler_toggle_task', {
      params: { id, enabled, workspacePath: getCurrentWorkspacePath() }
    });
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, enabled } : t)
    }));
  },

  runTask: async (id) => {
    await invoke('scheduler_run_task', { id });
  },

  validateTrigger: async (type, value) => {
    return await invoke<number | null>('scheduler_validate_trigger', { type, value });
  },
}));
```

### 3. 删除组件

```
src/components/Scheduler/
├── TaskLogList.tsx          # 删除
├── LogRetentionSettings.tsx # 删除
├── SubscriptionChatPanel.tsx # 删除
├── ProtocolTaskEditor.tsx   # 删除
├── TaskModeSelector.tsx     # 删除
└── TaskForm.tsx             # 简化
```

### 4. 简化 `TaskForm.tsx`

移除字段：
- 模式选择（TaskMode）
- 任务目标（mission）
- 模板选择（templateId）
- 最大轮次（maxRuns）
- 重试配置（maxRetries, retryInterval）
- 超时配置（timeoutMinutes）
- 通知配置（notifyOnComplete）
- 终端执行（runInTerminal）

保留字段：
- 名称、描述
- 触发类型、触发值
- 引擎选择
- 提示词
- 工作目录

## 前端调用 Tauri 命令

| 命令 | 功能 | 参数 |
|------|------|------|
| `scheduler_list_tasks` | 列出任务 | `{ workspacePath }` |
| `scheduler_create_task` | 创建任务 | `{ ...params, workspacePath }` |
| `scheduler_update_task` | 更新任务 | `{ ...task, workspacePath }` |
| `scheduler_delete_task` | 删除任务 | `{ id, workspacePath }` |
| `scheduler_toggle_task` | 切换启用 | `{ id, enabled, workspacePath }` |
| `scheduler_run_task` | 执行任务 | `{ id }` |
| `scheduler_validate_trigger` | 验证触发器 | `{ type, value }` |

## 验证检查

- [ ] 任务列表显示正常
- [ ] 创建任务成功
- [ ] 编辑任务成功
- [ ] 删除任务成功
- [ ] 切换启用状态成功
- [ ] 立即执行成功
- [ ] 无编译错误
- [ ] 无运行时错误

## 后续步骤

完成本阶段后，进入 [06-phase5-cleanup.md](./06-phase5-cleanup.md) 清理删除。
