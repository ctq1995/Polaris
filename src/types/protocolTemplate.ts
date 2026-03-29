/**
 * 文档模式模板类型定义
 *
 * 用于协议模式任务的模板系统，支持内置模板和用户自定义模板
 */

/** 模板类别 */
export type ProtocolTemplateCategory = 'development' | 'optimization' | 'fix' | 'custom' | 'requirement';

/** 模板类别标签 */
export const ProtocolTemplateCategoryLabels: Record<ProtocolTemplateCategory, string> = {
  development: '开发任务',
  optimization: '优化任务',
  fix: '修复任务',
  requirement: '需求管理',
  custom: '自定义',
};

/** 协议模式模板 */
export interface ProtocolTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 模板类别 */
  category: ProtocolTemplateCategory;
  /** 是否为内置模板 */
  builtin: boolean;
  /** 任务目标模板（支持占位符）- 保留向后兼容 */
  missionTemplate: string;
  /** 完整文档模板（支持占位符）- 新增：完整 task.md 内容模板 */
  fullTemplate?: string;
  /** 模板参数定义 - 新增：用于动态生成输入框 */
  templateParams?: TemplateParam[];
  /** 协议文档模板（可选，支持占位符） */
  protocolTemplate?: string;
  /** 默认触发类型 */
  defaultTriggerType?: 'once' | 'cron' | 'interval';
  /** 默认触发值 */
  defaultTriggerValue?: string;
  /** 默认引擎 */
  defaultEngineId?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/** 创建模板参数 */
export interface CreateProtocolTemplateParams {
  name: string;
  description: string;
  category: ProtocolTemplateCategory;
  missionTemplate: string;
  fullTemplate?: string;
  templateParams?: TemplateParam[];
  protocolTemplate?: string;
  defaultTriggerType?: 'once' | 'cron' | 'interval';
  defaultTriggerValue?: string;
  defaultEngineId?: string;
}

