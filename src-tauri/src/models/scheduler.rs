//! Scheduler Models
//!
//! Data models for scheduled task management with support for both
//! simple mode and protocol mode (document-driven workflow).

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Core Types
// ============================================================================

/// 触发类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TriggerType {
    /// 单次执行
    Once,
    /// Cron 表达式
    Cron,
    /// 间隔执行（支持 s/m/h/d）
    #[default]
    Interval,
}

/// 任务状态
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Running,
    Success,
    Failed,
}

/// 任务模式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TaskMode {
    /// 简单模式：直接使用 prompt
    #[default]
    Simple,
    /// 协议模式：使用文档驱动的工作流
    Protocol,
}

/// 任务分类（用于模板分组）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TaskCategory {
    /// 开发任务
    #[default]
    Development,
    /// 审查任务
    Review,
    /// 新闻搜索
    News,
    /// 监控任务
    Monitor,
    /// 自定义
    Custom,
}

// ============================================================================
// Prompt Template
// ============================================================================

/// 提示词模板
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptTemplate {
    /// 模板 ID
    pub id: String,
    /// 模板名称
    pub name: String,
    /// 模板描述
    #[serde(default)]
    pub description: Option<String>,
    /// 模板内容，支持占位符：{{prompt}}, {{taskName}}, {{date}}, {{time}}, {{datetime}}, {{weekday}}
    pub content: String,
    /// 是否启用
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 创建模板参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateParams {
    /// 模板名称
    pub name: String,
    /// 模板描述
    #[serde(default)]
    pub description: Option<String>,
    /// 模板内容
    pub content: String,
    /// 是否启用
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

/// 模板存储
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TemplateStore {
    pub version: String,
    pub templates: Vec<PromptTemplate>,
}

// ============================================================================
// Task Model
// ============================================================================

/// 定时任务
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    // === 基础属性 ===
    /// 任务 ID
    pub id: String,
    /// 任务名称
    pub name: String,
    /// 是否启用
    pub enabled: bool,
    /// 触发类型
    pub trigger_type: TriggerType,
    /// 触发值
    /// - once: ISO 时间戳字符串 (如 "2024-03-16T14:00:00Z")
    /// - cron: Cron 表达式 (如 "0 9 * * 1-5")
    /// - interval: 间隔表达式 (如 "30s", "5m", "2h", "1d")
    pub trigger_value: String,
    /// 使用的引擎 ID
    pub engine_id: String,
    /// 提示词 (simple 模式使用)
    pub prompt: String,
    /// 工作目录（可选）
    pub work_dir: Option<String>,
    /// 任务描述（可选）
    pub description: Option<String>,

    // === 状态属性 ===
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

    // === 工作区关联 ===
    /// 所属工作区路径
    #[serde(default)]
    pub workspace_path: Option<String>,
    /// 所属工作区名称
    #[serde(default)]
    pub workspace_name: Option<String>,

    // === 任务模式 ===
    /// 任务模式
    #[serde(default)]
    pub mode: TaskMode,
    /// 任务分类
    #[serde(default)]
    pub category: TaskCategory,

    // === 协议模式属性 ===
    /// 任务文档路径 (protocol 模式)
    #[serde(default)]
    pub task_path: Option<String>,
    /// 任务目标 (protocol 模式)
    #[serde(default)]
    pub mission: Option<String>,
    /// 模板 ID
    #[serde(default)]
    pub template_id: Option<String>,
    /// 模板参数
    #[serde(default)]
    pub template_params: Option<HashMap<String, String>>,

    // === 执行控制 ===
    /// 最大执行次数 (protocol 模式)
    #[serde(default)]
    pub max_runs: Option<u32>,
    /// 当前执行次数
    #[serde(default)]
    pub current_runs: u32,
    /// 最大重试次数
    #[serde(default)]
    pub max_retries: Option<u32>,
    /// 当前重试次数
    #[serde(default)]
    pub retry_count: u32,
    /// 重试间隔
    #[serde(default)]
    pub retry_interval: Option<String>,
    /// 超时时间（分钟）
    #[serde(default)]
    pub timeout_minutes: Option<u32>,

    // === 其他 ===
    /// 分组
    #[serde(default)]
    pub group: Option<String>,
    /// 完成通知
    #[serde(default = "default_true")]
    pub notify_on_complete: bool,
}

/// 创建任务参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskParams {
    // === 基础属性 ===
    /// 任务名称
    pub name: String,
    /// 是否启用
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// 触发类型
    pub trigger_type: TriggerType,
    /// 触发值
    pub trigger_value: String,
    /// 使用的引擎 ID
    pub engine_id: String,
    /// 提示词 (simple 模式使用)
    pub prompt: String,
    /// 工作目录（可选）
    pub work_dir: Option<String>,
    /// 任务描述（可选）
    pub description: Option<String>,

    // === 工作区关联 ===
    /// 所属工作区路径
    #[serde(default)]
    pub workspace_path: Option<String>,
    /// 所属工作区名称
    #[serde(default)]
    pub workspace_name: Option<String>,

    // === 任务模式 ===
    /// 任务模式
    #[serde(default)]
    pub mode: TaskMode,
    /// 任务分类
    #[serde(default)]
    pub category: TaskCategory,

    // === 协议模式属性 ===
    /// 任务目标 (protocol 模式)
    #[serde(default)]
    pub mission: Option<String>,
    /// 模板 ID
    #[serde(default)]
    pub template_id: Option<String>,
    /// 模板参数
    #[serde(default)]
    pub template_params: Option<HashMap<String, String>>,

    // === 执行控制 ===
    /// 最大执行次数 (protocol 模式)
    #[serde(default)]
    pub max_runs: Option<u32>,
    /// 最大重试次数
    #[serde(default)]
    pub max_retries: Option<u32>,
    /// 重试间隔
    #[serde(default)]
    pub retry_interval: Option<String>,
    /// 超时时间（分钟）
    #[serde(default)]
    pub timeout_minutes: Option<u32>,

    // === 其他 ===
    /// 分组
    #[serde(default)]
    pub group: Option<String>,
    /// 完成通知
    #[serde(default = "default_true")]
    pub notify_on_complete: bool,
}

