/**
 * 需求库类型定义
 *
 * 管理需求的完整生命周期：草稿→分析→设计→开发→测试→验收
 */

// ============================================================================
// 枚举类型
// ============================================================================

/** 需求状态 - 生命周期各阶段 */
export type RequirementStatus =
  | 'draft'        // 草稿
  | 'analyzing'    // 需求分析中（Agent 探索代码库）
  | 'designed'     // 方案设计完成（含原型）
  | 'developing'   // 开发实现中（Agent 执行）
  | 'testing'      // 测试验证中（Agent 验证）
  | 'tested'       // 测试通过，待验收
  | 'fixing'       // 修复中（测试发现问题）
  | 'accepted'     // 已验收
  | 'rejected'     // 已驳回（打回重新设计/分析）
  | 'cancelled'    // 已取消

/** 需求优先级 */
export type RequirementPriority = 'low' | 'normal' | 'high' | 'urgent'

/** 需求类型 */
export type RequirementType =
  | 'feature'      // 新功能
  | 'bugfix'       // Bug 修复
  | 'refactor'     // 重构
  | 'docs'         // 文档
  | 'infra'        // 基础设施
  | 'research'     // 调研
  | 'other'        // 其他

/** 需求复杂度 */
export type RequirementComplexity = 'simple' | 'medium' | 'complex'

/** 执行动作类型 */
export type ExecutionAction = 'analyze' | 'design' | 'develop' | 'test' | 'fix'

/** 执行状态 */
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'cancelled'

// ============================================================================
// 子结构
// ============================================================================

/** 子需求 */
export interface SubRequirement {
  /** 子需求 ID */
  id: string
  /** 子需求标题 */
  title: string
  /** 详细描述 */
  description?: string
  /** 子需求状态 */
  status: 'pending' | 'in_progress' | 'completed'
  /** 创建时间 */
  createdAt: number
  /** 完成时间 */
  completedAt?: number
}

/** 原型版本 */
export interface PrototypeVersion {
  /** 版本 ID */
  id: string
  /** 版本号 */
  version: number
  /** HTML 内容 */
  htmlContent: string
  /** 创建时间 */
  createdAt: number
  /** 版本说明 */
  note?: string
  /** 是否当前版本 */
  isCurrent: boolean
}

/** 执行记录 - 记录每个阶段的执行情况 */
export interface RequirementExecution {
  /** 执行记录 ID */
  id: string
  /** 关联需求 ID */
  requirementId: string
  /** 所在阶段 */
  phase: RequirementStatus
  /** 执行动作 */
  action: ExecutionAction
  /** AI 会话 ID */
  sessionId?: string
  /** 开始时间 */
  startedAt: number
  /** 结束时间 */
  finishedAt?: number
  /** 执行状态 */
  status: ExecutionStatus
  /** 执行摘要 */
  summary?: string
  /** AI 输出内容 */
  output?: string
  /** 错误信息 */
  error?: string
  /** 变更的文件列表 */
  changedFiles?: string[]
  /** 工具调用次数 */
  toolCallCount?: number
  /** Token 消耗 */
  tokenCount?: number
}

/** 验收标准 */
export interface AcceptanceCriteria {
  /** 标准 ID */
  id: string
  /** 标准内容 */
  content: string
  /** 是否通过 */
  passed?: boolean
  /** 验证时间 */
  verifiedAt?: number
  /** 关联 AI 会话 */
  sessionId?: string
  /** 备注 */
  note?: string
}

/** 阶段转换记录 */
export interface PhaseTransition {
  /** 转换 ID */
  id: string
  /** 原状态 */
  from: RequirementStatus
  /** 目标状态 */
  to: RequirementStatus
  /** 转换原因 */
  reason?: string
  /** 触发者 */
  actor: 'user' | 'agent'
  /** 关联 AI 会话 */
  sessionId?: string
  /** 转换时间 */
  timestamp: number
}

