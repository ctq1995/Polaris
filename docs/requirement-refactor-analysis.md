# 需求库重构方案分析

## 1. 当前实现

### 1.1 存储位置

```
{workspace}/.polaris/requirements/
├── requirements.json    # 需需求数据
└── prototypes/          # 原型 HTML 文件
    └── {id}.html
```

### 1.2 代码结构

| 文件 | 说明 |
|------|------|
| `models/requirement.rs` | 数据模型定义 |
| `services/requirement_repository.rs` | 工作区仓库实现 |
| `services/requirements_mcp_server.rs` | MCP 服务（仅接收 workspace_path） |
| `services/requirementService.ts` | 前端服务（直接读写文件） |
| `types/requirement.ts` | 前端类型定义 |

### 1.3 特点

- **仅工作区范围**：需求存储在工作区，随项目移动
- **无 Tauri 命令层**：前端直接通过 `read_file_absolute`/`write_file_absolute` 读写
- **原型文件**：HTML 原型存储在工作区的 `prototypes/` 目录

## 2. 对比待办重构

### 2.1 待办重构方案

| 项目 | 改造前 | 改造后 |
|------|--------|--------|
| 存储位置 | 双存储（全局 + 工作区） | 单存储（全局） |
| 工作区关联 | 存储位置区分 | `workspacePath` 字段筛选 |
| 代码量 | ~1097 行 | ~152 行（减少 945 行） |
| 前端访问 | 直接文件读写 | Tauri 命令 |

### 2.2 需求库的差异

| 特性 | 待办 | 需求 |
|------|------|------|
| 跨工作区共享 | 常见（个人日程） | 较少（项目资产） |
| 附属文件 | 无 | 原型 HTML |
| 生命周期 | 短期（任务） | 长期（项目文档） |
| 团队协作 | 个人 | 可能需要版本控制 |

## 3. 重构方案

### 3.1 方案一：完全参照待办（全局单存储）

**存储结构：**
```
{config_dir}/requirements/
├── requirements.json         # 所有需求
├── workspaces.json           # 已注册工作区
└── prototypes/
    └── {id}.html             # 原型文件
```

**优点：**
- 代码结构统一，降低维护成本
- 支持跨工作区查询
- 简化前端访问（Tauri 命令）

**缺点：**
- 需求与项目分离，不适合版本控制
- 原型文件移出工作区，可能影响项目完整性
- 团队协作时需求不在代码仓库中

**改动清单：**

| 文件 | 操作 |
|------|------|
| `models/requirement.rs` | 添加 `workspacePath`/`workspaceName` 字段 |
| `services/requirement_repository.rs` | 删除 |
| `services/unified_requirement_repository.rs` | 新建（单仓库） |
| `services/requirements_mcp_server.rs` | 更新，添加 config_dir 参数 |
| `commands/requirement.rs` | 新建（Tauri 命令层） |
| `services/requirementService.ts` | 改用 Tauri 命令 |

### 3.2 方案二：保持工作区存储 + 添加 Tauri 命令层

**存储结构：** 保持不变

**改动内容：**
- 添加 `commands/requirement.rs`（Tauri 命令层）
- 更新前端服务使用 Tauri 命令
- 保持工作区隔离

**优点：**
- 需求随项目移动，适合版本控制
- 团队协作友好
- 改动量小

**缺点：**
- 无法跨工作区查询
- 代码结构与待办不一致

### 3.3 方案三：混合存储（推荐）

**存储结构：**
```
{config_dir}/requirements/
├── requirements.json         # 需求数据（全局）
└── prototypes/               # 原型缓存（可选）

{workspace}/.polaris/requirements/
└── prototypes/               # 原型文件保留在工作区
```

**数据结构：**
```typescript
interface Requirement {
  // ... 现有字段
  workspacePath?: string | null   // 所属工作区
  workspaceName?: string | null   // 工作区名称
  prototypeWorkspacePath?: string // 原型所属工作区（通常与 workspacePath 相同）
}
```