fn default_enabled() -> bool {
    true
}

fn default_true() -> bool {
    true
}

/// 任务存储
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskStore {
    pub tasks: Vec<ScheduledTask>,
}

// ============================================================================
// Helper Methods
// ============================================================================

impl TriggerType {
    /// 解析触发值，计算下次执行时间
    pub fn calculate_next_run(&self, trigger_value: &str, now: i64) -> Option<i64> {
        match self {
            TriggerType::Once => {
                // 解析 ISO 时间戳
                chrono::DateTime::parse_from_rfc3339(trigger_value)
                    .ok()
                    .map(|dt| dt.timestamp())
                    .filter(|&ts| ts > now)
            }
            TriggerType::Cron => {
                // 解析 Cron 表达式
                use cron::Schedule;
                use std::str::FromStr;

                Schedule::from_str(trigger_value)
                    .ok()
                    .and_then(|schedule| {
                        schedule
                            .upcoming(chrono::Utc)
                            .next()
                            .map(|dt| dt.timestamp())
                    })
            }
            TriggerType::Interval => {
                // 解析间隔表达式 (30s, 5m, 2h, 1d)
                parse_interval(trigger_value)
                    .map(|interval_secs| now + interval_secs)
            }
        }
    }
}

/// 解析间隔表达式，返回秒数
/// 支持格式: 30s, 5m, 2h, 1d
pub fn parse_interval(value: &str) -> Option<i64> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    let (num_str, unit) = value.split_at(value.len() - 1);
    let num: i64 = num_str.parse().ok()?;

    let multiplier = match unit.to_lowercase().as_str() {
        "s" => 1,           // 秒
        "m" => 60,          // 分钟
        "h" => 3600,        // 小时
        "d" => 86400,       // 天
        _ => return None,
    };

    Some(num * multiplier)
}

/// 星期几中文名称
fn weekday_name(weekday: chrono::Weekday) -> &'static str {
    match weekday {
        chrono::Weekday::Mon => "星期一",
        chrono::Weekday::Tue => "星期二",
        chrono::Weekday::Wed => "星期三",
        chrono::Weekday::Thu => "星期四",
        chrono::Weekday::Fri => "星期五",
        chrono::Weekday::Sat => "星期六",
        chrono::Weekday::Sun => "星期日",
    }
}

/// 应用模板变量替换
/// 支持的变量：{{prompt}}, {{taskName}}, {{date}}, {{time}}, {{datetime}}, {{weekday}}
pub fn apply_template(template: &str, task_name: &str, user_prompt: &str) -> String {
    let now = chrono::Utc::now();

    template
        .replace("{{prompt}}", user_prompt)
        .replace("{{taskName}}", task_name)
        .replace("{{date}}", &now.format("%Y-%m-%d").to_string())
        .replace("{{time}}", &now.format("%H:%M").to_string())
        .replace("{{datetime}}", &now.format("%Y-%m-%d %H:%M").to_string())
        .replace("{{weekday}}", weekday_name(now.weekday()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_interval() {
        assert_eq!(parse_interval("30s"), Some(30));
        assert_eq!(parse_interval("5m"), Some(300));
        assert_eq!(parse_interval("2h"), Some(7200));
        assert_eq!(parse_interval("1d"), Some(86400));
        assert_eq!(parse_interval("invalid"), None);
    }

    #[test]
    fn test_calculate_next_run_interval() {
        let now = 1000i64;
        let next = TriggerType::Interval.calculate_next_run("5m", now);
        assert_eq!(next, Some(1000 + 300));
    }
}
