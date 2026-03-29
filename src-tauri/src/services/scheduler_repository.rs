//! Workspace-scoped Scheduler Repository
//!
//! Manages scheduled tasks and logs within a workspace's `.polaris/scheduler/` directory.
//! This is designed for MCP server use, providing isolated task management per workspace.

use crate::error::{AppError, Result};
use crate::models::scheduler::{
    CreateTaskParams, LogRetentionConfig, LogStore, PaginatedLogs, ScheduledTask, TaskLog,
    TaskStatus, TaskStore, TriggerType,
};
use chrono::Utc;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const TASKS_FILE_RELATIVE_PATH: &str = ".polaris/scheduler/tasks.json";
const LOGS_FILE_RELATIVE_PATH: &str = ".polaris/scheduler/logs.json";
const SCHEDULER_FILE_VERSION: &str = "1.0.0";

/// Workspace-scoped scheduler repository for managing tasks and logs
pub struct SchedulerRepository {
    workspace_path: PathBuf,
    tasks_file_path: PathBuf,
    logs_file_path: PathBuf,
}

impl SchedulerRepository {
    /// Create a new scheduler repository for the given workspace
    pub fn new(workspace_path: impl AsRef<Path>) -> Self {
        let workspace_path = workspace_path.as_ref().to_path_buf();
        Self {
            tasks_file_path: workspace_path.join(TASKS_FILE_RELATIVE_PATH),
            logs_file_path: workspace_path.join(LOGS_FILE_RELATIVE_PATH),
            workspace_path,
        }
    }

    /// Get the workspace path
    pub fn workspace_path(&self) -> &Path {
        &self.workspace_path
    }

    // =========================================================================
    // Task Operations
    // =========================================================================

    /// List all scheduled tasks
    pub fn list_tasks(&self) -> Result<Vec<ScheduledTask>> {
        Ok(self.read_tasks_file()?.tasks)
    }

    /// Get a single task by ID
    pub fn get_task(&self, id: &str) -> Result<Option<ScheduledTask>> {
        let tasks = self.list_tasks()?;
        Ok(tasks.into_iter().find(|t| t.id == id))
    }

    /// Create a new scheduled task
    pub fn create_task(&self, params: CreateTaskParams) -> Result<ScheduledTask> {
        let name = params.name.trim();
        if name.is_empty() {
            return Err(AppError::ValidationError("任务名称不能为空".to_string()));
        }

        let now = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let mut task = ScheduledTask::from(params);
        task.id = id.clone();
        task.created_at = now;
        task.updated_at = now;
        task.next_run_at = task.trigger_type.calculate_next_run(&task.trigger_value, now);

        let mut store = self.read_tasks_file()?;
        store.tasks.push(task.clone());
        self.write_tasks_file(&mut store)?;

        Ok(task)
    }

    /// Update an existing task
    pub fn update_task(&self, id: &str, updates: TaskUpdateParams) -> Result<ScheduledTask> {
        let mut store = self.read_tasks_file()?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or_else(|| AppError::ValidationError(format!("任务不存在: {}", id)))?;

        if let Some(name) = updates.name.as_ref() {
            let trimmed = name.trim();
            if !trimmed.is_empty() {
                task.name = trimmed.to_string();
            }
        }

        if let Some(enabled) = updates.enabled {
            task.enabled = enabled;
        }

        if let Some(trigger_type) = updates.trigger_type {
            task.trigger_type = trigger_type;
        }

        if let Some(trigger_value) = updates.trigger_value.as_ref() {
            task.trigger_value = trigger_value.clone();
        }

        if let Some(engine_id) = updates.engine_id.as_ref() {
            task.engine_id = engine_id.clone();
        }

        if let Some(prompt) = updates.prompt.as_ref() {
            task.prompt = prompt.clone();
        }

        if updates.work_dir.is_some() {
            task.work_dir = updates.work_dir.clone();
        }

        if let Some(mode) = updates.mode {
            task.mode = mode;
        }

        if updates.group.is_some() {
            task.group = updates.group.clone();
        }

        if updates.description.is_some() {
            task.description = updates.description.clone();
        }

        if updates.mission.is_some() {
            task.mission = updates.mission.clone();
        }

        if updates.max_runs.is_some() {
            task.max_runs = updates.max_runs;
        }

        if updates.run_in_terminal.is_some() {
            task.run_in_terminal = updates.run_in_terminal.unwrap();
        }

        if updates.template_id.is_some() {
            task.template_id = updates.template_id.clone();
        }

        if updates.template_param_values.is_some() {
            task.template_param_values = updates.template_param_values.clone();
        }

        if updates.max_retries.is_some() {
            task.max_retries = updates.max_retries;
        }

        if updates.retry_interval.is_some() {
            task.retry_interval = updates.retry_interval.clone();
        }

        if updates.notify_on_complete.is_some() {
            task.notify_on_complete = updates.notify_on_complete.unwrap();
        }

        if updates.timeout_minutes.is_some() {
            task.timeout_minutes = updates.timeout_minutes;
        }

        if updates.user_supplement.is_some() {
            task.user_supplement = updates.user_supplement.clone();
        }

        // Update timestamp and recalculate next run time
        task.updated_at = Utc::now().timestamp();
        task.next_run_at = task.trigger_type.calculate_next_run(&task.trigger_value, task.updated_at);

        let result = task.clone();
        self.write_tasks_file(&mut store)?;
        Ok(result)
    }

