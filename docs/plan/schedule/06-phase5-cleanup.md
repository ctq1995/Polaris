# 阶段五：清理删除

> **执行次序**：第六步
> **依赖**：阶段一至四完成
> **产出**：干净的代码库

## 目标

删除冗余文件和代码，更新测试用例，确保构建通过。

## 删除文件清单

### 后端文件

| 文件 | 删除原因 |
|------|----------|
| `src-tauri/src/services/scheduler_repository.rs` | 被 unified_scheduler_repository.rs 替代 |
| `src-tauri/src/services/scheduler/store.rs` | 日志存储移除，任务存储合并 |
| `src-tauri/src/services/scheduler/dispatcher.rs` | 日志分发移除 |
| `src-tauri/src/services/scheduler/protocol_task.rs` | 协议模式移除 |

### 前端文件

| 文件 | 删除原因 |
|------|----------|
| `src/components/Scheduler/TaskLogList.tsx` | 日志功能移除 |
| `src/components/Scheduler/LogRetentionSettings.tsx` | 日志配置移除 |
| `src/components/Scheduler/SubscriptionChatPanel.tsx` | 订阅功能移除 |
| `src/components/Scheduler/ProtocolTaskEditor.tsx` | 协议模式移除 |
| `src/components/Scheduler/TaskModeSelector.tsx` | 模式选择移除 |

## 修改文件清单

### `src-tauri/src/services/mod.rs`

```rust
// 删除
pub mod scheduler_repository;

// 保留
pub mod scheduler_mcp_server;
pub mod unified_scheduler_repository;  // 新增
```

### `src-tauri/src/services/scheduler/mod.rs`

```rust
// 精简后
mod protocol_task;  // 删除
mod dispatcher;     // 删除
mod store;          // 删除

// 不再需要任何导出，考虑删除整个 scheduler/ 目录
```

### `src-tauri/src/commands/scheduler.rs`

重写为简单命令层：

```rust
//! Scheduler Tauri Commands

use crate::error::Result;
use crate::models::scheduler::{CreateTaskParams, ScheduledTask, TriggerType};
use crate::services::unified_scheduler_repository::UnifiedSchedulerRepository;
use tauri::AppHandle;
use std::path::PathBuf;

#[tauri::command]
pub async fn scheduler_list_tasks(
    workspace_path: Option<String>,
    app: AppHandle,
) -> Result<Vec<ScheduledTask>> {
    let config_dir = get_config_dir(&app)?;
    let workspace_path = workspace_path.filter(|p| !p.trim().is_empty()).map(PathBuf::from);

    let repository = UnifiedSchedulerRepository::new(config_dir, workspace_path);
    repository.list_tasks()
}

#[tauri::command]
pub async fn scheduler_create_task(
    params: CreateTaskParams,
    workspace_path: Option<String>,
    app: AppHandle,
) -> Result<ScheduledTask> {
    let config_dir = get_config_dir(&app)?;
    let workspace_path = workspace_path.filter(|p| !p.trim().is_empty()).map(PathBuf::from);

    let repository = UnifiedSchedulerRepository::new(config_dir, workspace_path);
    repository.create_task(params)
}

#[tauri::command]
pub async fn scheduler_update_task(
    task: ScheduledTask,
    workspace_path: Option<String>,
    app: AppHandle,
) -> Result<ScheduledTask> {
    let config_dir = get_config_dir(&app)?;
    let workspace_path = workspace_path.filter(|p| !p.trim().is_empty()).map(PathBuf::from);

    let repository = UnifiedSchedulerRepository::new(config_dir, workspace_path);
    repository.update_task(&task.id, task.into())
}

#[tauri::command]
pub async fn scheduler_delete_task(
    id: String,
    workspace_path: Option<String>,
    app: AppHandle,
) -> Result<ScheduledTask> {
    let config_dir = get_config_dir(&app)?;
    let workspace_path = workspace_path.filter(|p| !p.trim().is_empty()).map(PathBuf::from);

    let repository = UnifiedSchedulerRepository::new(config_dir, workspace_path);
    repository.delete_task(&id)
}

#[tauri::command]
pub async fn scheduler_toggle_task(
    id: String,
    enabled: bool,
    workspace_path: Option<String>,
    app: AppHandle,
) -> Result<ScheduledTask> {
    let config_dir = get_config_dir(&app)?;
    let workspace_path = workspace_path.filter(|p| !p.trim().is_empty()).map(PathBuf::from);

    let repository = UnifiedSchedulerRepository::new(config_dir, workspace_path);
    repository.update_task(&id, TaskUpdateParams { enabled: Some(enabled), ..Default::default() })
}

#[tauri::command]
pub async fn scheduler_run_task(
    id: String,
    app: AppHandle,
) -> Result<()> {
    // 执行任务逻辑（简化版）
    // 更新 last_run_at, last_run_status, next_run_at
    Ok(())
}

#[tauri::command]
pub async fn scheduler_validate_trigger(
    trigger_type: TriggerType,
    trigger_value: String,
) -> Result<Option<i64>> {
    let now = chrono::Utc::now().timestamp();
    Ok(trigger_type.calculate_next_run(&trigger_value, now))
}

fn get_config_dir(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .app_config_dir()
        .map_err(|e| crate::error::AppError::ProcessError(format!("获取配置目录失败: {}", e)))
}
```

