# Polaris × Claude Code × MCP 开发指南

## 1. 这份文档的目的

这份文档用于系统总结 Polaris、Claude Code、MCP 三者是如何配合工作的，重点说明：

- 为什么要把原来的系统提示词注入方案迁移到 MCP
- Polaris 当前是怎么把 Todo 能力接给 Claude Code 的
- 整条调用链的实现方式与运行原理
- 后续如果要继续接入 scheduler、requirements、需求分析器等 MCP，应该怎么做

目标不是只解释“代码写了什么”，而是给后续开发者一份可以复用的方法论。

---

## 2. 背景：为什么不能只靠系统提示词

Polaris 早期对“待办、定时任务、需求库”这类扩展能力，主要做法是：

- 在 system prompt 里告诉 Claude Code 某些规则
- 让模型自己去读写 `.polaris/*.json`
- 通过提示词约束模型用某种文件协议完成增删改查

这种方式的问题很明显：

### 2.1 这不是“工具”，而是“让模型模仿工具”

本质上，模型并没有获得真正的 Todo API，只是被要求：

- 读取 JSON
- 修改 JSON
- 再写回 JSON

这会导致：

- 行为不稳定
- prompt 很重
- 容易误操作文件
- 无法提供明确的参数 schema
- 无法天然获得工具调用记录

### 2.2 能力边界不清晰

当待办能力只存在于提示词中时，Claude Code 不知道这是一个“正式工具”，只知道“你让我这么做”。

后果是：

- 不能像真正工具那样被发现
- 不能标准化复用
- 不方便后续扩展成 scheduler / requirements / protocol 等更多能力

### 2.3 多能力叠加后 prompt 会越来越难维护

如果待办、定时任务、需求库都继续走提示词注入路线，system prompt 会不断变长，最终：

- 维护成本高
- 冲突概率上升
- 某一类能力改动会影响整体提示质量

所以，**正确方向不是继续增强 prompt，而是把“能力”变成 Claude 可调用的标准工具**。

---

## 3. 为什么选择 MCP

MCP，全称 Model Context Protocol。它的核心价值是：

- 让应用把自己的能力暴露成标准工具
- 让模型在对话过程中按 schema 调用工具
- 让宿主应用控制工具的实现与权限边界

对于 Polaris，这比 Skill 更适合承载“工作区能力”：

### 3.1 Skill 更适合固定命令流

Skill 更像“预定义工作流”或“命令模板”。

它适合：

- 固定命令
- 固定文档处理流程
- 某类标准化操作模板

但待办、定时任务、需求库这种能力，本质上是：

- 要有增删改查
- 要有结构化参数
- 要有工作区隔离
- 要有长期可扩展性

这更像一组 API，而不是一个 slash command。

### 3.2 MCP 天然适合工作区级能力

Todo 不是全局单例能力，而是强依赖工作区：

- 每个 workspace 都有自己的 `.polaris/todos.json`
- 每个 workspace 都应该有自己的 MCP 配置
- 多开 Polaris 时不能互相污染

所以最佳方案不是改用户全局 `~/.claude/settings.json`，而是：

- **为每个 workspace 生成自己的 MCP 配置**
- **在启动 Claude Code 会话时，把该配置显式传给 Claude CLI**

这就是当前 Polaris 采用的方案。

---

## 4. Polaris 当前的整体方案概览

当前 Todo MCP 的整体设计可以概括为四层：

1. **能力实现层**：`src/mcp/`
   - 定义 Todo 仓储
   - 定义 Todo MCP server
   - 定义 Node CLI 入口

2. **构建层**：`scripts/build-mcp.mjs`
   - 把 MCP CLI 入口打包成 Node 可执行 JS

3. **工作区配置层**：`src-tauri/src/services/mcp_config_service.rs`
   - 为当前 workspace 生成 `.polaris/claude/mcp.json`