/** 内置模板定义 */
export const BUILTIN_PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: 'dev-feature',
    name: '功能开发',
    description: '用于持续开发新功能的任务模板，包含需求分析、实现、测试等阶段',
    category: 'development',
    builtin: true,
    missionTemplate: `帮我开发以下功能：

{mission}

请按照以下步骤执行：
1. 分析需求和现有代码结构
2. 设计实现方案
3. 编写代码实现
4. 编写测试用例
5. 进行代码审查和优化

当前时间：{dateTime}`,
    defaultTriggerType: 'interval',
    defaultTriggerValue: '1h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'dev-refactor',
    name: '代码重构',
    description: '用于持续重构和改进代码质量的任务模板',
    category: 'development',
    builtin: true,
    missionTemplate: `帮我重构以下代码：

{mission}

重构目标：
- 提高代码可读性
- 减少重复代码
- 优化性能
- 改善架构设计

当前时间：{dateTime}`,
    defaultTriggerType: 'interval',
    defaultTriggerValue: '2h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'opt-performance',
    name: '性能优化',
    description: '用于持续优化系统性能的任务模板',
    category: 'optimization',
    builtin: true,
    missionTemplate: `帮我优化以下性能问题：

{mission}

优化方向：
- 响应时间优化
- 内存使用优化
- 数据库查询优化
- 缓存策略改进

当前时间：{dateTime}`,
    defaultTriggerType: 'interval',
    defaultTriggerValue: '6h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'opt-code-quality',
    name: '代码质量优化',
    description: '用于持续提升代码质量的任务模板',
    category: 'optimization',
    builtin: true,
    missionTemplate: `帮我提升以下代码的质量：

{mission}

质量提升方向：
- 代码规范检查
- 添加单元测试
- 改善错误处理
- 完善文档注释

当前时间：{dateTime}`,
    defaultTriggerType: 'interval',
    defaultTriggerValue: '12h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'fix-bug',
    name: 'Bug修复',
    description: '用于持续修复Bug的任务模板',
    category: 'fix',
    builtin: true,
    missionTemplate: `帮我修复以下Bug：

{mission}

修复步骤：
1. 定位Bug根源
2. 分析影响范围
3. 编写修复代码
4. 添加回归测试
5. 验证修复效果

当前时间：{dateTime}`,
    defaultTriggerType: 'interval',
    defaultTriggerValue: '30m',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'fix-security',
    name: '安全修复',
    description: '用于修复安全漏洞的任务模板',
    category: 'fix',
    builtin: true,
    missionTemplate: `帮我修复以下安全问题：

{mission}

安全修复要点：
- 分析安全漏洞影响
- 修复漏洞代码
- 添加安全测试
- 更新安全文档

当前时间：{dateTime}`,
    defaultTriggerType: 'once',
    defaultTriggerValue: '',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'protocol-assist',
    name: '协议协助模式',
    description: '完整的协议任务模板，支持任务目标和用户补充内容',
    category: 'development',
    builtin: true,
    missionTemplate: '{task}', // 向后兼容
    fullTemplate: `# 任务协议

> 任务ID: 自动生成
> 创建时间: {dateTime}
> 版本: 1.0.0

---

## 任务目标

{task}

---

## 用户补充

{userSupplement}

---

## 执行规则

每次触发时按以下顺序执行：

### 1. 检查用户补充
- 读取用户补充文件
- 如有新内容，优先处理并归档

### 2. 推进主任务
- 读取记忆索引了解当前进度
- 选择下一个待办事项执行
- 完成后更新记忆

### 3. 记忆更新
- 新成果写入记忆文件
- 待办任务写入任务文件

---

## 成果定义

有价值的工作：
- 完成具体功能实现
- 修复已知问题
- 优化代码质量
- 产出可复用资产

避免：
- 无产出的探索
- 重复性工作
`,
    templateParams: [
      {
        key: 'task',
        label: '任务目标',
        type: 'textarea',
        required: true,
        placeholder: '描述任务目标...',
      },
      // userSupplement 作为独立字段存在于 ScheduledTask 中，不需要在模板参数中定义
      // fullTemplate 中的 {userSupplement} 占位符在渲染时从独立字段获取
    ],
    defaultTriggerType: 'interval',
    defaultTriggerValue: '1h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'req-generate',
    name: '需求生成',
    description: '分析项目代码，自动生成需求并存入需求队列，支持原型 HTML 生成',
    category: 'requirement',
    builtin: true,
    missionTemplate: '分析项目并生成需求到需求队列。\n\n{scope}\n\n{projectContext}',
    fullTemplate: `分析当前工作区项目，识别改进点和新功能机会，将需求写入需求库等待审核。

## 分析范围

{scope}

{projectContext}

## 操作流程

每次触发执行以下步骤：

### 1. 分析项目
- 阅读项目结构和关键文件
- 理解现有功能模块
- 识别可以改进或新增的功能点

### 2. 生成需求（每次 1~3 条）
基于分析结果生成需求，需包含：
- 清晰的标题
- 详细的描述（包含背景、目标、预期效果）
- 合理的优先级（low / normal / high / urgent）
- 相关标签（用于分类）

### 3. 可选：生成原型
仅当需求涉及 **UI 界面变更** 时才生成原型：
- 原型为单文件 HTML（内联 CSS）
- 使用 MCP 工具保存原型，并回写需求的 prototypePath / hasPrototype
- 原型应展示目标界面的大致布局和交互

### 4. 写入需求库
优先使用当前工作区提供的 Requirements MCP 工具完成需求入库，不要直接读写 \.polaris/requirements/requirements.json。

推荐工具顺序：
1. 使用 \'list_requirements\' 检查现有需求，避免重复
2. 使用 \'create_requirement\' 创建新需求
3. 仅在需要 UI 原型时，使用 \'save_requirement_prototype\' 保存原型 HTML

### 注意事项
- AI 生成的需求状态固定为 \'pending\'，由用户在需求队列面板中审核
- 标签用于分类，如 [UI, 性能, 安全, 重构] 等
- 不要把原始 JSON 读写协议写进对话过程或执行步骤中`,
    templateParams: [
      {
        key: 'scope',
        label: '分析范围',
        type: 'textarea',
        required: true,
        placeholder: '描述要分析的模块或功能范围，如：分析 src/components 下的组件，提出优化建议',
      },
      {
        key: 'projectContext',
        label: '项目背景（可选）',
        type: 'textarea',
        required: false,
        placeholder: '补充项目背景信息，帮助 AI 更好地理解上下文',
      },
    ],
    defaultTriggerType: 'interval',
    defaultTriggerValue: '24h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'req-execute',
    name: '需求执行（仅分析）',
    description: '从需求队列获取已批准的需求，进行深入分析并记录执行方案（不直接实现）',
    category: 'requirement',
    builtin: true,
    missionTemplate: '从需求队列获取已批准需求并分析。\n\n{focusModule}',
    fullTemplate: `从需求库中获取已批准（approved）的需求，进行深入分析，记录执行方案。

## 执行范围

{focusModule}

## 操作流程

每次触发执行以下步骤：

### 1. 获取待执行需求
- 优先使用 Requirements MCP 工具读取需求库，不要直接操作 \.polaris/requirements/requirements.json
- 使用 \'list_requirements\' 获取状态为 approved 的需求
- 按优先级排序：urgent > high > normal > low
- 如有指定模块，按标签进一步筛选
- 选取优先级最高的一条需求进行分析

### 2. 深入分析需求（仅分析，不实现）
- 阅读相关代码，理解当前实现
- 评估需求的技术方案
- 识别可能的实现路径和影响范围
- 分析潜在风险和依赖关系

### 3. 记录分析结果
将分析结果写入目标需求，包含：
- 需求理解：对需求目标和背景的理解
- 当前状态：相关代码的现状分析
- 实现方案：推荐的技术实现路径
- 影响范围：涉及哪些文件和模块
- 风险评估：可能的风险和注意事项
- 预估工作量：大致的实现复杂度

推荐工具顺序：
1. 使用 \'list_requirements\' 选出目标需求
2. 使用 \'update_requirement\' 写入 executeLog，并将 status 更新为 executing
3. 如分析失败，同样使用 \'update_requirement\' 写入 executeError

### 4. 更新需求状态
- 将需求 status 更新为 executing
- 写入 executeLog
- 如有需要补充 sessionId / executeError，也通过 MCP 工具更新

### 注意事项
- 每次只分析一条需求，不要贪多
- 分析要深入具体，不要泛泛而谈
- 分析结果要有可操作性，为后续实现提供明确指导
- 如果没有已批准的需求，跳过本次执行并在记忆中记录`,
    templateParams: [
      {
        key: 'focusModule',
        label: '聚焦模块（可选）',
        type: 'text',
        required: false,
        default: '',
        placeholder: '指定要执行的需求模块，留空则按优先级全局选取',
      },
    ],
    defaultTriggerType: 'interval',
    defaultTriggerValue: '2h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'req-executor',
    name: '需求执行器',
    description: '从需求队列获取已批准的需求，按优先级执行并记录结果。支持分步执行、状态追踪、执行日志记录',
    category: 'requirement',
    builtin: true,
    missionTemplate: '从需求队列获取已批准需求并执行。\n\n{executionScope}',
    fullTemplate: `从需求队列中获取已批准（approved）的需求，执行实现并记录结果。

## 执行范围

{executionScope}

## 每次执行需求数量

{maxRequirements}

---

## 执行规则

每次触发时按以下顺序执行：

### 1. 获取待执行需求
优先使用当前工作区提供的 Requirements MCP 工具，不要直接操作 \`.polaris/requirements/requirements.json\`：
- 使用 \`list_requirements\` 获取状态为 approved 的需求
- 按优先级排序：\`urgent > high > normal > low\`
- 同优先级按 \`updatedAt\` 升序（先批准先执行）
- 若无已批准需求，静默跳过本次执行

### 2. 开始执行需求
对每个获取到的需求：

#### 2.1 状态更新
- 使用 \`update_requirement\` 将需求 \`status\` 更新为 \`"executing"\`
- 写入 \`executedAt\` 为当前时间戳

#### 2.2 执行分析
- 阅读需求描述，理解需求目标
- 分析相关代码，了解当前实现
- 设计实现方案
- 编写代码实现
- 测试验证

#### 2.3 记录执行结果
执行完成后使用 \`update_requirement\` 更新需求：
- **成功**: \`status\` 设为 \`"completed"\`，\`completedAt\` 设为当前时间戳
- **失败**: \`status\` 设为 \`"failed"\`，\`executeError\` 记录错误信息
- 无论成功失败，\`executeLog\` 记录执行过程和结果
- 更新 \`updatedAt\`

### 3. 分步执行支持
如果需求复杂无法一次完成：
- 保持 \`status === "executing"\`
- 将当次进度写入 \`executeLog\`（追加模式）
- 下次定时触发时继续执行
- 直至完成或失败

---

## 注意事项

- 每次最多执行 {maxRequirements} 条需求
- 执行前先检查需求状态，避免重复执行
- 执行过程要写入 \`executeLog\`，便于追踪进度
- 如果代码修改需要提交 Git，执行完成后自动提交
- 遇到阻塞问题时，记录到 \`executeLog\` 并继续下一条需求
- 始终使用 MCP 工具操作需求库，避免直接读写 JSON 文件`,
    templateParams: [
      {
        key: 'executionScope',
        label: '执行范围',
        type: 'textarea',
        required: false,
        default: '不限模块，按优先级全局选取',
        placeholder: '描述执行范围，如：仅执行 high 以上优先级的需求，或限定特定标签的需求',
      },
      {
        key: 'maxRequirements',
        label: '每次执行数量上限',
        type: 'select',
        required: true,
        default: '1',
        options: [
          { value: '1', label: '1 条（推荐）' },
          { value: '2', label: '2 条' },
          { value: '3', label: '3 条' },
          { value: '5', label: '5 条' },
        ],
      },
    ],
    defaultTriggerType: 'interval',
    defaultTriggerValue: '1h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'scheduler-manager',
    name: '定时任务管理',
    description: '通过 MCP 工具管理当前工作区的定时任务，支持创建、查看、更新、删除任务',
    category: 'custom',
    builtin: true,
    missionTemplate: '管理定时任务。\n\n{scope}',
    fullTemplate: `通过 Scheduler MCP 工具管理当前工作区的定时任务。

## 工作范围

{scope}

## 可用工具

优先使用当前工作区提供的 Scheduler MCP 工具：

### 任务管理
- \`list_tasks\` - 列出所有定时任务
- \`get_task\` - 获取单个任务详情（参数: id）
- \`create_task\` - 创建新任务
- \`update_task\` - 更新现有任务（参数: id + 要更新的字段）
- \`delete_task\` - 删除任务（参数: id）

### 日志管理
- \`list_logs\` - 分页列出执行日志（参数: page, pageSize）
- \`get_task_logs\` - 获取特定任务的日志（参数: taskId）
- \`create_log\` - 创建日志条目
- \`update_log\` - 更新日志（参数: logId + 要更新的字段）
- \`delete_task_logs\` - 删除任务的所有日志（参数: taskId）

### 配置管理
- \`get_retention_config\` - 获取日志保留配置
- \`update_retention_config\` - 更新保留配置

## 任务字段说明

创建任务时需要的字段：
- **name** (必填): 任务名称
- **triggerType** (必填): 触发类型 - "once" | "cron" | "interval"
- **triggerValue** (必填): 触发值
  - once: ISO 时间戳，如 "2024-03-16T14:00:00Z"
  - cron: Cron 表达式，如 "0 9 * * 1-5"
  - interval: 间隔表达式，如 "30s", "5m", "2h", "1d"
- **engineId** (必填): 使用的引擎 ID
- **prompt** (必填): 执行时的提示词
- **workDir** (可选): 工作目录
- **mode** (可选): "simple" | "protocol"
- **description** (可选): 任务描述
- **enabled** (可选): 是否启用，默认 true
- **maxRuns** (可选): 最大执行次数
- **maxRetries** (可选): 最大重试次数
- **retryInterval** (可选): 重试间隔
- **notifyOnComplete** (可选): 完成后通知，默认 true
- **timeoutMinutes** (可选): 超时时间（分钟）

## 注意事项

- 不要直接读写 .polaris/scheduler/*.json 文件
- 始终使用 MCP 工具操作定时任务数据
- 任务 ID 由系统自动生成，无需手动指定
- 删除任务不会自动删除其执行日志`,
    templateParams: [
      {
        key: 'scope',
        label: '工作范围',
        type: 'textarea',
        required: false,
        default: '管理当前工作区的所有定时任务',
        placeholder: '描述要管理的任务范围，如：只管理测试相关的任务',
      },
    ],
    defaultTriggerType: 'interval',
    defaultTriggerValue: '1h',
    defaultEngineId: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
];