/** AI 分析结果 */
export interface RequirementAnalysis {
  /** AI 生成的需求摘要 */
  summary?: string
  /** 影响范围 */
  scope?: string
  /** 建议的子任务 */
  suggestedTasks?: string[]
  /** 建议查看/修改的文件 */
  suggestedFiles?: string[]
  /** 评估的复杂度 */
  complexity?: RequirementComplexity
  /** 预估工时（小时） */
  estimatedHours?: number
  /** 风险点 */
  risks?: string[]
  /** 依赖的其他需求 ID */
  dependencies?: string[]
  /** 分析时间 */
  analyzedAt: number
  /** 关联 AI 会话 */
  sessionId?: string
}

/** 设计方案 */
export interface RequirementDesign {
  /** 方案描述 */
  solution?: string
  /** 原型列表 */
  prototypes?: PrototypeVersion[]
  /** 验收标准 */
  acceptanceCriteria?: AcceptanceCriteria[]
  /** 技术备注 */
  technicalNotes?: string
  /** 设计时间 */
  designedAt: number
}

// ============================================================================
// 主实体
// ============================================================================

/** 需求实体 */
export interface Requirement {
  /** 唯一标识 */
  id: string
  // 基本信息
  /** 需求标题 */
  title: string
  /** 需求描述 */
  description: string
  /** 需求类型 */
  type: RequirementType
  /** 需求优先级 */
  priority: RequirementPriority
  /** 当前状态 */
  status: RequirementStatus
  // 审核
  /** 用户审核门控：AI 创建的需求为 false，用户确认后为 true */
  approved: boolean
  /** 创建来源：user / agent_analysis / scheduled */
  source?: string
  // 标签与分组
  /** 标签 */
  tags?: string[]
  /** 分组 */
  group?: string
  // 子需求
  /** 子需求列表 */
  subRequirements?: SubRequirement[]
  // AI 分析
  /** AI 分析结果 */
  analysis?: RequirementAnalysis
  // 方案设计
  /** 设计方案 */
  design?: RequirementDesign
  // 执行记录
  /** 执行记录列表 */
  executions: RequirementExecution[]
  // 阶段转换历史
  /** 阶段转换记录 */
  phaseHistory: PhaseTransition[]
  // 关联文件
  /** 相关文件路径 */
  relatedFiles?: string[]
  // 依赖
  /** 依赖的需求 ID */
  dependencies?: string[]
  // 工作区
  /** 关联工作区路径 */
  workspacePath?: string
  /** 关联工作区 ID（已弃用） */
  workspaceId?: string | null
  // 元数据
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 完成时间 */
  completedAt?: number
  /** 截止日期（ISO 8601） */
  dueDate?: string
  /** 当前活跃的执行 ID */
  activeExecutionId?: string
}

// ============================================================================
// 操作参数
// ============================================================================

/** 创建需求参数 */
export interface CreateRequirementParams {
  /** 需求标题 */
  title: string
  /** 需求描述 */
  description?: string
  /** 需求类型 */
  type?: RequirementType
  /** 需求优先级 */
  priority?: RequirementPriority
  /** 创建来源 */
  source?: string
  /** 标签 */
  tags?: string[]
  /** 分组 */
  group?: string
  /** 关联工作区 ID */
  workspaceId?: string | null
  /** 关联工作区路径 */
  workspacePath?: string
  /** 截止日期 */
  dueDate?: string
  /** 相关文件 */
  relatedFiles?: string[]
  /** 依赖需求 ID */
  dependencies?: string[]
}

/** 更新需求参数 */
export interface UpdateRequirementParams {
  /** 需求标题 */
  title?: string
  /** 需求描述 */
  description?: string
  /** 需求类型 */
  type?: RequirementType
  /** 需求优先级 */
  priority?: RequirementPriority
  /** 标签 */
  tags?: string[]
  /** 分组 */
  group?: string
  /** 截止日期 */
  dueDate?: string
  /** 相关文件 */
  relatedFiles?: string[]
  /** 依赖需求 ID */
  dependencies?: string[]
  /** 子需求 */
  subRequirements?: SubRequirement[]
}

/** 保存分析结果参数 */
export interface SaveAnalysisParams {
  /** 需求 ID */
  requirementId: string
  /** 分析结果 */
  analysis: RequirementAnalysis
}