4. **会话接入层**：前端 store + Tauri chat + Claude engine
   - 前端声明要启用 MCP 工具
   - Rust 侧生成 mcp config 路径
   - Claude CLI 启动时附带 `--mcp-config`

可以理解为：

**Polaris 不是把工具“安装进 Claude Code”，而是在启动 Claude Code 会话时，把一个 workspace 专属的 MCP server 配置注入给它。**

---

## 5. Todo MCP 的核心目录与职责

### 5.1 `src/mcp/todoRepository.ts`

这是待办数据仓储层。

职责：

- 读写 `.polaris/todos.json`
- 初始化空文件
- 标准化 Todo 数据
- 提供 CRUD 能力：
  - `listTodos()`
  - `getTodo()`
  - `createTodo()`
  - `updateTodo()`
  - `deleteTodo()`

设计上它有一个重要抽象：

```ts
export interface TodoRepositoryFileAccess {
  pathExists(path: string): Promise<boolean>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
}
```

这意味着仓储层并不关心“文件是怎么读写的”，只关心“有人提供文件访问能力”。

这也是后面修复 Node 运行时问题的关键。

### 5.2 `src/mcp/todoMcpServer.ts`

这是 MCP server 本体。

职责：

- 创建 `McpServer`
- 注册工具
- 把仓储层包装成 Claude 可调用的 MCP 工具

当前暴露的工具包括：

- `list_todos`
- `create_todo`
- `update_todo`
- `delete_todo`
- `start_todo`
- `complete_todo`

这里定义的不是 prompt，而是标准工具接口。模型真正看到的是：

- 工具名
- 描述
- 参数 schema
- 返回结构

### 5.3 `src/mcp/todoMcpServerCli.ts`

这是 MCP server 的 stdio 入口。

职责：

- 接收 workspacePath 参数
- 启动 `startTodoMcpServer(workspacePath)`

Claude CLI 启动 MCP server 时，实际跑的是这个入口的构建产物。

---

## 6. 为什么需要构建产物，而不是直接跑 TypeScript 源码

### 6.1 Claude 启动 MCP server 时跑的是 Node 子进程

MCP server 对 Claude 来说，本质是一个独立进程。当前 Todo MCP 使用的是 stdio 方式，所以 Claude CLI 会做类似这样的事情：

```json
{
  "mcpServers": {
    "polaris-todo": {
      "command": "node",
      "args": [
        "D:/space/base/Polaris/dist/mcp/todoMcpServerCli.js",
        "D:/space/base/Polaris"
      ]
    }
  }
}
```

这意味着 Claude 启动的是 **Node 可直接执行的 JS 文件**。

### 6.2 直接指向 `.ts` 源码会有运行问题

之前已经遇到过：

- Node 直接执行 `.ts` 源码入口不稳定
- ESM import 解析会失败
- 相对路径与扩展名容易出错

因此需要构建步骤。

### 6.3 当前构建脚本

文件：`scripts/build-mcp.mjs`

职责：

- 以 `src/mcp/todoMcpServerCli.ts` 为入口
- 通过 esbuild 打包到 `dist/mcp/`
- 目标平台是 Node
- 产物格式是 ESM

对应脚本：

```json
"build:mcp": "node ./scripts/build-mcp.mjs"
```

所以 Todo MCP 的发布模型是：

- 代码写在 `src/mcp/`
- 启动时跑 `dist/mcp/todoMcpServerCli.js`

---

## 7. Polaris 是怎么把 MCP 配置交给 Claude Code 的

这是整个接入链里最重要的一段。

### 7.1 前端：声明当前会话要启用 MCP

文件：`src/stores/eventChatStore/eventHandlerSlice.ts`

当前前端在发起 `start_chat` / `continue_chat` 时，会在 options 中带上：

```ts
enableMcpTools: currentEngine === 'claude-code'
```

意思是：

