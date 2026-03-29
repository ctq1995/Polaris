# 阶段二：简化数据模型

> **执行次序**：第三步
> **依赖**：阶段一完成
> **产出**：精简后的 `models/scheduler.rs`

## 目标

精简 `ScheduledTask` 模型，移除冗余字段，保留核心功能。

## 变更详情

### `src-tauri/src/models/scheduler.rs`

#### 保留字段

```rust
/// 定时任务（精简版）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    /// 任务 ID
    pub id: String,
    /// 任务名称
    pub name: String,
    /// 是否启用
    pub enabled: bool,
    /// 触发类型
    pub trigger_type: TriggerType,
    /// 触发值
    pub trigger_value: String,
    /// 使用的引擎 ID
    pub engine_id: String,
    /// 提示词
    pub prompt: String,
    /// 工作目录（可选）
    pub work_dir: Option<String>,
    /// 任务描述（可选）
    pub description: Option<String>,

    // 状态字段
    /// 上次执行时间
    pub last_run_at: Option<i64>,
    /// 上次执行状态
    pub last_run_status: Option<TaskStatus>,
    /// 下次执行时间
    pub next_run_at: Option<i64>,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,

    // 工作区关联
    /// 所属工作区路径
    #[serde(default)]
    pub workspace_path: Option<String>,
    /// 所属工作区名称
    #[serde(default)]
    pub workspace_name: Option<String>,
}
```

#### 删除字段

| 字段 | 类型 | 删除原因 |
|------|------|----------|
| `mode` | TaskMode | 移除协议模式 |
| `task_path` | Option<String> | 协议模式相关 |
| `mission` | Option<String> | 协议模式相关 |
| `group` | Option<String> | 分组功能简化 |
| `max_runs` | Option<u32> | 执行轮次限制简化 |
| `current_runs` | u32 | 执行轮次限制简化 |
| `run_in_terminal` | bool | 执行方式简化 |
| `template_id` | Option<String> | 模板功能移除 |
| `template_param_values` | Option<HashMap> | 模板功能移除 |
| `subscribed_context_id` | Option<String> | 订阅功能移除 |
| `max_retries` | Option<u32> | 重试功能移除 |
| `retry_count` | u32 | 重试功能移除 |
| `retry_interval` | Option<String> | 重试功能移除 |
| `notify_on_complete` | bool | 通知功能移除 |
| `timeout_minutes` | Option<u32> | 超时功能移除 |
| `user_supplement` | Option<String> | 用户补充简化 |

#### 删除类型

```rust
// 删除以下类型定义
pub struct TaskLog { ... }              // 日志移除
pub struct LogStore { ... }             // 日志存储移除
pub struct PaginatedLogs { ... }        // 分页日志移除
pub struct LogRetentionConfig { ... }   // 日志保留配置移除
pub struct RunTaskResult { ... }        // 改为简单返回 logId
pub enum TaskMode { ... }               // 任务模式移除
```

#### 精简后的 `CreateTaskParams`

```rust
/// 创建任务参数（精简版）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskParams {
    pub name: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub trigger_type: TriggerType,
    pub trigger_value: String,
    pub engine_id: String,
    pub prompt: String,
    pub work_dir: Option<String>,
    pub description: Option<String>,
}

fn default_enabled() -> bool { true }
```

#### 保留类型

```rust
/// 触发类型（保留）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TriggerType {
    Once,
    Cron,
    Interval,
}

/// 任务状态（保留）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Running,
    Success,
    Failed,
}

/// 任务存储（简化）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskStore {
    pub tasks: Vec<ScheduledTask>,
}
```

## 前端类型同步更新

### `src/types/scheduler.ts`

```typescript
/** 触发类型 */
export type TriggerType = 'once' | 'cron' | 'interval';

/** 任务状态 */
export type TaskStatus = 'running' | 'success' | 'failed';

/** 定时任务（精简版） */
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

/** 创建任务参数（精简版） */
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

// 删除以下类型
// TaskMode, TaskLog, LogStore, PaginatedLogs, LogRetentionConfig
// ProtocolTaskFiles, RunTaskResult, LockStatus
```

## 迁移兼容

由于字段变化较大，建议：

1. **不迁移旧数据**：首次运行时创建空文件
2. **提供工具**：单独脚本迁移有效任务
3. **前端提示**：检测旧数据格式时提示用户

## 验证检查

- [ ] 编译通过
- [ ] 序列化/反序列化正确
- [ ] 前端类型与后端一致
- [ ] 旧字段缺失时不会崩溃（#[serde(default)]）

## 后续步骤

完成本阶段后，进入 [04-phase3-mcp.md](./04-phase3-mcp.md) 重构 MCP。
