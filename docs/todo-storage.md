# Todo MCP 单存储架构

## 1. 概述

本文档描述 Todo MCP 的单存储架构设计：所有待办存储在全局配置目录，通过 `workspacePath` 字段关联工作区。

## 2. 存储设计

### 2.1 目录结构

```
{config_dir}/                              # 如 C:\Users\xxx\AppData\Roaming\com.polaris.app
└── todo/
    ├── todos.json                         # 所有待办
    └── workspaces.json                    # 已注册工作区列表
```

### 2.2 待办数据结构

```typescript
interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  // ... 其他字段

  /** 所属工作区路径（null 表示无工作区关联） */
  workspacePath?: string | null

  /** 所属工作区名称（用于显示） */
  workspaceName?: string | null
}
```

### 2.3 查询范围

| Scope | 说明 |
|-------|------|
| `workspace` | 筛选当前工作区的待办（通过 workspacePath 匹配） |
| `all` | 返回所有待办 |

## 3. 后端实现

### 3.1 仓库层

```rust
pub struct UnifiedTodoRepository {
    storage_dir: PathBuf,           // config_dir/todo
    current_workspace: Option<PathBuf>,
    current_workspace_name: Option<String>,
}

impl UnifiedTodoRepository {
    /// 列出待办（支持 scope 筛选）
    pub fn list_todos(&self, scope: QueryScope) -> Result<Vec<TodoItem>>;

    /// 创建待办（自动设置 workspacePath）
    pub fn create_todo(&self, params: TodoCreateParams) -> Result<TodoItem>;

    /// 更新/删除待办
    pub fn update_todo(&self, id: &str, updates: TodoUpdateParams) -> Result<TodoItem>;
    pub fn delete_todo(&self, id: &str) -> Result<TodoItem>;

    /// 获取工作区分布统计（按 workspaceName 分组）
    pub fn get_workspace_breakdown(&self) -> Result<BTreeMap<String, usize>>;
}
```

### 3.2 Tauri 命令

| 命令 | 说明 |
|------|------|
| `list_todos` | 列出待办，支持 scope/status/priority/limit 筛选 |
| `create_todo` | 创建待办，自动关联当前工作区 |
| `update_todo` | 更新待办 |
| `delete_todo` | 删除待办 |
| `start_todo` | 开始待办 |
| `complete_todo` | 完成待办 |
| `get_todo_workspace_breakdown` | 获取工作区分布统计 |

## 4. MCP 工具

| 工具名 | 说明 |
|--------|------|
| `list_todos` | 列出待办，支持 `scope` 参数 |
| `create_todo` | 创建待办，自动关联工作区 |
| `update_todo` | 更新待办 |
| `delete_todo` | 删除待办 |
| `start_todo` | 开始待办 |
| `complete_todo` | 完成待办 |
| `get_workspace_breakdown` | 获取工作区分布统计 |

## 5. 前端实现

### 5.1 SimpleTodoService

```typescript
export class SimpleTodoService {
  private scope: 'workspace' | 'all' = 'workspace'

  setScope(scope: 'workspace' | 'all'): void
  listTodos(): TodoItem[]
  createTodo(params: CreateTodoParams): Promise<TodoItem>
  updateTodo(id: string, updates: UpdateParams): Promise<void>
  deleteTodo(id: string): Promise<void>
}
```

### 5.2 UI 组件

- **SimpleTodoPanel**: 范围切换（当前工作区/全部）
- **TodoCard**: 显示工作区名称
- **TodoForm**: 待办创建/编辑表单

## 6. 文件清单

| 文件 | 说明 |
|------|------|
| `src-tauri/src/models/todo.rs` | Todo 数据模型 |
| `src-tauri/src/services/unified_todo_repository.rs` | 仓库层实现 |
| `src-tauri/src/services/todo_mcp_server.rs` | MCP 服务 |
| `src-tauri/src/commands/todo.rs` | Tauri 命令 |
| `src/types/todo.ts` | 前端类型定义 |
| `src/services/simpleTodoService.ts` | 前端服务 |
| `src/components/TodoPanel/*.tsx` | UI 组件 |