- 如果当前引擎不是 Claude Code，不启用这条链路
- 如果当前引擎是 Claude Code，则允许后端为这次会话准备 MCP 配置

### 7.2 Rust 命令层：生成 workspace MCP 配置

文件：`src-tauri/src/commands/chat.rs`

这里会在启动会话前执行：

- 判断是否启用了 MCP
- 判断当前引擎是否是 Claude Code
- 判断是否存在有效 `work_dir`
- 调用 `WorkspaceMcpConfigService::prepare_todo_config(work_dir)`

生成出来的是：

```text
<workspace>/.polaris/claude/mcp.json
```

### 7.3 Rust 服务层：写入 `.polaris/claude/mcp.json`

文件：`src-tauri/src/services/mcp_config_service.rs`

职责：

- 构造 MCP server 配置
- 指向 `dist/mcp/todoMcpServerCli.js`
- 把当前 workspace path 作为参数传给它
- 写入工作区级 MCP 配置文件

这一步非常关键，因为它实现了：

- 工作区隔离
- 多开 Polaris 不互相覆盖
- 不污染用户全局 Claude 设置

### 7.4 SessionOptions：在会话链路中传递 mcp_config_path

文件：`src-tauri/src/ai/traits.rs`

这里新增了：

```rust
pub mcp_config_path: Option<String>
```

这样从 Tauri 命令层到 Claude engine 的参数链路就完整了。

### 7.5 Claude engine：最终拼接 CLI 参数

文件：`src-tauri/src/ai/engine/claude.rs`

这里最终会把配置转成：

```bash
claude ... --mcp-config <path>
```

所以最终链路不是“Claude 自动发现 Polaris”，而是：

- Polaris 先生成 workspace 级 MCP 配置
- Polaris 再在启动 Claude CLI 时把这份配置显式传进去

这就是实际原理。

---

## 8. Claude Code 为什么能看到 `mcp__polaris-todo__create_todo`

当 Claude CLI 启动时拿到了 `--mcp-config <workspace/.polaris/claude/mcp.json>`，它会：

1. 读取该配置
2. 启动里面定义的 `polaris-todo` server
3. 通过 stdio 与 server 建立 MCP 通信
4. 获取该 server 提供的工具列表
5. 把这些工具暴露给当前会话中的模型

于是最终在 Claude 侧看到的工具名会是类似：

- `mcp__polaris-todo__list_todos`
- `mcp__polaris-todo__create_todo`
- `mcp__polaris-todo__update_todo`
- `mcp__polaris-todo__delete_todo`

这也是为什么后来已经可以确认：

- Claude 已经识别了 MCP
- 问题不是“接入不上”
- 而是 server 内部运行时出错

---

## 9. 本次遇到的关键问题：`window is not defined`

这个问题非常值得单独总结，因为后续做其他 MCP 时也很容易踩坑。

### 9.1 现象

Claude 已经识别到 `polaris-todo`，但调用：

- `mcp__polaris-todo__create_todo`

时报错：

```text
window is not defined
```

### 9.2 根因

最初 `src/mcp/todoMcpServer.ts` 里用了：

```ts
import { invoke } from '@tauri-apps/api/core'
```

然后通过它访问：

- `path_exists`
- `read_file_absolute`
- `write_file_absolute`

这在 Tauri WebView 前端环境中没问题，但 **Todo MCP server 运行在 Node 子进程中，不是浏览器，不是 WebView**。

所以本质错误是：

- **把前端/Tauri API 带进了 Node MCP 运行时**

这就是为什么报 `window is not defined`。

### 9.3 正确修复方式

修复时没有重写仓储层，而是只替换了 `todoMcpServer.ts` 的文件访问实现：

- 移除 `@tauri-apps/api/core`
- 改用 `node:fs/promises`
- 改用 `node:path`
- `writeFile` 前自动创建父目录

这样就把 Todo MCP server 变成了一个真正的 **纯 Node MCP server**。