    /// Update task execution status
    pub fn update_task_status(
        &self,
        id: &str,
        status: TaskStatus,
        increment_runs: bool,
    ) -> Result<ScheduledTask> {
        let mut store = self.read_tasks_file()?;
        let task = store
            .tasks
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or_else(|| AppError::ValidationError(format!("任务不存在: {}", id)))?;

        task.last_run_status = Some(status);
        task.last_run_at = Some(Utc::now().timestamp());

        if increment_runs {
            task.current_runs += 1;
        }

        // Recalculate next run time
        task.next_run_at = task.trigger_type.calculate_next_run(&task.trigger_value, task.updated_at);

        let result = task.clone();
        self.write_tasks_file(&mut store)?;
        Ok(result)
    }

    /// Delete a task
    pub fn delete_task(&self, id: &str) -> Result<ScheduledTask> {
        let mut store = self.read_tasks_file()?;
        let index = store
            .tasks
            .iter()
            .position(|t| t.id == id)
            .ok_or_else(|| AppError::ValidationError(format!("任务不存在: {}", id)))?;

        let removed = store.tasks.remove(index);
        self.write_tasks_file(&mut store)?;
        Ok(removed)
    }

    // =========================================================================
    // Log Operations
    // =========================================================================

    /// List logs with pagination
    pub fn list_logs(&self, page: u32, page_size: u32) -> Result<PaginatedLogs> {
        let store = self.read_logs_file()?;
        let total = store.all_logs.len();
        let total_pages = if page_size > 0 {
            (total as u32 + page_size - 1) / page_size
        } else {
            1
        };

        let page = page.max(1);
        let start = ((page - 1) * page_size) as usize;
        let end = std::cmp::min(start + page_size as usize, total);

        let logs: Vec<TaskLog> = if start < total {
            store.all_logs[start..end].to_vec()
        } else {
            Vec::new()
        };

        Ok(PaginatedLogs {
            logs,
            total,
            page,
            page_size,
            total_pages: total_pages as usize,
        })
    }

    /// Get logs for a specific task
    pub fn get_task_logs(&self, task_id: &str) -> Result<Vec<TaskLog>> {
        let store = self.read_logs_file()?;
        Ok(store.logs.get(task_id).cloned().unwrap_or_default())
    }

    /// Create a new log entry
    pub fn create_log(&self, log: TaskLog) -> Result<TaskLog> {
        let mut store = self.read_logs_file()?;

        // Add to task-specific logs
        store
            .logs
            .entry(log.task_id.clone())
            .or_insert_with(Vec::new)
            .push(log.clone());

        // Add to all_logs (insert at beginning for descending order)
        store.all_logs.insert(0, log.clone());

        self.write_logs_file(&mut store)?;
        Ok(log)
    }

    /// Update a log entry
    pub fn update_log(&self, log_id: &str, updates: LogUpdateParams) -> Result<TaskLog> {
        let mut store = self.read_logs_file()?;

        // Find and update in all_logs
        let log = store
            .all_logs
            .iter_mut()
            .find(|l| l.id == log_id)
            .ok_or_else(|| AppError::ValidationError(format!("日志不存在: {}", log_id)))?;

        if updates.finished_at.is_some() {
            log.finished_at = updates.finished_at;
        }

        if updates.duration_ms.is_some() {
            log.duration_ms = updates.duration_ms;
        }

        if updates.status.is_some() {
            log.status = updates.status.unwrap();
        }

        if updates.session_id.is_some() {
            log.session_id = updates.session_id;
        }

        if updates.output.is_some() {
            log.output = updates.output;
        }

        if updates.error.is_some() {
            log.error = updates.error;
        }

        if updates.thinking_summary.is_some() {
            log.thinking_summary = updates.thinking_summary;
        }

        if updates.tool_call_count.is_some() {
            log.tool_call_count = updates.tool_call_count.unwrap();
        }

        if updates.token_count.is_some() {
            log.token_count = updates.token_count;
        }

        let result = log.clone();

        // Also update in task-specific logs
        if let Some(task_logs) = store.logs.get_mut(&result.task_id) {
            if let Some(task_log) = task_logs.iter_mut().find(|l| l.id == log_id) {
                *task_log = result.clone();
            }
        }

        self.write_logs_file(&mut store)?;
        Ok(result)
    }