/** 模板参数定义 - 用于动态生成输入框 */
export interface TemplateParam {
  /** 参数键，用于占位符匹配，如 "task", "userSupplement" */
  key: string;
  /** 显示标签 */
  label: string;
  /** 输入类型 */
  type: 'text' | 'textarea' | 'select';
  /** 是否必填 */
  required: boolean;
  /** 默认值 */
  default?: string;
  /** 占位提示 */
  placeholder?: string;
  /** select 类型的选项 */
  options?: { value: string; label: string }[];
}

/** 支持的占位符 */
export const TEMPLATE_PLACEHOLDERS = {
  dateTime: '{dateTime}',
  mission: '{mission}',
  date: '{date}',
  time: '{time}',
  task: '{task}',
  userSupplement: '{userSupplement}',
};

/** 格式化日期时间 */
export function formatDateTimeForTemplate(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 格式化日期 */
export function formatDateForTemplate(): string {
  const now = new Date();
  return now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 格式化时间 */
export function formatTimeForTemplate(): string {
  const now = new Date();
  return now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 渲染模板的参数 */
export interface RenderTemplateParams {
  /** 任务目标/描述 (对应 {mission} 和 {task}) */
  mission?: string;
  /** 用户补充内容 (对应 {userSupplement}) */
  userSupplement?: string;
}

/** 渲染模板 */
export function renderProtocolTemplate(
  template: string,
  missionOrParams: string | RenderTemplateParams
): string {
  let result = template;

  // 兼容旧的字符串参数形式
  const params: RenderTemplateParams = typeof missionOrParams === 'string'
    ? { mission: missionOrParams }
    : missionOrParams;

  // 替换基础占位符
  result = result.replace(TEMPLATE_PLACEHOLDERS.dateTime, formatDateTimeForTemplate());
  result = result.replace(TEMPLATE_PLACEHOLDERS.date, formatDateForTemplate());
  result = result.replace(TEMPLATE_PLACEHOLDERS.time, formatTimeForTemplate());

  // 替换任务相关占位符
  result = result.replace(TEMPLATE_PLACEHOLDERS.mission, params.mission || '');
  result = result.replace(TEMPLATE_PLACEHOLDERS.task, params.mission || '');
  result = result.replace(TEMPLATE_PLACEHOLDERS.userSupplement, params.userSupplement || '');

  return result;
}

/** 渲染参数映射类型 */
export interface TemplateParamValues {
  task?: string;
  userSupplement?: string;
  mission?: string;
  [key: string]: string | undefined;
}

/** 渲染完整模板 - 新版，支持所有占位符 */
export function renderFullTemplate(
  template: string,
  params: TemplateParamValues
): string {
  let result = template;

  // 替换系统占位符
  result = result.replace(TEMPLATE_PLACEHOLDERS.dateTime, formatDateTimeForTemplate());
  result = result.replace(TEMPLATE_PLACEHOLDERS.date, formatDateForTemplate());
  result = result.replace(TEMPLATE_PLACEHOLDERS.time, formatTimeForTemplate());

  // 替换用户参数占位符
  Object.entries(params).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    if (result.includes(placeholder)) {
      result = result.split(placeholder).join(value || '');
    }
  });

  return result;
}

/** 从模板中提取占位符列表 */
export function extractPlaceholders(template: string): string[] {
  const regex = /\{(\w+)\}/g;
  const placeholders: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1]);
    }
  }
  return placeholders;
}