### 9.4 这个经验对后续开发非常重要

以后只要是给 Claude CLI 跑的 MCP server，都要牢记：

> **MCP server 的运行时是独立进程，不要默认它能访问前端环境、Tauri WebView API、浏览器对象或 React 上下文。**

换句话说：

- 能在前端跑，不代表能在 MCP server 里跑
- 能在 Tauri 页面里跑，不代表能在 Node MCP 进程里跑

---

## 10. 当前 Todo MCP 的实现原则

当前方案里，有几个原则后续应该继续保持。

### 10.1 工作区隔离优先

配置文件放在：

```text
<workspace>/.polaris/claude/mcp.json
```

数据文件放在：

```text
<workspace>/.polaris/todos.json
```

这意味着每个工作区：

- 配置独立
- 数据独立
- 工具上下文独立

这非常适合 Polaris 多开场景。

### 10.2 能力实现与接入链解耦

分层如下：

- `todoRepository.ts`：数据逻辑
- `todoMcpServer.ts`：工具暴露
- `todoMcpServerCli.ts`：进程入口
- `build-mcp.mjs`：构建
- `mcp_config_service.rs`：配置生成
- `chat.rs` / `claude.rs`：会话接入

这种分层的好处是：

- 后续接 scheduler 时可以复用同一条接入链
- 后续接 requirements 时也不用重写 Claude 集成逻辑
- 只要新增自己的 server / cli / config，就能接进同样框架

### 10.3 Prompt 只负责引导，不负责承载能力

当前 `workspaceReference.ts` 里的系统提示词已经做了调整：

- 告诉模型优先使用 MCP 待办工具
- 告诉模型查看待办优先 `list_todos`
- 不再鼓励直接读写 `.polaris/todos.json`

这说明 prompt 现在的职责变成了：

- **教模型优先使用正确工具**

而不是：

- **让模型自己扮演工具**

这个角色变化非常重要。

---

## 11. 后续要开发其他 MCP，推荐的标准流程

如果以后要继续开发：

- Scheduler MCP
- Requirements MCP
- Protocol MCP
- Git 分析 MCP
- Workspace Index MCP

建议统一按照下面的模板来。

### 第一步：先确定“能力边界”

先问自己：

- 这是一个工具集合，还是一个 prompt 规则？
- 是否需要结构化参数？
- 是否需要标准化返回？
- 是否需要工作区隔离？

如果答案是“需要结构化工具”，优先做 MCP。

### 第二步：先写仓储/服务层，不要先写 MCP

建议先实现纯业务层，例如：

- `schedulerRepository.ts`
- `requirementsRepository.ts`
- `protocolRepository.ts`

要求：

- 不依赖 UI
- 不依赖 prompt
- 不依赖 Tauri 页面运行时
- 最好通过接口抽象底层文件访问/存储访问

### 第三步：再用 MCP server 包装业务层

例如：

- `schedulerMcpServer.ts`
- `requirementsMcpServer.ts`

这里只做：

- schema 定义
- 参数映射
- 业务调用
- 返回格式整理

### 第四步：提供 CLI 入口

例如：

- `schedulerMcpServerCli.ts`
- `requirementsMcpServerCli.ts`

Claude 启动的不是你的 TS 模块，而是一个 Node 入口进程。

### 第五步：加入构建脚本

你可以：

- 为每个 server 单独打包
- 或者做一个统一多入口构建脚本

但原则不变：

- 最终要给 Claude 一个可执行产物
- 不要让 Claude 直接跑源代码

### 第六步：在 Rust 侧生成 workspace 配置

扩展 `mcp_config_service.rs`：

- 一个 workspace 可注册多个 server
- 每个 server 对应自己的 command/args
- 后续可做 profile/catalog

比如最终可能变成：

```json
{
  "mcpServers": {
    "polaris-todo": { ... },
    "polaris-scheduler": { ... },
    "polaris-requirements": { ... }
  }
}
```