**特点：**
- 需求数据统一存储，支持跨工作区查询
- 原型文件保留在工作区，随项目版本控制
- 通过 `workspacePath` 筛选当前工作区需求

**改动清单：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `models/requirement.rs` | 修改 | 添加 `workspacePath`/`workspaceName` |
| `services/requirement_repository.rs` | 删除 | 不再需要工作区仓库 |
| `services/unified_requirement_repository.rs` | 新建 | 单仓库，原型路径映射 |
| `services/requirements_mcp_server.rs` | 修改 | 接收 config_dir + workspace_path |
| `commands/requirement.rs` | 新建 | Tauri 命令层 |
| `types/requirement.ts` | 修改 | 添加新字段 |
| `services/requirementService.ts` | 重写 | 使用 Tauri 命令 |

## 4. 推荐方案

### 4.1 选择建议

| 场景 | 推荐方案 |
|------|----------|
| 个人项目，不需要版本控制 | 方案一 |
| 团队项目，需要版本控制 | 方案三 |
| 仅需改进前端访问方式 | 方案二 |

### 4.2 实施优先级

如果采用方案三：

1. **第一步**：添加 Tauri 命令层
   - 创建 `commands/requirement.rs`
   - 暴露基本 CRUD 命令

2. **第二步**：更新前端服务
   - 改用 Tauri 命令
   - 移除直接文件访问

3. **第三步**：添加工作区字段
   - 扩展数据模型
   - 实现单仓库

4. **第四步**：迁移原型处理逻辑
   - 原型保留在工作区
   - 添加路径映射

## 5. 代码预览

### 5.1 Tauri 命令层（新增）

```rust
// src-tauri/src/commands/requirement.rs

#[tauri::command]
pub async fn list_requirements(params: ListRequirementsParams, app: AppHandle) -> Result<Vec<RequirementItem>>;

#[tauri::command]
pub async fn create_requirement(params: CreateRequirementParams, app: AppHandle) -> Result<RequirementItem>;

#[tauri::command]
pub async fn update_requirement(params: UpdateRequirementParams, app: AppHandle) -> Result<RequirementItem>;

#[tauri::command]
pub async fn delete_requirement(params: DeleteRequirementParams, app: AppHandle) -> Result<RequirementItem>;

#[tauri::command]
pub async fn save_prototype(params: SavePrototypeParams, app: AppHandle) -> Result<String>;

#[tauri::command]
pub async fn read_prototype(params: ReadPrototypeParams, app: AppHandle) -> Result<String>;
```

### 5.2 数据模型扩展

```rust
// src-tauri/src/models/requirement.rs

pub struct RequirementItem {
    // ... 现有字段

    /// 所属工作区路径
    #[serde(default)]
    pub workspace_path: Option<String>,

    /// 所属工作区名称（用于显示）
    #[serde(default)]
    pub workspace_name: Option<String>,
}
```

### 5.3 前端服务改造

```typescript
// src/services/requirementService.ts

export class RequirementService {
  private scope: 'workspace' | 'all' = 'workspace'

  async loadRequirements(): Promise<void> {
    this.requirements = await invoke('list_requirements', {
      params: {
        scope: this.scope,
        workspacePath: this.workspacePath,
      }
    })
  }

  async createRequirement(params: RequirementCreateParams): Promise<Requirement> {
    return await invoke('create_requirement', {
      params: { ...params, workspacePath: this.workspacePath }
    })
  }
}
```

## 6. 预估工作量

| 方案 | 文件数 | 预估工时 |
|------|--------|----------|
| 方案一 | 6 | 4-6 小时 |
| 方案二 | 3 | 2-3 小时 |
| 方案三 | 7 | 6-8 小时 |

## 7. 风险与注意事项

1. **数据迁移**：现有工作区的需求数据需要迁移
2. **原型路径**：原型文件路径需要重新映射
3. **向后兼容**：MCP 配置格式可能需要更新
4. **团队协作**：需考虑多人同时操作的场景
