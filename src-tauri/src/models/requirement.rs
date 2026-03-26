use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// 枚举类型
// ============================================================================

/// 需求状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum RequirementStatus {
    Draft,
    Analyzing,
    Designed,
    Developing,
    Testing,
    Tested,
    Fixing,
    Accepted,
    Rejected,
    Cancelled,
}

/// 需求优先级
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RequirementPriority {
    Low,
    Normal,
    High,
    Urgent,
}

/// 需求类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RequirementType {
    Feature,
    Bugfix,
    Refactor,
    Docs,
    Infra,
    Research,
    Other,
}

/// 需求复杂度
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RequirementComplexity {
    Simple,
    Medium,
    Complex,
}

/// 执行动作
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionAction {
    Analyze,
    Design,
    Develop,
    Test,
    Fix,
}

/// 执行状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    Running,
    Success,
    Failed,
    Cancelled,
}

// ============================================================================
// 子结构
// ============================================================================

/// 子需求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubRequirement {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: String,
    pub created_at: i64,
    #[serde(default)]
    pub completed_at: Option<i64>,
}

/// 原型版本
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrototypeVersion {
    pub id: String,
    pub version: u32,
    pub html_content: String,
    pub created_at: i64,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub is_current: bool,
}

/// 执行记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequirementExecution {
    pub id: String,
    pub requirement_id: String,
    pub phase: String,
    pub action: ExecutionAction,
    #[serde(default)]
    pub session_id: Option<String>,
    pub started_at: i64,
    #[serde(default)]
    pub finished_at: Option<i64>,
    pub status: ExecutionStatus,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub output: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub changed_files: Option<Vec<String>>,
    #[serde(default)]
    pub tool_call_count: Option<u32>,
    #[serde(default)]
    pub token_count: Option<u32>,
}

/// 验收标准
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptanceCriteria {
    pub id: String,
    pub content: String,
    #[serde(default)]
    pub passed: Option<bool>,
    #[serde(default)]
    pub verified_at: Option<i64>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

/// 阶段转换记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseTransition {
    pub id: String,
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub reason: Option<String>,
    pub actor: String,
    #[serde(default)]
    pub session_id: Option<String>,
    pub timestamp: i64,
}

/// AI 分析结果
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequirementAnalysis {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub suggested_tasks: Option<Vec<String>>,
    #[serde(default)]
    pub suggested_files: Option<Vec<String>>,
    #[serde(default)]
    pub complexity: Option<RequirementComplexity>,
    #[serde(default)]
    pub estimated_hours: Option<f32>,
    #[serde(default)]
    pub risks: Option<Vec<String>>,
    #[serde(default)]
    pub dependencies: Option<Vec<String>>,
    pub analyzed_at: i64,
    #[serde(default)]
    pub session_id: Option<String>,
}

/// 设计方案
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequirementDesign {
    #[serde(default)]
    pub solution: Option<String>,
    #[serde(default)]
    pub prototypes: Option<Vec<PrototypeVersion>>,
    #[serde(default)]
    pub acceptance_criteria: Option<Vec<AcceptanceCriteria>>,
    #[serde(default)]
    pub technical_notes: Option<String>,
    pub designed_at: i64,
}

// ============================================================================
// 主实体
// ============================================================================

/// 需求实体
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Requirement {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub r#type: RequirementType,
    #[serde(default)]
    pub priority: RequirementPriority,
    pub status: RequirementStatus,
    /// 用户审核门控：AI 创建的需求 approved=false，用户确认后设为 true
    #[serde(default)]
    pub approved: bool,
    /// 创建来源：user / agent_analysis / scheduled
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub sub_requirements: Option<Vec<SubRequirement>>,
    #[serde(default)]
    pub analysis: Option<RequirementAnalysis>,
    #[serde(default)]
    pub design: Option<RequirementDesign>,
    #[serde(default)]
    pub executions: Vec<RequirementExecution>,
    #[serde(default)]
    pub phase_history: Vec<PhaseTransition>,
    #[serde(default)]
    pub related_files: Option<Vec<String>>,
    #[serde(default)]
    pub dependencies: Option<Vec<String>>,
    /// 关联的工作区路径（已弃用 workspace_id，改为 workspace_path）
    #[serde(default)]
    pub workspace_path: Option<String>,
    #[serde(default)]
    pub workspace_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub completed_at: Option<i64>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub active_execution_id: Option<String>,
}