    /// Delete logs for a specific task
    pub fn delete_task_logs(&self, task_id: &str) -> Result<usize> {
        let mut store = self.read_logs_file()?;

        // Remove from task-specific logs
        let task_logs_count = store.logs.remove(task_id).map(|v| v.len()).unwrap_or(0);

        // Remove from all_logs
        let before_count = store.all_logs.len();
        store.all_logs.retain(|l| l.task_id != task_id);
        let removed_from_all = before_count - store.all_logs.len();

        self.write_logs_file(&mut store)?;
        Ok(task_logs_count.max(removed_from_all))
    }

    /// Get log retention config
    pub fn get_retention_config(&self) -> Result<LogRetentionConfig> {
        let store = self.read_logs_file()?;
        Ok(store.retention_config)
    }

    /// Update log retention config
    pub fn update_retention_config(&self, config: LogRetentionConfig) -> Result<LogRetentionConfig> {
        let mut store = self.read_logs_file()?;
        store.retention_config = config;
        self.write_logs_file(&mut store)?;
        Ok(store.retention_config)
    }

    // =========================================================================
    // File Operations
    // =========================================================================

    fn read_tasks_file(&self) -> Result<TaskStore> {
        if !self.tasks_file_path.exists() {
            return Ok(TaskStore::default());
        }

        let content = std::fs::read_to_string(&self.tasks_file_path)?;
        let store: TaskStore = serde_json::from_str(&content).unwrap_or_default();
        Ok(store)
    }

    fn write_tasks_file(&self, store: &mut TaskStore) -> Result<()> {
        if let Some(parent) = self.tasks_file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(store)?;
        std::fs::write(&self.tasks_file_path, format!("{}\n", content))?;
        Ok(())
    }

    fn read_logs_file(&self) -> Result<LogStore> {
        if !self.logs_file_path.exists() {
            return Ok(LogStore::default());
        }

        let content = std::fs::read_to_string(&self.logs_file_path)?;
        let store: LogStore = serde_json::from_str(&content).unwrap_or_default();
        Ok(store)
    }

    fn write_logs_file(&self, store: &mut LogStore) -> Result<()> {
        if let Some(parent) = self.logs_file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(store)?;
        std::fs::write(&self.logs_file_path, format!("{}\n", content))?;
        Ok(())
    }
}

// ============================================================================
// Helper Types
// ============================================================================

/// Parameters for updating a scheduled task
#[derive(Debug, Clone, Default)]
pub struct TaskUpdateParams {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub trigger_type: Option<TriggerType>,
    pub trigger_value: Option<String>,
    pub engine_id: Option<String>,
    pub prompt: Option<String>,
    pub work_dir: Option<String>,
    pub mode: Option<crate::models::scheduler::TaskMode>,
    pub group: Option<String>,
    pub description: Option<String>,
    pub mission: Option<String>,
    pub max_runs: Option<u32>,
    pub run_in_terminal: Option<bool>,
    pub template_id: Option<String>,
    pub template_param_values: Option<HashMap<String, String>>,
    pub max_retries: Option<u32>,
    pub retry_interval: Option<String>,
    pub notify_on_complete: Option<bool>,
    pub timeout_minutes: Option<u32>,
    pub user_supplement: Option<String>,
}

/// Parameters for updating a log entry
#[derive(Debug, Clone, Default)]
pub struct LogUpdateParams {
    pub finished_at: Option<i64>,
    pub duration_ms: Option<i64>,
    pub status: Option<TaskStatus>,
    pub session_id: Option<String>,
    pub output: Option<String>,
    pub error: Option<String>,
    pub thinking_summary: Option<String>,
    pub tool_call_count: Option<u32>,
    pub token_count: Option<u32>,
}

/// Create log parameters
#[derive(Debug, Clone)]
pub struct CreateLogParams {
    pub task_id: String,
    pub task_name: String,
    pub engine_id: String,
    pub prompt: String,
}

impl From<CreateLogParams> for TaskLog {
    fn from(params: CreateLogParams) -> Self {
        TaskLog {
            id: Uuid::new_v4().to_string(),
            task_id: params.task_id,
            task_name: params.task_name,
            engine_id: params.engine_id,
            session_id: None,
            started_at: Utc::now().timestamp(),
            finished_at: None,
            duration_ms: None,
            status: TaskStatus::Running,
            prompt: params.prompt,
            output: None,
            error: None,
            thinking_summary: None,
            tool_call_count: 0,
            token_count: None,
        }
    }
}