/** 保存设计参数 */
export interface SaveDesignParams {
  /** 需求 ID */
  requirementId: string
  /** 方案描述 */
  solution?: string
  /** 技术备注 */
  technicalNotes?: string
  /** 验收标准 */
  acceptanceCriteria?: AcceptanceCriteria[]
}

/** 保存原型参数 */
export interface SavePrototypeParams {
  /** 需求 ID */
  requirementId: string
  /** HTML 内容 */
  htmlContent: string
  /** 版本说明 */
  note?: string
}

/** 创建执行记录参数 */
export interface CreateExecutionParams {
  /** 需求 ID */
  requirementId: string
  /** 执行动作 */
  action: ExecutionAction
  /** AI 会话 ID */
  sessionId?: string
}

/** 完成执行记录参数 */
export interface FinishExecutionParams {
  /** 执行记录 ID */
  executionId: string
  /** 执行状态 */
  status: ExecutionStatus
  /** 执行摘要 */
  summary?: string
  /** AI 输出 */
  output?: string
  /** 错误信息 */
  error?: string
  /** 变更文件 */
  changedFiles?: string[]
  /** 工具调用次数 */
  toolCallCount?: number
  /** Token 消耗 */
  tokenCount?: number
}

/** 阶段转换参数 */
export interface TransitionPhaseParams {
  /** 需求 ID */
  requirementId: string
  /** 目标状态 */
  targetStatus: RequirementStatus
  /** 转换原因 */
  reason?: string
  /** 触发者 */
  actor: 'user' | 'agent'
  /** 关联 AI 会话 */
  sessionId?: string
}

// ============================================================================
// 查询与统计
// ============================================================================

/** 需求筛选条件 */
export interface RequirementFilter {
  /** 状态筛选 */
  status?: RequirementStatus | 'all'
  /** 优先级筛选 */
  priority?: RequirementPriority
  /** 类型筛选 */
  type?: RequirementType
  /** 标签筛选 */
  tags?: string[]
  /** 关键词搜索 */
  search?: string
  /** 分组筛选 */
  group?: string
}

/** 需求统计信息 */
export interface RequirementStats {
  /** 总数 */
  total: number
  /** 按状态统计 */
  byStatus: Partial<Record<RequirementStatus, number>>
  /** 按优先级统计 */
  byPriority: Partial<Record<RequirementPriority, number>>
  /** 按类型统计 */
  byType: Partial<Record<RequirementType, number>>
  /** 完成率 */
  completionRate: number
}

// ============================================================================
// 显示名称映射
// ============================================================================

/** 需求状态显示名称 */
export const RequirementStatusLabels: Record<RequirementStatus, string> = {
  draft: '草稿',
  analyzing: '分析中',
  designed: '设计完成',
  developing: '开发中',
  testing: '测试中',
  tested: '待验收',
  fixing: '修复中',
  accepted: '已验收',
  rejected: '已驳回',
  cancelled: '已取消',
}

/** 需求优先级显示名称 */
export const RequirementPriorityLabels: Record<RequirementPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

/** 需求类型显示名称 */
export const RequirementTypeLabels: Record<RequirementType, string> = {
  feature: '新功能',
  bugfix: 'Bug 修复',
  refactor: '重构',
  docs: '文档',
  infra: '基础设施',
  research: '调研',
  other: '其他',
}

/** 合法状态转换映射 */
export const VALID_TRANSITIONS: Record<RequirementStatus, RequirementStatus[]> = {
  draft: ['analyzing', 'cancelled'],
  analyzing: ['designed', 'draft', 'cancelled'],
  designed: ['developing', 'analyzing', 'cancelled'],
  developing: ['testing', 'designed', 'cancelled'],
  testing: ['tested', 'fixing', 'developing', 'cancelled'],
  tested: ['accepted', 'rejected', 'testing', 'cancelled'],
  fixing: ['testing', 'developing', 'cancelled'],
  accepted: [],
  rejected: ['analyzing', 'designed', 'cancelled'],
  cancelled: [],
}

/**
 * 验证状态转换是否合法
 */
export function isValidTransition(
  from: RequirementStatus,
  to: RequirementStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