// ============================================================================
// 操作参数
// ============================================================================

/// 创建需求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRequirementParams {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub r#type: Option<RequirementType>,
    #[serde(default)]
    pub priority: Option<RequirementPriority>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub workspace_path: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub related_files: Option<Vec<String>>,
    #[serde(default)]
    pub dependencies: Option<Vec<String>>,
}

/// 更新需求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRequirementParams {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub r#type: Option<RequirementType>,
    #[serde(default)]
    pub priority: Option<RequirementPriority>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub related_files: Option<Vec<String>>,
    #[serde(default)]
    pub dependencies: Option<Vec<String>>,
    #[serde(default)]
    pub sub_requirements: Option<Vec<SubRequirement>>,
}

/// 保存分析结果参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAnalysisParams {
    pub requirement_id: String,
    pub analysis: RequirementAnalysis,
}

/// 保存设计参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDesignParams {
    pub requirement_id: String,
    #[serde(default)]
    pub solution: Option<String>,
    #[serde(default)]
    pub technical_notes: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Option<Vec<AcceptanceCriteria>>,
}

/// 保存原型参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePrototypeParams {
    pub requirement_id: String,
    pub html_content: String,
    #[serde(default)]
    pub note: Option<String>,
}

/// 创建执行记录参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExecutionParams {
    pub requirement_id: String,
    pub action: ExecutionAction,
    #[serde(default)]
    pub session_id: Option<String>,
}

/// 完成执行记录参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinishExecutionParams {
    pub execution_id: String,
    pub status: ExecutionStatus,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub output: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub changed_files: Option<Vec<String>>,
    #[serde(default)]
    pub tool_call_count: Option<u32>,
    #[serde(default)]
    pub token_count: Option<u32>,
}

/// 阶段转换参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionPhaseParams {
    pub requirement_id: String,
    pub target_status: RequirementStatus,
    #[serde(default)]
    pub reason: Option<String>,
    pub actor: String,
    #[serde(default)]
    pub session_id: Option<String>,
}

/// 需求统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequirementStats {
    pub total: usize,
    #[serde(default)]
    pub by_status: HashMap<String, usize>,
    #[serde(default)]
    pub by_priority: HashMap<String, usize>,
    #[serde(default)]
    pub by_type: HashMap<String, usize>,
    #[serde(default)]
    pub completion_rate: f64,
}

// ============================================================================
// 存储容器
// ============================================================================

/// 需求存储（JSON 文件内容）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequirementStore {
    pub requirements: Vec<Requirement>,
}

// ============================================================================
// 默认值函数
// ============================================================================

fn default_status() -> RequirementStatus {
    RequirementStatus::Draft
}

fn default_type() -> RequirementType {
    RequirementType::Feature
}

fn default_priority() -> RequirementPriority {
    RequirementPriority::Normal
}

impl Default for RequirementStatus {
    fn default() -> Self {
        default_status()
    }
}

impl Default for RequirementType {
    fn default() -> Self {
        default_type()
    }
}

impl Default for RequirementPriority {
    fn default() -> Self {
        default_priority()
    }
}

impl Default for Requirement {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: String::new(),
            description: String::new(),
            r#type: default_type(),
            priority: default_priority(),
            status: default_status(),
            approved: false,
            source: None,
            tags: None,
            group: None,
            sub_requirements: None,
            analysis: None,
            design: None,
            executions: Vec::new(),
            phase_history: Vec::new(),
            related_files: None,
            dependencies: None,
            workspace_path: None,
            workspace_id: None,
            created_at: 0,
            updated_at: 0,
            completed_at: None,
            due_date: None,
            active_execution_id: None,
        }
    }
}
