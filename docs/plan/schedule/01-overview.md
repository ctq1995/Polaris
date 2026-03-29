# 阶段零：问题分析与重构目标

## 当前问题

### 1. 存储路径混乱

| 组件 | 存储路径 | 问题 |
|------|----------|------|
| MCP（scheduler_repository.rs） | `workspace/.polaris/scheduler/` | 工作区范围，不一致 |
| 前端 Tauri（store.rs） | `config_dir/claude-code-pro/` | 全局但路径错误 |
| 待办（已重构） | `config_dir/todo/` | ✅ 正确 |
| 需求（已重构） | `config_dir/requirements/` | ✅ 正确 |

### 2. 功能过度复杂

| 功能 | 当前状态 | 问题 |
|------|----------|------|
| 任务模式 | simple + protocol 双模式 | 协议模式复杂，生成大量文件 |
| 日志系统 | TaskLog + LogStore + 分页 + 清理 | 重构优先级低 |
| 模板管理 | templateId + templateParamValues | 增加复杂度 |
| 订阅机制 | subscribedContextId + 实时事件 | 实现复杂 |
| 重试机制 | maxRetries + retryCount + retryInterval | 可在执行层处理 |
| 超时配置 | timeoutMinutes | 可在执行层处理 |
| 通知配置 | notifyOnComplete | 可在执行层处理 |

### 3. MCP 实现问题

- 参数格式：仅接收 workspace_path，未传递 config_dir
- 路径问题：存储在工作区而非全局配置目录
- 与待办/需求 MCP 不一致

## 重构目标

### 存储架构

```
config_dir/
├── todo/
│   └── todos.json
├── requirements/
│   ├── requirements.json
│   └── prototypes/
└── scheduler/
    └── tasks.json          # 新增
```

### 精简后的任务模型

```rust
pub struct ScheduledTask {
    // 基础字段
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub trigger_type: TriggerType,      // once | cron | interval
    pub trigger_value: String,
    pub engine_id: String,
    pub prompt: String,
    pub work_dir: Option<String>,
    pub description: Option<String>,

    // 状态字段
    pub last_run_at: Option<i64>,
    pub last_run_status: Option<TaskStatus>,
    pub next_run_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,

    // 工作区关联
    pub workspace_path: Option<String>,
    pub workspace_name: Option<String>,
}
```

### 移除项清单

| 类别 | 移除项 | 涉及文件 |
|------|--------|----------|
| 日志 | TaskLog, LogStore, LogRetentionConfig, PaginatedLogs | models/scheduler.rs, scheduler_repository.rs, store.rs |
| 模式 | TaskMode, protocol 相关逻辑 | models/scheduler.rs, protocol_task.rs, dispatcher.rs |
| 模板 | templateId, templateParamValues | models/scheduler.rs, store.rs |
| 订阅 | subscribedContextId, SubscriptionSession | models/scheduler.rs, store.rs, schedulerStore.ts |
| 重试 | maxRetries, retryCount, retryInterval | models/scheduler.rs |
| 超时 | timeoutMinutes | models/scheduler.rs |
| 通知 | notifyOnComplete | models/scheduler.rs |
| 执行 | runInTerminal, userSupplement | models/scheduler.rs |
| 其他 | mission, taskPath, maxRuns, currentRuns | models/scheduler.rs |

## 文件变更清单

### 新增文件

| 文件 | 用途 |
|------|------|
| `src-tauri/src/services/unified_scheduler_repository.rs` | 统一调度仓库 |
| `src-tauri/src/commands/scheduler.rs` | Tauri 命令层（重写） |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src-tauri/src/models/scheduler.rs` | 精简数据模型 |
| `src-tauri/src/services/scheduler_mcp_server.rs` | 使用统一仓库 |
| `src-tauri/src/bin/polaris_scheduler_mcp.rs` | 更新参数格式 |
| `src-tauri/src/services/mcp_config_service.rs` | 更新参数传递 |
| `src/types/scheduler.ts` | 精简类型定义 |
| `src/stores/schedulerStore.ts` | 简化状态管理 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src-tauri/src/services/scheduler_repository.rs` | 被 unified_scheduler_repository.rs 替代 |
| `src-tauri/src/services/scheduler/store.rs` | 合并到统一仓库 |
| `src-tauri/src/services/scheduler/dispatcher.rs` | 日志相关代码删除 |
| `src-tauri/src/services/scheduler/protocol_task.rs` | 协议模式移除 |

## 执行检查点

- [ ] 阶段一完成：统一存储架构，MCP 可用
- [ ] 阶段二完成：数据模型精简，编译通过
- [ ] 阶段三完成：MCP 重构，测试通过
- [ ] 阶段四完成：前端简化，功能可用
- [ ] 阶段五完成：清理删除，无冗余代码