### `src-tauri/src/lib.rs`

更新命令注册：

```rust
// 删除旧命令
// scheduler_get_tasks, scheduler_get_task_logs, scheduler_cleanup_logs, etc.

// 注册新命令
.invoke_handler(tauri::generate_handler![
    // ... 其他命令
    scheduler_list_tasks,
    scheduler_create_task,
    scheduler_update_task,
    scheduler_delete_task,
    scheduler_toggle_task,
    scheduler_run_task,
    scheduler_validate_trigger,
])
```

## 更新测试

### `src-tauri/src/services/unified_scheduler_repository.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("polaris-scheduler-{}-{}", name, Uuid::new_v4()))
    }

    #[test]
    fn creates_and_lists_tasks() {
        let config_dir = temp_dir("config");
        let workspace = temp_dir("workspace");
        std::fs::create_dir_all(&config_dir).unwrap();
        std::fs::create_dir_all(&workspace).unwrap();

        let repo = UnifiedSchedulerRepository::new(config_dir.clone(), Some(workspace.clone()));
        repo.register_workspace().unwrap();

        let task = repo.create_task(CreateTaskParams {
            name: "测试任务".to_string(),
            enabled: true,
            trigger_type: TriggerType::Interval,
            trigger_value: "1h".to_string(),
            engine_id: "claude-code".to_string(),
            prompt: "测试提示词".to_string(),
            work_dir: None,
            description: None,
        }).unwrap();

        assert!(task.workspace_path.is_some());

        let tasks = repo.list_tasks().unwrap();
        assert_eq!(tasks.len(), 1);

        let _ = std::fs::remove_dir_all(&config_dir);
        let _ = std::fs::remove_dir_all(&workspace);
    }

    #[test]
    fn toggles_and_deletes_tasks() {
        // ...
    }
}
```

## 最终目录结构

```
config_dir/
├── todo/
│   └── todos.json
├── requirements/
│   ├── requirements.json
│   └── prototypes/
└── scheduler/
    └── tasks.json

src-tauri/src/
├── models/
│   └── scheduler.rs          # 精简模型
├── services/
│   ├── unified_scheduler_repository.rs  # 新增
│   ├── scheduler_mcp_server.rs          # 重构
│   └── mcp_config_service.rs            # 更新参数
├── bin/
│   └── polaris_scheduler_mcp.rs          # 重构
└── commands/
    └── scheduler.rs          # 重写

src/
├── types/
│   └── scheduler.ts          # 精简类型
└── stores/
    └── schedulerStore.ts     # 精简状态
```

## 验证检查

- [ ] `cargo build` 通过
- [ ] `cargo test` 通过
- [ ] `npm run build` 通过
- [ ] MCP 启动正常
- [ ] 前端功能正常
- [ ] 无控制台错误

## 完成标志

重构完成后，定时任务系统将：

1. **存储统一**：与待办、需求一致的全局存储
2. **模型精简**：仅保留核心字段
3. **MCP 一致**：参数格式与 Todo/Requirements MCP 统一
4. **代码整洁**：无冗余文件和代码
