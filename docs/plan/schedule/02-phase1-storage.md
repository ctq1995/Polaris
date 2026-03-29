# 阶段一：统一存储架构

> **执行次序**：第二步
> **依赖**：无
> **产出**：`unified_scheduler_repository.rs`

## 目标

创建统一调度仓库，存储路径为 `config_dir/scheduler/tasks.json`，支持工作区关联。

## 新增文件

### `src-tauri/src/services/unified_scheduler_repository.rs`

```rust
//! Unified Scheduler Repository
//!
//! Single storage for all scheduled tasks in config_dir/scheduler/tasks.json.
//! Workspace filtering via workspacePath field.

use crate::error::{AppError, Result};
use crate::models::scheduler::{
    CreateTaskParams, ScheduledTask, TaskStatus, TaskStore, TriggerType,
};
use chrono::Utc;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const TASKS_FILE_NAME: &str = "tasks.json";
const SCHEDULER_FILE_VERSION: &str = "1.0.0";
const WORKSPACES_FILE_NAME: &str = "workspaces.json";

/// Unified repository for managing scheduled tasks in a single global storage
pub struct UnifiedSchedulerRepository {
    /// Global storage directory (config_dir/scheduler)
    storage_dir: PathBuf,
    /// Current workspace path (optional, for filtering)
    current_workspace: Option<PathBuf>,
    /// Current workspace name (for display)
    current_workspace_name: Option<String>,
}

/// Workspace registration info
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub path: String,
    pub name: String,
    pub last_accessed_at: String,
}

impl UnifiedSchedulerRepository {
    /// Create a new unified scheduler repository
    pub fn new(config_dir: PathBuf, current_workspace: Option<PathBuf>) -> Self {
        let current_workspace_name = current_workspace
            .as_ref()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .map(|s| s.to_string());

        let storage_dir = config_dir.join("scheduler");

        Self {
            storage_dir,
            current_workspace,
            current_workspace_name,
        }
    }

    /// Register current workspace in the workspaces list
    pub fn register_workspace(&self) -> Result<()> {
        // Similar to todo/requirement implementation
        // ...
    }

    /// List all tasks (optionally filtered by workspace)
    pub fn list_tasks(&self) -> Result<Vec<ScheduledTask>> {
        let store = self.read_file_data()?;

        let filtered = if let Some(workspace) = &self.current_workspace {
            let workspace_path = workspace.to_string_lossy().to_string();
            store.tasks.into_iter()
                .filter(|t| t.workspace_path.as_deref() == Some(workspace_path.as_str()))
                .collect()
        } else {
            store.tasks
        };

        Ok(filtered)
    }

    /// Create a new task
    pub fn create_task(&self, params: CreateTaskParams) -> Result<ScheduledTask> {
        // Validation
        let name = params.name.trim();
        if name.is_empty() {
            return Err(AppError::ValidationError("任务名称不能为空".to_string()));
        }

        let now = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let (workspace_path, workspace_name) = if let Some(workspace) = &self.current_workspace {
            (
                Some(workspace.to_string_lossy().to_string()),
                self.current_workspace_name.clone(),
            )
        } else {
            (None, None)
        };

        let task = ScheduledTask {
            id: id.clone(),
            name: name.to_string(),
            enabled: params.enabled,
            trigger_type: params.trigger_type,
            trigger_value: params.trigger_value,
            engine_id: params.engine_id,
            prompt: params.prompt,
            work_dir: params.work_dir,
            description: params.description,
            last_run_at: None,
            last_run_status: None,
            next_run_at: params.trigger_type.calculate_next_run(&params.trigger_value, now),
            created_at: now,
            updated_at: now,
            workspace_path,
            workspace_name,
        };

        let mut store = self.read_file_data()?;
        store.tasks.push(task.clone());
        self.write_file_data(&mut store)?;

        Ok(task)
    }

    /// Update a task
    pub fn update_task(&self, id: &str, updates: TaskUpdateParams) -> Result<ScheduledTask> {
        // ...
    }

    /// Delete a task
    pub fn delete_task(&self, id: &str) -> Result<ScheduledTask> {
        // ...
    }

    /// Update task execution status
    pub fn update_task_status(&self, id: &str, status: TaskStatus) -> Result<ScheduledTask> {
        // ...
    }

    // ... file I/O helpers
}
```

## 文件数据格式

### `config_dir/scheduler/tasks.json`

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-03-29T05:00:00Z",
  "tasks": [
    {
      "id": "uuid",
      "name": "每日提醒",
      "enabled": true,
      "triggerType": "cron",
      "triggerValue": "0 9 * * *",
      "engineId": "claude-code",
      "prompt": "检查今日待办并提醒",
      "workDir": null,
      "description": "每天早上9点执行",
      "lastRunAt": null,
      "lastRunStatus": null,
      "nextRunAt": 1711702800,
      "createdAt": 1711616400,
      "updatedAt": 1711616400,
      "workspacePath": "D:\\projects\\myapp",
      "workspaceName": "myapp"
    }
  ]
}
```

## 与待办/需求仓库对比

| 项目 | 待办 | 需求 | 定时任务 |
|------|------|------|----------|
| 存储目录 | `config_dir/todo/` | `config_dir/requirements/` | `config_dir/scheduler/` |
| 数据文件 | `todos.json` | `requirements.json` | `tasks.json` |
| 附属文件 | 无 | `prototypes/` | 无 |
| 工作区字段 | `workspacePath` | `workspacePath` | `workspacePath` |
| MCP 参数 | `config_dir, workspace_path` | `config_dir, workspace_path` | `config_dir, workspace_path` |

## 验证检查

- [ ] 创建任务写入正确路径
- [ ] 工作区过滤正常工作
- [ ] 跨工作区查询可用（scope=all）
- [ ] 文件格式符合规范

## 后续步骤

完成本阶段后，进入 [03-phase2-model.md](./03-phase2-model.md) 简化数据模型。