### 第七步：在 prompt 里只保留“工具使用引导”

例如：

- 查看待办优先 `list_todos`
- 创建定时任务优先 `create_schedule`
- 查看需求优先 `list_requirements`

不要把具体文件协议继续塞进 prompt。

---

## 12. 一个推荐的未来演进方向

当前 Todo MCP 已经证明这条路是可行的。后续推荐演进为：

### 12.1 单能力单 server，还是统一 Polaris MCP

短期 MVP：

- 每种能力一个独立 server
- 结构清晰，易调试

后期统一化：

- 做一个 `polaris-workspace-mcp`
- 内部注册 todo / scheduler / requirements / protocols 等全部工具

什么时候适合统一：

- 能力数量开始变多
- 希望减少多个 Node 子进程
- 希望共享更多工作区上下文

什么时候适合保持拆分：

- 能力还在快速演化
- 不同能力边界还不稳定
- 需要单独调试与灰度发布

当前阶段，**先拆分是更稳妥的**。

### 12.2 可以考虑引入 profile/catalog

等 Todo、Scheduler、Requirements 都稳定后，可以把前端的：

```ts
enableMcpTools: true
```

升级为更明确的配置，例如：

- `mcpProfile: "workspace-basic"`
- `mcpProfile: "workspace-full"`

这样可以控制：

- 本次会话开放哪些能力
- 不同工作区开放不同工具集
- 调试模式与生产模式使用不同 MCP 组合

---

## 13. 当前方案的优点与局限

### 优点

1. **不再依赖 prompt 伪装工具**
2. **工作区隔离明确**
3. **多开 Polaris 不互相污染**
4. **Claude 工具调用可观察、可调试**
5. **后续扩展 scheduler / requirements 有统一路径**
6. **能力层与接入层解耦**

### 局限

1. 仍然需要先构建 MCP 产物
2. Node 运行时与前端运行时必须严格隔离
3. 当前主要是 workspace 级本地文件存储，还不是统一服务化后端
4. 后续如果 MCP server 变多，需要考虑：
   - 配置管理
   - 构建管理
   - 启动性能
   - 多 server 调试体验

但这些局限都属于可控范围，远比继续堆 prompt 更健康。

---

## 14. 给后续开发者的结论

如果只记住一句话，那就是：

> **在 Polaris 里，Claude Code 的扩展能力应该优先做成 workspace-scoped MCP 工具，而不是继续通过系统提示词让模型直接操作底层文件。**

如果再补一句，就是：

> **MCP server 必须按独立运行时来设计，避免混入前端/Tauri WebView 依赖。**

当前 Todo MCP 的落地已经把整条链跑通了：

- 业务层：`todoRepository.ts`
- 工具层：`todoMcpServer.ts`
- CLI 层：`todoMcpServerCli.ts`
- 构建层：`build-mcp.mjs`
- 配置层：`mcp_config_service.rs`
- 接入层：`chat.rs` → `traits.rs` → `claude.rs`
- 引导层：`workspaceReference.ts`

后续新增任何 MCP，基本都可以沿着这条链复制实现。

---

## 15. 一份最简开发清单

后续开发新的 Polaris MCP 时，可直接按这个 checklist：

- [ ] 明确能力边界与工具清单
- [ ] 先写纯业务/仓储层
- [ ] 定义 MCP server 与工具 schema
- [ ] 提供 Node CLI 入口
- [ ] 加入构建脚本并输出到稳定路径
- [ ] 在 Rust 侧把 server 写入 workspace MCP 配置
- [ ] 在 Claude 会话启动链里透传 `--mcp-config`
- [ ] 在 prompt 中只保留“优先使用工具”的引导
- [ ] 做 Node 运行时验证，不要只做前端验证
- [ ] 做工作区切换验证，确认不会互相污染

这就是当前 Polaris × Claude Code × MCP 的核心实现方法。
